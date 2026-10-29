// ประเมินความพึงพอใจระบบ: ให้ดาว 1–5 (บังคับ) + ข้อเสนอแนะ (ไม่บังคับ) — ไม่มีการเรียกเครือข่ายในไฟล์นี้
export const RATING_LABELS = { 1: "ไม่พอใจมาก", 2: "ไม่พอใจ", 3: "พอใช้", 4: "พอใจ", 5: "พอใจมาก" };
export const COMMENT_MAX = 1000;
// เครื่องเดิมประเมินซ้ำได้หลัง 30 วัน (จำไว้ในเครื่องผู้ใช้เท่านั้น)
export const RATED_KEY = "stn-eoc:satisfaction";
export const RATE_AGAIN_DAYS = 30;

const clean = (value) => String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/[ \t]+/g, " ").trim();

export function validateSatisfaction(body = {}) {
  const rating = Number(body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "กรุณาให้คะแนน 1–5 ดาว" };
  const comment = clean(body?.comment).slice(0, COMMENT_MAX) || null;
  return { value: { rating, comment } };
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
