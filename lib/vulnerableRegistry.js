// ทะเบียนกลุ่มเปราะบาง "ยอดรายหมู่บ้าน" ที่ใช้จริงทั้งระบบ
// = ยอดที่เจ้าหน้าที่กรอก (vulnerable_group_baselines) รวมกับจำนวนคนในทะเบียนรายบุคคล (vulnerable_persons)
//   แต่ละประเภทใช้ "ค่าที่มากกว่า" — ไม่หายและไม่นับซ้ำ
// การจับคู่คนเข้ากับแถว (ไล่จากละเอียดไปหยาบ):
//   1) แถวหมู่บ้านเดียวกัน (อำเภอ + ตำบล + เลขหมู่ / ชื่อหมู่บ้าน)
//   2) แถวรวมทั้งตำบล (หมู่บ้าน = ว่าง/รวม/ทั้งตำบล)
//   3) แถวรวมทั้งอำเภอ (ตำบลขึ้นต้นด้วย "รวม")
//   4) ไม่มีแถวเลย → สร้างแถวหมู่บ้านจากรายชื่อ (id = null, source = "persons")
import { VULNERABLE_TYPES } from "@/lib/vulnerableEvent";

export const TYPE_KEYS = VULNERABLE_TYPES.map((type) => type.key);
const WHOLE_TAMBON = new Set(["", "รวม", "ทั้งตำบล"]);
const t = (value) => String(value ?? "").trim();
const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/** เลขหมู่จากข้อความ เช่น "หมู่ 11 บ้านปาล์มไทย" → "11" */
export function mooOf(text) {
  const match = /หมู่(?:ที่)?\s*(\d{1,2})/.exec(String(text || ""));
  return match ? String(Number(match[1])) : "";
}

const normName = (value) => t(value).replace(/^บ้าน/, "").replace(/[\s\-]/g, "");

/**
 * ดัชนีหมู่บ้านจากชั้นข้อมูลแปลงหมู่บ้าน: (อำเภอ|ตำบล|ชื่อ) → หมู่ และ (อำเภอ|ตำบล|หมู่) → ชื่อ
 * villages = [{ distname, subdistnam, moo, villname }]
 */
export function buildVillageIndex(villages = []) {
  const mooByName = new Map();
  const nameByMoo = new Map();
  for (const row of villages) {
    const district = t(row.distname ?? row.district);
    const tambon = t(row.subdistnam ?? row.tambon);
    const moo = row.moo ? String(Number(row.moo)) : "";
    const name = t(row.villname ?? row.name);
    if (!district || !tambon || !moo || moo === "0" || !name) continue;
    for (const part of name.split(/\s*,\s*/)) {
      const key = `${district}|${tambon}|${normName(part)}`;
      if (!mooByName.has(key)) mooByName.set(key, moo);
    }
    const mooKey = `${district}|${tambon}|${moo}`;
    if (!nameByMoo.has(mooKey)) nameByMoo.set(mooKey, name.split(/\s*,\s*/)[0]);
  }
  return { mooByName, nameByMoo };
}

function villageMoo(row, index) {
  const direct = mooOf(row.village);
  if (direct) return direct;
  const name = t(row.village).replace(/^หมู่(?:ที่)?\s*\d+\s*/, "");
  return index.mooByName.get(`${t(row.district)}|${t(row.tambon)}|${normName(name)}`) || "";
}

/**
 * รวมยอด
 * baseline = แถวจาก vulnerable_group_baselines
 * personGroups = [{ district, tambon, village, vulnerable_type, count }] (นับจาก vulnerable_persons ที่ใช้งาน)
 * คืนแถวเรียงตามอำเภอ/ตำบล/หมู่ แต่ละแถวมี person_counts, person_total, source: manual | persons | both
 */
