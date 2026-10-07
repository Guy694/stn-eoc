// สถานะสถานพยาบาลบนแผนที่สถานการณ์: ให้บริการได้หรือไม่ + สถานการณ์น้ำท่วมที่ตั้ง
// ไฟล์นี้ไม่มีการเรียกเครือข่าย ใช้ได้ทั้งฝั่ง API และหน้าเว็บ

export const SERVICE_STATUSES = [
  { value: "open", label: "เปิดให้บริการปกติ", short: "เปิด", color: "#15803d", bg: "#dcfce7" },
  { value: "limited", label: "เปิดบางส่วน/จำกัดบริการ", short: "จำกัด", color: "#b45309", bg: "#fef3c7" },
  { value: "closed", label: "ปิดให้บริการชั่วคราว", short: "ปิด", color: "#b91c1c", bg: "#fee2e2" }
];
export const UNKNOWN_SERVICE = { value: "unknown", label: "ยังไม่มีรายงานสถานะ", short: "ไม่ทราบ", color: "#475569", bg: "#e2e8f0" };

export const FLOOD_STATUSES = [
  { value: "normal", label: "ไม่มีน้ำท่วม", color: "#15803d", bg: "#dcfce7" },
  { value: "access_cut", label: "ถนนเข้าออกถูกน้ำท่วม", color: "#b45309", bg: "#fef3c7" },
  { value: "flooded", label: "น้ำท่วมพื้นที่สถานพยาบาล", color: "#b91c1c", bg: "#fee2e2" }
];

// สถานะที่เจ้าหน้าที่รายงานเกินเวลานี้ถือว่าอาจไม่เป็นปัจจุบัน (บอกผู้ใช้ ไม่ซ่อน)
export const STATUS_STALE_HOURS = 24;

// คำอธิบายประเภทหน่วยบริการ: บอกประชาชนว่าไปที่นี่แล้วได้รับบริการระดับไหน
const FACILITY_TYPES = [
  { codes: ["รพ.ทั่วไป", "รพ.ศูนย์"], label: "โรงพยาบาลทั่วไป", care: "รับผู้ป่วยฉุกเฉิน 24 ชม. และรับส่งต่อจากทุกอำเภอ", level: "hospital" },
  { codes: ["รพ.ชุมชน"], label: "โรงพยาบาลชุมชน", care: "รับผู้ป่วยฉุกเฉิน 24 ชม. ประจำอำเภอ", level: "hospital" },
  { codes: ["รพ.สต.", "สอน."], label: "โรงพยาบาลส่งเสริมสุขภาพตำบล", care: "รักษาโรคทั่วไป ทำแผล ปฐมพยาบาล ในเวลาราชการ", level: "primary" },
  { codes: ["ศสช."], label: "ศูนย์สุขภาพชุมชน", care: "รักษาโรคทั่วไปและปฐมพยาบาล ในเวลาราชการ", level: "primary" },
  { codes: ["สสจ", "สสจ."], label: "สำนักงานสาธารณสุขจังหวัด", care: "หน่วยงานบริหาร ไม่ใช่จุดรักษาผู้ป่วย", level: "office" },
  { codes: ["สสอ."], label: "สำนักงานสาธารณสุขอำเภอ", care: "หน่วยงานบริหาร ไม่ใช่จุดรักษาผู้ป่วย", level: "office" }
];

export function facilityTypeInfo(typecode) {
  const code = String(typecode || "").trim();
  return FACILITY_TYPES.find((item) => item.codes.includes(code))
    || { codes: [code], label: code || "หน่วยบริการสุขภาพ", care: "", level: "primary" };
}

export function serviceStatusMeta(value) {
  return SERVICE_STATUSES.find((item) => item.value === value) || UNKNOWN_SERVICE;
}

export function floodStatusMeta(value) {
  return FLOOD_STATUSES.find((item) => item.value === value) || null;
}

export function normalizeServiceStatus(value) {
  return SERVICE_STATUSES.some((item) => item.value === value) ? value : null;
}

export function normalizeFloodStatus(value) {
  return FLOOD_STATUSES.some((item) => item.value === value) ? value : null;
}

/** เบอร์โทรที่กดโทรได้: เก็บเฉพาะตัวเลขและ + (คั่นหลายเบอร์ด้วย , หรือ /) */
export function phoneLinks(phone) {
  return String(phone || "")
    .split(/[,/]|\s{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((label) => ({ label, href: `tel:${label.replace(/[^\d+]/g, "")}` }))
    .filter((item) => item.href.length > 6);
}

export function isStatusStale(updatedAt, now = Date.now(), hours = STATUS_STALE_HOURS) {
  const time = new Date(updatedAt || 0).getTime();
  if (!Number.isFinite(time) || time <= 0) return true;
  return now - time > hours * 3600 * 1000;
}

// --- พื้นที่น้ำท่วม: จุดอยู่ในรูปหลายเหลี่ยม (GeoJSON, พิกัด [lng, lat]) ---
function inRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(lng, lat, rings) {
  if (!Array.isArray(rings) || rings.length === 0 || !inRing(lng, lat, rings[0])) return false;
  return !rings.slice(1).some((hole) => inRing(lng, lat, hole));
}

export function pointInGeometry(lat, lng, geometry) {
  if (!geometry) return false;
  const geom = geometry.type === "Feature" ? geometry.geometry : geometry;
  if (!geom) return false;
  if (geom.type === "FeatureCollection") return (geometry.features || []).some((f) => pointInGeometry(lat, lng, f));
  if (geom.type === "Polygon") return inPolygon(lng, lat, geom.coordinates);
  if (geom.type === "MultiPolygon") return (geom.coordinates || []).some((poly) => inPolygon(lng, lat, poly));
  return false;
}

/** พื้นที่น้ำท่วม (หมู่บ้าน) ที่สถานพยาบาลตั้งอยู่ ถ้ามี */
export function floodAreaAt(lat, lng, floodAreas = []) {
  return floodAreas.find((area) => area?.geometry && pointInGeometry(lat, lng, area.geometry)) || null;
}

// --- ระยะทาง ---
export function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** รายการที่อยู่ภายในรัศมี (กม.) เรียงจากใกล้ไปไกล — item ต้องมี lat/lng หรือ lat/lon หรือ latitude/longitude */
export function nearby(lat, lng, items = [], radiusKm = 1) {
  return items
    .map((item) => {
      const itemLat = Number.parseFloat(item.lat ?? item.latitude);
      const itemLng = Number.parseFloat(item.lng ?? item.lon ?? item.longitude);
      if (!Number.isFinite(itemLat) || !Number.isFinite(itemLng)) return null;
      return { item, km: distanceKm(lat, lng, itemLat, itemLng) };
    })
    .filter((row) => row && row.km <= radiusKm)
    .sort((a, b) => a.km - b.km);
}

export function distanceText(km) {
  if (!Number.isFinite(km)) return "";
  return km < 1 ? `${Math.round(km * 1000)} ม.` : `${km.toFixed(1)} กม.`;
}

/** สีของหมุด: ปิด > น้ำท่วม > จำกัด > เปิด > ไม่ทราบ */
export function markerTone(facility) {
  if (facility?.service_status === "closed") return SERVICE_STATUSES[2];
  if (facility?.flood_status === "flooded") return SERVICE_STATUSES[2];
  if (facility?.service_status === "limited" || facility?.flood_status === "access_cut") return SERVICE_STATUSES[1];
  if (facility?.service_status === "open") return SERVICE_STATUSES[0];
  return UNKNOWN_SERVICE;
}
