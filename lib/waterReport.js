// รายงานระดับน้ำจากประชาชน — ช่วงระดับน้ำเทียบกับร่างกาย (เข้าใจง่ายกว่าตัวเลข ซม.)
// ไม่แตะฐานข้อมูล ใช้ทั้งฟอร์มประชาชน หน้าตรวจของเจ้าหน้าที่ และแผนที่สาธารณะ

export const WATER_LEVELS = [
  { value: "dry", label: "แห้ง / ต่ำกว่าข้อเท้า", short: "ต่ำกว่าข้อเท้า", range: "< 10 ซม.", fill: 0.07, color: "#22a35a", urgency: "low", travel: "passable" },
  { value: "ankle_knee", label: "ข้อเท้า–เข่า", short: "ข้อเท้า–เข่า", range: "10–50 ซม.", fill: 0.24, color: "#e5b819", urgency: "medium", travel: "passable" },
  { value: "knee_waist", label: "เข่า–เอว", short: "เข่า–เอว", range: "50–100 ซม.", fill: 0.44, color: "#f08a24", urgency: "high", travel: "difficult" },
  { value: "waist_chest", label: "เอว–อก", short: "เอว–อก", range: "100–130 ซม.", fill: 0.6, color: "#e0413a", urgency: "high", travel: "impassable" },
  { value: "chest_up", label: "อกขึ้นไป", short: "อกขึ้นไป", range: "130–180 ซม.", fill: 0.76, color: "#b5325f", urgency: "critical", travel: "impassable" },
  { value: "over_head", label: "มิดหัว / ท่วมหลังคา", short: "มิดหัว", range: "> 180 ซม.", fill: 1, color: "#6b3fa0", urgency: "critical", travel: "impassable" }
];

export const WATER_TRENDS = [
  { value: "rising", label: "น้ำกำลังขึ้น", arrow: "↑" },
  { value: "steady", label: "ทรงตัว", arrow: "→" },
  { value: "falling", label: "กำลังลด", arrow: "↓" }
];

// การสัญจร → travel_status เดิมของระบบ
export const WATER_PASSABILITY = [
  { value: "car", label: "รถเก๋ง/กระบะผ่านได้", travel: "passable" },
  { value: "high_vehicle", label: "เฉพาะรถสูง", travel: "difficult" },
  { value: "boat", label: "เรือเท่านั้น", travel: "impassable" }
];

const LEVEL_MAP = new Map(WATER_LEVELS.map((item) => [item.value, item]));
const TREND_MAP = new Map(WATER_TRENDS.map((item) => [item.value, item]));

export function waterLevelMeta(value) {
  return LEVEL_MAP.get(value) || null;
}

export function waterTrendMeta(value) {
  return TREND_MAP.get(value) || null;
}

export function isWaterLevel(value) {
  return LEVEL_MAP.has(value);
}

// ข้อความสั้นสำหรับแสดงผล: "เข่า–เอว (50–100 ซม.)" — ค่าเก่าที่เป็นตัวเลขแสดงเป็น "xx ซม."
export function waterLevelText(value) {
  const meta = waterLevelMeta(value);
  if (meta) return `${meta.label} (${meta.range})`;
  if (value === null || value === undefined || value === "") return "";
  return `${value} ซม.`;
}

export function travelForPassability(value) {
  return WATER_PASSABILITY.find((item) => item.value === value)?.travel || null;
}

// หัวข้อเริ่มต้นสำหรับเผยแพร่ (เจ้าหน้าที่แก้ต่อได้)
export function waterReportTitle({ water_level: level, travel_status: travel }) {
  const meta = waterLevelMeta(level);
  if (!meta) return null;
  if (meta.value === "dry") return "น้ำลดแล้ว / ต่ำกว่าข้อเท้า";
  const travelText = travel === "impassable" ? " — รถผ่านไม่ได้" : travel === "difficult" ? " — เฉพาะรถสูง" : "";
  return `น้ำท่วมระดับ${meta.short} (${meta.range})${travelText}`;
}

// อ่านพิกัดจากลิงก์ Google Maps / ข้อความแชร์ตำแหน่งของ LINE / ตัวเลขพิกัดที่วางมา
export function parseLatLng(text) {
  const value = String(text || "").trim();
  if (!value) return { ok: false, error: "" };
  const patterns = [
    /@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll|destination|daddr|center)=(?:loc:)?(-?\d{1,3}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /(-?\d{1,2}\.\d{3,})\s*[,\s]\s*(-?\d{2,3}\.\d{3,})/
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { ok: true, lat, lng, nearSatun: lat > 6.2 && lat < 7.4 && lng > 99.4 && lng < 100.5 };
      }
    }
  }
  if (/goo\.gl|maps\.app|line\.me/i.test(value)) {
    return { ok: false, error: "ลิงก์แบบย่อเปิดอ่านพิกัดไม่ได้ — เปิดลิงก์ในแผนที่ก่อน แล้วคัดลอกลิงก์เต็มหรือตัวเลขพิกัดมาวาง" };
  }
  return { ok: false, error: "ไม่พบพิกัดในข้อความนี้" };
}
