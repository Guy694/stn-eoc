import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { OFFICER_ROLES, requireAuth } from '@/lib/auth';
import { modulePermissions, requireModuleEdit } from '@/lib/eocModuleAccess';
import { publicInternalError } from '@/lib/apiResponse';

const IMPACT_FIELDS = [
    'citizen_property',
    'citizen_injured',
    'citizen_deaths',
    'citizen_missing',
    'volunteer_property',
    'volunteer_injured',
    'volunteer_deaths',
    'volunteer_missing',
    'staff_property',
    'staff_injured',
    'staff_deaths',
    'staff_missing',
    'medicine_support',
    'evacuated',
    'not_evacuated',
];

function toCount(value) {
    const number = parseInt(value);
    return Number.isFinite(number) ? number : 0;
}

function hasDetailedImpact(body) {
    return IMPACT_FIELDS.some(field => body[field] !== undefined && body[field] !== null && body[field] !== '');
}

function buildImpactValues(body) {
    const values = IMPACT_FIELDS.reduce((acc, field) => {
        acc[field] = toCount(body[field]);
        return acc;
    }, {});
    const hasDetails = hasDetailedImpact(body);

    return {
        ...values,
        deaths: hasDetails
            ? values.citizen_deaths + values.volunteer_deaths + values.staff_deaths
            : toCount(body.deaths),
        missing: hasDetails
            ? values.citizen_missing + values.volunteer_missing + values.staff_missing
            : toCount(body.missing),
        injured: hasDetails
            ? values.citizen_injured + values.volunteer_injured + values.staff_injured
            : toCount(body.injured),
        affected: hasDetails
            ? values.citizen_property + values.volunteer_property + values.staff_property
            : toCount(body.affected),
    };
}

