export function getTelegramBotUsername() {
    return process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || '';
}

export function buildTelegramBotLink(payload = '') {
    const username = getTelegramBotUsername();
    if (!username) return '';
    const suffix = payload ? `?start=${encodeURIComponent(payload)}` : '';
    return `https://t.me/${username}${suffix}`;
}

export function getTelegramHelpNotifyChatIds() {
    const raw = process.env.TELEGRAM_HELP_NOTIFY_CHAT_IDS || process.env.TELEGRAM_NOTIFY_CHAT_IDS || '';
    return [...new Set(
        raw
            .split(/[\s,;]+/)
            .map((chatId) => chatId.trim())
            .filter(Boolean)
    )];
}

/** กลุ่มแจ้งเหตุความปลอดภัย (ผู้ดูแลระบบเท่านั้น) — ไม่ถอยไปใช้กลุ่มเจ้าหน้าที่ เพื่อไม่ให้เจ้าหน้าที่ทั่วไปเห็นเหตุเข้าระบบผิดปกติ */
export function getTelegramSecurityChatIds() {
    const raw = process.env.TELEGRAM_SECURITY_CHAT_IDS || process.env.TELEGRAM_ADMIN_CHAT_IDS || '';
    return [...new Set(raw.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean))];
}

export async function sendTelegramMessage(chatId, text) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || !chatId || !text) {
        return { ok: false, skipped: true };
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });

        const data = await response.json().catch(() => ({}));
        return { ok: response.ok && data.ok !== false, data };
    } catch (error) {
        console.error('Telegram send error:', error);
        return { ok: false, error };
    }
}

export async function sendTelegramPhoto(chatId, photo, caption = '') {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || !chatId || !photo) {
        return { ok: false, skipped: true };
    }

    try {
        const formData = new FormData();
        formData.append('chat_id', String(chatId));

        if (caption) {
            formData.append('caption', caption);
            formData.append('parse_mode', 'HTML');
        }

        if (typeof photo === 'string') {
            formData.append('photo', photo);
        } else if (photo.buffer) {
            const blob = new Blob([photo.buffer], {
                type: photo.contentType || 'image/jpeg'
            });
            formData.append('photo', blob, photo.filename || 'incident-photo.jpg');
        } else {
            return { ok: false, skipped: true };
        }

        const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json().catch(() => ({}));
        return { ok: response.ok && data.ok !== false, data };
    } catch (error) {
        console.error('Telegram photo send error:', error);
        return { ok: false, error };
    }
}

export function escapeTelegramHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** แจ้งเหตุความปลอดภัย: กลุ่มผู้ดูแลระบบ + ผู้ดูแลที่เชื่อม Telegram ส่วนตัว (ดู lib/telegramChannels.js) */
export async function notifySecurityEvent(eventType, details = {}) {
    if (!process.env.TELEGRAM_BOT_TOKEN) return { ok: false, skipped: true };
    try {
        const { formatSecurityBody, sendCategorized } = await import('@/lib/telegramChannels');
        const result = await sendCategorized('security', formatSecurityBody(eventType, details, escapeTelegramHtml));
        return { ok: result.delivered > 0, ...result };
    } catch (error) {
        console.error('Telegram security alert error:', error?.message || error);
        return { ok: false, error };
    }
}
