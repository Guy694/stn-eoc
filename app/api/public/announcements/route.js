import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { publicInternalError } from '@/lib/apiResponse';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const { searchParams } = new URL(request.url);
        const eocType = searchParams.get('eocType');
        const announcementId = Number.parseInt(searchParams.get('id') || '', 10);
        const includeOld = searchParams.get('include_old') === '1' || searchParams.get('includeArchived') === '1';
        const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), includeOld ? 200 : 50);

        const [columns] = await connection.execute(
            `SHOW COLUMNS FROM announcements LIKE 'eoc_type'`
        );
        const hasEocType = columns.length > 0;
        const [optionalColumns] = await connection.execute(
            `SELECT COLUMN_NAME
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'announcements'
               AND COLUMN_NAME IN ('content_type', 'category', 'attachment_path', 'attachment_name')`
        );
        const availableColumns = new Set(optionalColumns.map((column) => column.COLUMN_NAME));

        const params = [];
        const activeWindowWhereClause = `
            WHERE a.is_active = 1
            AND (a.start_date IS NULL OR a.start_date <= NOW())
            AND (a.end_date IS NULL OR a.end_date >= NOW())
        `;
        let whereClause = includeOld
            ? `WHERE a.is_active = 1
               AND (a.start_date IS NULL OR a.start_date <= NOW())`
            : activeWindowWhereClause;

        if (hasEocType && eocType) {
            whereClause += ' AND a.eoc_type = ?';
            params.push(eocType);
        }
        if (Number.isInteger(announcementId) && announcementId > 0) {
            whereClause += ' AND a.id = ?';
            params.push(announcementId);
        }

        const selectEocType = hasEocType ? 'a.eoc_type,' : `'flood' as eoc_type,`;
        const selectContentFields = [
            availableColumns.has('content_type') ? 'a.content_type' : `'news' as content_type`,
            availableColumns.has('category') ? 'a.category' : 'NULL as category',
            availableColumns.has('attachment_path') ? 'a.attachment_path' : 'NULL as attachment_path',
            availableColumns.has('attachment_name') ? 'a.attachment_name' : 'NULL as attachment_name'
        ].join(',\n                ');

        const selectSql = `SELECT
                a.id,
                a.title,
                a.description,
                a.image_path,
                a.priority,
                a.show_popup,
                a.start_date,
                a.end_date,
                a.created_at,
                ${selectContentFields},
                CASE
                    WHEN (a.start_date IS NULL OR a.start_date <= NOW())
                        AND (a.end_date IS NULL OR a.end_date >= NOW()) THEN 'current'
                    WHEN a.end_date IS NOT NULL AND a.end_date < NOW() THEN 'expired'
                    ELSE 'scheduled'
                END as display_status,
                ${selectEocType}
                CONCAT(o.given_name, ' ', o.family_name) as created_by_name
            FROM announcements a
            LEFT JOIN officer o ON a.created_by = o.id`;

        let [rows] = await connection.execute(
            `${selectSql}
             ${whereClause}
             ORDER BY
                CASE
                    WHEN (a.start_date IS NULL OR a.start_date <= NOW())
                        AND (a.end_date IS NULL OR a.end_date >= NOW()) THEN 0
                    WHEN a.end_date IS NOT NULL AND a.end_date < NOW() THEN 1
                    ELSE 2
                END ASC,
                a.priority DESC,
                a.created_at DESC
             LIMIT ${limit}`,
            params
        );

        let fallback = false;
        if (rows.length === 0 && !includeOld) {
            fallback = true;
            const fallbackParams = [];
            let fallbackWhereClause = `
                WHERE a.is_active = 1
                AND (a.start_date IS NULL OR a.start_date <= NOW())
            `;

            if (hasEocType && eocType) {
                fallbackWhereClause += ' AND a.eoc_type = ?';
                fallbackParams.push(eocType);
            }
            if (Number.isInteger(announcementId) && announcementId > 0) {
                fallbackWhereClause += ' AND a.id = ?';
                fallbackParams.push(announcementId);
            }

            const [fallbackRows] = await connection.execute(
                `${selectSql}
                 ${fallbackWhereClause}
                 ORDER BY a.priority DESC, a.created_at DESC
                 LIMIT ${limit}`,
                fallbackParams
            );
            rows = fallbackRows;
        }

        return NextResponse.json({
            success: true,
            data: rows,
            meta: {
                fallback
            }
        });
    } catch (error) {
        console.error('Get public announcements error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลประกาศ');
    } finally {
        connection.release();
    }
}
