// พื้นที่น้ำท่วมซ้ำซาก (GISTDA flood-freq): แปลงข้อมูลดิบให้เบาพอส่งไปแผนที่บนมือถือ
// ไฟล์นี้ไม่มีการเรียกเครือข่าย ใช้ได้ทั้งฝั่ง API และหน้าเว็บ
//
// freq = จำนวนปีที่พื้นที่นั้นถูกน้ำท่วมจากภาพดาวเทียม ช่วง พ.ศ. 2554–2567 (ค.ศ. 2011–2024) รวม 14 ปี

export const FLOOD_FREQ_YEARS = { from: 2011, to: 2024 };

// โทนน้ำเงิน อ่อน→เข้มตามจำนวนปีที่ท่วม (ชั้นนี้มีขอบและโปร่งแสง เพื่อแยกจากเส้นทางน้ำ)
// ช่วงสีตั้งจากข้อมูลจริงของสตูล (ท่วมมากสุด 6 ใน 14 ปี) — แสดงทุกพื้นที่ที่เคยท่วมตั้งแต่ 1 ปีขึ้นไป (REPEATED_MIN_FREQ)
export const FLOOD_FREQ_CLASSES = [
  { key: "once", min: 1, max: 1, label: "ท่วม 1 ปี", color: "#5bb0ec" },
  { key: "twice", min: 2, max: 2, label: "ท่วม 2 ปี", color: "#2f7fd6" },
  { key: "three", min: 3, max: 3, label: "ท่วม 3 ปี", color: "#2a4bc0" },
  { key: "four_plus", min: 4, max: Infinity, label: "ท่วม 4 ปีขึ้นไป", color: "#4b1fa8" }
];

export const REPEATED_MIN_FREQ = 1;
export const FLOOD_FREQ_TOTAL_YEARS = 14;

/** ค.ศ. → พ.ศ. */
export function thaiYear(year) {
  return Number(year) + 543;
}

export function floodFreqClass(freq) {
  const value = Number(freq);
  if (!Number.isFinite(value) || value < 1) return null;
  return FLOOD_FREQ_CLASSES.find((item) => value >= item.min && value <= item.max) || null;
}

