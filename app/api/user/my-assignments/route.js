// ========================================
// API Route: ข้อมูลทีมงานที่ user รับผิดชอบ
// Path: app/api/user/my-assignments/route.js
// ========================================

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';

export async function GET(request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const requestedSessionId = searchParams.get('sessionId');
        const sessionId = requestedSessionId ? Number(requestedSessionId) : null;
        if (requestedSessionId && (!Number.isInteger(sessionId) || sessionId <= 0)) {
            return NextResponse.json({ success: false, message: 'sessionId ไม่ถูกต้อง' }, { status: 400 });
        }

        // Sidebar uses active assignments by default. A selected session (including
        // a closed one) can be requested explicitly for retrospective reporting.
        const sessionScope = sessionId ? 'AND session_id = ?' : "AND session_status = 'active'";
        const assignmentParams = sessionId ? [auth.user.id, sessionId] : [auth.user.id];
        const assignments = await pool.query(`
            SELECT * FROM vw_officer_team_assignments
            WHERE officer_id = ? 
              AND is_active = TRUE
              ${sessionScope}
            ORDER BY assigned_at DESC
        `, assignmentParams);

        const diseaseSessionIds = [
            ...new Set(assignments
                .filter((assignment) => assignment.eoc_type === 'disease' && assignment.session_id)
                .map((assignment) => assignment.session_id))
        ];

        if (diseaseSessionIds.length > 0) {
            try {
                const placeholders = diseaseSessionIds.map(() => '?').join(',');
                const diseaseSessions = await pool.query(
                    `SELECT id, disease_id, disease_name
                     FROM eoc_sessions
                     WHERE id IN (${placeholders})`,
                    diseaseSessionIds
                );
                const diseaseBySessionId = new Map(diseaseSessions.map((session) => [String(session.id), session]));
                assignments.forEach((assignment) => {
                    const diseaseSession = diseaseBySessionId.get(String(assignment.session_id));
                    if (diseaseSession) {
                        assignment.disease_id = assignment.disease_id || diseaseSession.disease_id;
                        assignment.disease_name = assignment.disease_name || diseaseSession.disease_name;
                    }
                });
            } catch (error) {
                console.warn('Could not enrich disease assignment names:', error.message);
            }
        }

        // ดึง modules ที่แต่ละทีมสามารถเข้าถึงได้
        for (let assignment of assignments) {
            const modules = await pool.query(`
                SELECT 
                    m.id,
                    m.module_code,
                    m.module_name_th,
                    m.module_name_en,
                    m.module_type,
                    m.route_path,
                    m.icon,
                    p.can_view,
                    p.can_create,
                    p.can_edit,
                    p.can_delete,
                    p.can_approve
                FROM eoc_type_modules m
                LEFT JOIN module_permissions p ON m.id = p.module_id
                LEFT JOIN eoc_teams t ON p.team_id = t.id
                WHERE m.eoc_type = ? 
                  AND (t.team_code = ? OR p.team_id IS NULL)
                  AND m.is_active = TRUE
                ORDER BY m.sort_order
            `, [assignment.eoc_type, assignment.team_code]);

            assignment.modules = modules;
        }

        return NextResponse.json({
            success: true,
            assignments: assignments
        });

    } catch (error) {
        console.error('Error fetching user assignments:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลงานที่รับผิดชอบ');
    }
}
