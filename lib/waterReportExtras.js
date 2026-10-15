// ส่วนเสริมของรายงานระดับน้ำแบบ 4 หัวข้อ (ไม่มีการเรียกเครือข่ายในไฟล์นี้)
// 1 ตารางหลายช่วงเวลา · 2 ระดับลุ่มน้ำหลัก (ThaiWater) · 3 ฝนสะสม 24 ชม. + คาดการณ์ · 4 พื้นที่เฝ้าระวังสำคัญ
import { rainCategory, isRainStale } from "@/lib/thaiWaterRain";

export const REPORT_CONFIG_KEY = "water_report_config";
export const THAIWATER_CODE_PREFIX = "TW"; // รหัสที่ใช้เก็บค่าสถานี ThaiWater ในตาราง dpm_water_readings

const round2 = (value) => Math.round(value * 100) / 100;
const num = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const LEVEL_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const text = (value, max = 200) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export const DEFAULT_REPORT_CONFIG = {
  issuer: { name: "", position: "นายแพทย์สาธารณสุขจังหวัดสตูล" },
  basins: [
    { key: "dusan", label: "คลองดุสน (ม่าบัง)", match: "ดุสน", station_id: "", warning: null, bank: null, level: null, level_at: "", previous: null },
    { key: "langu", label: "คลองละงู", match: "ละงู", station_id: "", warning: null, bank: null, level: null, level_at: "", previous: null },
    { key: "thaphae", label: "คลองท่าแพ", match: "ท่าแพ", station_id: "", warning: null, bank: null, level: null, level_at: "", previous: null }
  ],
  areas: [
    { key: "drain", title: "แนวรับน้ำและจุดระบาย", text: "ละงู ควนโพธิ์ บ้านควน คลองขุด และเทศบาลเมืองสตูล" },
    { key: "upland", title: "เชิงเขาและต้นน้ำ", text: "อ.ควนกาหลง อ.ควนโดน อ.มะนัง และ อ.ทุ่งหว้า" },
    { key: "lowland", title: "พื้นที่ลุ่มและปลายน้ำ", text: "ลุ่มคลองละงู" }
  ]
};

/** ค่าตั้งค่าที่เก็บไว้ → รูปแบบที่ใช้ได้เสมอ (เติมค่าเริ่มต้น ตัดค่าที่ไม่ถูกต้อง) */
export function normalizeReportConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  const basinsIn = Array.isArray(source.basins) ? source.basins : [];
  const areasIn = Array.isArray(source.areas) ? source.areas : [];
  return {
    issuer: {
      name: text(source.issuer?.name ?? DEFAULT_REPORT_CONFIG.issuer.name, 120),
      position: text(source.issuer?.position ?? DEFAULT_REPORT_CONFIG.issuer.position, 120)
    },
    basins: DEFAULT_REPORT_CONFIG.basins.map((basin, index) => {
      const saved = basinsIn.find((item) => item?.key === basin.key) || (basinsIn[index] && !basinsIn[index].key ? basinsIn[index] : {});
      return {
        key: basin.key,
        label: text(saved.label, 60) || basin.label,
        match: text(saved.match, 40) || basin.match,
        station_id: text(saved.station_id, 30),
        warning: num(saved.warning),
        bank: num(saved.bank),
        // ระดับน้ำล่าสุดที่เจ้าหน้าที่กรอกเอง (ใช้แทนค่าจากสถานี เมื่อสถานีไม่มีข้อมูล/ต้องการระบุเอง)
        level: num(saved.level),
        level_at: LEVEL_AT_PATTERN.test(String(saved.level_at || "")) ? String(saved.level_at).slice(0, 16) : "",
        previous: num(saved.previous)
      };
    }),
    areas: DEFAULT_REPORT_CONFIG.areas.map((area, index) => {
      const saved = areasIn.find((item) => item?.key === area.key) || (areasIn[index] && !areasIn[index].key ? areasIn[index] : {});
      return {
        key: area.key,
        title: text(saved.title, 60) || area.title,
        text: saved.text === undefined ? area.text : text(saved.text, 300)
      };
    })
  };
}

export function thaiWaterCode(stationId) {
  return `${THAIWATER_CODE_PREFIX}${String(stationId).replace(/[^0-9A-Za-z]/g, "").slice(0, 18)}`;
}

/** เลือกสถานี ThaiWater ของลุ่มน้ำ: ตามที่ตั้งไว้ ไม่งั้นหาจากชื่อคลอง/ชื่อสถานี (เลือกสถานีที่มีข้อมูลและสถานการณ์รุนแรงสุด) */
export function pickBasinStation(stations = [], basin) {
  if (basin?.station_id) {
    const chosen = stations.find((station) => String(station.id) === String(basin.station_id));
    if (chosen) return chosen;
  }
  const match = String(basin?.match || "").trim();
  if (!match) return null;
  const candidates = stations.filter((station) => `${station.river} ${station.name}`.includes(match));
  return [...candidates].sort((a, b) =>
    Number(b.waterLevelMsl !== null) - Number(a.waterLevelMsl !== null)
    || (b.situationLevel || 0) - (a.situationLevel || 0)
    || (b.bankDiff ?? -99) - (a.bankDiff ?? -99)
  )[0] || null;
}

