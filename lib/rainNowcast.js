// โอกาสฝนหนักวันนี้แบบรวมค่าวัดจริง: ฝนที่ตกแล้ววันนี้ (สถานีวัดฝน) + ฝนที่ ECMWF 51 ชุดคาดว่าจะตกในชั่วโมงที่เหลือ
// "วันนี้" = 00:00–24:00 เวลาไทย (ตรงกับวันของพยากรณ์รายวัน) · ไม่มีการเรียกเครือข่ายในไฟล์นี้ ทดสอบได้
import { EXTREME_RAIN_MM, HEAVY_RAIN_MM, VERY_HEAVY_RAIN_MM, quantile, round1 } from "@/lib/forecastSignals";

const BKK_MS = 7 * 3600e3;
/** เวลา (ms หรือ ISO) → ข้อความเวลาไทย "YYYY-MM-DD HH:MM:SS" */
export function bangkokText(value) {
  const ms = typeof value === "number" ? value : Date.parse(value || "");
  return Number.isFinite(ms) ? new Date(ms + BKK_MS).toISOString().slice(0, 19).replace("T", " ") : null;
}

const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const MIN_GAP_MINUTES = 50; // ค่าฝน 1 ชม. สองค่าที่ห่างกันน้อยกว่านี้คาบเกี่ยวกัน → นับค่าเดียว
const minutesBetween = (a, b) => (Date.parse(`${b.replace(" ", "T")}Z`) - Date.parse(`${a.replace(" ", "T")}Z`)) / 60000;

function previousDay(day) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * ฝนที่ตกแล้ววันนี้ของสถานีเดียว
 * readings = [{ observedAt: "YYYY-MM-DD HH:MM:SS" (เวลาไทย), rain1, rain24 }] (ประวัติรายชั่วโมง + ค่าล่าสุด)
 * วิธี: (1) รวมฝนรายชั่วโมงที่สถานีรายงานตั้งแต่เที่ยงคืน (ไม่นับซ้ำช่วงเวลาที่คาบเกี่ยวกัน)
 *       (2) ค่าต่ำสุดที่เป็นไปได้จากฝนสะสม 24 ชม.: ค่าล่าสุด − ค่าตอนเที่ยงคืน (ใช้แทนชั่วโมงที่สถานีไม่ได้ส่ง)
 *       ใช้ค่าที่มากกว่า และไม่เกินฝนสะสม 24 ชม. ล่าสุด
 * คืน null = ข้อมูลไม่พอ
 */
