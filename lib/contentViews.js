// ยอดเข้าชมเนื้อหาในหน้า "ประกาศและความรู้" (ไม่มีการเรียกเครือข่าย ทดสอบได้)
export const CONTENT_KINDS = {
  announcement: "ประกาศของศูนย์ฯ",
  riskcom: "สื่อความรู้ (riskcom)",
  infographic: "อินโฟกราฟิก"
};

const cleanTitle = (value) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) || null;

/** ตรวจสัญญาณการเปิดดู: { kind, id, title } — ประกาศ/อินโฟกราฟิกใช้รหัสตัวเลข, riskcom ใช้รหัสของคลังสื่อ */
export function validateContentView(body = {}) {
  const kind = Object.hasOwn(CONTENT_KINDS, body?.kind) ? body.kind : null;
  if (!kind) return { error: "kind" };
  const raw = String(body.id ?? "").trim();
  let id = null;
  if (kind === "riskcom") id = /^[A-Za-z0-9_-]{1,80}$/.test(raw.replace(/^riskcom-/, "")) ? raw.replace(/^riskcom-/, "") : null;
  else id = /^[1-9]\d{0,9}$/.test(raw) ? raw : null;
  if (!id) return { error: "id" };
  return { value: { kind, id, title: cleanTitle(body.title) } };
}

/** แถวจากฐานข้อมูล [{ kind, item_id, views, title, total_views? }] → รายการเรียงมากไปน้อย พร้อมยอดรวมต่อประเภท */
export function summarizeContentViews(rows = []) {
  const byKind = Object.fromEntries(Object.keys(CONTENT_KINDS).map((kind) => [kind, { views: 0, items: 0 }]));
  const items = rows
    .filter((row) => byKind[row.kind])
    .map((row) => ({
      kind: row.kind,
      id: String(row.item_id),
      title: row.title || `${CONTENT_KINDS[row.kind]} #${row.item_id}`,
      views: Number(row.views) || 0,
      total_views: row.total_views === undefined || row.total_views === null ? null : Number(row.total_views)
    }))
    .sort((a, b) => b.views - a.views || a.title.localeCompare(b.title, "th"));
  for (const item of items) {
    byKind[item.kind].views += item.views;
    byKind[item.kind].items += 1;
  }
  return { total: items.reduce((sum, item) => sum + item.views, 0), by_kind: byKind, items };
}

/** ลิงก์ไปยังเนื้อหาในหน้าประชาชน */
export function contentHref(kind, id) {
  if (kind === "announcement") return `/public/announcements/${id}`;
  if (kind === "riskcom") return `/public/announcements/riskcom/${id}`;
  return "/public/announcements#infographic-title";
}
