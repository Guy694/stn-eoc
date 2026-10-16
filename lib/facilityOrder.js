// ลำดับหน่วยบริการที่ใช้ทุกฟอร์ม/ตัวกรอง: โรงพยาบาล → สสจ. → สสอ. → รพ.สต. → อื่น ๆ
// ภายในกลุ่มเรียงตามอำเภอ แล้วตามชื่อ (ใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และหน้าเว็บ ไม่มีการเรียกฐานข้อมูล)

export const FACILITY_GROUPS = [
  { key: "hospital", label: "โรงพยาบาล" },
  { key: "pho", label: "สำนักงานสาธารณสุขจังหวัด" },
  { key: "dho", label: "สำนักงานสาธารณสุขอำเภอ" },
  { key: "pcu", label: "โรงพยาบาลส่งเสริมสุขภาพตำบล" },
  { key: "other", label: "หน่วยบริการอื่น" }
];
const GROUP_INDEX = Object.fromEntries(FACILITY_GROUPS.map((group, index) => [group.key, index]));

const compact = (value) => String(value ?? "").replace(/\s+/g, "").toLowerCase();

/** กลุ่มของหน่วยบริการ จากประเภท (typecode) — ไม่มีประเภทใช้ชื่อแทน */
export function facilityGroup(facility = {}) {
  const type = compact(facility.typecode ?? facility.type ?? facility.agency_type);
  const name = compact(facility.name ?? facility.label ?? facility.agency_name);
  const test = (pattern) => pattern.test(type) || (!type && pattern.test(name));
  // ตรวจ รพ.สต. ก่อน เพราะขึ้นต้นด้วย "รพ." เหมือนโรงพยาบาล
  if (test(/^(รพ\.?สต|สอน|สถานีอนามัย|โรงพยาบาลส่งเสริม)/)) return "pcu";
  if (test(/^(รพ|โรงพยาบาล)/)) return "hospital";
  if (test(/^(สสจ|สำนักงานสาธารณสุขจังหวัด)/)) return "pho";
  if (test(/^(สสอ|สำนักงานสาธารณสุขอำเภอ)/)) return "dho";
  return "other";
}

// ในกลุ่มโรงพยาบาล: รพ.ศูนย์/ทั่วไป ก่อน รพ.ชุมชน · ในกลุ่ม รพ.สต.: รพ.สต. ก่อน สอน.
function subRank(facility, group) {
  const type = compact(facility.typecode ?? facility.type ?? facility.agency_type);
  if (group === "hospital") return /ศูนย์|ทั่วไป/.test(type) ? 0 : /ชุมชน/.test(type) ? 1 : 2;
  if (group === "pcu") return /^สอน/.test(type) ? 1 : 0;
  return 0;
}

const district = (facility) => String(facility.district_name ?? facility.district ?? "");
const nameOf = (facility) => String(facility.name ?? facility.label ?? facility.agency_name ?? "");

export function compareFacilities(a, b) {
  const groupA = facilityGroup(a);
  const groupB = facilityGroup(b);
  return GROUP_INDEX[groupA] - GROUP_INDEX[groupB]
    || subRank(a, groupA) - subRank(b, groupB)
    || district(a).localeCompare(district(b), "th")
    || nameOf(a).localeCompare(nameOf(b), "th");
}

export function sortFacilities(list = []) {
  return [...list].sort(compareFacilities);
}

/** ORDER BY สำหรับ SQL ให้ลำดับตรงกับหน้าเว็บ (alias = ชื่อ/alias ของตาราง health_facilities) */
export function facilityOrderSql(alias = "") {
  const p = alias ? `${alias}.` : "";
  return `CASE
      WHEN ${p}typecode LIKE 'รพ.สต%' OR ${p}typecode LIKE 'รพสต%' THEN 40
      WHEN ${p}typecode LIKE 'สอน%' THEN 41
      WHEN ${p}typecode LIKE 'รพ.ศูนย์%' OR ${p}typecode LIKE 'รพ.ทั่วไป%' THEN 10
      WHEN ${p}typecode LIKE 'รพ%' OR ${p}typecode LIKE 'โรงพยาบาล%' THEN 11
      WHEN ${p}typecode LIKE 'สสจ%' THEN 20
      WHEN ${p}typecode LIKE 'สสอ%' THEN 30
      ELSE 90 END, ${p}district_name, ${p}name`;
}

/** ข้อความที่ใช้ค้นหา: ชื่อ ประเภท อำเภอ (ไม่สนช่องว่าง/จุด) */
export function facilitySearchText(facility) {
  return compact(`${nameOf(facility)} ${facility.typecode ?? facility.type ?? ""} ${district(facility)} ${FACILITY_GROUPS[GROUP_INDEX[facilityGroup(facility)]].label}`).replace(/\./g, "");
}

export function matchFacility(facility, keyword) {
  const needle = compact(keyword).replace(/\./g, "");
  return !needle || facilitySearchText(facility).includes(needle);
}
