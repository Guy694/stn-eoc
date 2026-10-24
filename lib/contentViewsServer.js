// บันทึก/อ่านยอดเข้าชมเนื้อหาในหน้า "ประกาศและความรู้" (ฝั่งเซิร์ฟเวอร์)
import { query } from "@/lib/db";
import { summarizeContentViews } from "@/lib/contentViews";
import { INFOGRAPHIC_TYPES, infographicTitle } from "@/lib/infographicAssets";

const missing = (error) => error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_FIELD_ERROR";

/** ชื่อเรื่องจากฐานข้อมูลของเรา (ไม่เชื่อชื่อที่หน้าเว็บส่งมา) — null = ไม่พบ */
async function trustedTitle(kind, id) {
  if (kind === "announcement") {
    const rows = await query("SELECT title FROM announcements WHERE id = ? AND is_active = 1 LIMIT 1", [id]);
    return rows[0] ? rows[0].title : null;
  }
  if (kind === "infographic") {
    const rows = await query("SELECT eoc_type, original_filename FROM eoc_file_assets WHERE id = ? AND asset_type = 'infographic' LIMIT 1", [id]);
    return rows[0] && INFOGRAPHIC_TYPES.includes(rows[0].eoc_type) ? infographicTitle(rows[0].original_filename) : null;
  }
  return undefined; // riskcom: สื่ออยู่นอกระบบ ใช้ชื่อที่หน้าสื่อแสดง
}

/** +1 ยอดวันนี้ (ตัวกันปั่นยอดอยู่ที่ route) — คืน false ถ้าไม่พบเนื้อหา */
export async function recordContentView({ kind, id, title }) {
  const known = await trustedTitle(kind, id);
  if (known === null) return false;
  const name = String(known ?? title ?? "").slice(0, 200) || null;
  await query(
    `INSERT INTO content_views (kind, item_id, view_date, views, title) VALUES (?, ?, CURDATE(), 1, ?)
     ON DUPLICATE KEY UPDATE views = views + 1, title = COALESCE(VALUES(title), title)`,
    [kind, String(id), name]
  );
  return true;
}

/** ยอดเข้าชมในช่วงที่เลือก (รายชิ้น + รายวัน) — ประกาศของศูนย์ฯ แนบยอดสะสมทั้งหมด (นับมาก่อนมีตารางนี้) */
export async function readContentViews({ days = 30 } = {}) {
  const span = [7, 30, 90, 365].includes(Number(days)) ? Number(days) : 30;
  let rows = [];
  let daily = [];
  let ready = true;
  try {
    [rows, daily] = await Promise.all([
      query(
        `SELECT kind, item_id, SUM(views) AS views, SUBSTRING_INDEX(GROUP_CONCAT(title ORDER BY view_date DESC SEPARATOR '\\n'), '\\n', 1) AS title
         FROM content_views WHERE view_date >= CURDATE() - INTERVAL ? DAY GROUP BY kind, item_id`, [span - 1]),
      query(
        `SELECT DATE_FORMAT(view_date, '%Y-%m-%d') AS day, kind, SUM(views) AS views
         FROM content_views WHERE view_date >= CURDATE() - INTERVAL ? DAY GROUP BY day, kind ORDER BY day`, [span - 1])
    ]);
  } catch (error) {
    if (!missing(error)) throw error;
    ready = false;
  }
  // ยอดสะสมของประกาศ (คอลัมน์ view_count เดิม) — แสดงทุกประกาศที่เผยแพร่อยู่ แม้ยังไม่มียอดในช่วงนี้
  const totals = await query("SELECT id, title, view_count FROM announcements WHERE is_active = 1").catch(() => []);
  const seen = new Set(rows.filter((row) => row.kind === "announcement").map((row) => String(row.item_id)));
  const totalById = new Map(totals.map((row) => [String(row.id), Number(row.view_count || 0)]));
  const withTotals = rows.map((row) => (row.kind === "announcement" ? { ...row, total_views: totalById.get(String(row.item_id)) ?? null } : row));
  for (const row of totals) {
    if (!seen.has(String(row.id)) && Number(row.view_count) > 0) withTotals.push({ kind: "announcement", item_id: row.id, views: 0, title: row.title, total_views: Number(row.view_count) });
  }
  return { days: span, ready, ...summarizeContentViews(withTotals), daily: daily.map((row) => ({ day: row.day, kind: row.kind, views: Number(row.views) || 0 })) };
}
