import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';

// GET - ดึงรายงานโรคในศูนย์พักพิง
export async function GET(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');
        const shelterId = searchParams.get('shelter_id');
        const reportDate = searchParams.get('report_date');
        const getDiseases = searchParams.get('get_diseases'); // ดึงรายการโรค

        const pool = await getConnection();

        // ถ้าต้องการดึงรายการโรค
        if (getDiseases === 'true') {
            const [diseases] = await pool.query(
                'SELECT * FROM common_diseases WHERE is_active = 1 ORDER BY name'
            );
            return NextResponse.json({ success: true, data: diseases });
        }

        // ดึงรายงานโรค
        let query = `
            SELECT 
                sdr.*,
                sc.sheltername,
                sc.tambon,
                sc.district_name
            FROM shelter_disease_reports sdr
            LEFT JOIN shelter_centers sc ON sdr.shelter_id = sc.id
            WHERE 1=1
        `;
        const params = [];

        if (sessionId) {
            query += ` AND sdr.session_id = ?`;
            params.push(sessionId);
        }

        if (shelterId) {
            query += ` AND sdr.shelter_id = ?`;
            params.push(shelterId);
        }

        if (reportDate) {
            query += ` AND sdr.report_date = ?`;
            params.push(reportDate);
        }

        query += ` ORDER BY sdr.report_date DESC, sdr.created_at DESC`;

        const [rows] = await pool.query(query, params);

        // สรุปสถิติ
        const stats = {
            total_reports: rows.length,
            total_new_cases: rows.reduce((sum, r) => sum + (r.new_cases || 0), 0),
            total_recovered: rows.reduce((sum, r) => sum + (r.recovered || 0), 0),
            total_hospitalized: rows.reduce((sum, r) => sum + (r.hospitalized || 0), 0),
            by_disease: {}
        };

        rows.forEach(r => {
            if (!stats.by_disease[r.disease_type]) {
                stats.by_disease[r.disease_type] = { new_cases: 0, recovered: 0, hospitalized: 0 };
            }
            stats.by_disease[r.disease_type].new_cases += r.new_cases || 0;
            stats.by_disease[r.disease_type].recovered += r.recovered || 0;
            stats.by_disease[r.disease_type].hospitalized += r.hospitalized || 0;
        });

        return NextResponse.json({
            success: true,
            data: rows,
            stats
        });
    } catch (error) {
        console.error('Get shelter disease reports error:', error);

        // ถ้าตารางยังไม่มี
        if (error.code === 'ER_NO_SUCH_TABLE') {
            return NextResponse.json({
                success: true,
                data: [],
                stats: { total_reports: 0, total_new_cases: 0, total_recovered: 0, total_hospitalized: 0, by_disease: {} },
                message: 'ยังไม่ได้สร้างตาราง shelter_disease_reports'
            });
        }

        return publicInternalError('เกิดข้อผิดพลาดในการดึงรายงานโรคในศูนย์พักพิง');
    }
}

// POST - เพิ่มรายงานโรค
export async function POST(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT']);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const {
            shelter_id,
            session_id,
            report_date,
            disease_type,
            new_cases,
            recovered,
            hospitalized,
            deaths,
            severity,
            symptoms,
            treatment_given,
            notes,
        } = body;

        if (!shelter_id || !session_id || !report_date || !disease_type) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลที่จำเป็น (ศูนย์พักพิง, วันที่, ประเภทโรค)' },
                { status: 400 }
            );
        }

        const pool = await getConnection();

        // ตรวจสอบว่ามีรายงานซ้ำหรือไม่
        const [existing] = await pool.query(
            `SELECT id FROM shelter_disease_reports 
             WHERE shelter_id = ? AND session_id = ? AND report_date = ? AND disease_type = ?`,
            [shelter_id, session_id, report_date, disease_type]
        );

        if (existing.length > 0) {
            // Update existing
            await pool.query(
                `UPDATE shelter_disease_reports SET
                    new_cases = ?, recovered = ?, hospitalized = ?, deaths = ?,
                    severity = ?, symptoms = ?, treatment_given = ?, notes = ?,
                    updated_at = NOW()
                 WHERE id = ?`,
                [
                    new_cases || 0, recovered || 0, hospitalized || 0, deaths || 0,
                    severity || 'low', symptoms, treatment_given, notes,
                    existing[0].id
                ]
            );

            return NextResponse.json({
                success: true,
                message: 'อัพเดทรายงานสำเร็จ',
                id: existing[0].id
            });
        }

        // Insert new
        const [result] = await pool.query(
            `INSERT INTO shelter_disease_reports 
             (shelter_id, session_id, report_date, disease_type, new_cases, recovered, 
              hospitalized, deaths, severity, symptoms, treatment_given, notes, reported_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                shelter_id, session_id, report_date, disease_type,
                new_cases || 0, recovered || 0, hospitalized || 0, deaths || 0,
                severity || 'low', symptoms, treatment_given, notes, auth.user.id
            ]
        );

        return NextResponse.json({
            success: true,
            message: 'บันทึกรายงานสำเร็จ',
            id: result.insertId
        });
    } catch (error) {
        console.error('Create shelter disease report error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการบันทึกรายงานโรคในศูนย์พักพิง');
    }
}

// DELETE - ลบรายงานโรค
export async function DELETE(request) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, message: 'ต้องระบุ ID' },
                { status: 400 }
            );
        }

        const pool = await getConnection();
        await pool.query('DELETE FROM shelter_disease_reports WHERE id = ?', [id]);

        return NextResponse.json({
            success: true,
            message: 'ลบรายงานสำเร็จ'
        });
    } catch (error) {
        console.error('Delete shelter disease report error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการลบรายงานโรคในศูนย์พักพิง');
    }
}