// --- ย่อรูปทรง (Douglas–Peucker) ---
function sqSegDist(p, a, b) {
  let [x, y] = a;
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

function douglasPeucker(points, sqTolerance) {
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDist = 0;
    let index = 0;
    for (let i = first + 1; i < last; i += 1) {
      const dist = sqSegDist(points[i], points[first], points[last]);
      if (dist > maxDist) { maxDist = dist; index = i; }
    }
    if (maxDist > sqTolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const round = (value, digits) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** ย่อวงรอบหนึ่งวง: ปัดพิกัด ตัดจุดซ้ำ แล้วลดจุด — วงที่เหลือน้อยกว่า 4 จุดถือว่าเล็กเกินแสดง */
export function simplifyRing(ring, { tolerance = 0.00008, digits = 5 } = {}) {
  if (!Array.isArray(ring) || ring.length < 4) return null;
  const rounded = [];
  for (const point of ring) {
    const next = [round(point[0], digits), round(point[1], digits)];
    const prev = rounded[rounded.length - 1];
    if (!prev || prev[0] !== next[0] || prev[1] !== next[1]) rounded.push(next);
  }
  if (rounded.length < 4) return null;
  const simplified = douglasPeucker(rounded, tolerance * tolerance);
  const first = simplified[0];
  const last = simplified[simplified.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) simplified.push([first[0], first[1]]);
  return simplified.length >= 4 ? simplified : null;
}

export function simplifyGeometry(geometry, options) {
  if (!geometry) return null;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  const kept = polygons
    .map((rings) => {
      const outer = simplifyRing(rings[0], options);
      if (!outer) return null;
      const holes = rings.slice(1).map((ring) => simplifyRing(ring, options)).filter(Boolean);
      return [outer, ...holes];
    })
    .filter(Boolean);
  if (kept.length === 0) return null;
  return kept.length === 1 ? { type: "Polygon", coordinates: kept[0] } : { type: "MultiPolygon", coordinates: kept };
}

const stripPrefix = (value) => String(value || "").replace(/^(อ\.|ต\.|จ\.)\s*/, "").trim();

/** ปีที่ท่วม (ค.ศ.) จากช่อง y_2011…y_2024 */
export function floodYears(properties = {}) {
  const years = [];
  for (let year = FLOOD_FREQ_YEARS.from; year <= FLOOD_FREQ_YEARS.to; year += 1) {
    if (Number(properties[`y_${year}`]) > 0) years.push(year);
  }
  return years;
}

/** feature ดิบของ GISTDA → feature เบา (ตัดฟิลด์ภายในของ GISTDA ออก) */
export function compactFeature(feature, options) {
  const props = feature?.properties || {};
  const freq = Number(props.freq);
  if (!Number.isFinite(freq) || freq < 1) return null;
  const geometry = simplifyGeometry(feature.geometry, options);
  if (!geometry) return null;
  return {
    type: "Feature",
    geometry,
    properties: {
      freq,
      district: stripPrefix(props.ap_tn),
      tambon: stripPrefix(props.tb_tn),
      area_rai: Math.round(Number(props.area_rai || 0) * 10) / 10,
      years: floodYears(props)
    }
  };
}

/** สรุปพื้นที่ (ไร่) รายอำเภอ แยกตามระดับความถี่ — ใช้กับข้อมูลดิบทั้งหมด (ก่อนตัดแปลงเล็ก) */
export function summarizeFloodFreq(features = []) {
  const districts = new Map();
  for (const feature of features) {
    const props = feature?.properties || {};
    const freqClass = floodFreqClass(props.freq);
    if (!freqClass) continue;
    const name = stripPrefix(props.ap_tn) || "ไม่ระบุ";
    const row = districts.get(name) || { district: name, total_rai: 0, repeated_rai: 0, by_class: {} };
    const rai = Number(props.area_rai || 0);
    row.total_rai += rai;
    if (Number(props.freq) >= 2) row.repeated_rai += rai;
    row.by_class[freqClass.key] = (row.by_class[freqClass.key] || 0) + rai;
    districts.set(name, row);
  }
  return [...districts.values()]
    .map((row) => ({
      ...row,
      total_rai: Math.round(row.total_rai),
      repeated_rai: Math.round(row.repeated_rai),
      by_class: Object.fromEntries(Object.entries(row.by_class).map(([key, value]) => [key, Math.round(value)]))
    }))
    .sort((a, b) => b.repeated_rai - a.repeated_rai);
}

/** สรุปรายตำบล: พื้นที่เคยท่วม/ท่วมซ้ำ (ไร่) และจำนวนปีที่ท่วมมากที่สุด — ใช้กับข้อมูลดิบทั้งหมด */
export function summarizeFloodFreqByTambon(features = []) {
  const tambons = new Map();
  for (const feature of features) {
    const props = feature?.properties || {};
    const freq = Number(props.freq);
    if (!Number.isFinite(freq) || freq < 1) continue;
    const district = stripPrefix(props.ap_tn) || "ไม่ระบุ";
    const tambon = stripPrefix(props.tb_tn) || "ไม่ระบุ";
    const key = `${district}|${tambon}`;
    const row = tambons.get(key) || { district, tambon, total_rai: 0, repeated_rai: 0, max_freq: 0, patches: 0 };
    const rai = Number(props.area_rai || 0);
    row.total_rai += rai;
    if (freq >= 2) row.repeated_rai += rai;
    row.max_freq = Math.max(row.max_freq, freq);
    row.patches += 1;
    tambons.set(key, row);
  }
  return [...tambons.values()].map((row) => ({ ...row, total_rai: Math.round(row.total_rai), repeated_rai: Math.round(row.repeated_rai) }));
}
