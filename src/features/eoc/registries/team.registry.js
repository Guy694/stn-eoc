const DEFAULT_MENUS = Object.freeze([
  { key: "dashboard", label: "Dashboard" },
  { key: "records", label: "รายงานผล" },
  { key: "members", label: "สมาชิก" },
]);

function team(code, legacyCode, name, shortName = legacyCode) {
  return Object.freeze({ code, legacyCode, name, shortName, enabled: true, menus: DEFAULT_MENUS });
}

/** Registry กลางของกลุ่มภารกิจ 23 ทีมตามข้อมูล production ปัจจุบัน */
export const teamRegistry = Object.freeze({
  commander: team("commander", "COMMANDER", "ผู้บัญชาการเหตุการณ์และรองผู้บัญชาการเหตุการณ์", "COMMANDER"),
  sat: team("sat", "SAT", "กลุ่มภารกิจตระหนักรู้สถานการณ์", "SAT"),
  planning: team("planning", "PLANNING", "กลุ่มภารกิจการวางแผน", "PLANNING"),
  scientific: team("scientific", "SCIENTIFIC", "กลุ่มภารกิจวิชาการ", "SCIENTIFIC"),
  jit: team("jit", "JIT", "กลุ่มภารกิจปฏิบัติการสอบสวนควบคุมโรค", "JIT"),
  "active-surv": team("active-surv", "ACTIVE_SURV", "กลุ่มภารกิจการเฝ้าระวังเชิงรุก", "ACTIVE SURV"),
  "case-mgmt": team("case-mgmt", "CASE_MGMT", "กลุ่มภารกิจการจัดการและดูแลรักษาผู้ป่วย", "CASE MGMT"),
  lab: team("lab", "LAB", "กลุ่มภารกิจห้องปฏิบัติการด้านสาธารณสุข", "LAB"),
  riskcom: team("riskcom", "RISKCOM", "กลุ่มภารกิจสื่อสารความเสี่ยง", "RISKCOM"),
  vaccine: team("vaccine", "VACCINE", "กลุ่มภารกิจบริหารจัดการและบริการวัคซีน", "VACCINE"),
  mcatt: team("mcatt", "MCATT", "กลุ่มภารกิจช่วยเหลือเยียวยาจิตใจผู้ประสบภาวะวิกฤต", "MCATT"),
  poe: team("poe", "POE", "กลุ่มภารกิจด่านควบคุมโรคระหว่างประเทศ", "POE"),
  quarantine: team("quarantine", "QUARANTINE", "กลุ่มภารกิจปฏิบัติการกักกันโรค", "QUARANTINE"),
  mert: team("mert", "MERT", "กลุ่มภารกิจปฏิบัติการฉุกเฉินทางการแพทย์", "MERT"),
  serht: team("serht", "SeRHT", "กลุ่มภารกิจปฏิบัติการด้านอนามัยสิ่งแวดล้อม", "SeRHT"),
  logistics: team("logistics", "LOGISTICS", "กลุ่มภารกิจสำรองวัสดุ เวชภัณฑ์ และส่งกำลังบำรุง", "LOGISTICS"),
  legal: team("legal", "LEGAL", "กลุ่มภารกิจกฎหมาย", "LEGAL"),
  finance: team("finance", "FINANCE", "กลุ่มภารกิจการเงินและงบประมาณ", "FINANCE"),
  staffing: team("staffing", "STAFFING", "กลุ่มภารกิจจัดสรรกำลังคนในภาวะฉุกเฉิน", "STAFFING"),
  admin: team("admin", "ADMIN", "กลุ่มภารกิจด้านบริหารและธุรการ", "ADMIN"),
  it: team("it", "ITSUPPORT", "กลุ่มภารกิจด้านเทคโนโลยีดิจิทัล", "IT"),
  liaison: team("liaison", "LIAISON", "กลุ่มภารกิจประสานงานและเลขานุการ", "LIAISON"),
  "eoc-mgmt": team("eoc-mgmt", "EOC_MGMT", "กลุ่มภารกิจการจัดการศูนย์ปฏิบัติการภาวะฉุกเฉิน", "EOC MGMT"),
});

export const TEAM_CODES = Object.freeze(Object.keys(teamRegistry));

const teamAliases = Object.freeze(
  Object.values(teamRegistry).reduce((aliases, item) => {
    aliases[item.code] = item.code;
    aliases[item.legacyCode.toLowerCase()] = item.code;
    return aliases;
  }, { eoc_admin: "admin" })
);

export function normalizeTeamCode(value) {
  if (typeof value !== "string") return null;
  return teamAliases[value.trim().toLowerCase()] || null;
}

export function isValidTeamCode(value) {
  const code = normalizeTeamCode(value);
  return Boolean(code && teamRegistry[code]?.enabled);
}

export function getTeam(value) {
  const code = normalizeTeamCode(value);
  return code ? teamRegistry[code] : null;
}
