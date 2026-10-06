// สรุปกลุ่มเปราะบางในเหตุการณ์ (ไม่แตะฐานข้อมูล ทดสอบได้)
// affected = ผลรวมทุกประเภทในหมู่บ้านที่ได้รับผลกระทบ, cared = ดูแลแล้ว, moved = เคลื่อนย้ายแล้ว

export const VULNERABLE_TYPES = [
  { key: "bedridden", label: "ผู้ป่วยติดบ้าน/ติดเตียง", short: "ติดเตียง", priority: 3 },
  { key: "disabled", label: "ผู้พิการ", short: "พิการ", priority: 2 },
  { key: "pregnant", label: "หญิงตั้งครรภ์", short: "ตั้งครรภ์", priority: 2 },
  { key: "elderly", label: "ผู้สูงอายุ", short: "สูงอายุ", priority: 1 },
  { key: "children", label: "เด็กเล็ก (ต่ำกว่า 5 ปี)", short: "เด็กเล็ก", priority: 1 },
  { key: "chronic_illness", label: "ผู้ป่วยโรคเรื้อรัง", short: "เรื้อรัง", priority: 1 }
];

const n = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};
const areaKey = (row) => [row.district, row.tambon, row.village || ""].map((part) => String(part || "").trim()).join("|");

export function affectedOf(row) {
  return VULNERABLE_TYPES.reduce((sum, type) => sum + n(row?.[type.key]), 0);
}

/** น้ำหนักความเร่งด่วน: ผู้ที่ยังไม่ได้ดูแล โดยให้ติดเตียง/พิการ/ตั้งครรภ์มีน้ำหนักมากกว่า */
export function urgencyScore(row) {
  const pending = Math.max(affectedOf(row) - n(row.cared_count), 0);
  if (!pending) return 0;
  const weighted = VULNERABLE_TYPES.reduce((sum, type) => sum + n(row[type.key]) * type.priority, 0);
  const ratio = pending / Math.max(affectedOf(row), 1);
  return Math.round(weighted * ratio);
}

/** ตรวจค่าก่อนบันทึก */
export function validateEventRecord(record) {
  if (!record.district || !record.tambon) return "กรุณาเลือกอำเภอและตำบล";
  for (const type of VULNERABLE_TYPES) {
    if (Number(record[type.key]) < 0) return `จำนวน${type.label}ต้องไม่ติดลบ`;
  }
  const affected = affectedOf(record);
  if (Number(record.cared_count) < 0 || Number(record.moved_count) < 0) return "จำนวนดูแล/เคลื่อนย้ายต้องไม่ติดลบ";
  if (n(record.cared_count) > affected) return `ดูแลแล้วต้องไม่เกินผู้ได้รับผลกระทบ (${affected} คน)`;
  if (n(record.moved_count) > affected) return `เคลื่อนย้ายต้องไม่เกินผู้ได้รับผลกระทบ (${affected} คน)`;
  return null;
}

/**
 * rows: บันทึกของเหตุการณ์ (vulnerable_groups)
 * baseline: ทะเบียนกลาง ใช้หาจำนวน "ที่มีอยู่ในหมู่บ้านที่ประสบภัย"
 */
export function summarizeVulnerableEvent(rows = [], baseline = []) {
  const baselineByArea = new Map(baseline.map((row) => [areaKey(row), row]));
  const totals = { villages: rows.length, affected: 0, cared: 0, moved: 0, pending: 0, inArea: 0, byType: {}, districts: [] };
  for (const type of VULNERABLE_TYPES) totals.byType[type.key] = { ...type, affected: 0, inArea: 0 };

  const districts = new Map();
  for (const row of rows) {
    const affected = affectedOf(row);
    const cared = Math.min(n(row.cared_count), affected);
    const moved = Math.min(n(row.moved_count), affected);
    const base = baselineByArea.get(areaKey(row));
    const inArea = base ? affectedOf(base) : 0;
    totals.affected += affected;
    totals.cared += cared;
    totals.moved += moved;
    totals.inArea += inArea;
    for (const type of VULNERABLE_TYPES) {
      totals.byType[type.key].affected += n(row[type.key]);
      totals.byType[type.key].inArea += base ? n(base[type.key]) : 0;
    }
    if (!districts.has(row.district)) districts.set(row.district, { district: row.district, villages: 0, affected: 0, cared: 0, moved: 0 });
    const entry = districts.get(row.district);
    entry.villages += 1;
    entry.affected += affected;
    entry.cared += cared;
    entry.moved += moved;
  }
  totals.pending = Math.max(totals.affected - totals.cared, 0);
  totals.caredPercent = totals.affected ? Math.round((totals.cared / totals.affected) * 100) : 0;
  totals.movedPercent = totals.affected ? Math.round((totals.moved / totals.affected) * 100) : 0;
  totals.byType = Object.values(totals.byType);
  totals.districts = [...districts.values()]
    .map((entry) => ({ ...entry, pending: Math.max(entry.affected - entry.cared, 0), caredPercent: entry.affected ? Math.round((entry.cared / entry.affected) * 100) : 0 }))
    .sort((a, b) => b.pending - a.pending || b.affected - a.affected);
  totals.urgent = rows
    .map((row) => ({ ...row, affected: affectedOf(row), pending: Math.max(affectedOf(row) - n(row.cared_count), 0), score: urgencyScore(row) }))
    .filter((row) => row.pending > 0)
    .sort((a, b) => b.score - a.score || b.pending - a.pending)
    .slice(0, 8);
  return totals;
}

export function findBaselineFor(baseline, area) {
  const key = areaKey(area);
  return baseline.find((row) => areaKey(row) === key) || null;
}

/** จำนวนแต่ละประเภทของพื้นที่จากทะเบียน (0 ถ้าไม่พบ) */
export function registryCounts(baseline, area) {
  const row = findBaselineFor(baseline, area);
  return Object.fromEntries(VULNERABLE_TYPES.map((type) => [type.key, row ? n(row[type.key]) : 0]));
}

/** ตัวเลขในเหตุการณ์ต่างจากทะเบียนหรือไม่ (ทะเบียนถูกแก้หลังเพิ่มหมู่บ้าน) */
export function differsFromRegistry(row, baseline) {
  const base = findBaselineFor(baseline, row);
  if (!base) return false;
  return VULNERABLE_TYPES.some((type) => n(row[type.key]) !== n(base[type.key]));
}
