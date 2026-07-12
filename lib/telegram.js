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

export function getTelegramSecurityChatIds() {
    const raw = process.env.TELEGRAM_SECURITY_CHAT_IDS
        || process.env.TELEGRAM_NOTIFY_CHAT_IDS
        || process.env.TELEGRAM_HELP_NOTIFY_CHAT_IDS
        || '';
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

export async function notifySecurityEvent(eventType, details = {}) {
    const chatIds = getTelegramSecurityChatIds();
    if (!process.env.TELEGRAM_BOT_TOKEN || chatIds.length === 0) {
        return { ok: false, skipped: true };
    }

    const detailLines = Object.entries(details)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .slice(0, 10)
        .map(([key, value]) => `<b>${escapeTelegramHtml(key)}:</b> ${escapeTelegramHtml(String(value).slice(0, 500))}`);
    const text = [
        '🚨 <b>STN-EOC Security Alert</b>',
        `<b>event:</b> ${escapeTelegramHtml(eventType)}`,
        `<b>time:</b> ${escapeTelegramHtml(new Date().toISOString())}`,
        ...detailLines
    ].join('\n');

    const results = await Promise.all(chatIds.map((chatId) => sendTelegramMessage(chatId, text)));
    return { ok: results.some((result) => result.ok), results };
}
