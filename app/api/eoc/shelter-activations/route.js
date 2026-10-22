import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { OFFICER_ROLES, requireAuth } from '@/lib/auth';
import { modulePermissions, requireModuleEdit } from '@/lib/eocModuleAccess';
import { publicInternalError } from '@/lib/apiResponse';
import { recordChange } from '@/lib/recordArchive';
import { triggerEventAlerts } from '@/lib/eocAlertRunner';
import { canonicalDisease } from '@/lib/healthDashboard';

// คอลัมน์ updated_at เพิ่มใน migration 20261005 — ตรวจก่อนใช้ เพื่อให้ระบบยังทำงานได้ก่อนรัน migration
let activationUpdatedAtColumn = null;
async function hasActivationUpdatedAt(pool) {
    if (activationUpdatedAtColumn === null) {
        const [columns] = await pool.query(
            `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shelter_session_activations' AND COLUMN_NAME = 'updated_at'`
        );
        activationUpdatedAtColumn = columns.length > 0;
        if (!activationUpdatedAtColumn) setTimeout(() => { activationUpdatedAtColumn = null; }, 60000);
    }
    return activationUpdatedAtColumn;
}

// GET - ดึงรายการ shelter activations สำหรับ session
export async function GET(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SEhRT', 'staff']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');
        const eocType = searchParams.get('eoc_type');

        if (!sessionId) {
            return NextResponse.json(
                { success: false, message: 'ต้องระบุ session_id' },
                { status: 400 }
            );
        }

        const pool = await getConnection();

        // ดึงทุก shelter พร้อมสถานะ activation สำหรับ session นี้
        let query = `
            SELECT 
                sc.*,
                CASE WHEN ssa.id IS NOT NULL AND ssa.is_active = 1 THEN 1 ELSE 0 END as is_activated_for_session,
                COALESCE(ssa.current_occupancy, 0) as session_occupancy,
                ssa.activated_at,
                ${await hasActivationUpdatedAt(pool) ? 'ssa.updated_at' : 'ssa.activated_at'} as activation_updated_at,
                ssa.notes as activation_notes
            FROM shelter_centers sc
            LEFT JOIN shelter_session_activations ssa 
                ON sc.id = ssa.shelter_id AND ssa.session_id = ?
            WHERE 1=1
        `;
        const params = [sessionId];

        if (eocType) {
            query += ` AND sc.eoc_type = ?`;
            params.push(eocType);
        }

        query += ` ORDER BY is_activated_for_session DESC, sc.sheltername ASC`;

        const [rows] = await pool.query(query, params);

        // นับสถิติ
        const stats = {
            total: rows.length,
            activated: rows.filter(r => r.is_activated_for_session).length,
            not_activated: rows.filter(r => !r.is_activated_for_session).length,
            total_capacity: rows.filter(r => r.is_activated_for_session)
                .reduce((sum, r) => sum + (r.shelter_capacity || 0), 0),
            total_occupancy: rows.filter(r => r.is_activated_for_session)
                .reduce((sum, r) => sum + (r.session_occupancy || 0), 0)
        };

        // สุขภาพในศูนย์ (เฉพาะเหตุการณ์นี้) — ถ้ายังไม่มีตารางรายงานโรค ให้ข้ามไป
        const health = { by_shelter: {}, by_disease: [], totals: { new_cases: 0, hospitalized: 0, deaths: 0, recovered: 0, today_new_cases: 0, latest_report_date: null } };
        try {
            const [byShelter] = await pool.query(
                `SELECT shelter_id,
                        SUM(new_cases) AS new_cases, SUM(hospitalized) AS hospitalized, SUM(deaths) AS deaths, SUM(recovered) AS recovered,
                        SUM(CASE WHEN report_date = CURDATE() THEN new_cases ELSE 0 END) AS today_new_cases,
                        DATE_FORMAT(MAX(report_date), '%Y-%m-%d') AS latest_report_date,
                        MAX(FIELD(severity, 'low', 'medium', 'high', 'critical')) AS severity_rank
                 FROM shelter_disease_reports WHERE session_id = ? GROUP BY shelter_id`,
                [sessionId]
            );
            const [byDisease] = await pool.query(
                `SELECT disease_type, shelter_id, SUM(new_cases) AS new_cases, SUM(hospitalized) AS hospitalized
                 FROM shelter_disease_reports WHERE session_id = ? GROUP BY disease_type, shelter_id`,
                [sessionId]
            );
            const severityNames = [null, 'low', 'medium', 'high', 'critical'];
            for (const row of byShelter) {
                health.by_shelter[row.shelter_id] = {
                    new_cases: Number(row.new_cases) || 0, hospitalized: Number(row.hospitalized) || 0, deaths: Number(row.deaths) || 0,
                    today_new_cases: Number(row.today_new_cases) || 0, latest_report_date: row.latest_report_date,
                    severity: severityNames[Number(row.severity_rank) || 0]
                };
                for (const key of ['new_cases', 'hospitalized', 'deaths', 'recovered', 'today_new_cases']) health.totals[key] += Number(row[key]) || 0;
                if (!health.totals.latest_report_date || row.latest_report_date > health.totals.latest_report_date) health.totals.latest_report_date = row.latest_report_date;
            }
            // รวมชื่อโรคที่เขียนต่างกัน (เช่น "โรคฉี่หนู" กับ "โรคฉี่หนู (เลปโตสไปโรซิส)") ให้เป็นแถวเดียว
            const diseaseMap = new Map();
            for (const row of byDisease) {
                const name = canonicalDisease(row.disease_type);
                if (!diseaseMap.has(name)) diseaseMap.set(name, { disease_type: name, new_cases: 0, hospitalized: 0, shelterIds: new Set() });
                const entry = diseaseMap.get(name);
                entry.new_cases += Number(row.new_cases) || 0;
                entry.hospitalized += Number(row.hospitalized) || 0;
                entry.shelterIds.add(row.shelter_id);
            }
            health.by_disease = [...diseaseMap.values()]
                .map(({ shelterIds, ...entry }) => ({ ...entry, shelters: shelterIds.size }))
                .sort((a, b) => b.new_cases - a.new_cases)
                .slice(0, 8);
        } catch (healthError) {
            if (healthError.code !== 'ER_NO_SUCH_TABLE') throw healthError;
        }

        return NextResponse.json({
            success: true,
            data: rows,
            stats,
            health,
            permissions: await modulePermissions(auth.user, sessionId, 'shelters')
        });
    } catch (error) {
        console.error('Get shelter activations error:', error);

        // ถ้าตารางยังไม่มี ให้ return empty array
        if (error.code === 'ER_NO_SUCH_TABLE') {
            return NextResponse.json({
                success: true,
                data: [],
                stats: { total: 0, activated: 0, not_activated: 0, total_capacity: 0, total_occupancy: 0 },
                message: 'ยังไม่ได้สร้างตาราง shelter_session_activations'
            });
        }

        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลศูนย์พักพิง');
    }
}

