// ระดับน้ำสถานีเฝ้าระวัง (กล้อง CCTV + เซนเซอร์) ของ ปภ. จาก cctv.disaster.go.th
// ไฟล์นี้ไม่มีการเรียกเครือข่าย: แปลงข้อมูลดิบ และประกอบรายงาน "การประเมินความเสี่ยงสถานการณ์อุทกภัย" แบบ A4
import { FLOOD_FLAGS, stageMeta } from "@/lib/floodTriggers";
import { RISK_TONES } from "@/lib/riskPalette";

export const DPM_SOURCE = "ระบบติดตามระดับน้ำด้วยกล้อง CCTV กรมป้องกันและบรรเทาสาธารณภัย";
export const DPM_URL = "https://cctv.disaster.go.th/dashboard";
export const DPM_STATION_PREFIX = "STN"; // รหัสสถานีของจังหวัดสตูล
export const STEADY_EPSILON = 0.005; // เปลี่ยนไม่ถึง 1 ซม. นับว่าคงที่

// ระยะต่ำกว่าตลิ่ง (ม.) → สถานะของแต่ละสถานี (จุดสีในตาราง และประเด็นเฝ้าระวัง)
// ธงของรายงานใช้เกณฑ์ธง 3 สีของทีม SAT (ดู suggestFlag)
export const BANK_LEVELS = [
  { key: "overflow", label: "ล้นตลิ่ง", flag: "แดง", color: RISK_TONES.red.color, min: -Infinity, max: 0 },
  { key: "near", label: "ใกล้ตลิ่ง", flag: "ส้ม", color: RISK_TONES.orange.color, min: 0, max: 1 },
  { key: "watch", label: "เฝ้าระวัง", flag: "เหลือง", color: RISK_TONES.yellow.color, min: 1, max: 2 },
  { key: "normal", label: "ปกติ", flag: "เขียว", color: RISK_TONES.green.color, min: 2, max: Infinity }
];
const LEVEL_RANK = { overflow: 3, near: 2, watch: 1, normal: 0 };

const round2 = (value) => Math.round(value * 100) / 100;
const num = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const RISING_CONTINUOUS_M = 0.1; // เพิ่ม ≥ 10 ซม. ในช่วงที่เทียบ = "เพิ่มต่อเนื่อง"

/**
 * ธงที่ระบบเสนอจากข้อมูลสถานี (ให้ SAT ยืนยันก่อนประกาศ):
 * แดง  = ล้นตลิ่ง หรือใกล้ตลิ่ง (< 1 ม.) และยังเพิ่มขึ้น
 * เหลือง = ใกล้ตลิ่ง หรืออยู่ช่วงเฝ้าระวัง (1–2 ม.) และเพิ่มต่อเนื่อง
 * เขียว = นอกนั้น (ฤดูน้ำหลาก เฝ้าระวัง)
 */
export function suggestFlag(rows = []) {
  const live = rows.filter((row) => row.level !== null && !row.malfunction && row.belowBank !== null);
  const rising = (row) => row.direction === "up";
  const pick = (key, reason) => ({ ...FLOOD_FLAGS.find((flag) => flag.key === key), reason });
  const overflow = live.filter((row) => row.belowBank < 0);
  if (overflow.length) return pick("red", `ระดับน้ำล้นตลิ่ง: ${overflow.map((row) => row.code).join(", ")}`);
  const nearRising = live.filter((row) => row.belowBank < 1 && rising(row));
  if (nearRising.length) return pick("red", `ใกล้ตลิ่ง (< 1 ม.) และยังเพิ่มขึ้น: ${nearRising.map((row) => row.code).join(", ")}`);
  const near = live.filter((row) => row.belowBank < 1);
  if (near.length) return pick("yellow", `ใกล้ตลิ่ง (< 1 ม.): ${near.map((row) => row.code).join(", ")}`);
  const watchRising = live.filter((row) => row.belowBank < 2 && row.diff !== null && row.diff >= RISING_CONTINUOUS_M);
  if (watchRising.length) return pick("yellow", `ต่ำกว่าตลิ่งไม่ถึง 2 ม. และเพิ่มต่อเนื่อง: ${watchRising.map((row) => row.code).join(", ")}`);
  return pick("green", "ยังไม่มีสถานีที่ใกล้ตลิ่งหรือเพิ่มต่อเนื่อง");
}

export function bankLevel(belowBank) {
  if (belowBank === null || belowBank === undefined || !Number.isFinite(belowBank)) return null;
  return BANK_LEVELS.find((item) => belowBank < item.max && belowBank >= item.min) || BANK_LEVELS[BANK_LEVELS.length - 1];
}

// "2026-10-12 14" (UTC) → Date
function hourKeyToDate(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2})$/.exec(String(key || ""));
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4])));
}

function stationOrder(code) {
  const match = /(\d+)$/.exec(code || "");
  return match ? Number(match[1]) : 999;
}

