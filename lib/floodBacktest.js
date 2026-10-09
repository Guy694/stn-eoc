// ทดสอบย้อนหลัง (backtest) + ปรับเทียบเกณฑ์พยากรณ์จุดเสี่ยงน้ำท่วม กับเหตุการณ์น้ำท่วมจริงของสตูล
// (ไม่มีการเรียกเครือข่ายในไฟล์นี้ ทดสอบได้)
//
// วิธี: ป้อนฝน/น้ำในคลอง/น้ำทะเล "ที่เกิดขึ้นจริง" ย้อนหลังรายวันเข้ากฎพยากรณ์เดียวกับที่ใช้งานจริง (lib/floodForecast)
//   แล้วดูว่า ตำบลที่น้ำท่วมจริง ถูกเตือน (≥ เฝ้าระวัง) ในช่วงวันเกิดเหตุหรือไม่ = "เตือนถูก" / "พลาด"
//   และนอกช่วงเหตุการณ์ เตือนโดยไม่มีน้ำท่วมกี่ครั้ง = "เตือนเกิน"
// การทดสอบแบบ "ไม่รู้คำตอบล่วงหน้า": ไม่ใช้ประวัติน้ำท่วมจาก EOC ในความเปราะบางของตำบล (ฝั่งข้อมูลเป็นคนตัดออก)
// บันทึกน้ำท่วมไม่ครบทุกตำบล → ช่วงเหตุการณ์ (±3 วัน) ตำบลที่ไม่มีบันทึกจะ "ไม่นับ" ว่าเตือนเกิน
import { areaKey } from "@/lib/areaRisk";
import { DEFAULT_FACTOR_FLOOR, DEFAULT_THRESHOLDS, assessConditions, levelFromForecastScore } from "@/lib/floodForecast";

const DAY = 864e5;
export const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const dateRange = (start, end) => {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
};
const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

/** เหตุการณ์อ้างอิงจากรายงานทางการที่เผยแพร่ (ใช้เมื่อฐานข้อมูลไม่มีบันทึกของเหตุการณ์นั้น) */
export const REFERENCE_EVENTS = [
  {
    id: "ref-2024-11",
    label: "น้ำท่วม 27–29 พ.ย. 2567",
    start: "2024-11-27",
    end: "2024-11-29",
    source: "รายงานศูนย์บัญชาการเหตุการณ์จังหวัดสตูล ณ 29 พ.ย. 2567 (กรุงเทพธุรกิจ)",
    areas: [["ควนโดน", "ควนโดน"], ["ควนโดน", "ย่านซื่อ"], ["ควนโดน", "ควนสตอ"], ["เมืองสตูล", "ฉลุง"], ["ท่าแพ", "ท่าแพ"], ["มะนัง", "ปาล์มพัฒนา"]]
  },
  {
    id: "ref-2023-12",
    label: "น้ำท่วมภาคใต้ 23–26 ธ.ค. 2566",
    start: "2023-12-23",
    end: "2023-12-26",
    source: "สสน. รายงานสถานการณ์น้ำปี 2566 (สตูลอยู่ในพื้นที่ประสบภัย ไม่ระบุตำบล)",
    areas: [],
    province_level: true
  }
];

/** บันทึกน้ำท่วม (flood_records) → เหตุการณ์ตาม session: { id, start, end, areas:[key] } */
export function eventsFromRecords(rows = []) {
  const bySession = new Map();
  for (const row of rows) {
    const date = toDate(row.flood_start_date);
    if (!date || row.flood_level === "ไม่มี") continue;
    const id = `eoc-${row.session_id}`;
    const event = bySession.get(id) || { id, label: `น้ำท่วม (EOC ครั้งที่ ${row.session_number || row.session_id})`, start: date, end: date, source: `บันทึกน้ำท่วม EOC (ครั้งที่ ${row.session_number || row.session_id})`, areas: new Set(), records: 0 };
    if (date < event.start) event.start = date;
    if (date > event.end) event.end = date;
    event.areas.add(areaKey(row.district, row.tambon));
    event.records += 1;
    bySession.set(id, event);
  }
  return [...bySession.values()].map((event) => ({
    ...event,
    end: addDays(event.end, 1), // น้ำท่วมมักต่อเนื่องอย่างน้อยอีก 1 วันหลังวันเริ่มที่บันทึก
    areas: [...event.areas]
  }));
}