// POST - Activate/Toggle shelter สำหรับ session
export async function POST(request) {
    try {
        // เปิดใช้ศูนย์/ปรับยอดผู้พักพิง: เฉพาะกลุ่มภารกิจเจ้าของเมนู (LOGISTICS) — ตรวจด้วย requireModuleEdit
        const auth = await requireAuth(request, OFFICER_ROLES);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const { shelter_id, session_id, is_active, notes } = body;

        if (!shelter_id || !session_id) {
            return NextResponse.json(
                { success: false, message: 'ต้องระบุ shelter_id และ session_id' },
                { status: 400 }
            );
        }
        const gate = await requireModuleEdit(auth.user, session_id, 'shelters');
        if (gate.response) return gate.response;

        const pool = await getConnection();

        // ตรวจสอบว่ามี record อยู่แล้วหรือไม่
        const [existing] = await pool.query(
            'SELECT * FROM shelter_session_activations WHERE shelter_id = ? AND session_id = ?',
            [shelter_id, session_id]
        );

        if (existing.length > 0) {
            // Update existing
            const newStatus = is_active !== undefined ? is_active : !existing[0].is_active;
            await pool.query(
                `UPDATE shelter_session_activations 
                 SET is_active = ?, 
                     deactivated_at = CASE WHEN ? = 0 THEN NOW() ELSE NULL END,
                     notes = COALESCE(?, notes)
                 WHERE shelter_id = ? AND session_id = ?`,
                [newStatus, newStatus ? 0 : 1, notes, shelter_id, session_id]
            );

            await recordChange({
                request, user: auth.user, action: 'data_update', table: 'shelter_session_activations', id: existing[0].id,
                sessionId: session_id, description: `${newStatus ? 'เปิด' : 'ปิด'}ใช้ศูนย์พักพิง #${shelter_id} ในเหตุการณ์`,
                oldValues: existing[0], newValues: { is_active: newStatus, notes }
            });

            return NextResponse.json({
                success: true,
                message: newStatus ? 'เปิดใช้งานศูนย์พักพิงแล้ว' : 'ปิดใช้งานศูนย์พักพิงแล้ว',
                is_active: newStatus
            });
        } else {
            // Insert new
            await pool.query(
                `INSERT INTO shelter_session_activations 
                 (shelter_id, session_id, is_active, notes) 
                 VALUES (?, ?, ?, ?)`,
                [shelter_id, session_id, is_active !== undefined ? is_active : true, notes || null]
            );

            await recordChange({
                request, user: auth.user, action: 'data_create', table: 'shelter_session_activations', id: shelter_id,
                sessionId: session_id, description: `เปิดใช้ศูนย์พักพิง #${shelter_id} ในเหตุการณ์`, newValues: body
            });

            return NextResponse.json({
                success: true,
                message: 'เปิดใช้งานศูนย์พักพิงแล้ว',
                is_active: true
            });
        }
    } catch (error) {
        console.error('Toggle shelter activation error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการเปิด/ปิดศูนย์พักพิง');
    }
}