// ข้อมูลจาก /api/v1/dashboard → สถานีของสตูล (เรียงตามรหัส)
export function parseDpmDashboard(json, prefix = DPM_STATION_PREFIX) {
  const rows = json?.stationAvailable?.data;
  if (!Array.isArray(rows)) throw new Error("รูปแบบข้อมูลจาก ปภ. ไม่ตรงที่คาด");
  const upper = String(prefix || DPM_STATION_PREFIX).toUpperCase();
  return rows
    .filter((row) => String(row?.code || "").toUpperCase().startsWith(upper))
    .map((row) => {
      const level = num(row.currentWaterLevel);
      const bank = num(row.riverBankLevel);
      const belowBank = level !== null && bank !== null ? round2(bank - level) : null;
      const malfunction = String(row.waterLevelStatus).toUpperCase() === "MALFUNCTION";
      return {
        code: String(row.code).toUpperCase(),
        name: String(row.name || "").replace(/\s+/g, " ").trim(),
        lat: num(row.latitude),
        lng: num(row.longitude),
        level: level !== null ? round2(level) : null,
        bank: bank !== null ? round2(bank) : null,
        belowBank,
        status: bankLevel(belowBank)?.key || null,
        malfunction,
        sourceTrend: ["up", "down", "equal"].includes(row.waterLevelTrend) ? row.waterLevelTrend : null,
        sourceDiff: num(row.waterLevelTrendDiff),
        observedAt: hourKeyToDate(row.waterLevelTrendCurrentHourKey)?.toISOString() || null
      };
    })
    .sort((a, b) => stationOrder(a.code) - stationOrder(b.code));
}

// สถานีของจังหวัดสตูลในระบบ ปภ. (ณ ต.ค. 2569) ใช้เติมแถวเมื่อสถานีใดหายจากข้อมูลต้นทาง
export const SATUN_STATIONS = [
  { code: "STN01", name: "สะพานร้อยเมตร", bank: 3.8 },
  { code: "STN02", name: "สะพานข้ามคลองละงู ถนน404", bank: 3.75 },
  { code: "STN03", name: "สะพานข้ามคลองละงู (คิวรถตู้ละงู-หาดใหญ่)", bank: 6.23 },
  { code: "STN05", name: "สะพานข้ามคลองท่าแพ หมู่ 3", bank: 6.13 },
  { code: "STN06", name: "สะพานข้ามคลองโทน", bank: null },
  { code: "STN07", name: "ฝายชลประทาน ดุสน", bank: 32.27 },
  { code: "STN08", name: "สะพานเคียน", bank: 5.07 },
  { code: "STN09", name: "สะพานข้ามคลองฉลุง ใกล้โรงเรียนมุสลิมสตูลวิทยา", bank: 14.38 },
  { code: "STN10", name: "สะพานข้ามคลองตาลีไกล หน้าสำนักงานวัฒนธรรมจังหวัดสตูล", bank: 4.18 }
];

// สถานีที่เคยมีข้อมูลแต่รอบนี้ต้นทางไม่ส่งมา (เช่น อุปกรณ์ขัดข้อง) — ใส่ไว้ในรายงานเป็น "ไม่มีข้อมูล"
export function withKnownStations(stations, known = []) {
  const present = new Set(stations.map((station) => station.code));
  const seen = new Set();
  const missing = known
    .filter((item) => item?.code && !seen.has(String(item.code).toUpperCase()) && seen.add(String(item.code).toUpperCase()))
    .filter((item) => item?.code && !present.has(String(item.code).toUpperCase()))
    .map((item) => ({
      code: String(item.code).toUpperCase(), name: String(item.name || ""), lat: null, lng: null,
      level: null, bank: item.bank === null || item.bank === undefined ? null : round2(Number(item.bank)),
      belowBank: null, status: null, malfunction: true, sourceTrend: null, sourceDiff: null, observedAt: null
    }));
  return [...stations, ...missing].sort((a, b) => stationOrder(a.code) - stationOrder(b.code));
}

// เวลาท้องถิ่นไทย (UTC+7) แบบ "YYYY-MM-DD HH:00:00" ใช้เป็นคีย์รายชั่วโมงในฐานข้อมูล
export function bangkokHourKey(date = new Date()) {
  const local = new Date(new Date(date).getTime() + 7 * 3600 * 1000);
  return `${local.toISOString().slice(0, 13).replace("T", " ")}:00:00`;
}

export function shiftHourKey(key, hours) {
  const base = new Date(`${String(key).slice(0, 13).replace(" ", "T")}:00:00Z`);
  return bangkokHourKey(new Date(base.getTime() - 7 * 3600 * 1000 + hours * 3600 * 1000));
}

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

// "2026-10-12 20:00:00" → { date: "12 ตุลาคม 2569", time: "20.00 น." }
export function thaiHourLabel(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(String(key || ""));
  if (!match) return { date: "", time: "" };
  return {
    date: `${Number(match[3])} ${THAI_MONTHS[Number(match[2]) - 1]} ${Number(match[1]) + 543}`,
    time: `${match[4]}.${match[5]} น.`
  };
}

export function direction(diff) {
  if (diff === null || diff === undefined || !Number.isFinite(diff)) return null;
  if (diff > STEADY_EPSILON) return "up";
  if (diff < -STEADY_EPSILON) return "down";
  return "steady";
}

