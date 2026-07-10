import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';

async function getVillageLocation(pool, villagePolygonId) {
    if (!villagePolygonId) return null;

    const [rows] = await pool.query(
        `SELECT id, distname, subdistnam, moo, villname
         FROM satun_village_polygon
         WHERE id = ?
         LIMIT 1`,
        [villagePolygonId]
    );

    return rows[0] || null;
}

function buildManualVillageSourceKey({ sessionId, reportDate, diseaseName, villagePolygonId, districtName, tambonName, moo }) {
    const locationKey = villagePolygonId || [districtName, tambonName, moo].filter(Boolean).join('|');
    return `manual-village:${sessionId}:${reportDate}:${diseaseName}:${locationKey}`;
}

// GET - ดึงรายงานโรครายวัน
export async function GET(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const pool = await getConnection();
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date'); // YYYY-MM-DD
        const sessionId = searchParams.get('session_id');
        const facilityId = searchParams.get('facility_id');
        const disease = searchParams.get('disease');
        const district = searchParams.get('district');
        const tambon = searchParams.get('tambon');
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');

        let query = `
            SELECT 
                dr.*,
                hf.name as facility_name,
                COALESCE(dr.district_name, hf.district_name) as district_name,
                COALESCE(dr.tambon_name, hf.tambon) as tambon_name,
                hf.tambon,
                CONCAT(o.given_name, ' ', o.family_name) as reported_by_name
            FROM disease_reports dr
            LEFT JOIN health_facilities hf ON dr.health_facility_id = hf.id
            LEFT JOIN officer o ON dr.reported_by = o.id
            WHERE 1=1
        `;
        const params = [];

        if (sessionId) {
            query += ` AND dr.session_id = ?`;
            params.push(sessionId);
        }

        if (date) {
            query += ` AND dr.report_date = ?`;
            params.push(date);
        }

        if (facilityId) {
            query += ` AND dr.health_facility_id = ?`;
            params.push(facilityId);
        }

        if (disease) {
            query += ` AND dr.disease_name LIKE ?`;
            params.push(`%${disease}%`);
        }

        if (district && district !== 'all') {
            query += ` AND COALESCE(dr.district_name, hf.district_name) = ?`;
            params.push(district);
        }

        if (tambon && tambon !== 'all') {
            query += ` AND COALESCE(dr.tambon_name, hf.tambon) = ?`;
            params.push(tambon);
        }

        if (startDate && endDate) {
            query += ` AND dr.report_date BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        query += ` ORDER BY dr.report_date DESC, district_name, tambon_name, CAST(dr.moo AS UNSIGNED), dr.village_name, hf.name`;

        const [reports] = await pool.query(query, params);

        // สรุปข้อมูลตามอำเภอ (วันนี้) - กรอง session_id ถ้ามี
        const today = new Date().toISOString().split('T')[0];
        let todaySummaryQuery = `
            SELECT 
                COALESCE(dr.district_name, hf.district_name) as district_name,
                dr.disease_name,
                SUM(dr.patient_count) as today_patients,
                COUNT(DISTINCT COALESCE(
                    CONCAT('hf:', dr.health_facility_id),
                    CONCAT('v:', dr.village_polygon_id),
                    CONCAT('area:', dr.district_name, '|', dr.tambon_name, '|', dr.moo)
                )) as facilities_count
            FROM disease_reports dr
            LEFT JOIN health_facilities hf ON dr.health_facility_id = hf.id
            WHERE dr.report_date = ?
        `;
        const todayParams = [today];

        if (sessionId) {
            todaySummaryQuery += ` AND dr.session_id = ?`;
            todayParams.push(sessionId);
        }

        todaySummaryQuery += `
            GROUP BY COALESCE(dr.district_name, hf.district_name), dr.disease_name
            ORDER BY district_name, today_patients DESC
        `;

        const [todaySummary] = await pool.query(todaySummaryQuery, todayParams);

        // สรุปข้อมูลสะสม - กรอง session_id ถ้ามี
        let cumulativeQuery = `
            SELECT 
                COALESCE(dr.district_name, hf.district_name) as district_name,
                dr.disease_name,
                SUM(dr.patient_count) as cumulative_patients,
                COUNT(DISTINCT dr.report_date) as report_days,
                MAX(dr.report_date) as last_report_date
            FROM disease_reports dr
            LEFT JOIN health_facilities hf ON dr.health_facility_id = hf.id
            WHERE 1=1
        `;
        const cumulativeParams = [];

        if (sessionId) {
            cumulativeQuery += ` AND dr.session_id = ?`;
            cumulativeParams.push(sessionId);
        }

        cumulativeQuery += `
            GROUP BY COALESCE(dr.district_name, hf.district_name), dr.disease_name
            ORDER BY district_name, cumulative_patients DESC
        `;

        const [cumulativeSummary] = await pool.query(cumulativeQuery, cumulativeParams);

        // สรุปรายโรค - กรอง session_id ถ้ามี
        let diseaseSummaryQuery = `
            SELECT 
                dr.disease_name,
                SUM(CASE WHEN dr.report_date = ? THEN dr.patient_count ELSE 0 END) as today_total,
                SUM(dr.patient_count) as cumulative_total,
                COUNT(DISTINCT COALESCE(
                    CONCAT('hf:', dr.health_facility_id),
                    CONCAT('v:', dr.village_polygon_id),
                    CONCAT('area:', dr.district_name, '|', dr.tambon_name, '|', dr.moo)
                )) as facilities_count
            FROM disease_reports dr
            WHERE 1=1
        `;
        const diseaseParams = [today];

        if (sessionId) {
            diseaseSummaryQuery += ` AND dr.session_id = ?`;
            diseaseParams.push(sessionId);
        }

        diseaseSummaryQuery += `
            GROUP BY dr.disease_name
            ORDER BY cumulative_total DESC
        `;

        const [diseaseSummary] = await pool.query(diseaseSummaryQuery, diseaseParams);

        // ดึงรายการโรคทั้งหมดที่เคยบันทึก (สำหรับ dropdown) - กรอง session_id ถ้ามี
        let diseaseListQuery = `
            SELECT DISTINCT disease_name 
            FROM disease_reports
            WHERE 1=1
        `;
        const diseaseListParams = [];

        if (sessionId) {
            diseaseListQuery += ` AND session_id = ?`;
            diseaseListParams.push(sessionId);
        }

        diseaseListQuery += ` ORDER BY disease_name`;

        const [diseaseList] = await pool.query(diseaseListQuery, diseaseListParams);

        return NextResponse.json({
            success: true,
            data: Array.isArray(reports) ? reports : [],
            diseaseList: Array.isArray(diseaseList) ? diseaseList.map(d => d.disease_name) : [],
            summary: {
                today: Array.isArray(todaySummary) ? todaySummary : [],
                cumulative: Array.isArray(cumulativeSummary) ? cumulativeSummary : [],
                byDisease: Array.isArray(diseaseSummary) ? diseaseSummary : []
            }
        });
    } catch (error) {
        console.error('Get disease reports error:', error);
        return NextResponse.json({
            success: false,
            message: error.code === 'ER_NO_SUCH_TABLE'
                ? 'ยังไม่ได้สร้างตารางในฐานข้อมูล กรุณารัน SQL ก่อน'
                : 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            data: [],
            summary: { today: [], cumulative: [], byDisease: [] }
        });
    }
}

// POST - บันทึกรายงานโรค
export async function POST(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT']);
        if (!auth.success) return auth.response;

        const pool = await getConnection();
        const body = await request.json();
        const {
            session_id,
            report_date,
            health_facility_id,
            village_polygon_id,
            district_name,
            tambon_name,
            moo,
            village_name,
            disease_name,
            patient_count,
            notes,
        } = body;

        const village = await getVillageLocation(pool, village_polygon_id);
        const finalDistrictName = village?.distname || district_name || null;
        const finalTambonName = village?.subdistnam || tambon_name || null;
        const finalMoo = village?.moo || moo || null;
        const finalVillageName = village?.villname || village_name || null;
        const finalVillagePolygonId = village?.id || village_polygon_id || null;
        const finalHealthFacilityId = health_facility_id || null;
        const sourceKey = finalHealthFacilityId
            ? null
            : buildManualVillageSourceKey({
                sessionId: session_id,
                reportDate: report_date,
                diseaseName: disease_name,
                villagePolygonId: finalVillagePolygonId,
                districtName: finalDistrictName,
                tambonName: finalTambonName,
                moo: finalMoo
            });

        // Validation
        if (!session_id || !report_date || !disease_name || patient_count === undefined || patient_count === null) {
            console.error('Validation failed:', { session_id, report_date, disease_name, patient_count });
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (รวมถึง session_id)' },
                { status: 400 }
            );
        }

        if (!finalHealthFacilityId && (!finalDistrictName || !finalTambonName || !finalMoo)) {
            return NextResponse.json(
                { success: false, message: 'กรุณาเลือกพื้นที่ระดับหมู่บ้าน หรือเลือกหน่วยบริการ' },
                { status: 400 }
            );
        }

        // อนุญาตให้กรอกค่าลบได้สำหรับกรณีลดจำนวนผู้ป่วย

        const [result] = await pool.query(
            `INSERT INTO disease_reports 
            (session_id, report_date, health_facility_id, village_polygon_id, disease_name,
             district_name, tambon_name, moo, village_name, patient_count, notes, reported_by, source_key, import_source) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                village_polygon_id = VALUES(village_polygon_id),
                district_name = VALUES(district_name),
                tambon_name = VALUES(tambon_name),
                moo = VALUES(moo),
                village_name = VALUES(village_name),
                patient_count = VALUES(patient_count),
                notes = VALUES(notes),
                reported_by = VALUES(reported_by),
                import_source = VALUES(import_source),
                updated_at = CURRENT_TIMESTAMP`,
            [
                session_id,
                report_date,
                finalHealthFacilityId,
                finalVillagePolygonId,
                disease_name,
                finalDistrictName,
                finalTambonName,
                finalMoo,
                finalVillageName,
                patient_count,
                notes || null,
                auth.user.id,
                sourceKey,
                finalHealthFacilityId ? null : 'Manual village-level entry'
            ]
        );

        return NextResponse.json({
            success: true,
            message: 'บันทึกข้อมูลสำเร็จ',
            id: result.insertId
        });
    } catch (error) {
        console.error('Create disease report error:', error);

        let errorMessage = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';

        if (error.code === 'ER_DUP_ENTRY') {
            errorMessage = 'มีข้อมูลรายงานนี้อยู่แล้วในวันเดียวกัน';
        } else if (error.code === 'ER_NO_REFERENCED_ROW' || error.code === 'ER_NO_REFERENCED_ROW_2') {
            errorMessage = 'ไม่พบหน่วยบริการที่เลือก';
        } else if (error.code === 'ER_NO_SUCH_TABLE') {
            errorMessage = 'ยังไม่ได้สร้างตาราง disease_reports ในฐานข้อมูล กรุณารัน SQL script ก่อน';
        } else if (error.message?.includes('Table')) {
            errorMessage = 'ตารางในฐานข้อมูลมีปัญหา';
        }

        return NextResponse.json(
            { success: false, message: errorMessage },
            { status: 500 }
        );
    }
}

// PUT - แก้ไขรายงานโรค
export async function PUT(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT']);
        if (!auth.success) return auth.response;

        const pool = await getConnection();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ ID' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const {
            session_id,
            report_date,
            health_facility_id,
            village_polygon_id,
            district_name,
            tambon_name,
            moo,
            village_name,
            disease_name,
            patient_count,
            notes
        } = body;

        const village = await getVillageLocation(pool, village_polygon_id);
        const finalDistrictName = village?.distname || district_name || null;
        const finalTambonName = village?.subdistnam || tambon_name || null;
        const finalMoo = village?.moo || moo || null;
        const finalVillageName = village?.villname || village_name || null;
        const finalVillagePolygonId = village?.id || village_polygon_id || null;
        const finalHealthFacilityId = health_facility_id || null;

        if (!session_id || !report_date || !disease_name || patient_count === undefined) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (รวมถึง session_id)' },
                { status: 400 }
            );
        }

        if (!finalHealthFacilityId && (!finalDistrictName || !finalTambonName || !finalMoo)) {
            return NextResponse.json(
                { success: false, message: 'กรุณาเลือกพื้นที่ระดับหมู่บ้าน หรือเลือกหน่วยบริการ' },
                { status: 400 }
            );
        }

        await pool.query(
            `UPDATE disease_reports 
            SET session_id = ?, report_date = ?, health_facility_id = ?, village_polygon_id = ?,
                disease_name = ?, district_name = ?, tambon_name = ?, moo = ?, village_name = ?,
                patient_count = ?, notes = ?
            WHERE id = ?`,
            [
                session_id,
                report_date,
                finalHealthFacilityId,
                finalVillagePolygonId,
                disease_name,
                finalDistrictName,
                finalTambonName,
                finalMoo,
                finalVillageName,
                patient_count,
                notes || null,
                id
            ]
        );

        return NextResponse.json({
            success: true,
            message: 'แก้ไขข้อมูลสำเร็จ'
        });
    } catch (error) {
        console.error('Update disease report error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการแก้ไขข้อมูล');
    }
}

// DELETE - ลบรายงานโรค
export async function DELETE(request) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const pool = await getConnection();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ ID' },
                { status: 400 }
            );
        }

        await pool.query('DELETE FROM disease_reports WHERE id = ?', [id]);

        return NextResponse.json({
            success: true,
            message: 'ลบข้อมูลสำเร็จ'
        });
    } catch (error) {
        console.error('Delete disease report error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
}
