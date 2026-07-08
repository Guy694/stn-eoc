import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { buildTelegramBotLink } from '@/lib/telegram';

async function ensureTelegramColumns(connection) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'officer'
           AND COLUMN_NAME IN ('telegram_chat_id', 'telegram_notify_enabled')`
    );
    const names = new Set(columns.map((column) => column.COLUMN_NAME));

    if (!names.has('telegram_chat_id')) {
        await connection.execute(
            `ALTER TABLE officer
             ADD COLUMN telegram_chat_id VARCHAR(64) NULL COMMENT 'Telegram chat id for citizen help request notifications'`
        );
    }

    if (!names.has('telegram_notify_enabled')) {
        await connection.execute(
            `ALTER TABLE officer
             ADD COLUMN telegram_notify_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Enable Telegram help request notifications'`
        );
    }
}

function normalizeChatId(value) {
    return String(value || '').trim();
}

export async function GET(request) {
    let connection;
    try {
        const auth = await requireAuth(request);
        if (!auth.success) return auth.response;

        const pool = await getConnection();
        connection = await pool.getConnection();
        await ensureTelegramColumns(connection);

        const [rows] = await connection.execute(
            `SELECT telegram_chat_id, telegram_notify_enabled
             FROM officer
             WHERE id = ?`,
            [auth.user.id]
        );

        const row = rows[0] || {};
        return NextResponse.json({
            success: true,
            data: {
                telegramChatId: row.telegram_chat_id || '',
                telegramNotifyEnabled: Boolean(row.telegram_notify_enabled),
                botLink: buildTelegramBotLink(`officer_${auth.user.id}`)
            }
        });
    } catch (error) {
        console.error('Telegram settings GET error:', error);
        return NextResponse.json({ success: false, message: 'ไม่สามารถโหลดการตั้งค่า Telegram ได้' }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

export async function PUT(request) {
    let connection;
    try {
        const auth = await requireAuth(request);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const telegramChatId = normalizeChatId(body.telegramChatId);
        const telegramNotifyEnabled = Boolean(body.telegramNotifyEnabled);

        if (telegramNotifyEnabled && !telegramChatId) {
            return NextResponse.json({
                success: false,
                message: 'กรุณาระบุ Telegram Chat ID ก่อนเปิดรับแจ้งเตือน'
            }, { status: 400 });
        }

        const pool = await getConnection();
        connection = await pool.getConnection();
        await ensureTelegramColumns(connection);

        await connection.execute(
            `UPDATE officer
             SET telegram_chat_id = ?, telegram_notify_enabled = ?
             WHERE id = ?`,
            [telegramChatId || null, telegramNotifyEnabled ? 1 : 0, auth.user.id]
        );

        return NextResponse.json({
            success: true,
            message: 'บันทึกการตั้งค่า Telegram แล้ว',
            data: {
                telegramChatId,
                telegramNotifyEnabled
            }
        });
    } catch (error) {
        console.error('Telegram settings PUT error:', error);
        return NextResponse.json({ success: false, message: 'ไม่สามารถบันทึกการตั้งค่า Telegram ได้' }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
