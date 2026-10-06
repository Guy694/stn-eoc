// รายงาน IT support ในเหตุการณ์ — ตรรกะที่ไม่แตะฐานข้อมูล (ทดสอบได้)

export const IT_CATEGORIES = {
  internet: "อินเทอร์เน็ต",
  network: "เครือข่าย/Wi-Fi",
  server: "เซิร์ฟเวอร์/ระบบงาน",
  hardware: "คอมพิวเตอร์/อุปกรณ์",
  software: "โปรแกรม/แอป",
  radio: "วิทยุสื่อสาร",
  power: "ไฟฟ้า/เครื่องสำรองไฟ",
  other: "อื่น ๆ"
};
export const IT_SEVERITIES = {
  critical: { label: "วิกฤต", hint: "ศูนย์สั่งการ/การสื่อสารหลักใช้ไม่ได้", tone: "red" },
  high: { label: "สูง", hint: "งานหลักของหน่วยติดขัด", tone: "amber" },
  medium: { label: "ปานกลาง", hint: "ใช้งานได้แต่ช้า/บางส่วน", tone: "blue" },
  low: { label: "ต่ำ", hint: "ไม่กระทบงานเร่งด่วน", tone: "gray" }
};
export const IT_STATUSES = {
  open: { label: "รอดำเนินการ", tone: "red" },
  in_progress: { label: "กำลังแก้ไข", tone: "amber" },
  resolved: { label: "แก้ไขแล้ว", tone: "green" },
  closed: { label: "ปิดเรื่อง", tone: "gray" }
};
export const RESOURCE_STATUSES = {
  online: { label: "ออนไลน์", tone: "green" },
  offline: { label: "ออฟไลน์", tone: "red" },
  maintenance: { label: "ซ่อมบำรุง", tone: "amber" },
  unknown: { label: "ไม่ทราบ", tone: "gray" }
};

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const isOpen = (status) => status === "open" || status === "in_progress";

export function validateTicket(input) {
  const ticket = {
    unit_name: String(input.unit_name || "").trim().slice(0, 255),
    title: String(input.title || "").trim().slice(0, 255),
    detail: String(input.detail || "").trim() || null,
    category: IT_CATEGORIES[input.category] ? input.category : "other",
    severity: IT_SEVERITIES[input.severity] ? input.severity : "medium",
    status: IT_STATUSES[input.status] ? input.status : "open",
    assignee: String(input.assignee || "").trim().slice(0, 255) || null,
    workaround: String(input.workaround || "").trim() || null,
    resolution: String(input.resolution || "").trim() || null,
    reporter_name: String(input.reporter_name || "").trim().slice(0, 255) || null,
    reporter_phone: String(input.reporter_phone || "").trim().slice(0, 50) || null,
    it_resource_id: Number(input.it_resource_id) > 0 ? Number(input.it_resource_id) : null,
    reported_at: input.reported_at ? String(input.reported_at) : null
  };
  if (!ticket.unit_name) return { ok: false, error: "กรุณาระบุหน่วยงาน/จุดที่เกิดปัญหา" };
  if (!ticket.title) return { ok: false, error: "กรุณาระบุหัวข้อปัญหา" };
  if (ticket.reported_at && Number.isNaN(new Date(ticket.reported_at).getTime())) return { ok: false, error: "วันเวลาที่แจ้งไม่ถูกต้อง" };
  if ((ticket.status === "resolved" || ticket.status === "closed") && !ticket.resolution) {
    return { ok: false, error: "กรุณาระบุผลการแก้ไขก่อนปิดเรื่อง" };
  }
  return { ok: true, ticket };
}

export function nextTicketNo(sessionNumber, existingNumbers) {
  const prefix = `IT${sessionNumber || ""}-`;
  const max = existingNumbers.reduce((highest, value) => {
    const match = String(value || "").match(/-(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/** แสดงช่วงเวลาให้อ่านง่าย: ต่ำกว่า 1 ชม. เป็นนาที, ต่ำกว่า 48 ชม. เป็นชั่วโมง, มากกว่านั้นเป็นวัน */
export function formatDuration(hours) {
  if (hours === null || hours === undefined || !Number.isFinite(Number(hours))) return "-";
  const value = Math.max(0, Number(hours));
  if (value < 1) return `${Math.max(1, Math.round(value * 60))} นาที`;
  if (value < 48) return `${Math.round(value * 10) / 10} ชม.`;
  return `${Math.round((value / 24) * 10) / 10} วัน`;
}

const hoursBetween = (from, to) => (new Date(to).getTime() - new Date(from).getTime()) / 3600000;

export function sortTickets(tickets) {
  return [...tickets].sort((a, b) => {
    const openDiff = Number(!isOpen(a.status)) - Number(!isOpen(b.status));
    if (openDiff) return openDiff;
    const severityDiff = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
    if (severityDiff) return severityDiff;
    return new Date(b.reported_at) - new Date(a.reported_at);
  });
}

export function summarizeIt(tickets = [], resources = [], now = Date.now()) {
  const open = tickets.filter((ticket) => isOpen(ticket.status));
  const resolved = tickets.filter((ticket) => !isOpen(ticket.status) && ticket.resolved_at);
  const durations = resolved.map((ticket) => hoursBetween(ticket.reported_at, ticket.resolved_at)).filter((hours) => hours >= 0);
  const today = new Date(now);
  const sameDay = (value) => { const date = new Date(value); return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate(); };
  const byCategory = Object.keys(IT_CATEGORIES)
    .map((key) => ({ key, label: IT_CATEGORIES[key], total: tickets.filter((ticket) => ticket.category === key).length, open: open.filter((ticket) => ticket.category === key).length }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.open - a.open || b.total - a.total);
  const resourceCounts = Object.fromEntries(Object.keys(RESOURCE_STATUSES).map((key) => [key, resources.filter((row) => (row.status || "unknown") === key).length]));
  const oldestOpen = open.reduce((oldest, ticket) => (!oldest || new Date(ticket.reported_at) < new Date(oldest.reported_at) ? ticket : oldest), null);
  return {
    total: tickets.length,
    open: open.length,
    critical: open.filter((ticket) => ticket.severity === "critical" || ticket.severity === "high").length,
    resolvedToday: resolved.filter((ticket) => sameDay(ticket.resolved_at)).length,
    avgHoursToResolve: durations.length ? Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10 : null,
    oldestOpenHours: oldestOpen ? Math.max(0, hoursBetween(oldestOpen.reported_at, now)) : null,
    byCategory,
    resources: { total: resources.length, ...resourceCounts },
    unitsWithProblems: [...new Set(open.map((ticket) => ticket.unit_name))]
  };
}
