// รายงานประจำวัน "สถานการณ์/ข้อสั่งการ" แบบเป็นข้อๆ — ตรรกะที่ไม่แตะฐานข้อมูล (ทดสอบได้)

export const MAX_ITEMS = 200;
export const MAX_LENGTH = 2000;
export const MAX_LEVEL = 2;

/** ทำความสะอาดรายการจากฟอร์ม: ตัดช่องว่าง ตัดข้อว่าง จำกัดความยาว/ระดับย่อหน้า */
export function normalizeItems(items) {
  if (!Array.isArray(items)) return { ok: false, error: "รูปแบบข้อมูลไม่ถูกต้อง" };
  const cleaned = items
    .map((item) => ({
      id: Number.isInteger(Number(item?.id)) && Number(item.id) > 0 ? Number(item.id) : null,
      content: String(item?.content ?? "").replace(/\s+$/g, "").replace(/^\s+/g, ""),
      level: Math.min(MAX_LEVEL, Math.max(0, Math.round(Number(item?.level) || 0))),
      status: item?.status === "done" ? "done" : "open"
    }))
    .filter((item) => item.content.length > 0);
  if (cleaned.length > MAX_ITEMS) return { ok: false, error: `บันทึกได้ไม่เกิน ${MAX_ITEMS} ข้อต่อวัน` };
  const tooLong = cleaned.findIndex((item) => item.content.length > MAX_LENGTH);
  if (tooLong >= 0) return { ok: false, error: `ข้อที่ ${tooLong + 1} ยาวเกิน ${MAX_LENGTH} ตัวอักษร` };
  // ข้อแรกเป็นข้อย่อยไม่ได้ และย่อหน้าได้ทีละ 1 ระดับจากข้อก่อนหน้า
  let previous = -1;
  for (const item of cleaned) {
    item.level = Math.min(item.level, previous + 1);
    previous = item.level;
  }
  return { ok: true, items: cleaned.map((item, index) => ({ ...item, order: index })) };
}

/** เทียบกับของเดิมในฐานข้อมูล → แถวที่ต้องเพิ่ม/แก้/ลบ */
export function diffItems(existing, incoming) {
  const byId = new Map(existing.map((row) => [Number(row.id), row]));
  const keep = new Set();
  const inserts = [];
  const updates = [];
  for (const item of incoming) {
    const current = item.id ? byId.get(item.id) : null;
    if (!current) { inserts.push(item); continue; }
    keep.add(item.id);
    const changed = current.content !== item.content || Number(current.item_level) !== item.level
      || Number(current.item_order) !== item.order || current.item_status !== item.status;
    if (changed) updates.push({ ...item, statusChanged: current.item_status !== item.status });
  }
  const deletes = existing.filter((row) => !keep.has(Number(row.id))).map((row) => Number(row.id));
  return { inserts, updates, deletes };
}

/** ตัวระบุเวอร์ชันของรายการวันนั้น ใช้กันคนสองคนบันทึกทับกัน */
export function versionOf(rows) {
  if (!rows.length) return "empty";
  const latest = rows.reduce((max, row) => {
    const time = new Date(row.updated_at).getTime() || 0;
    return time > max ? time : max;
  }, 0);
  return `${rows.length}-${latest}-${rows.map((row) => row.id).join(".")}`;
}

/** เลขข้อแบบ 1, 1.1, 1.1.1 ตามระดับย่อหน้า */
export function numberItems(items) {
  const counters = [0, 0, 0];
  return items.map((item) => {
    const level = Math.min(MAX_LEVEL, Math.max(0, Number(item.level ?? item.item_level) || 0));
    counters[level] += 1;
    for (let index = level + 1; index < counters.length; index += 1) counters[index] = 0;
    return counters.slice(0, level + 1).map((value) => value || 1).join(".");
  });
}