/** รวมเหตุการณ์จากฐานข้อมูล + อ้างอิง — ถ้าช่วงวันซ้อนกัน (±3 วัน) รวมเป็นเหตุการณ์เดียว */
export function mergeEvents(dbEvents = [], reference = REFERENCE_EVENTS) {
  const out = dbEvents.map((e) => ({ ...e, areas: [...e.areas], sources: [e.source] }));
  for (const ref of reference) {
    const refAreas = (ref.areas || []).map(([district, tambon]) => areaKey(district, tambon));
    const match = out.find((e) => !(addDays(e.end, 3) < ref.start || addDays(ref.end, 3) < e.start));
    if (match) {
      match.areas = [...new Set([...match.areas, ...refAreas])];
      match.sources.push(ref.source);
      if (ref.start < match.start) match.start = ref.start;
      if (ref.end > match.end) match.end = ref.end;
    } else {
      out.push({ id: ref.id, label: ref.label, start: ref.start, end: ref.end, source: ref.source, sources: [ref.source], areas: refAreas, province_level: Boolean(ref.province_level) });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * คะแนนพยากรณ์รายตำบลรายวัน (คิดครั้งเดียว แล้วลองเกณฑ์หลายชุดได้เร็ว)
 * areas: [{ key, coastal, riverine, susceptibility }]
 * inputs: { rain: { key: { date: mm } }, canal: { key: { date: state } }, sea: { date: state } }
 */
export function scoreSeries(areas, dates, inputs, calibration = null) {
  const result = {};
  for (const area of areas) {
    const rain = inputs.rain?.[area.key] || {};
    const canal = inputs.canal?.[area.key] || {};
    result[area.key] = dates.map((date) => {
      const rain24 = Number(rain[date]) || 0;
      const rain72 = rain24 + (Number(rain[addDays(date, -1)]) || 0) + (Number(rain[addDays(date, -2)]) || 0);
      const conditions = { rain24, rain72, canal: canal[date] || "normal", sea: inputs.sea?.[date] || "normal", compoundTiming: false };
      const assessed = assessConditions(area, conditions, calibration);
      return { date, score: assessed.score, rain24: Math.round(rain24), rain72: Math.round(rain72), canal: conditions.canal, sea: conditions.sea };
    });
  }
  return result;
}

const RANK = { normal: 0, watch: 1, high: 2, critical: 3 };

/** ประเมินผลเกณฑ์หนึ่งชุด */
export function evaluate(series, dates, events, areasMeta, thresholds = DEFAULT_THRESHOLDS, { alarmLevel = "watch" } = {}) {
  const index = new Map(dates.map((d, i) => [d, i]));
  const minRank = RANK[alarmLevel];
  const meta = new Map(areasMeta.map((a) => [a.key, a]));
  const levelOf = (day) => levelFromForecastScore(day.score, thresholds);
  // ช่วงยกเว้นการนับ "เตือนเกิน": ทุกตำบล ±3 วันรอบเหตุการณ์ (บันทึกไม่ครบทุกตำบล)
  const excluded = new Set();
  for (const event of events) for (const d of dateRange(addDays(event.start, -3), addDays(event.end, 3))) excluded.add(d);

  let hits = 0;
  let misses = 0;
  const perEvent = [];
  for (const event of events) {
    const window = dateRange(addDays(event.start, -1), event.end).filter((d) => index.has(d));
    const covered = window.length > 0;
    const rows = [];
    for (const key of event.areas) {
      const days = series[key];
      if (!days || !covered) continue;
      const inWindow = window.map((d) => days[index.get(d)]);
      const peak = inWindow.reduce((best, day) => (!best || day.score > best.score ? day : best), null);
      const firstAlarm = inWindow.find((day) => RANK[levelOf(day)] >= minRank) || null;
      const hit = Boolean(firstAlarm);
      if (hit) hits += 1;
      else misses += 1;
      rows.push({ key, district: meta.get(key)?.district, tambon: meta.get(key)?.tambon, hit, level: levelOf(peak), score: peak.score, date: peak.date, rain24: peak.rain24, rain72: peak.rain72, canal: peak.canal, sea: peak.sea, first_alarm: firstAlarm?.date || null });
    }
    // เหตุการณ์ระดับจังหวัด (ไม่ระบุตำบล): ดูว่ามีตำบลใดถูกเตือนบ้าง (รายงานแยก ไม่นับในคะแนน)
    const alarmed = covered ? Object.keys(series).filter((key) => window.some((d) => RANK[levelOf(series[key][index.get(d)])] >= minRank)) : [];
    perEvent.push({ id: event.id, label: event.label, start: event.start, end: event.end, sources: event.sources || [event.source], province_level: Boolean(event.province_level), covered, areas: rows, alarmed_tambons: alarmed.length, alarmed: alarmed.slice(0, 12).map((key) => ({ key, district: meta.get(key)?.district, tambon: meta.get(key)?.tambon })) });
  }

  // เตือนเกิน: นับเป็น "ครั้ง" (วันติดกันนับครั้งเดียว) ต่อตำบล
  const falseAlarms = [];
  for (const [key, days] of Object.entries(series)) {
    let run = null;
    for (const day of days) {
      const alarm = !excluded.has(day.date) && RANK[levelOf(day)] >= minRank;
      if (alarm) {
        if (run && addDays(run.end, 2) >= day.date) {
          run.end = day.date;
          if (day.score > run.score) Object.assign(run, { score: day.score, rain24: day.rain24, level: levelOf(day) });
        } else {
          run = { key, district: meta.get(key)?.district, tambon: meta.get(key)?.tambon, start: day.date, end: day.date, score: day.score, rain24: day.rain24, level: levelOf(day) };
          falseAlarms.push(run);
        }
      }
    }
  }
  const fa = falseAlarms.length;
  const ratio = (a, b) => (b > 0 ? Math.round((a / b) * 100) / 100 : null);
  const years = dates.length / 365;
  return {
    thresholds,
    hits,
    misses,
    false_alarms: fa,
    false_alarms_per_year: years > 0 ? Math.round((fa / years) * 10) / 10 : null,
    pod: ratio(hits, hits + misses),
    far: ratio(fa, hits + fa),
    csi: ratio(hits, hits + misses + fa),
    per_event: perEvent,
    false_alarm_list: falseAlarms.sort((a, b) => b.score - a.score).slice(0, 15)
  };
}

export function scaledThresholds(scale) {
  const watch = Math.max(2, Math.round(DEFAULT_THRESHOLDS.watch * scale));
  const high = Math.max(watch + 2, Math.round(DEFAULT_THRESHOLDS.high * scale));
  const critical = Math.max(high + 2, Math.round(DEFAULT_THRESHOLDS.critical * scale));
  return { watch, high, critical };
}

export const FACTOR_FLOORS = [0.5, 0.65, 0.8, 1.0];

/**
 * ปรับเทียบ 2 ค่า (เลือกน้อยค่าเพื่อไม่ให้ "จำคำตอบ" จากเหตุการณ์จำนวนน้อย):
 *   1) ตัวคูณขั้นต่ำของความเปราะบาง (ตำบลที่ไม่มีประวัติดาวเทียม/ไม่ลุ่ม) 0.5–1.0
 *   2) ย่อ/ขยายเกณฑ์ทั้งชุด 0.4–1.6 เท่า
 * เลือกชุดที่ CSI สูงสุด — เสมอกันเลือกชุดที่ใกล้ค่าเริ่มต้น
 * เหตุการณ์ระดับจังหวัดไม่มีรายชื่อตำบล จึงไม่มีผลต่อเตือนถูก/พลาด แต่ช่วงวันของมันยังถูกยกเว้นจากการนับเตือนเกิน
 */
export function calibrate(areas, dates, inputs, events, { floors = FACTOR_FLOORS } = {}) {
  const scored = events.filter((e) => !e.province_level);
  const curve = [];
  for (const floor of floors) {
    const series = scoreSeries(areas, dates, inputs, { factor_floor: floor });
    const seen = new Set();
    for (let i = 0; i <= 24; i += 1) {
      const scale = Math.round((0.4 + i * 0.05) * 100) / 100;
      const thresholds = scaledThresholds(scale);
      const signature = `${thresholds.watch}/${thresholds.high}/${thresholds.critical}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      const m = evaluate(series, dates, events, areas, thresholds);
      curve.push({ factor_floor: floor, scale, thresholds, hits: m.hits, misses: m.misses, false_alarms: m.false_alarms, false_alarms_per_year: m.false_alarms_per_year, pod: m.pod, far: m.far, csi: m.csi });
    }
  }
  const distance = (row) => Math.abs(row.scale - 1) + Math.abs(row.factor_floor - DEFAULT_FACTOR_FLOOR);
  const best = curve.reduce((a, b) => {
    if (!a) return b;
    if ((b.csi ?? -1) !== (a.csi ?? -1)) return (b.csi ?? -1) > (a.csi ?? -1) ? b : a;
    return distance(b) < distance(a) ? b : a;
  }, null);
  const observed = scored.reduce((sum, e) => sum + e.areas.length, 0);
  return { best, curve, observed_tambon_events: observed, confidence: observed >= 25 ? "medium" : "low" };
}
