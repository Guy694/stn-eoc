// แบบรายงานประจำวันของทีมปฏิบัติการ (MCATT / หน่วยแพทย์ / MERT) รายอำเภอ — ไม่แตะฐานข้อมูล ทดสอบได้
// ทุกทีมใช้โครงเดียวกัน: ตัวเลขเก็บใน metrics (JSON) ตามรายการ fields ของแต่ละทีม

export const TEAM_REPORT_TYPES = {
  mcatt: {
    key: "mcatt",
    label: "MCATT",
    title: "ทีมช่วยเหลือเยียวยาจิตใจ (MCATT)",
    fields: [
      { key: "teams_total", label: "จำนวนทีมทั้งหมด", unit: "ทีม", group: "ทีม" },
      { key: "teams_working", label: "ทีมที่ออกปฏิบัติงาน", unit: "ทีม", group: "ทีม" },
      { key: "home_visits", label: "เยี่ยมบ้าน", unit: "หลัง", group: "การปฏิบัติงาน", served: true },
      { key: "health_education", label: "ให้สุขศึกษา", unit: "ราย", group: "การปฏิบัติงาน" },
      { key: "stress_assessed", label: "ประเมินความเครียด", unit: "ราย", group: "การปฏิบัติงาน" },
      { key: "referred", label: "ส่งต่อ", unit: "ราย", group: "การปฏิบัติงาน" },
      { key: "stress_normal", label: "ปกติ", unit: "ราย", group: "ผลประเมินความเครียด" },
      { key: "stress_low", label: "น้อย", unit: "ราย", group: "ผลประเมินความเครียด" },
      { key: "stress_medium", label: "ปานกลาง", unit: "ราย", group: "ผลประเมินความเครียด" },
      { key: "stress_high", label: "สูง", unit: "ราย", group: "ผลประเมินความเครียด", alert: true }
    ]
  },
  medical: {
    key: "medical",
    label: "หน่วยแพทย์",
    title: "หน่วยแพทย์เคลื่อนที่",
    fields: [
      { key: "units", label: "จำนวนหน่วยที่ออก", unit: "หน่วย", group: "ทีม" },
      { key: "treated", label: "ตรวจรักษา", unit: "ราย", group: "การปฏิบัติงาน", served: true },
      { key: "counseled", label: "ให้คำปรึกษา", unit: "ราย", group: "การปฏิบัติงาน" },
      { key: "referred", label: "ส่งต่อ", unit: "ราย", group: "การปฏิบัติงาน" }
    ]
  },
  mert: {
    key: "mert",
    label: "MERT",
    title: "ทีมปฏิบัติการฉุกเฉินทางการแพทย์ (MERT)",
    fields: [
      { key: "mert_teams", label: "ทีม MERT", unit: "ทีม", group: "ทีม" },
      { key: "mini_mert_teams", label: "ทีม Mini MERT", unit: "ทีม", group: "ทีม" },
      { key: "rescue_teams", label: "ทีมกู้ชีพ/กู้ภัย", unit: "ทีม", group: "ทีม" },
      { key: "served", label: "ให้บริการ", unit: "ราย", group: "การปฏิบัติงาน", served: true },
      { key: "referred", label: "ส่งต่อโรงพยาบาล", unit: "ราย", group: "การปฏิบัติงาน" }
    ],
    areaField: { key: "area", label: "พื้นที่ปฏิบัติงาน", placeholder: "เช่น ต.กำแพง ม.3, ศูนย์พักพิงโรงเรียน..." }
  },
  doxy: {
    key: "doxy",
    label: "Doxy",
    title: "สำรวจกลุ่มเสี่ยงและจ่ายยา Doxycycline ป้องกันโรคฉี่หนู",
    module: "doxy",
    fields: [
      { key: "at_risk", label: "กลุ่มเสี่ยงที่สำรวจพบ", unit: "ราย", group: "วันนี้" },
      { key: "doxy_new", label: "จ่ายยารายใหม่", unit: "ราย", group: "วันนี้", served: true }
    ],
    // รายงานแยกรายหน่วยบริการในอำเภอ (ตามชีต สำรวจdoxy)
    perUnit: true,
    areaField: { key: "area", label: "หน่วยบริการที่จ่ายยา", placeholder: "เช่น รพ.สต.บ้านมะนัง, รพช.มะนัง", required: true }
  },
  resources: {
    key: "resources",
    label: "แจกจ่ายทรัพยากร",
    title: "ทรัพยากรที่แจกจ่ายให้ประชาชน",
    module: "supplies",
    fields: [
      { key: "relief_kits", label: "ชุดยาช่วยเหลือผู้ประสบภัย", unit: "ชุด", group: "ชุดยา" },
      { key: "hospital_kits", label: "ชุดยาที่โรงพยาบาลจัดเอง", unit: "ชุด", group: "ชุดยา" },
      { key: "foot_meds", label: "ยาทาน้ำกัดเท้า", unit: "ชุด", group: "ยาและอุปกรณ์" },
      { key: "boots", label: "รองเท้าบูท", unit: "คู่", group: "ยาและอุปกรณ์" },
      { key: "repellent", label: "ยาทากันยุง", unit: "ชิ้น", group: "ยาและอุปกรณ์" },
      { key: "mosquito_spray", label: "ยาจุด/สเปรย์กันยุง", unit: "ชิ้น", group: "ยาและอุปกรณ์" },
      { key: "life_jackets", label: "เสื้อชูชีพ", unit: "ตัว", group: "ยาและอุปกรณ์" },
      { key: "other", label: "อื่น ๆ", unit: "ชิ้น", group: "ยาและอุปกรณ์" }
    ]
  }
};

