// แจ้งเตือนอัตโนมัติ: ตรวจเหตุสำคัญจากข้อมูลสรุปของเหตุการณ์ แล้วสร้างข้อความที่ "ส่งครั้งเดียวต่อเรื่อง"
// (alert key ผูกกับสิ่งที่เกิด เช่น ศูนย์ id / รายการยา id / จำนวนผู้เสียชีวิต จึงไม่ส่งซ้ำ แต่ส่งใหม่เมื่อสถานการณ์แย่ลง)

export function detectAlerts(brief, { eventLabel = "เหตุการณ์" } = {}) {
  const alerts = [];
  const add = (key, level, text) => alerts.push({ key, level, text });

  const deaths = Number(brief.health?.totals?.deaths) || 0;
  if (deaths > 0) add(`deaths:${deaths}`, "critical", `☠️ มีผู้เสียชีวิตในศูนย์พักพิงรวม ${deaths} ราย (${eventLabel})`);

  for (const action of brief.health?.actions || []) {
    if (action.level === "serious" && action.title.startsWith("อ.")) add(`health-district:${action.title.split(" ")[0]}`, "serious", `🦠 ${action.title} — ${action.detail}`);
  }

  for (const item of brief.shelters?.attention || []) {
    if (item.reasons.some((reason) => reason.text === "เต็ม/เกินความจุ")) add(`shelter-full:${item.id}`, "serious", `🏫 ศูนย์พักพิงเต็ม: ${item.name}${item.district ? ` อ.${item.district}` : ""}`);
    if (item.reasons.some((reason) => reason.text === "มีผู้ป่วยอาการรุนแรง")) add(`shelter-severe:${item.id}`, "serious", `🚑 มีผู้ป่วยอาการรุนแรงในศูนย์ ${item.name}`);
  }

  for (const row of brief.supplies?.critical || []) {
    if (row.level === "out") add(`stock-out:${row.id}`, "serious", `💊 เวชภัณฑ์หมด: ${row.item_name} ที่ ${row.agency_name}`);
  }

  for (const ticket of brief.it?.openTickets || []) {
    if (ticket.severity === "critical") add(`it-critical:${ticket.id}`, "critical", `🖥️ IT วิกฤต ${ticket.ticket_no}: ${ticket.title} (${ticket.unit_name})`);
  }

  return alerts;
}

export function formatAlertMessage({ eventLabel, alerts, escape = (value) => value, link }) {
  const lines = [`<b>แจ้งเตือนอัตโนมัติ ${escape(eventLabel)}</b>`, ...alerts.map((alert) => `• ${escape(alert.text)}`)];
  if (link) lines.push("", `ดูสรุป: ${escape(link)}`);
  return lines.join("\n");
}