export function mergeRegistry(baseline = [], personGroups = [], villages = []) {
  const index = buildVillageIndex(villages);
  const rows = baseline.map((row) => ({
    ...row,
    village: row.village ?? "",
    _moo: villageMoo(row, index),
    person_counts: Object.fromEntries(TYPE_KEYS.map((key) => [key, 0]))
  }));
  const byVillage = new Map();
  const byTambon = new Map();
  const byDistrict = new Map();
  for (const row of rows) {
    const district = t(row.district);
    const tambon = t(row.tambon);
    if (tambon.startsWith("รวม")) { byDistrict.set(district, row); continue; }
    if (WHOLE_TAMBON.has(t(row.village))) { byTambon.set(`${district}|${tambon}`, row); continue; }
    if (row._moo) byVillage.set(`${district}|${tambon}|${row._moo}`, row);
    byVillage.set(`${district}|${tambon}|n:${normName(t(row.village).replace(/^หมู่(?:ที่)?\s*\d+\s*/, ""))}`, row);
  }

  const synthetic = new Map();
  for (const group of personGroups) {
    const type = t(group.vulnerable_type);
    if (!TYPE_KEYS.includes(type)) continue;
    const count = num(group.count);
    if (!count) continue;
    const district = t(group.district);
    const tambon = t(group.tambon);
    const moo = mooOf(group.village);
    const nameKey = `${district}|${tambon}|n:${normName(t(group.village).replace(/^หมู่(?:ที่)?\s*\d+\s*/, ""))}`;
    let target = (moo && byVillage.get(`${district}|${tambon}|${moo}`)) || (t(group.village) && byVillage.get(nameKey))
      || byTambon.get(`${district}|${tambon}`) || byDistrict.get(district);
    if (!target) {
      const key = `${district}|${tambon}|${moo || t(group.village)}`;
      if (!synthetic.has(key)) {
        const name = moo ? index.nameByMoo.get(`${district}|${tambon}|${moo}`) : "";
        synthetic.set(key, {
          id: null, province: "สตูล", district, tambon,
          village: name || (moo ? `หมู่ ${moo}` : t(group.village) || "รวม"),
          _moo: moo,
          ...Object.fromEntries(TYPE_KEYS.map((k) => [k, 0])),
          person_counts: Object.fromEntries(TYPE_KEYS.map((k) => [k, 0]))
        });
      }
      target = synthetic.get(key);
    }
    target.person_counts[type] += count;
  }

  const merged = [...rows, ...synthetic.values()].map((row) => {
    const personTotal = TYPE_KEYS.reduce((sum, key) => sum + row.person_counts[key], 0);
    const manual = Object.fromEntries(TYPE_KEYS.map((key) => [key, num(row[key])]));
    const counts = Object.fromEntries(TYPE_KEYS.map((key) => [key, Math.max(manual[key], row.person_counts[key])]));
    const { _moo, ...rest } = row;
    return {
      ...rest,
      moo: _moo || null,
      ...counts,
      manual_counts: row.id ? manual : null,
      person_total: personTotal,
      source: row.id ? (personTotal ? "both" : "manual") : "persons"
    };
  });
  const collator = new Intl.Collator("th");
  return merged.sort((a, b) => collator.compare(t(a.district), t(b.district)) || collator.compare(t(a.tambon), t(b.tambon))
    || (Number(a.moo) || 999) - (Number(b.moo) || 999) || collator.compare(t(a.village), t(b.village)));
}

/** ผลรวมแต่ละประเภท (ใช้ทำการ์ดสรุป) */
export function summarizeRegistry(rows = []) {
  const summary = Object.fromEntries(TYPE_KEYS.map((key) => [`total_${key}`, 0]));
  let grand = 0;
  let persons = 0;
  for (const row of rows) {
    for (const key of TYPE_KEYS) {
      summary[`total_${key}`] += num(row[key]);
      grand += num(row[key]);
    }
    persons += num(row.person_total);
  }
  return { ...summary, grand_total: grand, location_count: rows.length, person_total: persons };
}
