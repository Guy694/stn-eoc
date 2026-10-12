// สถานะการฟื้นตัวรายตำบล (ไม่ต้องกรอกเพิ่ม — คำนวณจากบันทึกพื้นที่น้ำท่วมรายวันต่อหมู่บ้าน)
// ใช้ระดับน้ำ "ล่าสุด" ของแต่ละหมู่บ้านเทียบกับรายงานก่อนหน้า/สูงสุดของหมู่บ้านนั้น
//   normal  = กลับสู่ภาวะปกติ: ทุกหมู่บ้านที่เคยท่วม รายงานล่าสุดเป็น "ไม่มี"
//   easing  = สถานการณ์คลี่คลาย: ยังมีน้ำ แต่ระดับลดลงจากรายงานก่อน/จุดสูงสุด และไม่มีหมู่บ้านไหนแย่ลง
//   ongoing = ยังไม่คลี่คลาย
import { floodLevelRank } from "@/lib/areaRisk";

export const RECOVERY_STATUSES = {
  normal: { label: "กลับสู่ภาวะปกติ", tone: "green" },
  easing: { label: "คลี่คลาย", tone: "blue" },
  ongoing: { label: "ยังไม่คลี่คลาย", tone: "red" }
};

const clean = (value) => String(value || "").trim().replace(/^(อำเภอ|อ\.|ตำบล|ต\.)\s*/, "").trim();

/** rows: [{ district, tambon, village, date: 'YYYY-MM-DD', level }] */
export function tambonRecovery(rows = []) {
  const villages = new Map();
  for (const row of rows) {
    const district = clean(row.district);
    const tambon = clean(row.tambon);
    if (!district || !tambon) continue;
    const key = `${district}|${tambon}|${String(row.village || "").trim()}`;
    if (!villages.has(key)) villages.set(key, { district, tambon, records: [] });
    villages.get(key).records.push({ date: String(row.date || ""), rank: floodLevelRank(row.level) });
  }

  const tambons = new Map();
  for (const village of villages.values()) {
    const records = village.records.sort((a, b) => a.date.localeCompare(b.date));
    const peak = Math.max(...records.map((record) => record.rank));
    if (peak === 0) continue; // ไม่เคยท่วมในเหตุการณ์นี้
    const latest = records.at(-1);
    const previous = records.length > 1 ? records.at(-2) : null;
    const key = `${village.district}|${village.tambon}`;
    if (!tambons.has(key)) tambons.set(key, { district: village.district, tambon: village.tambon, villages: 0, flooded: 0, worse: 0, lower: 0, lastDate: "" });
    const entry = tambons.get(key);
    entry.villages += 1;
    if (latest.rank > 0) entry.flooded += 1;
    if (previous && latest.rank > previous.rank) entry.worse += 1;
    if (latest.rank > 0 && latest.rank < peak) entry.lower += 1;
    if (latest.date > entry.lastDate) entry.lastDate = latest.date;
  }

  return [...tambons.values()].map((entry) => {
    let status = "ongoing";
    if (entry.flooded === 0) status = "normal";
    else if (!entry.worse && entry.lower > 0) status = "easing";
    return { district: entry.district, tambon: entry.tambon, status, floodedVillages: entry.flooded, villages: entry.villages, lastDate: entry.lastDate };
  }).sort((a, b) => a.district.localeCompare(b.district, "th") || a.tambon.localeCompare(b.tambon, "th"));
}

/** นับตามอำเภอ + รวมจังหวัด */
export function summarizeRecovery(tambons = []) {
  const total = { normal: 0, easing: 0, ongoing: 0, count: tambons.length };
  const districts = new Map();
  for (const item of tambons) {
    total[item.status] += 1;
    if (!districts.has(item.district)) districts.set(item.district, { district: item.district, normal: 0, easing: 0, ongoing: 0, ongoingTambons: [] });
    const entry = districts.get(item.district);
    entry[item.status] += 1;
    if (item.status === "ongoing") entry.ongoingTambons.push(item.tambon);
  }
  return { ...total, districts: [...districts.values()], tambons };
}
