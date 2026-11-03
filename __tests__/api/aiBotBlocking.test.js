/** @jest-environment node */
// กันบอท AI: robots.txt ห้ามบอท AI แต่ยังให้ Google/Bing ค้นได้ · proxy ตอบ 403 ตาม User-Agent
const { NextRequest } = require('next/server');

jest.mock('@/lib/maintenance', () => ({
    getMaintenanceState: jest.fn(async () => ({ enabled: false })),
    sessionRole: jest.fn(async () => null),
}));
jest.mock('@/lib/siteUrl', () => ({ getSiteUrl: () => 'https://example.go.th/stn-eoc' }));

const { proxy } = require('@/proxy');
const robots = require('@/app/robots').default;
const { AI_ROBOTS_TOKENS, isAiBot } = require('@/lib/aiBots');

const nextConfig = { basePath: '/stn-eoc', trailingSlash: true };
const request = (path, userAgent) => new NextRequest(`http://localhost${path}`, { headers: { 'user-agent': userAgent }, nextConfig });

const AI_AGENTS = [
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
    'Claude-User/1.0',
    'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
    'Perplexity-User/1.0',
    'CCBot/2.0 (https://commoncrawl.org/faq/)',
    'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)',
    'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
];
const ALLOWED_AGENTS = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 Line/14.0.0',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Twitterbot/1.0',
];

describe('AI bot blocking', () => {
    test.each(AI_AGENTS)('403 สำหรับหน้าเว็บ: %s', async (ua) => {
        expect(isAiBot(ua)).toBe(true);
        const response = await proxy(request('/stn-eoc/', ua));
        expect(response.status).toBe(403);
        expect(response.headers.get('x-robots-tag')).toMatch(/noai/);
    });

    test('API ตอบ 403 เป็น JSON', async () => {
        const response = await proxy(request('/stn-eoc/api/public/weather-watch/', AI_AGENTS[1]));
        expect(response.status).toBe(403);
        expect((await response.json()).success).toBe(false);
    });

    test.each(ALLOWED_AGENTS)('เบราว์เซอร์ / บอทค้นหา / ภาพตัวอย่างลิงก์ ผ่านได้: %s', async (ua) => {
        expect(isAiBot(ua)).toBe(false);
        const response = await proxy(request('/stn-eoc/public/weather-watch/', ua));
        expect(response.status).not.toBe(403);
    });

    test('ไม่มี User-Agent ไม่ถือเป็นบอท AI', () => {
        expect(isAiBot('')).toBe(false);
        expect(isAiBot(null)).toBe(false);
    });

    test('robots.txt: ห้ามบอท AI ทั้งเว็บ แต่บอทค้นหาทั่วไปยังอ่านหน้าประชาชนได้', () => {
        const { rules } = robots();
        const ai = rules.find((rule) => Array.isArray(rule.userAgent));
        expect(ai.userAgent).toEqual(expect.arrayContaining(['GPTBot', 'ClaudeBot', 'Google-Extended', 'PerplexityBot', 'CCBot']));
        expect(ai.disallow).toEqual(['/']);
        const everyone = rules.find((rule) => rule.userAgent === '*');
        expect(everyone.allow).toContain('/public/');
        expect(AI_ROBOTS_TOKENS).not.toContain('Googlebot');
    });
});
