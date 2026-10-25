// "น้ำในคลองตอนนี้" จากสถานีของ ปภ. (cctv.disaster.go.th) — ใช้สถานะตามเกณฑ์ของ ปภ. แต่ละสถานี ให้ตรงกับหน้าเว็บ ปภ.
// ไม่มีการเรียกเครือข่ายในไฟล์นี้ (ทดสอบได้)
import { DDPM_CCTV_STATIONS } from "@/lib/ddpmCctv";

// waterLevelStatus ของ ปภ.: 1 ปกติ · 2 เฝ้าระวัง (≥ เกณฑ์ medium) · 3 เตือนภัย (≥ high) · 4 อันตราย (≥ danger) · 5 วิกฤต (≥ critical) · 0 = ไม่มีข้อมูล
export const DPM_STATUS = {
  0: { key: "nodata", rank: -1, label: "ไม่มีข้อมูล", tone: "#64748b", soft: "#f1f5f9" },
  1: { key: "normal", rank: 0, label: "ปกติ", tone: "#16a34a", soft: "#dcfce7" },
  2: { key: "watch", rank: 1, label: "เฝ้าระวัง", tone: "#a16207", soft: "#fef9c3" },
  3: { key: "warning", rank: 2, label: "เตือนภัย", tone: "#ea580c", soft: "#ffedd5" },
  4: { key: "danger", rank: 3, label: "อันตราย", tone: "#dc2626", soft: "#fee2e2" },
  5: { key: "critical", rank: 4, label: "วิกฤต", tone: "#991b1b", soft: "#fee2e2" }
};
const THRESHOLD_LABELS = [["watch", "เฝ้าระวัง"], ["warning", "เตือนภัย"], ["danger", "อันตราย"], ["critical", "วิกฤต"]];

const num = (value) => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value));
const round2 = (value) => Math.round(value * 100) / 100;

/** สถานะจากเกณฑ์ (ใช้เมื่อ ปภ. ไม่ส่งรหัสสถานะมา) */
export function statusFromThresholds(level, t) {
  if (level === null || !t) return 0;
  if (t.critical !== null && level >= t.critical) return 5;
  if (t.danger !== null && level >= t.danger) return 4;
  if (t.warning !== null && level >= t.warning) return 3;
  if (t.watch !== null && level >= t.watch) return 2;
  return 1;
}

/** ข้อมูลสถานีจาก /api/v1/stations/{code} → รูปแบบที่หน้าเว็บใช้ (ไม่รวมเบอร์โทรเจ้าหน้าที่) */
export function normalizeDpmStation(raw, code) {
  const known = DDPM_CCTV_STATIONS.find((item) => item.code === code) || {};
  const place = String(known.place || "");
  const placeMatch = place.match(/^ต\.(.*?)\s+อ\.(.*)$/);
  const level = num(raw?.currentWaterLevel);
  const th = raw?.waterThreshold || {};
  const thresholds = { watch: num(th.mediumLevelThreshold), warning: num(th.highLevelThreshold), danger: num(th.dangerLevelThreshold), critical: num(th.criticalLevelThreshold) };
  const sourceStatus = Number(raw?.waterLevelStatus);
  const statusCode = level === null ? 0 : sourceStatus >= 1 && sourceStatus <= 5 ? sourceStatus : statusFromThresholds(level, thresholds);
  const bank = num(raw?.riverBankLevel);
  const stamp = raw?.histories?.[0]?.timeStamp;
  const observedAt = level !== null && stamp ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(stamp) ? stamp : `${stamp}Z`).toISOString() : null;
  return {
    id: code,
    code,
    name: known.name || String(raw?.name || code),
    river: String(raw?.basin || "").trim() || null,
    location: String(raw?.location || place).replace(/\s+/g, " ").trim() || null,
    agency: String(raw?.agency || "").trim() || null,
    // เบอร์ติดต่อของหน่วยงานเจ้าของสถานี (ปภ.จ.สตูล) ที่ ปภ. เผยแพร่ในหน้าสถานีสาธารณะ
    telephone: String(raw?.telephone || "").replace(/[^0-9-]/g, "").slice(0, 20) || null,
    tambon: placeMatch?.[1] || null,
    amphoe: String(raw?.amphoeName || placeMatch?.[2] || "").trim() || null,
    source: "ddpm",
    lat: known.lat ?? num(raw?.latitude),
    lng: known.lng ?? num(raw?.longitude),
    level: level === null ? null : round2(level),
    bank: bank === null ? null : round2(bank),
    belowBank: level !== null && bank !== null ? round2(bank - level) : null,
    thresholds,
    statusCode,
    statusLabel: DPM_STATUS[statusCode]?.label || null,
    observedAt
  };
}

