import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';

// GET - ดึงรายงานผู้ได้รับผลกระทบ
export async function GET(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const pool = await getConnection();
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date'); // YYYY-MM-DD
        const sessionId = searchParams.get('session_id');
        const district = searchParams.get('district');
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');

        let query = `
            SELECT 
                ap.*,
                CONCAT(o.given_name, ' ', o.family_name) as reported_by_name,
                es.session_number,
                es.eoc_type
            FROM affected_persons ap
            LEFT JOIN officer o ON ap.reported_by = o.id
            LEFT JOIN eoc_sessions es ON ap.session_id = es.id
            WHERE 1=1
        `;
        const params = [];

        if (sessionId) {
            query += ` AND ap.session_id = ?`;
            params.push(sessionId);
        }

        if (date) {
            query += ` AND ap.report_date = ?`;
            params.push(date);
        }

        if (district) {
            query += ` AND ap.district_name = ?`;
            params.push(district);
        }

        if (startDate && endDate) {
            query += ` AND ap.report_date BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        query += ` ORDER BY ap.report_date DESC, ap.district_name, ap.tambon`;

        const [reports] = await pool.query(query, params);

        // สรุปข้อมูลรายวัน (Today)
        const today = new Date().toISOString().split('T')[0];
        let todaySummaryQuery = `
            SELECT 
                district_name,
                SUM(deaths) as today_deaths,
                SUM(missing) as today_missing,
                SUM(injured) as today_injured,
                SUM(affected) as today_affected,
                COUNT(DISTINCT tambon) as tambon_count
            FROM affected_persons
            WHERE report_date = ?
        `;
        const todayParams = [today];

        if (sessionId) {
            todaySummaryQuery += ` AND session_id = ?`;
            todayParams.push(sessionId);
        }

        todaySummaryQuery += `
            GROUP BY district_name
            ORDER BY district_name
        `;

        const [todaySummary] = await pool.query(todaySummaryQuery, todayParams);

        // สรุปข้อมูลสะสม
        let cumulativeQuery = `
            SELECT 
                district_name,
                SUM(deaths) as cumulative_deaths,
                SUM(missing) as cumulative_missing,
                SUM(injured) as cumulative_injured,
                SUM(affected) as cumulative_affected,
                COUNT(DISTINCT report_date) as report_days,
                MAX(report_date) as last_report_date,
                COUNT(DISTINCT tambon) as tambon_count
            FROM affected_persons
            WHERE 1=1
        `;
        const cumulativeParams = [];

        if (sessionId) {
            cumulativeQuery += ` AND session_id = ?`;
            cumulativeParams.push(sessionId);
        }

        cumulativeQuery += `
            GROUP BY district_name
            ORDER BY district_name
        `;

        const [cumulativeSummary] = await pool.query(cumulativeQuery, cumulativeParams);

        // สรุปรวมจังหวัด
        let provinceSummaryQuery = `
            SELECT 
                SUM(deaths) as province_deaths,
                SUM(missing) as province_missing,
                SUM(injured) as province_injured,
                SUM(affected) as province_affected,
                COUNT(DISTINCT district_name) as district_count,
                COUNT(DISTINCT tambon) as tambon_count
            FROM affected_persons
            WHERE 1=1
        `;
        const provinceParams = [];

        if (sessionId) {
            provinceSummaryQuery += ` AND session_id = ?`;
            provinceParams.push(sessionId);
        }

        if (date) {
            provinceSummaryQuery += ` AND report_date = ?`;
            provinceParams.push(date);
        }

        const [provinceSummary] = await pool.query(provinceSummaryQuery, provinceParams);

        // ดึงรายการอำเภอทั้งหมด
        const [districts] = await pool.query(`
            SELECT DISTINCT district_name 
            FROM affected_persons 
            WHERE session_id = ? 
            ORDER BY district_name
        `, [sessionId || 0]);

        return NextResponse.json({
            success: true,
            data: Array.isArray(reports) ? reports : [],
            districts: Array.isArray(districts) ? districts.map(d => d.district_name) : [],
            summary: {
                today: Array.isArray(todaySummary) ? todaySummary : [],
                cumulative: Array.isArray(cumulativeSummary) ? cumulativeSummary : [],
                province: provinceSummary && provinceSummary.length > 0 ? provinceSummary[0] : {
                    province_deaths: 0,
                    province_missing: 0,
                    province_injured: 0,
                    province_affected: 0,
                    district_count: 0,
                    tambon_count: 0
                }
            }
        });
    } catch (error) {
        console.error('Get affected persons error:', error);
        return NextResponse.json({
            success: false,
            message: error.code === 'ER_NO_SUCH_TABLE'
                ? 'ยังไม่ได้สร้างตารางในฐานข้อมูล กรุณารัน SQL ก่อน'
                : 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            data: [],
            summary: { today: [], cumulative: [], province: {} }
        });
    }
}

// POST - บันทึกข้อมูลผู้ได้รับผลกระทบ
export async function POST(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT']);
        if (!auth.success) return auth.response;

        const pool = await getConnection();
        const body = await request.json();
        const {
            session_id,
            report_date,
            district_name,
            tambon,
            deaths,
            missing,
            injured,
            affected,
            notes,
        } = body;

        // Validation
        if (!session_id || !report_date || !district_name) {
            console.error('Validation failed:', { session_id, report_date, district_name });
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (session_id, วันที่, อำเภอ)' },
                { status: 400 }
            );
        }

        // ตรวจสอบจำนวนไม่เป็นลบ
        const deathsVal = parseInt(deaths) || 0;
        const missingVal = parseInt(missing) || 0;
        const injuredVal = parseInt(injured) || 0;
        const affectedVal = parseInt(affected) || 0;

        if (deathsVal < 0 || missingVal < 0 || injuredVal < 0 || affectedVal < 0) {
            return NextResponse.json(
                { success: false, message: 'จำนวนผู้ได้รับผลกระทบต้องเป็นจำนวนบวก' },
                { status: 400 }
            );
        }

        const [result] = await pool.query(
            `INSERT INTO affected_persons 
            (session_id, report_date, district_name, tambon, deaths, missing, injured, affected, notes, reported_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                deaths = VALUES(deaths),
                missing = VALUES(missing),
                injured = VALUES(injured),
                affected = VALUES(affected),
                notes = VALUES(notes),
                reported_by = VALUES(reported_by),
                updated_at = CURRENT_TIMESTAMP`,
            [
                session_id, report_date, district_name, tambon || null,
                deathsVal, missingVal, injuredVal, affectedVal,
                notes || null, auth.user.id
            ]
        );

        return NextResponse.json({
            success: true,
            message: 'บันทึกข้อมูลสำเร็จ',
            id: result.insertId
        });
    } catch (error) {
        console.error('Create affected persons error:', error);

        let errorMessage = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';

        if (error.code === 'ER_DUP_ENTRY') {
            errorMessage = 'มีข้อมูลรายงานนี้อยู่แล้วในวันเดียวกัน';
        } else if (error.code === 'ER_NO_REFERENCED_ROW' || error.code === 'ER_NO_REFERENCED_ROW_2') {
            errorMessage = 'ไม่พบ EOC Session ที่เลือก';
        } else if (error.code === 'ER_NO_SUCH_TABLE') {
            errorMessage = 'ยังไม่ได้สร้างตาราง affected_persons ในฐานข้อมูล กรุณารัน SQL script ก่อน';
        }

        return NextResponse.json(
            { success: false, message: errorMessage },
            { status: 500 }
        );
    }
}

// PUT - แก้ไขข้อมูลผู้ได้รับผลกระทบ
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
            district_name,
            tambon,
            deaths,
            missing,
            injured,
            affected,
            notes
        } = body;

        if (!session_id || !report_date || !district_name) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' },
                { status: 400 }
            );
        }

        const deathsVal = parseInt(deaths) || 0;
        const missingVal = parseInt(missing) || 0;
        const injuredVal = parseInt(injured) || 0;
        const affectedVal = parseInt(affected) || 0;

        await pool.query(
            `UPDATE affected_persons 
            SET session_id = ?, report_date = ?, district_name = ?, tambon = ?, 
                deaths = ?, missing = ?, injured = ?, affected = ?, notes = ?
            WHERE id = ?`,
            [
                session_id, report_date, district_name, tambon || null,
                deathsVal, missingVal, injuredVal, affectedVal,
                notes || null, id
            ]
        );

        return NextResponse.json({
            success: true,
            message: 'แก้ไขข้อมูลสำเร็จ'
        });
    } catch (error) {
        console.error('Update affected persons error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการแก้ไขข้อมูล');
    }
}

// DELETE - ลบข้อมูลผู้ได้รับผลกระทบ
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

        await pool.query('DELETE FROM affected_persons WHERE id = ?', [id]);

        return NextResponse.json({
            success: true,
            message: 'ลบข้อมูลสำเร็จ'
        });
    } catch (error) {
        console.error('Delete affected persons error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
}
