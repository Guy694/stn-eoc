// บอท AI ที่ไม่อนุญาตให้อ่านเว็บนี้ (ใช้ทั้ง robots.txt และ proxy.js)
//
// 1) AI_ROBOTS_TOKENS: ชื่อใน robots.txt — บอทที่ทำตามกติกาจะไม่เก็บไปฝึกโมเดล/ทำดัชนี/อ่านแทนผู้ใช้
//    (บางชื่อเป็น "token" สำหรับ robots.txt เท่านั้น ไม่มีใน User-Agent จริง เช่น Google-Extended, Applebot-Extended)
// 2) AI_USER_AGENT_PATTERN: ตรวจ User-Agent ใน proxy.js → ตอบ 403
//    ครอบคลุมทั้งบอทเก็บข้อมูล และ "ตัวดึงเว็บแทนผู้ใช้" (เช่น วาง URL ในแชต ChatGPT/Claude/Perplexity)
//
// ข้อจำกัด: ปลอม User-Agent ได้ และ AI ที่ควบคุมเบราว์เซอร์จริงจะผ่านได้ — เป็นการกันแบบพื้นฐาน ไม่ใช่การป้องกันเด็ดขาด
// ห้ามใส่: Googlebot, Bingbot (ประชาชนต้องค้นเว็บเจอ) และตัวทำภาพตัวอย่างลิงก์ facebookexternalhit, Twitterbot, Line, Slackbot

export const AI_ROBOTS_TOKENS = [
  // OpenAI
  "GPTBot", "ChatGPT-User", "OAI-SearchBot",
  // Anthropic
  "ClaudeBot", "Claude-User", "Claude-SearchBot", "Claude-Web", "anthropic-ai",
  // Google / Apple (token สำหรับการใช้ข้อมูลกับ AI — ไม่กระทบการค้นหาปกติ)
  "Google-Extended", "Applebot-Extended",
  // Perplexity, Meta, ByteDance, Amazon, Common Crawl และอื่น ๆ
  "PerplexityBot", "Perplexity-User",
  "meta-externalagent", "meta-externalfetcher",
  "Bytespider", "Amazonbot", "CCBot",
  "cohere-ai", "cohere-training-data-crawler", "MistralAI-User", "DuckAssistBot",
  "YouBot", "Diffbot", "Timpibot", "ImagesiftBot", "omgili", "AI2Bot", "Ai2Bot-Dolma", "PanguBot"
];

// token ที่ไม่ปรากฏใน User-Agent จริง ไม่ต้องตรวจใน proxy
const ROBOTS_ONLY = new Set(["Google-Extended", "Applebot-Extended"]);

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const AI_USER_AGENT_PATTERN = new RegExp(
  `(?:${AI_ROBOTS_TOKENS.filter((token) => !ROBOTS_ONLY.has(token)).map(escape).join("|")})`,
  "i"
);

export function isAiBot(userAgent) {
  return Boolean(userAgent) && AI_USER_AGENT_PATTERN.test(String(userAgent));
}
