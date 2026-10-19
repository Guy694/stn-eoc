import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { sendTelegramMessage } from '@/lib/telegram';
import { createTelegramLink, getBotUsername, syncTelegramUpdates } from '@/lib/telegramLink';

// การรับแจ้งเตือน Telegram ของเจ้าหน้าที่ (ของตัวเอง)
// เชื่อมด้วยลิงก์บอท: POST {action:"link"} → เปิดลิงก์แล้วกด Start → POST {action:"check"} จนเชื่อมสำเร็จ
// PUT ยังรับ Chat ID ที่กรอกเอง (เช่น กลุ่ม) ไว้สำหรับผู้ดูแล/กรณีพิเศษ

async function readStatus(officerId) {
    const rows = await query('SELECT telegram_chat_id, telegram_notify_enabled FROM officer WHERE id = ?', [officerId]);
    const row = rows[0] || {};
    const chatId = row.telegram_chat_id ? String(row.telegram_chat_id) : '';
    return {
        linked: Boolean(chatId),
        telegramChatId: chatId,
        telegramNotifyEnabled: Boolean(chatId && Number(row.telegram_notify_enabled)),
        botReady: Boolean(process.env.TELEGRAM_BOT_TOKEN)
    };
}

export async function GET(request) {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    try {
        const data = await readStatus(auth.user.id);
        data.botUsername = data.botReady ? await getBotUsername() : '';
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Telegram settings GET error:', error);
        return NextResponse.json({ success: false, message: 'ไม่สามารถโหลดการตั้งค่า Telegram ได้' }, { status: 500 });
    }
}

export async function POST(request) {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const body = await request.json().catch(() => ({}));
    const officerId = auth.user.id;
    try {
        if (!process.env.TELEGRAM_BOT_TOKEN) {
            return NextResponse.json({ success: false, message: 'ผู้ดูแลระบบยังไม่ได้ตั้งค่า Telegram Bot (TELEGRAM_BOT_TOKEN)' }, { status: 503 });
        }

        if (body.action === 'link') {
            const link = await createTelegramLink(officerId);
            if (!link) return NextResponse.json({ success: false, message: 'ไม่พบชื่อบอท ตรวจ TELEGRAM_BOT_TOKEN หรือกำหนด TELEGRAM_BOT_USERNAME' }, { status: 503 });
            return NextResponse.json({ success: true, data: link });
        }

        if (body.action === 'check') {
            const sync = await syncTelegramUpdates();
            const data = await readStatus(officerId);
            if (sync?.conflict && !data.linked) {
                return NextResponse.json({ success: false, code: 'BOT_IN_USE', message: 'บอทนี้ถูกตั้ง webhook หรือมีระบบอื่นใช้งานอยู่ ระบบจึงอ่านข้อความไม่ได้ — ให้ผู้ดูแลสร้างบอทแยกสำหรับระบบนี้', data }, { status: 409 });
            }
            return NextResponse.json({ success: true, data });
        }

        if (body.action === 'unlink') {
            await query('UPDATE officer SET telegram_chat_id = NULL, telegram_notify_enabled = 0 WHERE id = ?', [officerId]);
            await query('DELETE FROM officer_telegram_links WHERE officer_id = ?', [officerId]);
            return NextResponse.json({ success: true, message: 'ยกเลิกการเชื่อม Telegram แล้ว', data: await readStatus(officerId) });
        }

        if (body.action === 'test') {
            const status = await readStatus(officerId);
            if (!status.linked) return NextResponse.json({ success: false, message: 'ยังไม่ได้เชื่อม Telegram' }, { status: 400 });
            const result = await sendTelegramMessage(status.telegramChatId, '🔔 ทดสอบแจ้งเตือนจาก Satun Geo-EOC — ถ้าเห็นข้อความนี้ แปลว่าพร้อมรับแจ้งเตือนแล้ว');
            if (!result.ok) return NextResponse.json({ success: false, message: 'ส่งไม่สำเร็จ อาจกดบล็อกบอทไว้ ลองเชื่อมใหม่อีกครั้ง' }, { status: 502 });
            return NextResponse.json({ success: true, message: 'ส่งข้อความทดสอบแล้ว ตรวจใน Telegram' });
        }

        return NextResponse.json({ success: false, message: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
    } catch (error) {
        console.error('Telegram link error:', error);
        const missingTable = error?.code === 'ER_NO_SUCH_TABLE';
        return NextResponse.json({ success: false, message: missingTable ? 'ฐานข้อมูลยังไม่ได้อัปเดต (migration 20261019_officer_telegram_link)' : 'เชื่อม Telegram ไม่สำเร็จ' }, { status: 500 });
    }
}

export async function PUT(request) {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    try {
        const body = await request.json().catch(() => ({}));
        const current = await readStatus(auth.user.id);
        // ไม่ส่ง telegramChatId มา = เปิด/ปิดรับอย่างเดียว ใช้ chat เดิมที่เชื่อมไว้
        const chatId = body.telegramChatId === undefined ? current.telegramChatId : String(body.telegramChatId || '').trim();
        const enabled = Boolean(body.telegramNotifyEnabled);
        if (chatId && !/^-?\d{4,20}$/.test(chatId)) {
            return NextResponse.json({ success: false, message: 'Chat ID ต้องเป็นตัวเลข' }, { status: 400 });
        }
        if (enabled && !chatId) {
            return NextResponse.json({ success: false, message: 'กรุณาเชื่อม Telegram ก่อนเปิดรับแจ้งเตือน' }, { status: 400 });
        }
        await query('UPDATE officer SET telegram_chat_id = ?, telegram_notify_enabled = ? WHERE id = ?', [chatId || null, enabled ? 1 : 0, auth.user.id]);
        return NextResponse.json({ success: true, message: enabled ? 'เปิดรับแจ้งเตือน Telegram แล้ว' : 'ปิดรับแจ้งเตือน Telegram แล้ว', data: await readStatus(auth.user.id) });
    } catch (error) {
        console.error('Telegram settings PUT error:', error);
        return NextResponse.json({ success: false, message: 'ไม่สามารถบันทึกการตั้งค่า Telegram ได้' }, { status: 500 });
    }
}