const fmt = (value) => (value === null || value === undefined ? "–" : Number(value).toFixed(2));
const signed = (value) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)}`;

// baseline: { [code]: level } ณ เวลาที่เทียบ — ถ้าไม่มี ใช้แนวโน้มชั่วโมงก่อนหน้าจากต้นทาง
export function buildWaterReport(stations, { baseline = null, compareLabel = "", dataHour = "", recommendations = null } = {}) {
  const useBaseline = baseline && Object.keys(baseline).length > 0;
  const rows = stations.map((station) => {
    let diff = null;
    if (station.level !== null && !station.malfunction) {
      if (useBaseline) {
        const before = num(baseline[station.code]);
        diff = before !== null ? round2(station.level - before) : null;
      } else if (station.sourceDiff !== null) {
        diff = round2(station.sourceDiff);
      }
    }
    return { ...station, diff, direction: direction(diff) };
  });

  const withData = rows.filter((row) => row.level !== null && !row.malfunction);
  const missing = rows.filter((row) => row.level === null || row.malfunction);
  const counts = { up: 0, down: 0, steady: 0, unknown: 0 };
  for (const row of rows) counts[row.direction || "unknown"] += 1;

  const rising = withData.filter((row) => row.direction === "up").sort((a, b) => b.diff - a.diff);
  const falling = withData.filter((row) => row.direction === "down").sort((a, b) => a.diff - b.diff);
  const closest = [...withData].sort((a, b) => a.belowBank - b.belowBank)[0] || null;
  const risky = withData.filter((row) => row.status === "overflow" || row.status === "near").sort((a, b) => a.belowBank - b.belowBank);

  const worst = withData.reduce((top, row) => (LEVEL_RANK[row.status] > LEVEL_RANK[top] ? row.status : top), "normal");
  const overall = BANK_LEVELS.find((item) => item.key === (withData.length ? worst : "normal"));
  const suggested = suggestFlag(rows);

  let headline;
  if (!withData.length) headline = "ยังไม่มีข้อมูลระดับน้ำจากสถานีเฝ้าระวัง";
  else if (risky.some((row) => row.status === "overflow")) headline = `ระดับน้ำล้นตลิ่ง ${risky.filter((row) => row.status === "overflow").length} สถานี: ${risky.filter((row) => row.status === "overflow").map((row) => row.code).join(", ")}`;
  else if (risky.length) headline = `ระดับน้ำใกล้ตลิ่ง (ต่ำกว่าตลิ่งไม่ถึง 1 ม.) ${risky.length} สถานี: ${risky.map((row) => row.code).join(", ")}`;
  else headline = `สถานีที่มีข้อมูลทั้ง ${withData.length} แห่งยังมีระดับน้ำต่ำกว่าตลิ่ง`;

  const watch = [];
  if (risky.length) for (const row of risky) watch.push(`${row.code} ${row.name} ${row.status === "overflow" ? `ระดับน้ำสูงกว่าตลิ่ง ${Math.abs(row.belowBank).toFixed(2)} ม.` : `ต่ำกว่าตลิ่งเพียง ${row.belowBank.toFixed(2)} ม.`}`);
  if (!rising.length && withData.length) watch.push("ไม่มีสถานีที่ระดับน้ำเพิ่มขึ้น");
  else if (rising.length === 1) watch.push(`ระดับน้ำที่เพิ่มขึ้นมีเพียง ${rising[0].code} เพิ่มขึ้น ${rising[0].diff.toFixed(2)} ม.`);
  else if (rising.length > 1) watch.push(`ระดับน้ำเพิ่มขึ้น ${rising.length} สถานี มากที่สุด ${rising[0].code} +${rising[0].diff.toFixed(2)} ม.`);
  if (closest && !risky.includes(closest)) watch.push(`${closest.code} มีระยะห่างจากตลิ่งน้อยที่สุด ${closest.belowBank.toFixed(2)} ม.`);
  if (missing.length) watch.push(`ไม่มีข้อมูลหรืออุปกรณ์ขัดข้อง: ${missing.map((row) => row.code).join(", ")}`);


  return {
    dataHour,
    dataLabel: thaiHourLabel(dataHour),
    compareLabel: useBaseline ? compareLabel : "ชั่วโมงก่อนหน้า",
    comparedWithBaseline: Boolean(useBaseline),
    rows,
    counts,
    stationsWithData: withData.length,
    overall,
    suggestedFlag: suggested,
    headline,
    highlights: {
      rise: rising[0] || null,
      drop: falling[0] || null,
      next: falling.slice(1, 3)
    },
    watch,
    recommendations: Array.isArray(recommendations) && recommendations.length ? recommendations : flagRecommendations(suggested.key)
  };
}

/** ข้อเสนอเพื่อการเตรียมพร้อมตามธง = การดำเนินการของ Trigger 1 ธงนั้น (เกณฑ์ SAT) */
export function flagRecommendations(flag) {
  const stage = stageMeta(`t1_${flag}`) || stageMeta("t1_green");
  return stage.actions.map((action) => action.text);
}

export const formatLevel = fmt;
export const formatSigned = signed;
