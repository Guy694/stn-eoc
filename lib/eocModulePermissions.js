// ใครบันทึกข้อมูลในเมนูไหนของเหตุการณ์ได้ (เจ้าหน้าที่ทุกคนในเหตุการณ์ดูได้ แต่บันทึกได้เฉพาะกลุ่มภารกิจเจ้าของงาน)
// ค่าเริ่มต้นอยู่ที่นี่ แอดมินเปลี่ยนได้จากหน้า ตั้งค่าระบบ → สิทธิ์กลุ่มภารกิจ (ตาราง eoc_module_permissions)
// ไฟล์นี้ไม่แตะฐานข้อมูล ใช้ทั้ง API, เมนู และ unit test
import { getTeam, normalizeTeamCode } from "../src/features/eoc/registries/team.registry.js";

export const ALL_TEAMS = "*";

// ค่าเริ่มต้น (ตารางที่ยืนยันแล้ว) — key = key ของเมนูใน EVENT_MODULES
// null = ทุกทีมที่ได้รับมอบหมายบันทึกได้
export const MODULE_OWNERS = {
  records: ["sat"],
  // ประกาศธงเตือนภัย/Trigger รายพื้นที่ (ตามเกณฑ์ทีม SAT)
  triggers: ["sat"],
  affected: ["sat"],
  shelters: ["logistics"],
  vulnerable: ["case-mgmt", "mcatt"],
  health: ["case-mgmt", "sat"],
  supplies: ["logistics"],
  oxygen: ["logistics"],
  "team-reports": ["mcatt", "mert", "case-mgmt"],
  doxy: ["case-mgmt", "active-surv", "jit"],
  "it-support": ["it"],
  team: ["commander", "eoc-mgmt"],
  command: null
};

// เมนูที่มีการบันทึกข้อมูล (ตั้งสิทธิ์ได้) แยกตามประเภทเหตุการณ์
export const CONFIGURABLE_MODULES = {
  flood: [
    { key: "command", label: "ภารกิจและข้อสั่งการ" },
    { key: "records", label: "บันทึกพื้นที่น้ำท่วม" },
    { key: "triggers", label: "ประกาศธงเตือนภัย/Trigger" },
    { key: "shelters", label: "ศูนย์พักพิง (ในเหตุการณ์)" },
    { key: "vulnerable", label: "กลุ่มเปราะบาง" },
    { key: "affected", label: "ผู้ได้รับผลกระทบ" },
    { key: "health", label: "โรคและสุขภาพ" },
    { key: "supplies", label: "เวชภัณฑ์และคลังยา" },
    { key: "oxygen", label: "ออกซิเจนเหลว" },
    { key: "team-reports", label: "รายงานทีม MCATT / หน่วยแพทย์ / MERT" },
    { key: "doxy", label: "สำรวจและจ่ายยา Doxycycline" },
    { key: "it-support", label: "รายงาน IT support" },
    { key: "team", label: "ทีมปฏิบัติการ" }
  ],
  disease: [
    { key: "records", label: "บันทึกรายงานผู้ป่วย" },
    { key: "vulnerable", label: "กลุ่มเปราะบาง" },
    { key: "it-support", label: "รายงาน IT support" }
  ]
};

export const PRIVILEGED_ROLES = ["admin", "commander"];

export function defaultOwners(moduleKey) {
  return Object.prototype.hasOwnProperty.call(MODULE_OWNERS, moduleKey) ? MODULE_OWNERS[moduleKey] : null;
}

/**
 * แปลงแถวในตาราง eoc_module_permissions เป็น { "flood:records": ["sat"] | null }
 * แถว team_code = '*' หมายถึงทุกทีม (null)
 */
export function buildOwnerOverrides(rows = []) {
  const map = {};
  for (const row of rows) {
    const key = `${row.eoc_type}:${row.module_key}`;
    if (row.team_code === ALL_TEAMS) { map[key] = null; continue; }
    if (map[key] === null) continue;
    const code = normalizeTeamCode(row.team_code);
    if (!code) continue;
    map[key] = [...new Set([...(map[key] || []), code])];
  }
  return map;
}

// ทีมเจ้าของที่ใช้จริง: ค่าที่แอดมินตั้งไว้ก่อน ไม่มีจึงใช้ค่าเริ่มต้น
export function resolveOwners(eocType, moduleKey, overrides = {}) {
  const key = `${eocType}:${moduleKey}`;
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, key)) return overrides[key];
  return defaultOwners(moduleKey);
}

export function moduleOwners(moduleKey, owners) {
  return owners === undefined ? defaultOwners(moduleKey) : owners;
}

// รหัสทีม (มาตรฐาน) ของผู้ใช้จากรายการสังกัดในเหตุการณ์ (memberships หรือ assignments)
export function userTeamCodes(memberships = []) {
  return [...new Set((memberships || []).map((item) => normalizeTeamCode(item?.team_code)).filter(Boolean))];
}

export function ownerTeamNames(moduleKey, owners) {
  return (moduleOwners(moduleKey, owners) || []).map((code) => getTeam(code)?.name || code);
}

/**
 * @param owners  ทีมเจ้าของ (array) / null = ทุกทีม / undefined = ใช้ค่าเริ่มต้น
 * @returns {{ canEdit: boolean, reason: null | "closed" | "not_owner" }}
 */
export function moduleEditAccess({ role, memberships = [], sessionActive = true, moduleKey, owners }) {
  if (!sessionActive) return { canEdit: false, reason: "closed" };
  if (PRIVILEGED_ROLES.includes(role)) return { canEdit: true, reason: null };
  const list = moduleOwners(moduleKey, owners);
  if (!list) return { canEdit: true, reason: null };
  const mine = userTeamCodes(memberships);
  return list.some((code) => mine.includes(code)) ? { canEdit: true, reason: null } : { canEdit: false, reason: "not_owner" };
}

export function readOnlyMessage(moduleKey, reason, owners) {
  if (reason === "closed") return "เหตุการณ์นี้ปิดแล้ว ดูข้อมูลได้อย่างเดียว";
  if (reason === "not_owner") {
    const names = ownerTeamNames(moduleKey, owners);
    return `ดูได้อย่างเดียว — บันทึกและแก้ไขได้เฉพาะ${names.length ? names.join(" / ") : "กลุ่มภารกิจที่รับผิดชอบ"}`;
  }
  return null;
}

// ตรวจค่าที่แอดมินส่งมา: คืนรายการทีม (มาตรฐาน) หรือ [ALL_TEAMS]
export function normalizeOwnerInput(teams) {
  if (!Array.isArray(teams)) return { ok: false, error: "รูปแบบข้อมูลไม่ถูกต้อง" };
  if (teams.includes(ALL_TEAMS)) return { ok: true, value: [ALL_TEAMS] };
  const codes = [...new Set(teams.map((code) => normalizeTeamCode(code)).filter(Boolean))];
  if (!codes.length) return { ok: false, error: "ต้องมีอย่างน้อย 1 กลุ่มภารกิจ หรือเลือก “ทุกทีม”" };
  return { ok: true, value: codes };
}