// PUT - Update occupancy สำหรับ shelter ที่ activate แล้ว
export async function PUT(request) {
    try {
        // เปิดใช้ศูนย์/ปรับยอดผู้พักพิง: เฉพาะกลุ่มภารกิจเจ้าของเมนู (LOGISTICS) — ตรวจด้วย requireModuleEdit
        const auth = await requireAuth(request, OFFICER_ROLES);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const { shelter_id, session_id, current_occupancy, notes } = body;

        if (!shelter_id || !session_id) {
            return NextResponse.json(
                { success: false, message: 'ต้องระบุ shelter_id และ session_id' },
                { status: 400 }
            );
        }
        const gate = await requireModuleEdit(auth.user, session_id, 'shelters');
        if (gate.response) return gate.response;

        const pool = await getConnection();

        await pool.query(
            `UPDATE shelter_session_activations 
             SET current_occupancy = COALESCE(?, current_occupancy),
                 notes = COALESCE(?, notes)
             WHERE shelter_id = ? AND session_id = ?`,
            [current_occupancy, notes, shelter_id, session_id]
        );

        await recordChange({
            request, user: auth.user, action: 'data_update', table: 'shelter_session_activations', id: shelter_id,
            sessionId: session_id, description: `ปรับยอดผู้พักพิงศูนย์ #${shelter_id} เป็น ${current_occupancy ?? '-'} คน`, newValues: body
        });
        triggerEventAlerts(session_id);

        return NextResponse.json({
            success: true,
            message: 'อัพเดทข้อมูลสำเร็จ'
        });
    } catch (error) {
        console.error('Update shelter occupancy error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการอัพเดทข้อมูลศูนย์พักพิง');
    }
}

// DELETE - Deactivate shelter สำหรับ session
export async function DELETE(request) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const shelterId = searchParams.get('shelter_id');
        const sessionId = searchParams.get('session_id');

        if (!shelterId || !sessionId) {
            return NextResponse.json(
                { success: false, message: 'ต้องระบุ shelter_id และ session_id' },
                { status: 400 }
            );
        }

        const pool = await getConnection();

        await pool.query(
            `UPDATE shelter_session_activations 
             SET is_active = 0, deactivated_at = NOW() 
             WHERE shelter_id = ? AND session_id = ?`,
            [shelterId, sessionId]
        );

        return NextResponse.json({
            success: true,
            message: 'ปิดใช้งานศูนย์พักพิงแล้ว'
        });
    } catch (error) {
        console.error('Deactivate shelter error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการปิดใช้งานศูนย์พักพิง');
    }
}