export function stationRainToday(readings = [], { today } = {}) {
  const byTime = new Map();
  for (const row of readings) if (row?.observedAt) byTime.set(row.observedAt, row);
  const rows = [...byTime.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const since = `${today} 00:30:00`; // ฝน 1 ชม. ที่วัดก่อนนี้ส่วนใหญ่เป็นฝนเมื่อวาน

  let hourlySum = 0;
  let hourlyCount = 0;
  let lastCounted = null;
  for (const row of rows) {
    if (row.observedAt < since || !row.observedAt.startsWith(today) || !finite(row.rain1)) continue;
    if (lastCounted && minutesBetween(lastCounted, row.observedAt) < MIN_GAP_MINUTES) continue;
    hourlySum += Math.max(0, Number(row.rain1));
    hourlyCount += 1;
    lastCounted = row.observedAt;
  }

  const with24 = rows.filter((row) => finite(row.rain24));
  const latest = with24.length ? with24[with24.length - 1] : null;
  const latestToday = latest && latest.observedAt.startsWith(today) ? latest : null;
  const from = `${previousDay(today)} 23:30:00`;
  const to = `${today} 01:00:00`;
  const midnight = `${today} 00:00:00`;
  const baseline = with24
    .filter((row) => row.observedAt >= from && row.observedAt <= to)
    .sort((a, b) => Math.abs(minutesBetween(midnight, a.observedAt)) - Math.abs(minutesBetween(midnight, b.observedAt)))[0] || null;
  const lower = latestToday && baseline && latestToday.observedAt > baseline.observedAt
    ? Math.max(0, Number(latestToday.rain24) - Number(baseline.rain24))
    : null;

  if (!hourlyCount && lower === null) {
    // ไม่มีข้อมูลรายชั่วโมง: ถ้าฝน 24 ชม. ล่าสุดเป็น 0 แปลว่าวันนี้ยังไม่ตก
    return latestToday && Number(latestToday.rain24) === 0 ? { mm: 0, observedAt: latestToday.observedAt } : null;
  }
  let mm = Math.max(hourlySum, lower ?? 0);
  if (latestToday) mm = Math.min(mm, Number(latestToday.rain24));
  const observedAt = rows.filter((row) => row.observedAt.startsWith(today)).map((row) => row.observedAt).pop() || null;
  return { mm: round1(mm), observedAt };
}

/** ฝนวันนี้ของอำเภอ: ใช้สถานีที่ตกมากที่สุด (เหมือนการเตือนฝนจากสถานีวัด) — stations = [{ name, readings }] */
export function districtRainToday(stations = [], { today } = {}) {
  let best = null;
  let counted = 0;
  for (const station of stations) {
    const result = stationRainToday(station.readings, { today });
    if (!result) continue;
    counted += 1;
    if (!best || result.mm > best.mm) best = { ...result, station: station.name || null };
  }
  return best ? { ...best, stations: counted } : null;
}

/**
 * รวมฝนที่ตกแล้วกับพยากรณ์รายชั่วโมงที่เหลือของวันนี้ (ECMWF 51 ชุด)
 * hourly = ผลจาก ensemble API: { time: ["YYYY-MM-DDTHH:00", ...], precipitation: [...], precipitation_member01: [...] }
 * ค่าฝนรายชั่วโมงของ Open-Meteo = ฝนในชั่วโมงก่อนเวลานั้น จึงนับเฉพาะชั่วโมงหลังชั่วโมงปัจจุบัน
 * คืนรูปแบบเดียวกับ ensembleRainDays()[0] + observed_mm, remaining_median_mm, hours_left
 */
export function blendTodayHeavyRain({ observedMm, hourly, today, now = Date.now() }) {
  if (!finite(observedMm) || !Array.isArray(hourly?.time) || !today) return null;
  const nowHour = (bangkokText(now) || "").slice(0, 13);
  const remaining = hourly.time
    .map((time, index) => [String(time).replace("T", " ").slice(0, 13), index])
    .filter(([hour]) => hour.startsWith(today) && hour > nowHour)
    .map(([, index]) => index);
  const memberKeys = Object.keys(hourly).filter((key) => key.startsWith("precipitation"));
  const observed = Number(observedMm);
  const futures = [];
  for (const key of memberKeys) {
    const values = remaining.map((index) => hourly[key]?.[index]);
    if (remaining.length && values.every((value) => !finite(value))) continue; // ชุดนี้ไม่มีข้อมูล
    futures.push(values.reduce((sum, value) => sum + (finite(value) ? Math.max(0, Number(value)) : 0), 0));
  }
  if (!futures.length) return null;
  const totals = futures.map((value) => observed + value).sort((a, b) => a - b);
  const share = (mm) => Math.round((totals.filter((value) => value >= mm).length / totals.length) * 100);
  return {
    date: today,
    members: totals.length,
    median_mm: round1(quantile(totals, 0.5)),
    p90_mm: round1(quantile(totals, 0.9)),
    prob_heavy: share(HEAVY_RAIN_MM),
    prob_very_heavy: share(VERY_HEAVY_RAIN_MM),
    prob_extreme: share(EXTREME_RAIN_MM),
    observed_mm: round1(observed),
    remaining_median_mm: round1(quantile([...futures].sort((a, b) => a - b), 0.5)),
    hours_left: remaining.length,
    source: "gauge+forecast"
  };
}

// ---------- ข้อความแสดงผล (ใช้ได้ทั้งหน้าเว็บและน้องสจ๊วต) ----------
const isBlended = (item) => item?.source === "gauge+forecast" && finite(item.observed_mm);

/** ข้อความสั้นสำหรับบรรทัดสรุป เช่น "ฝนวันนี้ 22 มม. • โอกาสถึงฝนหนัก 64%" */
export function heavyRainTodayText(item) {
  if (!item || !finite(item.prob_heavy)) return null;
  if (isBlended(item) && item.observed_mm >= HEAVY_RAIN_MM) return `ฝนหนักแล้ววันนี้ (${item.observed_mm} มม.)`;
  if (isBlended(item) && item.observed_mm > 0) return `ฝนวันนี้ ${item.observed_mm} มม. • โอกาสถึงฝนหนัก ${item.prob_heavy}%`;
  return `โอกาสฝนหนักวันนี้ ${item.prob_heavy}%`;
}

/** คำอธิบายใต้ตัวเลข % */
export function heavyRainNote(item) {
  if (!item) return "";
  if (isBlended(item)) {
    const where = item.observed_station ? ` (${item.observed_station})` : "";
    return item.hours_left ? `ตกแล้ว ${item.observed_mm} มม.${where} + คาดอีก ~${item.remaining_median_mm} มม.` : `ตกแล้ว ${item.observed_mm} มม.${where}`;
  }
  return `ฝนน่าจะได้ราว ${item.median_mm} มม. (มากสุด ~${item.p90_mm})`;
}