function directionOf(diff) {
  if (diff === null) return null;
  if (diff > 0.005) return "up";
  if (diff < -0.005) return "down";
  return "steady";
}

/** "YYYY-MM-DDTHH:mm" (เวลาไทย) → ISO; ไม่ระบุเวลา → null */
function manualObservedAt(value) {
  if (!LEVEL_AT_PATTERN.test(String(value || ""))) return null;
  const time = new Date(`${String(value).slice(0, 16)}:00+07:00`);
  return Number.isFinite(time.getTime()) ? time.toISOString() : null;
}

/**
 * การ์ดลุ่มน้ำหลัก: ตลิ่ง (ThaiWater min_bank หรือที่ตั้งเอง) ระดับเฝ้าระวัง (ตั้งเอง) ระดับล่าสุด และค่าเมื่อวาน
 * previous: ระดับน้ำ ณ 24 ชม.ก่อน (จากค่าที่เก็บไว้) — ถ้าไม่มีใช้ค่าครั้งก่อนจากต้นทาง
 */
export function buildBasinCard(basin, station, { previous = null } = {}) {
  const manualLevel = num(basin.level);
  const manual = manualLevel !== null;
  const level = manual ? manualLevel : num(station?.waterLevelMsl);
  const bank = basin.bank ?? num(station?.bankLevelMsl);
  const warning = basin.warning;
  // ค่ากรอกเอง: เทียบกับ "เมื่อวาน" ที่กรอกเอง (ถ้ามี) ไม่เอาค่าสถานีมาปนกับระดับที่กรอก
  let before = manual ? num(basin.previous) : num(previous);
  let beforeSource = before !== null ? "yesterday" : null;
  if (!manual && before === null && level !== null && station?.trend && Number.isFinite(station.trend.change)) {
    before = round2(level - station.trend.change);
    beforeSource = "previous";
  }
  const diff = level !== null && before !== null ? round2(level - before) : null;
  const belowBank = level !== null && bank !== null ? round2(bank - level) : null;
  let status = "unknown";
  if (belowBank !== null) {
    if (belowBank < 0) status = "overflow";
    else if (warning !== null && level >= warning) status = "warning";
    else status = "normal";
  }
  return {
    key: basin.key,
    label: basin.label,
    station: station ? { id: station.id, name: station.name, river: station.river, amphoe: station.amphoe, agency: station.agency } : null,
    observedAt: manual ? manualObservedAt(basin.level_at) : station?.observedAt || null,
    manual,
    level,
    bank,
    warning,
    belowBank,
    previous: before,
    previousSource: beforeSource,
    diff,
    direction: directionOf(diff),
    status
  };
}

const RAIN_SHORT = { none: "ไม่มีฝน", light: "เล็กน้อย", moderate: "ปานกลาง", heavy: "หนัก", very_heavy: "หนักมาก" };

function bangkokTime(iso) {
  const time = new Date(iso || 0);
  if (!Number.isFinite(time.getTime()) || time.getTime() <= 0) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(time);
  const get = (type) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("hour")}.${get("minute")} น.`;
}

/** ฝนสะสม 24 ชม. รายสถานี (เฉพาะที่มีฝนและข้อมูลไม่เก่า) เรียงมากไปน้อย */
export function buildRainTable(stations = [], { limit = 12, now = Date.now() } = {}) {
  const fresh = stations.filter((station) => Number(station.rain24h) > 0 && !isRainStale(station.observedAt, now));
  const rows = [...fresh].sort((a, b) => b.rain24h - a.rain24h).slice(0, limit).map((station) => {
    const category = rainCategory(station.rain24h);
    return {
      id: station.id,
      name: station.name,
      amphoe: station.amphoe,
      rain24h: Number(station.rain24h),
      category: category.key,
      label: RAIN_SHORT[category.key] || category.label,
      color: category.color,
      textColor: category.text,
      time: bangkokTime(station.observedAt)
    };
  });
  const times = fresh.map((station) => bangkokTime(station.observedAt)).filter(Boolean).sort();
  return {
    rows,
    total: fresh.length,
    hidden: Math.max(0, fresh.length - rows.length),
    timeRange: times.length ? (times[0] === times[times.length - 1] ? times[0] : `${times[0].replace(" น.", "")} – ${times[times.length - 1]}`) : ""
  };
}

/** คาดการณ์ฝนรายวัน 7 วัน (ECMWF ผ่านหน้าพยากรณ์อากาศ) → หมวดฝนกรมอุตุฯ และโอกาสฝน */
export function buildForecastDays(forecast = [], limit = 7) {
  return forecast
    .filter((item) => item && item.period !== "hourly")
    .slice(0, limit)
    .map((item) => {
      const date = String(item.forecast_datetime || "").slice(0, 10);
      const rainfall = num(item.rainfall_forecast) ?? 0;
      const category = rainCategory(rainfall);
      return {
        date,
        rainfall,
        category: category.key,
        label: category.key === "none" ? "ไม่มีฝน" : RAIN_SHORT[category.key],
        color: category.color,
        probability: num(item.rain_probability)
      };
    });
}

/** วันที่แบบสั้น "14 ต.ค. 2569" จาก YYYY-MM-DD */
export function thaiShortDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || ""));
  if (!match) return "";
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${Number(match[1]) + 543}`;
}
