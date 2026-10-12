// รวม "เรื่องที่ต้องตัดสินใจ/ติดตาม" จากทุกโมดูลเป็นรายการเดียว เรียงตามความเร่งด่วน (ไม่แตะฐานข้อมูล ทดสอบได้)
import { PRIORITY_TYPE_KEYS, areaLabel } from "@/lib/vulnerableEvent";

export const LEVEL_ORDER = { critical: 0, serious: 1, warning: 2, info: 3 };
export const LEVEL_LABELS = { critical: "วิกฤต", serious: "เร่งด่วน", warning: "เฝ้าระวัง", info: "ข้อมูล" };

const fmt = (value) => Number(value || 0).toLocaleString("th-TH");
const list = (names, max = 4) => (names.length > max ? `${names.slice(0, max).join(", ")} และอีก ${names.length - max}` : names.join(", "));

function waitText(minutes) {
  if (minutes < 60) return `${minutes} นาที`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} ชม. ${minutes % 60} นาที` : `${Math.floor(hours / 24)} วัน`;
}

export function buildAgenda(brief, base = "/eoc/flood") {
  const items = [];
  const push = (level, module, title, detail, href) => items.push({ level, module, title, detail, href });

  // ผลกระทบจากน้ำท่วม / ผู้ประสบภัย
  const impact = brief.impact;
  if (impact) {
    const loss = (impact.casualties?.deaths || 0) + (impact.casualties?.missing || 0);
    if (loss > 0) push("critical", "ผู้ประสบภัย", `ผู้เสียชีวิต ${fmt(impact.casualties.deaths)} · สูญหาย ${fmt(impact.casualties.missing)} คน`, "รายงานผู้บังคับบัญชา ประสานค้นหาและดูแลครอบครัว", `${base}/affected`);
    if (impact.latest?.severe > 0) {
      const severeDistricts = (impact.districts || []).filter((row) => row.severe > 0).map((row) => `อ.${String(row.district).replace(/^(อำเภอ|อ\.)\s*/, "")}`);
      push("serious", "พื้นที่น้ำท่วม", `น้ำท่วมระดับรุนแรง ${fmt(impact.latest.severe)} หมู่บ้าน`, `${list(severeDistricts)} — จัดลำดับทีมช่วยเหลือ/อพยพ`, `${base}/records`);
    }
    if (impact.latest && impact.previous && impact.latest.people > impact.previous.people) {
      push("warning", "พื้นที่น้ำท่วม", `ผู้ได้รับผลกระทบเพิ่มขึ้น ${fmt(impact.latest.people - impact.previous.people)} คน`, `${fmt(impact.previous.people)} → ${fmt(impact.latest.people)} คน (${impact.previous.date} → ${impact.latest.date})`, `${base}/records`);
    }
  }

  // สถานะการฟื้นตัวรายตำบล (คำนวณจากบันทึกพื้นที่น้ำท่วม)
  const recovery = brief.recovery;
  if (recovery?.count) {
    const ongoing = (recovery.districts || []).filter((row) => row.ongoing).map((row) => `อ.${row.district} ${row.ongoing}`);
    push("info", "พื้นที่น้ำท่วม", `ตำบลประสบภัย ${fmt(recovery.count)} ตำบล: ยังไม่คลี่คลาย ${fmt(recovery.ongoing)} · คลี่คลาย ${fmt(recovery.easing)} · กลับสู่ภาวะปกติ ${fmt(recovery.normal)}`,
      ongoing.length ? `ยังไม่คลี่คลาย: ${list(ongoing, 7)}` : "ทุกตำบลคลี่คลายหรือกลับสู่ภาวะปกติแล้ว", `${base}/records`);
  }

  // สุขภาพ (ใช้ข้อควรพิจารณาที่คำนวณไว้แล้ว ยกเว้นข้อความแนะนำทั่วไป)
  for (const action of brief.health?.actions || []) {
    if (action.level === "info" && action.title.startsWith("ยังไม่มีรายงานผู้ป่วย")) continue;
    push(action.level, "สุขภาพ", action.title, action.detail, `${base}/health`);
  }

  const shelters = brief.shelters;
  if (shelters?.full) push("serious", "ศูนย์พักพิง", `ศูนย์เต็ม/เกินความจุ ${fmt(shelters.full)} แห่ง`, `ที่ว่างรวม ${fmt(shelters.free)} ที่ พิจารณาเปิดศูนย์เพิ่มหรือย้ายผู้พักพิง`, `/eoc/shelters?eoc=${base.split("/").pop()}`);
  if (shelters?.nearFull) push("warning", "ศูนย์พักพิง", `ศูนย์ใกล้เต็ม ${fmt(shelters.nearFull)} แห่ง`, "ใช้ความจุเกิน 80% เตรียมศูนย์สำรอง", `/eoc/shelters?eoc=${base.split("/").pop()}`);
  if (shelters?.stale) push("info", "ศูนย์พักพิง", `ยอดผู้พักพิงไม่อัปเดตเกิน 12 ชม. ${fmt(shelters.stale)} แห่ง`, "ให้ศูนย์รายงานยอดล่าสุดก่อนสรุปตัวเลข", `/eoc/shelters?eoc=${base.split("/").pop()}`);

  const supplies = brief.supplies;
  if (supplies?.opened) {
    const out = supplies.critical.filter((row) => row.level === "out");
    const low = supplies.critical.filter((row) => row.level === "low");
    if (out.length) push("serious", "เวชภัณฑ์", `เวชภัณฑ์หมดคลัง ${fmt(supplies.summary.out)} รายการ`, list(out.map((row) => `${row.item_name} (${row.agency_name})`)), `${base}/supplies`);
    if (low.length) push("warning", "เวชภัณฑ์", `เวชภัณฑ์ใกล้หมด ${fmt(supplies.summary.low)} รายการ`, list(low.map((row) => `${row.item_name} เหลือ ${fmt(row.balance_qty)} ${row.unit || ""}`.trim())), `${base}/supplies`);
  } else if (supplies) {
    push("info", "เวชภัณฑ์", "ยังไม่ได้เปิดบัญชีคลังของเหตุการณ์นี้", "เปิดบัญชีคลัง (ยกยอดจากครั้งก่อนได้) เพื่อติดตามยาที่ใกล้หมด", `${base}/supplies`);
  }

  // ออกซิเจนเหลว: โรงพยาบาลที่ใช้ได้น้อยกว่าเกณฑ์
  const oxygen = brief.oxygen;
  if (oxygen) {
    const short = (oxygen.items || []).filter((item) => item.level === "critical" || item.level === "low");
    if (short.length) {
      push(oxygen.critical ? "critical" : "serious", "ออกซิเจนเหลว", `ออกซิเจนเหลวต้องจัดหาเพิ่ม ${fmt(short.length)} โรงพยาบาล`,
        list(short.map((item) => `${item.facility_name} ${item.days.total} วัน`)), `${base}/oxygen`);
    }
    if (oxygen.problems) {
      const problems = (oxygen.items || []).filter((item) => Number(item.procurement_problem) === 1);
      push("warning", "ออกซิเจนเหลว", `มีปัญหาการจัดหาออกซิเจน ${fmt(problems.length)} แห่ง`, list(problems.map((item) => `${item.facility_name}: ${item.problem_note}`), 3), `${base}/oxygen`);
    }
  }

  // ทีม MCATT: ผู้มีความเครียดระดับสูงต้องติดตามต่อ
  const mcatt = brief.teamReports?.mcatt;
  if (mcatt?.cumulative?.stress_high) {
    push("warning", "ทีมปฏิบัติการ", `MCATT พบผู้มีความเครียดระดับสูง ${fmt(mcatt.cumulative.stress_high)} ราย`, `ประเมินแล้ว ${fmt(mcatt.cumulative.stress_assessed)} ราย ส่งต่อ ${fmt(mcatt.cumulative.referred)} ราย — วางแผนติดตามเยี่ยมซ้ำ`, `${base}/team-reports?team=mcatt`);
  }

  const vulnerable = brief.vulnerable;
  if (vulnerable?.pending) {
    const critical = (vulnerable.urgent || []).filter((row) => PRIORITY_TYPE_KEYS.some((key) => Number(row[key]) > 0));
    push(critical.length ? "serious" : "warning", "กลุ่มเปราะบาง", `กลุ่มเปราะบางยังไม่ได้ดูแล ${fmt(vulnerable.pending)} คน`,
      critical.length ? `มีผู้ติดเตียง/ฟอกไต/พิการ/ตั้งครรภ์/จิตเวชรอใน ${list(critical.map((row) => areaLabel(row).main))}` : `ดูแลแล้ว ${vulnerable.caredPercent}%`, `${base}/vulnerable-groups`);
  }

  const it = brief.it;
  if (it?.summary?.critical) push("serious", "IT", `ปัญหา IT ระดับวิกฤต/สูงที่ยังเปิด ${fmt(it.summary.critical)} เรื่อง`, list(it.openTickets.filter((ticket) => ["critical", "high"].includes(ticket.severity)).map((ticket) => `${ticket.title} (${ticket.unit_name})`), 3), `${base}/it-support`);
  if (it?.offline?.length) push("warning", "IT", `ระบบ/อุปกรณ์ออฟไลน์ ${fmt(it.offline.length)} รายการ`, list(it.offline.map((row) => row.unit_name)), `${base}/it-support?tab=resources`);

  // รายงานจากประชาชน: คำขอความช่วยเหลือที่ยังไม่มีใครรับ / จุดปัญหารอตรวจ / จุดที่ประชาชนแจ้งว่าปกติแล้ว
  const citizen = brief.citizen;
  if (citizen?.pendingHelp) {
    push(citizen.oldestHelpMinutes >= 30 ? "critical" : "serious", "คำขอจากประชาชน", `คำขอความช่วยเหลือยังไม่มีผู้รับเรื่อง ${fmt(citizen.pendingHelp)} เรื่อง`,
      citizen.oldestHelpMinutes !== null ? `รอนานสุด ${waitText(citizen.oldestHelpMinutes)}` : "", "/admin/incident-reports?status=pending");
  }
  if (citizen?.pendingPoints && citizen.oldestPointMinutes >= 30) {
    push("warning", "คำขอจากประชาชน", `จุดปัญหาจากประชาชนรอตรวจ ${fmt(citizen.pendingPoints)} เรื่อง`,
      `รอนานสุด ${waitText(citizen.oldestPointMinutes)} — ตรวจและเผยแพร่เพื่อให้แผนที่สาธารณะเป็นปัจจุบัน`, "/admin/incident-reports?status=pending");
  }
  if (citizen?.flaggedNormal) {
    push("info", "คำขอจากประชาชน", `ประชาชนแจ้งว่าปกติแล้ว ${fmt(citizen.flaggedNormal)} จุด`, "ตรวจแล้วถอดออกจากแผนที่ หรือยืนยันว่ายังมีปัญหา", "/admin/incident-reports?status=published");
  }

  const directives = brief.directives;
  if (directives?.open) push("warning", "ข้อสั่งการ", `ข้อสั่งการที่ยังไม่ดำเนินการ ${fmt(directives.open)} ข้อ`, `จากรายงานวันที่ ${directives.date}`, `${base}/management/directives`);

  const completeness = brief.completeness;
  if (completeness && completeness.total && completeness.percent < 100) {
    const missing = (completeness.districts || []).filter((row) => row.missing.length).map((row) => `อ.${row.district}`);
    push(completeness.percent < 50 ? "warning" : "info", "ความครบของรายงาน", `ส่งรายงานวันนี้แล้ว ${completeness.percent}% (${fmt(completeness.reported)}/${fmt(completeness.total)} ตำบล)`,
      missing.length ? `ยังขาด: ${list(missing, 6)}` : "", base === "/eoc/flood" ? "/eoc/flood/overview#sec-completeness" : `${base}`);
  }

  return items.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}
