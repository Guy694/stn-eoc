// ประเมินความพึงพอใจระบบ: ให้ดาว 1–5 (บังคับ) + ข้อเสนอแนะ (ไม่บังคับ) — ไม่มีการเรียกเครือข่ายในไฟล์นี้
export const RATING_LABELS = { 1: "ไม่พอใจมาก", 2: "ไม่พอใจ", 3: "พอใช้", 4: "พอใจ", 5: "พอใจมาก" };
export const COMMENT_MAX = 1000;
// เครื่องเดิมประเมินซ้ำได้หลัง 30 วัน (จำไว้ในเครื่องผู้ใช้เท่านั้น)
export const RATED_KEY = "stn-eoc:satisfaction";
export const RATE_AGAIN_DAYS = 30;

// ช่องทางที่รู้จักระบบ (เลือกได้หลายข้อ ไม่บังคับ)
export const SOURCE_CHANNELS = {
  facebook: "Facebook",
  line: "LINE",
  website: "เว็บไซต์ สสจ.สตูล / หน่วยงาน",
  search: "ค้นหาจาก Google",
  person: "คนรู้จัก / เจ้าหน้าที่แนะนำ",
  print: "โปสเตอร์ / QR code",
  other: "อื่น ๆ"
};
export const SOURCE_OTHER_MAX = 100;

// เสนอให้ประเมินเมื่อใช้งานมาสักพัก: เข้า ≥ 3 ครั้ง หรือเปิด ≥ 8 หน้า หรือกลับมาเข้าคนละวัน (และเปิด ≥ 3 หน้า)
export const VISITS_KEY = "stn-eoc:visits";
export const ASK_AFTER = { sessions: 3, pages: 8, minPagesAcrossDays: 3 };
export const ASK_SNOOZE_DAYS = 14;
export const ASK_DELAY_MS = 20000;

const clean = (value) => String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/[ \t]+/g, " ").trim();

export function validateSatisfaction(body = {}) {
  const rating = Number(body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "กรุณาให้คะแนน 1–5 ดาว" };
  const comment = clean(body?.comment).slice(0, COMMENT_MAX) || null;
  const picked = [...new Set((Array.isArray(body?.sources) ? body.sources : []).map(String).filter((key) => SOURCE_CHANNELS[key]))];
  const sources = picked.length ? picked.join(",") : null;
  const sourceOther = picked.includes("other") ? clean(body?.sourceOther).slice(0, SOURCE_OTHER_MAX) || null : null;
  return { value: { rating, comment, sources, sourceOther } };
}

/** แถว [{ rating, n }] → { total, average, counts: {1..5}, percent: {1..5}, satisfied } — satisfied = % ที่ให้ 4–5 ดาว */
export function summarizeRatings(rows = []) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of rows) {
    const rating = Number(row.rating);
    if (counts[rating] !== undefined) counts[rating] += Number(row.n) || 0;
  }
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const sum = Object.entries(counts).reduce((acc, [rating, n]) => acc + Number(rating) * n, 0);
  const pct = (n) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  return {
    total,
    average: total ? Math.round((sum / total) * 100) / 100 : null,
    counts,
    percent: Object.fromEntries(Object.entries(counts).map(([rating, n]) => [rating, pct(n)])),
    satisfied: total ? pct(counts[4] + counts[5]) : null
  };
}

/** เครื่องนี้ประเมินไปเมื่อไม่นานหรือยัง */
export function ratedRecently(state, now = Date.now()) {
  const at = Number(state?.at);
  return Number.isFinite(at) && now - at < RATE_AGAIN_DAYS * 86400000;
}

/** รหัสช่องทางที่เลือก (คั่นด้วยจุลภาค) → จำนวนต่อช่องทาง [{ key, label, n }] เรียงมาก→น้อย */
export function summarizeSources(rows = []) {
  const counts = {};
  for (const row of rows) {
    for (const key of String(row.sources || "").split(",")) {
      if (SOURCE_CHANNELS[key]) counts[key] = (counts[key] || 0) + (Number(row.n) || 0);
    }
  }
  return Object.entries(counts).map(([key, n]) => ({ key, label: SOURCE_CHANNELS[key], n })).sort((a, b) => b.n - a.n);
}

const bangkokDay = (now) => new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 10);

/** บันทึกการเข้าชมหนึ่งหน้า (เก็บในเครื่องผู้ใช้เท่านั้น) */
export function recordVisit(state, { now = Date.now(), newSession = false } = {}) {
  const days = Array.isArray(state?.days) ? state.days.slice(-9) : [];
  const day = bangkokDay(now);
  if (!days.includes(day)) days.push(day);
  return {
    first: Number(state?.first) || now,
    sessions: (Number(state?.sessions) || 0) + (newSession ? 1 : 0),
    pages: (Number(state?.pages) || 0) + 1,
    days,
    dismissedAt: Number(state?.dismissedAt) || null
  };
}

/** ควรเด้งขอให้ประเมินหรือยัง */
export function shouldAskSatisfaction(state, rated, now = Date.now()) {
  if (!state || ratedRecently(rated, now)) return false;
  if (state.dismissedAt && now - state.dismissedAt < ASK_SNOOZE_DAYS * 86400000) return false;
  return state.sessions >= ASK_AFTER.sessions
    || state.pages >= ASK_AFTER.pages
    || (Array.isArray(state.days) && state.days.length >= 2 && state.pages >= ASK_AFTER.minPagesAcrossDays);
}
