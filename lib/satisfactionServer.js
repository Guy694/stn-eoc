// บันทึก/อ่านการประเมินความพึงพอใจ (ฝั่งเซิร์ฟเวอร์)
import { query } from "@/lib/db";
import { getAuthSession, getSessionToken } from "@/lib/auth";
import { getUserAgent } from "@/lib/clientIp";
import { areaOf, cleanPath, describeUserAgent } from "@/lib/visitorLog";
import { summarizeRatings, summarizeSources } from "@/lib/satisfaction";

async function signedInRole(request) {
  if (!getSessionToken(request)) return null;
  try {
    const auth = await getAuthSession(request, { allowPasswordChangeRequired: true });
    return auth.success ? auth.user?.role || null : null;
  } catch {
    return null;
  }
}

export async function saveSatisfaction(request, { rating, comment, sources = null, sourceOther = null, path }) {
  const page = cleanPath(path);
  const role = await signedInRole(request);
  const { device } = describeUserAgent(getUserAgent(request));
  await query(
    "INSERT INTO satisfaction_feedback (rating, comment, sources, source_other, page_path, area, role, device) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [rating, comment, sources, sourceOther, page, role ? "staff" : areaOf(page || "/"), role ? String(role).slice(0, 30) : null, device]
  );
}

/** สรุปผลช่วงเวลา: ภาพรวม แยกประชาชน/เจ้าหน้าที่ รายวัน และข้อเสนอแนะล่าสุด */
export async function readSatisfaction({ days = 30, rating = null, commentsOnly = false, limit = 100 } = {}) {
  const span = [7, 30, 90, 365, 730].includes(Number(days)) ? Number(days) : 30;
  const where = ["created_at >= NOW() - INTERVAL ? DAY"];
  const params = [span];
  const [byRating, byArea, daily, bySources, otherRows] = await Promise.all([
    query(`SELECT rating, COUNT(*) AS n FROM satisfaction_feedback WHERE ${where.join(" AND ")} GROUP BY rating`, params),
    query(`SELECT area, rating, COUNT(*) AS n FROM satisfaction_feedback WHERE ${where.join(" AND ")} GROUP BY area, rating`, params),
    query(`SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS n, AVG(rating) AS avg FROM satisfaction_feedback WHERE ${where.join(" AND ")} GROUP BY day ORDER BY day`, params),
    query(`SELECT sources, COUNT(*) AS n FROM satisfaction_feedback WHERE ${where.join(" AND ")} AND sources IS NOT NULL GROUP BY sources`, params),
    query(`SELECT source_other FROM satisfaction_feedback WHERE ${where.join(" AND ")} AND source_other IS NOT NULL ORDER BY id DESC LIMIT 30`, params)
  ]);
  const listWhere = [...where];
  const listParams = [...params];
  if ([1, 2, 3, 4, 5].includes(Number(rating))) { listWhere.push("rating = ?"); listParams.push(Number(rating)); }
  if (commentsOnly) listWhere.push("comment IS NOT NULL AND comment <> ''");
  const size = Math.min(200, Math.max(10, Number(limit) || 100));
  const items = await query(
    `SELECT id, rating, comment, sources, source_other, page_path, area, role, device, created_at FROM satisfaction_feedback
      WHERE ${listWhere.join(" AND ")} ORDER BY id DESC LIMIT ${size}`, listParams
  );
  const [{ n: commentCount } = { n: 0 }] = await query(
    `SELECT COUNT(*) AS n FROM satisfaction_feedback WHERE ${where.join(" AND ")} AND comment IS NOT NULL AND comment <> ''`, params
  );
  return {
    days: span,
    summary: summarizeRatings(byRating),
    public: summarizeRatings(byArea.filter((row) => row.area === "public")),
    staff: summarizeRatings(byArea.filter((row) => row.area === "staff")),
    daily: daily.map((row) => ({ day: row.day, n: Number(row.n) || 0, average: row.avg === null ? null : Math.round(Number(row.avg) * 100) / 100 })),
    source_total: bySources.reduce((sum, row) => sum + (Number(row.n) || 0), 0),
    sources: summarizeSources(bySources),
    source_other: otherRows.map((row) => row.source_other),
    comment_count: Number(commentCount) || 0,
    items
  };
}
