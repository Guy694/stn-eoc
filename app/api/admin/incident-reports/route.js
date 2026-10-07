import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { getPool } from "@/lib/db";
import { handleArchiveDelete, recordChange } from '@/lib/recordArchive';
import { removePublicPhotoCopy } from '@/lib/incidentPhotos';
import { expireOverduePublications, hasConfirmationColumns, hasPublishingColumns } from '@/lib/incidentPublishingDb';
import { hasTrackingColumns, recordStatusEvent } from '@/lib/incidentTrackingDb';

const pool = getPool();

async function hasDiseaseSubtypeColumns(connection) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'eoc_sessions'
           AND COLUMN_NAME IN ('disease_id', 'disease_name')`
    );
    return columns.length === 2;
}

// GET - ดึงรายการรายงานเหตุการณ์ทั้งหมด
export async function GET(request) {
    const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
    if (!auth.success) return auth.response;

    const connection = await pool.getConnection();

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // pending, approved, rejected
        const publish = searchParams.get('publish'); // published | expired | withdrawn
        const reportType = searchParams.get('report_type');
        const disasterType = searchParams.get('disaster_type');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let params = [];

        const publishing = await hasPublishingColumns(connection);
        const confirmations = publishing && await hasConfirmationColumns(connection);
        if (publishing) {
            await expireOverduePublications(connection);
            // เรื่องที่รวมเข้ากับเรื่องหลักแล้ว แสดงอยู่ใต้เรื่องหลัก ไม่นับซ้ำในรายการ
            whereConditions.push('merged_into_id IS NULL');
            if (publish && ['published', 'expired', 'withdrawn'].includes(publish)) {
                whereConditions.push('publish_status = ?');
                params.push(publish);
            }
        }

        if (reportType && ['help_request', 'traffic_report', 'problem_point'].includes(reportType)) {
            whereConditions.push('report_type = ?');
            params.push(reportType);
        }

        if (status) {
            whereConditions.push('status = ?');
            params.push(status);
        }

        if (disasterType) {
            whereConditions.push('disaster_type = ?');
            params.push(disasterType);
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        const hasDiseaseColumns = await hasDiseaseSubtypeColumns(connection);
        const diseaseSessionSelect = hasDiseaseColumns
            ? `(
                SELECT es.id
                FROM eoc_sessions es
                WHERE es.eoc_type = 'disease'
                  AND es.opened_at <= COALESCE(public_incident_reports.occurred_at, public_incident_reports.created_at)
                  AND (es.closed_at IS NULL OR es.closed_at >= COALESCE(public_incident_reports.occurred_at, public_incident_reports.created_at))
                ORDER BY es.opened_at DESC, es.id DESC
                LIMIT 1
            ) as related_disease_session_id,
            (
                SELECT es.disease_name
                FROM eoc_sessions es
                WHERE es.eoc_type = 'disease'
                  AND es.opened_at <= COALESCE(public_incident_reports.occurred_at, public_incident_reports.created_at)
                  AND (es.closed_at IS NULL OR es.closed_at >= COALESCE(public_incident_reports.occurred_at, public_incident_reports.created_at))
                ORDER BY es.opened_at DESC, es.id DESC
                LIMIT 1
            ) as related_disease_name,`
            : `NULL as related_disease_session_id,
            NULL as related_disease_name,`;

        // Query รายการรายงาน
        const [reports] = await connection.execute(
            `SELECT 
                id,
                first_name,
                last_name,
                phone,
                village,
                sub_district,
                district,
                disaster_type,
                description,
                latitude,
                longitude,
                water_level,
                affected_people,
                urgency,
                travel_status,
                report_type,
                occurred_at,
                photo_path,
                status,
                ${publishing ? `problem_category, publish_status, public_title, public_detail, public_photo_path,
                published_at, published_by, expires_at, normal_reports, normal_reported_at,
                ${confirmations ? 'still_reports, still_reported_at, wrong_reports, wrong_reported_at,' : ''}
                (SELECT COUNT(*) FROM public_incident_reports m WHERE m.merged_into_id = public_incident_reports.id) AS merged_count,` : ''}
                reviewed_by,
                reviewed_at,
                admin_notes,
                ${await hasTrackingColumns(connection) ? 'tracking_code, citizen_message,' : ''}
                ${diseaseSessionSelect}
                created_at,
                updated_at
            FROM public_incident_reports
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?`,
            [...params, String(limit), String(offset)]
        );

        // นับจำนวนทั้งหมด
        const [countResult] = await connection.execute(
            `SELECT COUNT(*) as total FROM public_incident_reports ${whereClause}`,
            params
        );

        const total = countResult[0].total;

        // สถิติ
        const [stats] = await connection.execute(
            `SELECT 
                status,
                COUNT(*) as count
            FROM public_incident_reports
            ${publishing ? 'WHERE merged_into_id IS NULL' : ''}
            GROUP BY status`
        );

        let publishStats = {};
        if (publishing) {
            const [rows] = await connection.execute(
                `SELECT publish_status, COUNT(*) AS count
                 FROM public_incident_reports
                 WHERE merged_into_id IS NULL
                 GROUP BY publish_status`
            );
            publishStats = Object.fromEntries(rows.map((row) => [row.publish_status, Number(row.count)]));
        }

        return NextResponse.json({
            success: true,
            data: reports,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            stats: stats.reduce((acc, stat) => {
                acc[stat.status] = stat.count;
                return acc;
            }, {}),
            publishStats,
            publishingReady: publishing
        });

    } catch (error) {
        console.error('Error fetching incident reports:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลรายงานเหตุการณ์');
    } finally {
        connection.release();
    }
}

// PUT - อัปเดตสถานะรายงาน (อนุมัติ/ปฏิเสธ)
export async function PUT(request) {
    const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT']);
    if (!auth.success) return auth.response;

    const connection = await pool.getConnection();

    try {
        const body = await request.json();
        const { reportId, status, adminNotes } = body;
        // ข้อความถึงผู้แจ้ง: แสดงในหน้าติดตามคำขอ (ไม่ใช่บันทึกภายใน)
        const citizenMessage = typeof body.citizenMessage === 'string' ? body.citizenMessage.trim().slice(0, 500) || null : undefined;
        const tracking = await hasTrackingColumns(connection);

        // Validate input
        if (!reportId || !status) {
            return NextResponse.json(
                { success: false, message: 'ข้อมูลไม่ครบถ้วน' },
                { status: 400 }
            );
        }

        // Validate status
        const validStatuses = ['pending', 'reviewing', 'verified', 'resolved', 'rejected'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json(
                { success: false, message: 'สถานะไม่ถูกต้อง' },
                { status: 400 }
            );
        }

        const publishing = await hasPublishingColumns(connection);
        const [beforeRows] = await connection.execute(
            `SELECT status, ${publishing ? 'publish_status, public_photo_path' : 'id'}${await hasTrackingColumns(connection) ? ', citizen_message' : ''} FROM public_incident_reports WHERE id = ?`,
            [reportId]
        );
        if (!beforeRows.length) {
            return NextResponse.json({ success: false, message: 'ไม่พบเรื่องนี้' }, { status: 404 });
        }

        // อัปเดตสถานะ
        await connection.execute(
            `UPDATE public_incident_reports 
            SET status = ?, 
                reviewed_by = ?, 
                reviewed_at = NOW(), 
                admin_notes = ?${tracking && citizenMessage !== undefined ? ', citizen_message = ?' : ''}
            WHERE id = ?`,
            [status, auth.user.id, adminNotes || null, ...(tracking && citizenMessage !== undefined ? [citizenMessage] : []), reportId]
        );
        // ประวัติที่ผู้แจ้งเห็น: บันทึกเมื่อสถานะเปลี่ยน หรือมีข้อความใหม่ถึงผู้แจ้ง
        if (tracking && (beforeRows[0].status !== status || (citizenMessage && citizenMessage !== beforeRows[0].citizen_message))) {
            await recordStatusEvent(connection, {
                reportId,
                status,
                citizenMessage: citizenMessage && citizenMessage !== beforeRows[0].citizen_message ? citizenMessage : null,
                userId: auth.user.id
            });
        }

        // ปิดเรื่องหรือไม่ดำเนินการ → ถอดออกจากแผนที่สาธารณะทันที
        let withdrawn = false;
        if (publishing && ['resolved', 'rejected'].includes(status) && beforeRows[0].publish_status === 'published') {
            await connection.execute(
                `UPDATE public_incident_reports SET publish_status = 'withdrawn', public_photo_path = NULL WHERE id = ?`,
                [reportId]
            );
            await removePublicPhotoCopy(beforeRows[0].public_photo_path);
            withdrawn = true;
        }

        // ดึงข้อมูลที่อัปเดตแล้ว
        const [updatedReport] = await connection.execute(
            `SELECT * FROM public_incident_reports WHERE id = ?`,
            [reportId]
        );

        await recordChange({
            request, user: auth.user, action: 'data_update', table: 'public_incident_reports', id: reportId,
            description: `เปลี่ยนสถานะรายงานจากประชาชน #${reportId} เป็น ${status}`,
            newValues: { status, admin_notes: adminNotes || null }
        });

        return NextResponse.json({
            success: true,
            message: withdrawn ? 'อัปเดตสถานะแล้ว และถอดจุดนี้ออกจากแผนที่สาธารณะ' : 'อัปเดตสถานะสำเร็จ',
            data: updatedReport[0]
        });

    } catch (error) {
        console.error('Error updating incident report:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการอัปเดตรายงานเหตุการณ์');
    } finally {
        connection.release();
    }
}

// DELETE - ย้ายรายงานไปถังขยะ (กู้คืนได้) พร้อมบันทึกเหตุผล
export async function DELETE(request) {
    const auth = await requireAuth(request, ['admin']);
    if (!auth.success) return auth.response;
    return handleArchiveDelete(request, auth.user, { table: 'public_incident_reports' });
}