// GET - ดึงรายงานผู้ได้รับผลกระทบ
export async function GET(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SEhRT', 'staff']);
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

        // สรุปข้อมูลรายวันตามวันที่ที่เลือกในหน้า
        const summaryDate = date || endDate || new Date().toISOString().split('T')[0];
        let todaySummaryQuery = `
            SELECT 
                district_name,
                SUM(deaths) as today_deaths,
                SUM(missing) as today_missing,
                SUM(injured) as today_injured,
                SUM(affected) as today_affected,
                SUM(citizen_property) as today_citizen_property,
                SUM(citizen_injured) as today_citizen_injured,
                SUM(citizen_deaths) as today_citizen_deaths,
                SUM(citizen_missing) as today_citizen_missing,
                SUM(volunteer_property) as today_volunteer_property,
                SUM(volunteer_injured) as today_volunteer_injured,
                SUM(volunteer_deaths) as today_volunteer_deaths,
                SUM(volunteer_missing) as today_volunteer_missing,
                SUM(staff_property) as today_staff_property,
                SUM(staff_injured) as today_staff_injured,
                SUM(staff_deaths) as today_staff_deaths,
                SUM(staff_missing) as today_staff_missing,
                SUM(medicine_support) as today_medicine_support,
                SUM(evacuated) as today_evacuated,
                SUM(not_evacuated) as today_not_evacuated,
                COUNT(DISTINCT tambon) as tambon_count
            FROM affected_persons
            WHERE report_date = ?
        `;
        const todayParams = [summaryDate];

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
                SUM(citizen_property) as cumulative_citizen_property,
                SUM(citizen_injured) as cumulative_citizen_injured,
                SUM(citizen_deaths) as cumulative_citizen_deaths,
                SUM(citizen_missing) as cumulative_citizen_missing,
                SUM(volunteer_property) as cumulative_volunteer_property,
                SUM(volunteer_injured) as cumulative_volunteer_injured,
                SUM(volunteer_deaths) as cumulative_volunteer_deaths,
                SUM(volunteer_missing) as cumulative_volunteer_missing,
                SUM(staff_property) as cumulative_staff_property,
                SUM(staff_injured) as cumulative_staff_injured,
                SUM(staff_deaths) as cumulative_staff_deaths,
                SUM(staff_missing) as cumulative_staff_missing,
                SUM(medicine_support) as cumulative_medicine_support,
                SUM(evacuated) as cumulative_evacuated,
                SUM(not_evacuated) as cumulative_not_evacuated,
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

        if (date) {
            cumulativeQuery += ` AND report_date = ?`;
            cumulativeParams.push(date);
        }

        if (startDate && endDate) {
            cumulativeQuery += ` AND report_date BETWEEN ? AND ?`;
            cumulativeParams.push(startDate, endDate);
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
                SUM(citizen_property) as province_citizen_property,
                SUM(citizen_injured) as province_citizen_injured,
                SUM(citizen_deaths) as province_citizen_deaths,
                SUM(citizen_missing) as province_citizen_missing,
                SUM(volunteer_property) as province_volunteer_property,
                SUM(volunteer_injured) as province_volunteer_injured,
                SUM(volunteer_deaths) as province_volunteer_deaths,
                SUM(volunteer_missing) as province_volunteer_missing,
                SUM(staff_property) as province_staff_property,
                SUM(staff_injured) as province_staff_injured,
                SUM(staff_deaths) as province_staff_deaths,
                SUM(staff_missing) as province_staff_missing,
                SUM(medicine_support) as province_medicine_support,
                SUM(evacuated) as province_evacuated,
                SUM(not_evacuated) as province_not_evacuated,
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

        if (startDate && endDate) {
            provinceSummaryQuery += ` AND report_date BETWEEN ? AND ?`;
            provinceParams.push(startDate, endDate);
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
            permissions: await modulePermissions(auth.user, sessionId, 'affected'),
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
        // บันทึกได้เฉพาะทีมเจ้าของเมนู (SAT) ในเหตุการณ์นั้น — ตรวจด้านล่างด้วย requireModuleEdit
        const auth = await requireAuth(request, OFFICER_ROLES);
        if (!auth.success) return auth.response;

        const pool = await getConnection();
        const body = await request.json();
        const {
            session_id,
            report_date,
            district_name,
            tambon,
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

        const gate = await requireModuleEdit(auth.user, session_id, 'affected');
        if (gate.response) return gate.response;

        // ตรวจสอบจำนวนไม่เป็นลบ
        const impact = buildImpactValues(body);

        if (Object.values(impact).some(value => value < 0)) {
            return NextResponse.json(
                { success: false, message: 'จำนวนผู้ได้รับผลกระทบต้องเป็นจำนวนบวก' },
                { status: 400 }
            );
        }

        const [result] = await pool.query(
            `INSERT INTO affected_persons 
            (session_id, report_date, district_name, tambon,
             citizen_property, citizen_injured, citizen_deaths, citizen_missing,
             volunteer_property, volunteer_injured, volunteer_deaths, volunteer_missing,
             staff_property, staff_injured, staff_deaths, staff_missing,
             deaths, missing, injured, affected, medicine_support, evacuated, not_evacuated,
             notes, reported_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                citizen_property = VALUES(citizen_property),
                citizen_injured = VALUES(citizen_injured),
                citizen_deaths = VALUES(citizen_deaths),
                citizen_missing = VALUES(citizen_missing),
                volunteer_property = VALUES(volunteer_property),
                volunteer_injured = VALUES(volunteer_injured),
                volunteer_deaths = VALUES(volunteer_deaths),
                volunteer_missing = VALUES(volunteer_missing),
                staff_property = VALUES(staff_property),
                staff_injured = VALUES(staff_injured),
                staff_deaths = VALUES(staff_deaths),
                staff_missing = VALUES(staff_missing),
                deaths = VALUES(deaths),
                missing = VALUES(missing),
                injured = VALUES(injured),
                affected = VALUES(affected),
                medicine_support = VALUES(medicine_support),
                evacuated = VALUES(evacuated),
                not_evacuated = VALUES(not_evacuated),
                notes = VALUES(notes),
                reported_by = VALUES(reported_by),
                updated_at = CURRENT_TIMESTAMP`,
            [
                session_id, report_date, district_name, tambon || null,
                impact.citizen_property, impact.citizen_injured, impact.citizen_deaths, impact.citizen_missing,
                impact.volunteer_property, impact.volunteer_injured, impact.volunteer_deaths, impact.volunteer_missing,
                impact.staff_property, impact.staff_injured, impact.staff_deaths, impact.staff_missing,
                impact.deaths, impact.missing, impact.injured, impact.affected,
                impact.medicine_support, impact.evacuated, impact.not_evacuated,
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
            errorMessage = 'ไม่พบเหตุการณ์ EOC ที่เลือก';
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
        // บันทึกได้เฉพาะทีมเจ้าของเมนู (SAT) ในเหตุการณ์นั้น — ตรวจด้านล่างด้วย requireModuleEdit
        const auth = await requireAuth(request, OFFICER_ROLES);
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
            notes
        } = body;

        if (!session_id || !report_date || !district_name) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' },
                { status: 400 }
            );
        }
        // แก้ได้เฉพาะแถวของเหตุการณ์ที่ระบุ และผู้แก้ต้องเป็นทีมเจ้าของเมนู
        const [existingRows] = await pool.query('SELECT session_id FROM affected_persons WHERE id = ?', [id]);
        if (!existingRows.length || Number(existingRows[0].session_id) !== Number(session_id)) {
            return NextResponse.json({ success: false, message: 'ไม่พบข้อมูลนี้ในเหตุการณ์ที่เลือก' }, { status: 404 });
        }
        const gate = await requireModuleEdit(auth.user, session_id, 'affected');
        if (gate.response) return gate.response;

        const impact = buildImpactValues(body);

        await pool.query(
            `UPDATE affected_persons 
            SET session_id = ?, report_date = ?, district_name = ?, tambon = ?, 
                citizen_property = ?, citizen_injured = ?, citizen_deaths = ?, citizen_missing = ?,
                volunteer_property = ?, volunteer_injured = ?, volunteer_deaths = ?, volunteer_missing = ?,
                staff_property = ?, staff_injured = ?, staff_deaths = ?, staff_missing = ?,
                deaths = ?, missing = ?, injured = ?, affected = ?,
                medicine_support = ?, evacuated = ?, not_evacuated = ?,
                notes = ?
            WHERE id = ?`,
            [
                session_id, report_date, district_name, tambon || null,
                impact.citizen_property, impact.citizen_injured, impact.citizen_deaths, impact.citizen_missing,
                impact.volunteer_property, impact.volunteer_injured, impact.volunteer_deaths, impact.volunteer_missing,
                impact.staff_property, impact.staff_injured, impact.staff_deaths, impact.staff_missing,
                impact.deaths, impact.missing, impact.injured, impact.affected,
                impact.medicine_support, impact.evacuated, impact.not_evacuated,
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
