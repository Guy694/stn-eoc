// แจ้งเตือนเจ้าหน้าที่เมื่อมีคำขอความช่วยเหลือจากประชาชน (ไม่มีการเรียกเครือข่าย ทดสอบได้)
// - เรื่องใหม่: เด้งทันที
// - ยังไม่มีผู้รับเรื่อง (สถานะ "รอตรวจสอบ"): เตือนซ้ำทุก 30 นาที สูงสุด 6 ครั้ง (3 ชั่วโมง)
export const ESCALATE_EVERY_MIN = 30;
export const MAX_ESCALATIONS = 6;

const HELP_CATEGORY_PREFIX = /^ประเภทความช่วยเหลือ:\s*/;

export function placeText(row = {}) {
  return [row.village && `บ.${row.village}`, row.sub_district && `ต.${row.sub_district}`, row.district && `อ.${row.district}`].filter(Boolean).join(" ") || "ไม่ระบุพื้นที่";
}

/** ข้อความสั้นจากคำอธิบาย (บรรทัดแรกที่มีเนื้อหา) */
export function summaryText(description = "", max = 140) {
  const lines = String(description || "").split("\n").map((line) => line.trim()).filter(Boolean);
  const reason = lines.find((line) => line.startsWith("เหตุผล")) || lines.find((line) => !HELP_CATEGORY_PREFIX.test(line)) || lines[0] || "";
  const text = reason.replace(/^เหตุผลการขอความช่วยเหลือ:\s*/, "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function categoryText(description = "") {
  const line = String(description || "").split("\n").find((l) => HELP_CATEGORY_PREFIX.test(l.trim()));
  return line ? line.trim().replace(HELP_CATEGORY_PREFIX, "") : null;
}

export const waitedMinutes = (createdAt, now = Date.now()) => Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));

/** ครั้งที่ต้องเตือนซ้ำ ณ ตอนนี้ (0 = ยังไม่ถึง 30 นาที) ไม่เกิน MAX_ESCALATIONS */
export function escalationStep(waitedMin, every = ESCALATE_EVERY_MIN) {
  const step = Math.floor((Number(waitedMin) || 0) / every);
  return Math.min(step, MAX_ESCALATIONS);
}

export function waitedText(minutes) {
  if (minutes < 60) return `${minutes} นาที`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชม. ${minutes % 60} นาที`;
  return `${Math.floor(hours / 24)} วัน ${hours % 24} ชม.`;
}

/** แถวฐานข้อมูล → รายการที่ส่งให้หน้าเว็บเจ้าหน้าที่ (ไม่ส่งเบอร์โทร/ชื่อเต็มไปกับการแจ้งเตือน) */
export function helpAlertItem(row, now = Date.now()) {
  const waited = waitedMinutes(row.created_at, now);
  return {
    id: Number(row.id),
    created_at: row.created_at,
    waited_min: waited,
    escalation: escalationStep(waited),
    urgency: row.urgency || null,
    place: placeText(row),
    district: row.district || null,
    category: categoryText(row.description),
    summary: summaryText(row.description)
  };
}

const URGENCY_LABEL = { critical: "วิกฤต", high: "สูง", medium: "ปานกลาง", low: "ต่ำ" };

/** ข้อความ push ถึงมือถือเจ้าหน้าที่ (step 0 = เรื่องใหม่, ≥1 = ค้าง) */
export function officerHelpPayload(item, step = 0, now = Date.now()) {
  const urgency = URGENCY_LABEL[item.urgency] ? ` • ความเร่งด่วน${URGENCY_LABEL[item.urgency]}` : "";
  return {
    title: step === 0
      ? `🆘 คำขอความช่วยเหลือใหม่ #${item.id}`
      : `⏰ คำขอ #${item.id} รอ ${waitedText(item.waited_min)} ยังไม่มีผู้รับเรื่อง`,
    body: `${item.place}${urgency}\n${[item.category, item.summary].filter(Boolean).join(": ")}`.slice(0, 400),
    url: `/stn-eoc/admin/incident-reports/?status=pending&id=${item.id}`,
    tag: `help-${item.id}`,
    level: "high",
    at: new Date(now).toISOString()
  };
}
