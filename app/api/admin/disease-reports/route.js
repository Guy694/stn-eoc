import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

// GET - ดึงรายงานโรครายวัน
export async function GET(request) {
    try {
        const pool = await getConnection();
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date'); // YYYY-MM-DD
        const sessionId = searchParams.get('session_id');
        const facilityId = searchParams.get('facility_id');
        const disease = searchParams.get('disease');
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');

        let query = `
            SELECT 
                dr.*,
                hf.name as facility_name,
                hf.district_name,
                hf.tambon,
                CONCAT(o.given_name, ' ', o.family_name) as reported_by_name
            FROM disease_reports dr
            JOIN health_facilities hf ON dr.health_facility_id = hf.id
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

        if (startDate && endDate) {
            query += ` AND dr.report_date BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        query += ` ORDER BY dr.report_date DESC, hf.district_name, hf.name`;

        const [reports] = await pool.query(query, params);

        // สรุปข้อมูลตามอำเภอ (วันนี้) - กรอง session_id ถ้ามี
        const today = new Date().toISOString().split('T')[0];
        let todaySummaryQuery = `
            SELECT 
                hf.district_name,
                dr.disease_name,
                SUM(dr.patient_count) as today_patients,
                COUNT(DISTINCT dr.health_facility_id) as facilities_count
            FROM disease_reports dr
            JOIN health_facilities hf ON dr.health_facility_id = hf.id
            WHERE dr.report_date = ?
        `;
        const todayParams = [today];

        if (sessionId) {
            todaySummaryQuery += ` AND dr.session_id = ?`;
            todayParams.push(sessionId);
        }

        todaySummaryQuery += `
            GROUP BY hf.district_name, dr.disease_name
            ORDER BY hf.district_name, today_patients DESC
        `;

        const [todaySummary] = await pool.query(todaySummaryQuery, todayParams);

        // สรุปข้อมูลสะสม - กรอง session_id ถ้ามี
        let cumulativeQuery = `
            SELECT 
                hf.district_name,
                dr.disease_name,
                SUM(dr.patient_count) as cumulative_patients,
                COUNT(DISTINCT dr.report_date) as report_days,
                MAX(dr.report_date) as last_report_date
            FROM disease_reports dr
            JOIN health_facilities hf ON dr.health_facility_id = hf.id
            WHERE 1=1
        `;
        const cumulativeParams = [];

        if (sessionId) {
            cumulativeQuery += ` AND dr.session_id = ?`;
            cumulativeParams.push(sessionId);
        }

        cumulativeQuery += `
            GROUP BY hf.district_name, dr.disease_name
            ORDER BY hf.district_name, cumulative_patients DESC
        `;

        const [cumulativeSummary] = await pool.query(cumulativeQuery, cumulativeParams);

        // สรุปรายโรค - กรอง session_id ถ้ามี
        let diseaseSummaryQuery = `
            SELECT 
                dr.disease_name,
                SUM(CASE WHEN dr.report_date = ? THEN dr.patient_count ELSE 0 END) as today_total,
                SUM(dr.patient_count) as cumulative_total,
                COUNT(DISTINCT dr.health_facility_id) as facilities_count
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
            message: error.message.includes('Table')
                ? 'ยังไม่ได้สร้างตารางในฐานข้อมูล กรุณารัน SQL ก่อน'
                : 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message,
            data: [],
            summary: { today: [], cumulative: [], byDisease: [] }
        });
    }
}

// POST - บันทึกรายงานโรค
export async function POST(request) {
    try {
        const pool = await getConnection();
        const body = await request.json();
        const {
            session_id,
            report_date,
            health_facility_id,
            disease_name,
            patient_count,
            notes,
            reported_by
        } = body;

        console.log('Received data:', body);

        // Validation
        if (!session_id || !report_date || !health_facility_id || !disease_name || patient_count === undefined || patient_count === null) {
            console.error('Validation failed:', { session_id, report_date, health_facility_id, disease_name, patient_count });
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (รวมถึง session_id)' },
                { status: 400 }
            );
        }

        // อนุญาตให้กรอกค่าลบได้สำหรับกรณีลดจำนวนผู้ป่วย

        console.log('Executing INSERT query with:', [session_id, report_date, health_facility_id, disease_name, patient_count, notes || null, reported_by || 1]);

        const [result] = await pool.query(
            `INSERT INTO disease_reports 
            (session_id, report_date, health_facility_id, disease_name, patient_count, notes, reported_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                patient_count = VALUES(patient_count),
                notes = VALUES(notes),
                reported_by = VALUES(reported_by),
                updated_at = CURRENT_TIMESTAMP`,
            [session_id, report_date, health_facility_id, disease_name, patient_count, notes || null, reported_by || 1]
        );

        return NextResponse.json({
            success: true,
            message: 'บันทึกข้อมูลสำเร็จ',
            id: result.insertId
        });
    } catch (error) {
        console.error('Create disease report error:', error);
        console.error('Error code:', error.code);
        console.error('Error errno:', error.errno);
        console.error('Error sqlMessage:', error.sqlMessage);
        console.error('Error sqlState:', error.sqlState);
        console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

        let errorMessage = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';

        if (error.code === 'ER_DUP_ENTRY') {
            errorMessage = 'มีข้อมูลรายงานนี้อยู่แล้วในวันเดียวกัน';
        } else if (error.code === 'ER_NO_REFERENCED_ROW' || error.code === 'ER_NO_REFERENCED_ROW_2') {
            errorMessage = 'ไม่พบหน่วยบริการที่เลือก (ID: ' + error.sqlMessage?.match(/\d+/)?.[0] + ')';
        } else if (error.code === 'ER_NO_SUCH_TABLE') {
            errorMessage = 'ยังไม่ได้สร้างตาราง disease_reports ในฐานข้อมูล กรุณารัน SQL script ก่อน';
        } else if (error.message?.includes('Table')) {
            errorMessage = 'ตารางในฐานข้อมูลมีปัญหา: ' + error.message;
        }

        return NextResponse.json(
            {
                success: false,
                message: errorMessage,
                error: error.sqlMessage || error.message,
                code: error.code,
                errno: error.errno,
                details: process.env.NODE_ENV === 'development' ? {
                    sqlState: error.sqlState,
                    sql: error.sql
                } : undefined
            },
            { status: 500 }
        );
    }
}

// PUT - แก้ไขรายงานโรค
export async function PUT(request) {
    try {
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
            disease_name,
            patient_count,
            notes
        } = body;

        if (!session_id || !report_date || !health_facility_id || !disease_name || patient_count === undefined) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (รวมถึง session_id)' },
                { status: 400 }
            );
        }

        await pool.query(
            `UPDATE disease_reports 
            SET session_id = ?, report_date = ?, health_facility_id = ?, disease_name = ?, 
                patient_count = ?, notes = ?
            WHERE id = ?`,
            [session_id, report_date, health_facility_id, disease_name, patient_count, notes || null, id]
        );

        return NextResponse.json({
            success: true,
            message: 'แก้ไขข้อมูลสำเร็จ'
        });
    } catch (error) {
        console.error('Update disease report error:', error);
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล', error: error.message },
            { status: 500 }
        );
    }
}

// DELETE - ลบรายงานโรค
export async function DELETE(request) {
    try {
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
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาดในการลบข้อมูล', error: error.message },
            { status: 500 }
        );
    }
}