/** เมนูสิทธิ์ (eoc module) ของแต่ละแบบรายงาน */
export const teamReportModule = (type) => TEAM_REPORT_TYPES[type]?.module || "team-reports";

export const TEAM_REPORT_KEYS = Object.keys(TEAM_REPORT_TYPES);
const STRESS_KEYS = ["stress_normal", "stress_low", "stress_medium", "stress_high"];

const toInt = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return 0;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : NaN;
};

export function parseMetrics(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try { return JSON.parse(value) || {}; } catch { return {}; }
}

/** ตรวจค่าก่อนบันทึก คืน { ok, metrics } หรือ { ok:false, error } */
export function validateTeamReport(type, body = {}) {
  const config = TEAM_REPORT_TYPES[type];
  if (!config) return { ok: false, error: "ไม่รู้จักประเภทรายงาน" };
  if (!String(body.district_name || "").trim()) return { ok: false, error: "กรุณาเลือกอำเภอ" };
  if (config.perUnit && !String(body.area_note || "").trim()) return { ok: false, error: `กรุณาระบุ${config.areaField.label}` };
  const metrics = {};
  for (const field of config.fields) {
    const parsed = toInt(body[field.key] ?? body.metrics?.[field.key]);
    if (Number.isNaN(parsed)) return { ok: false, error: `${field.label} ต้องเป็นจำนวนเต็มไม่ติดลบ` };
    metrics[field.key] = parsed;
  }
  if (type === "mcatt") {
    if (metrics.teams_working > metrics.teams_total && metrics.teams_total > 0) return { ok: false, error: "ทีมที่ออกปฏิบัติงานต้องไม่เกินจำนวนทีมทั้งหมด" };
    const stress = STRESS_KEYS.reduce((sum, key) => sum + metrics[key], 0);
    if (stress > metrics.stress_assessed) return { ok: false, error: `ผลประเมินความเครียดรวม ${stress} ราย มากกว่าจำนวนที่ประเมิน (${metrics.stress_assessed} ราย)` };
  }
  if (!Object.values(metrics).some((value) => value > 0)) return { ok: false, error: "กรุณากรอกตัวเลขอย่างน้อย 1 ช่อง" };
  return { ok: true, metrics };
}

const sumInto = (target, metrics, fields) => {
  for (const field of fields) target[field.key] = (target[field.key] || 0) + (Number(metrics[field.key]) || 0);
  return target;
};

/**
 * rows: [{ report_type, report_date, district_name, metrics }]
 * คืนสรุปต่อทีม: วันนี้ (ตาม date), สะสมทั้งเหตุการณ์, อำเภอที่รายงานแล้ววันนี้, ผู้รับบริการ (served)
 */
export function summarizeTeamReports(rows = [], date) {
  const result = {};
  for (const config of Object.values(TEAM_REPORT_TYPES)) {
    const mine = rows.filter((row) => row.report_type === config.key).map((row) => ({ ...row, metrics: parseMetrics(row.metrics) }));
    const today = mine.filter((row) => row.report_date === date);
    const servedKey = config.fields.find((field) => field.served)?.key;
    const todayTotals = today.reduce((acc, row) => sumInto(acc, row.metrics, config.fields), {});
    const cumulative = mine.reduce((acc, row) => sumInto(acc, row.metrics, config.fields), {});
    result[config.key] = {
      key: config.key,
      label: config.label,
      reports: mine.length,
      districtsToday: [...new Set(today.map((row) => row.district_name))],
      today: todayTotals,
      cumulative,
      servedToday: servedKey ? todayTotals[servedKey] || 0 : 0,
      servedTotal: servedKey ? cumulative[servedKey] || 0 : 0,
      lastDate: mine.map((row) => row.report_date).sort().at(-1) || null
    };
  }
  return result;
}

/** เปลี่ยนสรุปเป็นข้อความสั้นสำหรับห้องประชุม */
export function teamReportHeadline(summary) {
  if (!summary) return [];
  const lines = [];
  const m = summary.mcatt;
  if (m?.reports) lines.push(`MCATT เยี่ยมบ้านสะสม ${m.cumulative.home_visits || 0} หลัง ประเมินความเครียด ${m.cumulative.stress_assessed || 0} ราย (เครียดสูง ${m.cumulative.stress_high || 0})`);
  const d = summary.medical;
  if (d?.reports) lines.push(`หน่วยแพทย์ตรวจรักษาสะสม ${d.cumulative.treated || 0} ราย ส่งต่อ ${d.cumulative.referred || 0}`);
  const e = summary.mert;
  if (e?.reports) lines.push(`MERT ให้บริการสะสม ${e.cumulative.served || 0} ราย ส่งต่อ รพ. ${e.cumulative.referred || 0}`);
  const x = summary.doxy;
  if (x?.reports) lines.push(`จ่ายยา Doxycycline สะสม ${x.cumulative.doxy_new || 0} ราย (กลุ่มเสี่ยงที่สำรวจ ${x.cumulative.at_risk || 0} ราย)`);
  return lines;
}
