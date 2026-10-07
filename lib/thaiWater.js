// ระดับน้ำจากคลังข้อมูลน้ำแห่งชาติ (ThaiWater, สสน.) — แปลงข้อมูลดิบให้อยู่ในรูปที่แผนที่ใช้ (ไม่มีการเรียกเครือข่ายในไฟล์นี้)
// สถานการณ์น้ำ (situation_level) ใช้เกณฑ์เดียวกับเว็บ ThaiWater: เทียบ % ความจุลำน้ำ
export const SITUATION_LEVELS = [
  { level: 1, label: "น้อยวิกฤต", range: "≤ 10%", color: "#db802b", text: "#ffffff" },
  { level: 2, label: "น้อย", range: "> 10–30%", color: "#f5b800", text: "#1f2937" },
  { level: 3, label: "ปกติ", range: "> 30–70%", color: "#16a34a", text: "#ffffff" },
  { level: 4, label: "มาก", range: "> 70–100%", color: "#1d4ed8", text: "#ffffff" },
  { level: 5, label: "ล้นตลิ่ง", range: "> 100%", color: "#dc2626", text: "#ffffff" }
];

export const THAIWATER_SOURCE = "คลังข้อมูลน้ำแห่งชาติ (ThaiWater) สสน.";
export const THAIWATER_URL = "https://www.thaiwater.net/water/wl";

// ขอบเขตจังหวัดสตูลโดยประมาณ — กันกรณี API ไม่กรองจังหวัดให้
const SATUN_BOUNDS = { minLat: 6.2, maxLat: 7.4, minLng: 99.4, maxLng: 100.5 };
const STALE_HOURS = 3;

export function situationMeta(level) {
  return SITUATION_LEVELS.find((item) => item.level === Number(level)) || null;
}

export function situationFromStorage(percent) {
  const value = Number(percent);
  if (!Number.isFinite(value)) return null;
  if (value > 100) return 5;
  if (value > 70) return 4;
  if (value > 30) return 3;
  if (value > 10) return 2;
  return 1;
}

function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function thName(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  return String(value.th || value.en || "").trim();
}

export function trendOf(current, previous) {
  const a = num(current);
  const b = num(previous);
  if (a === null || b === null) return null;
  const diff = Math.round((a - b) * 100) / 100;
  if (diff > 0.005) return { value: "rising", label: "น้ำขึ้น", arrow: "↑", change: diff };
  if (diff < -0.005) return { value: "falling", label: "น้ำลด", arrow: "↓", change: diff };
  return { value: "steady", label: "ทรงตัว", arrow: "→", change: 0 };
}

// "2026-10-07 10:40" (เวลาไทย) → ISO พร้อมเขตเวลา
export function thaiDateTimeToIso(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  return `${y}-${m}-${d}T${hh}:${mm}:00+07:00`;
}

// ส่วนต่างระดับน้ำกับตลิ่ง: บวก = ล้นตลิ่ง, ลบ = ต่ำกว่าตลิ่ง (ThaiWater ส่งเป็นค่าบวกพร้อมข้อความกำกับ)
export function bankDiff(record) {
  const value = num(record?.diff_wl_bank);
  if (value === null) return null;
  const text = String(record?.diff_wl_bank_text || "");
  if (/ต่ำกว่า/.test(text)) return -Math.abs(value);
  if (/ล้น|สูงกว่า/.test(text)) return Math.abs(value);
  return value;
}

export function bankText(diff) {
  if (diff === null || diff === undefined) return "";
  return diff > 0 ? `สูงกว่าตลิ่ง ${diff.toFixed(2)} ม.` : `ต่ำกว่าตลิ่ง ${Math.abs(diff).toFixed(2)} ม.`;
}

// ป้ายสั้นข้างหมุด
export function bankLabel(diff) {
  if (diff === null || diff === undefined) return "";
  return diff > 0 ? `ล้นตลิ่ง ${diff.toFixed(2)} ม.` : `−${Math.abs(diff).toFixed(2)} ม.`;
}

export function isStale(observedAt, now = Date.now(), hours = STALE_HOURS) {
  const time = new Date(observedAt).getTime();
  return !Number.isFinite(time) || now - time > hours * 3600 * 1000;
}

export function normalizeStation(record) {
  const station = record?.station || {};
  const lat = num(station.tele_station_lat);
  const lng = num(station.tele_station_long);
  if (lat === null || lng === null) return null;
  const storage = num(record.storage_percent);
  const level = num(record.situation_level) || situationFromStorage(storage);
  const geocode = record.geocode || {};
  const diff = bankDiff(record);
  return {
    id: String(station.id ?? record.id),
    name: thName(station.tele_station_name) || "สถานีวัดระดับน้ำ",
    river: record.river_name || "",
    tambon: thName(geocode.tumbon_name),
    amphoe: thName(geocode.amphoe_name),
    province: thName(geocode.province_name),
    lat,
    lng,
    waterLevelMsl: num(record.waterlevel_msl),
    bankLevelMsl: num(station.min_bank),
    bankDiff: diff,
    storagePercent: storage,
    situationLevel: level,
    trend: trendOf(record.waterlevel_msl, record.waterlevel_msl_previous),
    observedAt: thaiDateTimeToIso(record.waterlevel_datetime),
    agency: thName(record.agency?.agency_shortname) || ""
  };
}

function inSatun(station) {
  if (station.province) return station.province.includes("สตูล");
  return station.lat >= SATUN_BOUNDS.minLat && station.lat <= SATUN_BOUNDS.maxLat
    && station.lng >= SATUN_BOUNDS.minLng && station.lng <= SATUN_BOUNDS.maxLng;
}

// รับ JSON ทั้งก้อนจาก API (รองรับทั้ง {data: []} และ {waterlevel_data: {data: []}})
export function parseWaterLevelResponse(json) {
  const rows = Array.isArray(json?.data) ? json.data
    : Array.isArray(json?.waterlevel_data?.data) ? json.waterlevel_data.data
      : Array.isArray(json) ? json : [];
  return rows
    .map(normalizeStation)
    .filter(Boolean)
    .filter(inSatun)
    .sort((a, b) => (b.situationLevel || 0) - (a.situationLevel || 0) || (b.storagePercent || 0) - (a.storagePercent || 0));
}

// สถานีที่พิกัดซ้ำกัน (สสน. กับ ชป. ตั้งจุดเดียวกัน) รวมเป็นหมุดเดียว ใช้สถานการณ์ที่รุนแรงกว่าเป็นสีหมุด
export function groupByLocation(stations) {
  const groups = new Map();
  for (const station of stations) {
    const key = `${station.lat.toFixed(3)},${station.lng.toFixed(3)}`;
    if (!groups.has(key)) groups.set(key, { key, lat: station.lat, lng: station.lng, stations: [] });
    groups.get(key).stations.push(station);
  }
  return [...groups.values()].map((group) => {
    const sorted = [...group.stations].sort((a, b) => (b.situationLevel || 0) - (a.situationLevel || 0) || (b.bankDiff ?? -99) - (a.bankDiff ?? -99));
    return { ...group, stations: sorted, primary: sorted[0] };
  });
}

export function summarizeStations(stations) {
  const counts = Object.fromEntries(SITUATION_LEVELS.map((item) => [item.level, 0]));
  for (const station of stations) if (counts[station.situationLevel] !== undefined) counts[station.situationLevel] += 1;
  const nearBank = stations.filter((station) => station.bankDiff !== null && station.bankDiff > -0.5);
  return { total: stations.length, counts, overflow: counts[5], nearBank: nearBank.length };
}