/** แปลงเป็นฟิลด์ระดับน้ำกลางที่แผนที่และการประเมินความเสี่ยงใช้ */
export function dpmStationForMap(station) {
  const diff = station?.belowBank === null || station?.belowBank === undefined ? null : round2(-station.belowBank);
  return {
    ...station,
    waterLevelMsl: station.level,
    bankLevelMsl: station.bank,
    bankDiff: diff,
    situationLevel: station.statusCode > 0 ? station.statusCode : null,
    storagePercent: null,
    agency: station.agency || "กรมป้องกันและบรรเทาสาธารณภัย (ปภ.)"
  };
}

export const dpmStatus = (station) => DPM_STATUS[station?.statusCode] || DPM_STATUS[0];

/** เกณฑ์ถัดไปที่ระดับน้ำยังไม่ถึง: { label, level, gap } */
export function nextThreshold(station) {
  if (station?.level === null || station?.level === undefined) return null;
  for (const [key, label] of THRESHOLD_LABELS) {
    const value = station.thresholds?.[key];
    if (value !== null && value !== undefined && station.level < value) return { label, level: value, gap: round2(value - station.level) };
  }
  return null;
}

/** สัดส่วนของเกจ 0–1: ช่วงจาก (เฝ้าระวัง − ช่วงเกณฑ์) ถึง (วิกฤต + 20%) — สถานีที่ระดับอ้างอิงทะเล (เช่น 28–32 ม.) ก็ยังอ่านออก */
export function gaugeScale(station) {
  const t = station?.thresholds || {};
  const low = t.watch ?? 0;
  const high = Math.max(t.critical ?? 0, t.danger ?? 0, t.warning ?? 0, low + 0.5);
  const span = Math.max(high - low, 0.5);
  const min = Math.max(0, low - span);
  const max = high + span * 0.2;
  const at = (value) => (value === null || value === undefined ? null : Math.max(0, Math.min(1, (value - min) / (max - min))));
  return { fill: station?.level === null || station?.level === undefined ? null : Math.max(0.04, at(station.level)), danger: at(t.danger ?? t.warning) };
}

/** เรียงสถานีที่น่าห่วงก่อน (ไม่มีข้อมูลไว้ท้าย) */
export function sortDpmStations(stations = []) {
  return [...stations].sort((a, b) => dpmStatus(b).rank - dpmStatus(a).rank || a.code.localeCompare(b.code));
}

/** ประโยคสรุป เช่น "อันตราย 1 สถานี • เตือนภัย 1 สถานี" */
export function dpmSummary(stations = []) {
  const live = stations.filter((station) => station.statusCode > 0);
  if (!live.length) return "ยังไม่มีข้อมูลจากสถานีวัดระดับน้ำ";
  const parts = [5, 4, 3, 2]
    .map((code) => [DPM_STATUS[code].label, live.filter((station) => station.statusCode === code).length])
    .filter(([, count]) => count)
    .map(([label, count]) => `${label} ${count} สถานี`);
  return parts.length ? parts.join(" • ") : `ทุกสถานีอยู่ในเกณฑ์ปกติ (${live.length} สถานี)`;
}

/** แนวโน้มจากค่ารายชั่วโมง: เทียบค่าล่าสุดกับประมาณ 2 ชม. ก่อน */
export function dpmTrend(history = [], station = null) {
  const points = history.filter((p) => Number.isFinite(Number(p.level)));
  const last = station?.level ?? (points.length ? Number(points.at(-1).level) : null);
  if (last === null || points.length < 2) return null;
  const before = Number(points[Math.max(0, points.length - 3)].level);
  const change = last - before;
  if (change > 0.02) return { value: "rising", arrow: "↑", label: "น้ำขึ้น" };
  if (change < -0.02) return { value: "falling", arrow: "↓", label: "น้ำลด" };
  return { value: "steady", arrow: "→", label: "ทรงตัว" };
}

/** แถบเกณฑ์แบบเดียวกับหน้าสถานีของ ปภ./อบจ.สตูล: 0 → เฝ้าระวัง → เตือนภัย → อันตราย → วิกฤต → (วิกฤต × 1.15) */
export function thresholdBar(station) {
  const t = station?.thresholds || {};
  const values = [t.watch, t.warning, t.danger, t.critical];
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) return null;
  const level = typeof station.level === "number" ? station.level : null;
  const max = Math.max(t.critical * 1.15, level ?? 0) || 1;
  const pct = (value) => Math.min(100, Math.max(0, (value / max) * 100));
  const bounds = [0, t.watch, t.warning, t.danger, t.critical, max];
  const segments = [1, 2, 3, 4, 5].map((code, index) => ({ code, from: bounds[index], to: bounds[index + 1], width: Math.max(0, pct(bounds[index + 1]) - pct(bounds[index])) }));
  return {
    segments,
    marker: level === null ? null : pct(level),
    ticks: [["0", 0], [`เฝ้าระวัง ${t.watch.toFixed(1)}`, t.watch], [`เตือนภัย ${t.warning.toFixed(1)}`, t.warning], [`อันตราย ${t.danger.toFixed(1)}`, t.danger], [`วิกฤต ${t.critical.toFixed(1)}`, t.critical]].map(([label, value]) => ({ label, at: pct(value) }))
  };
}
