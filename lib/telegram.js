export function getTelegramBotUsername() {
    return process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || '';
}

export function buildTelegramBotLink(payload = '') {
    const username = getTelegramBotUsername();
    if (!username) return '';
    const suffix = payload ? `?start=${encodeURIComponent(payload)}` : '';
    return `https://t.me/${username}${suffix}`;
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

export function escapeTelegramHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
