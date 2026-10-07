// ความสูงพื้นที่ (เมตรจากระดับทะเลปานกลาง) จาก AWS Terrain Tiles รูปแบบ Terrarium (ข้อมูลเปิด ส่วนใหญ่มาจาก SRTM ~30 ม.)
// ไฟล์นี้ไม่มีการเรียกเครือข่าย: ถอดค่าจากสีของภาพ, จัดช่วงความสูง, คำนวณตำแหน่งในภาพ

export const ELEVATION_TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
export const ELEVATION_MAX_ZOOM = 14; // ละเอียดสุดที่มีข้อมูลจริง ซูมเกินนี้ขยายภาพเดิม
export const ELEVATION_ATTRIBUTION = 'ความสูง: <a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a> (SRTM/USGS)';

// ช่วงความสูงที่สื่อความเสี่ยงน้ำท่วม: ยิ่งต่ำยิ่งน้ำไปรวม — เน้นความละเอียดช่วงต่ำ (0–20 ม.) ซึ่งเป็นที่อยู่อาศัยส่วนใหญ่ของสตูล
export const ELEVATION_BANDS = [
  { max: 2, label: "0–2 ม.", meaning: "ต่ำมาก ใกล้ระดับทะเล น้ำทะเลหนุน/ท่วมขังง่าย", rgb: [8, 48, 107] },
  { max: 5, label: "2–5 ม.", meaning: "ต่ำ ที่ราบลุ่มริมคลอง น้ำท่วมถึงบ่อย", rgb: [33, 113, 181] },
  { max: 10, label: "5–10 ม.", meaning: "ค่อนข้างต่ำ ท่วมเมื่อฝนหนักต่อเนื่อง", rgb: [107, 174, 214] },
  { max: 20, label: "10–20 ม.", meaning: "ที่ราบ น้ำระบายได้", rgb: [199, 233, 192] },
  { max: 50, label: "20–50 ม.", meaning: "ที่ดอน", rgb: [116, 196, 118] },
  { max: 100, label: "50–100 ม.", meaning: "เนิน/เชิงเขา ระวังน้ำป่า", rgb: [253, 208, 162] },
  { max: 300, label: "100–300 ม.", meaning: "ภูเขา ระวังดินถล่มเมื่อฝนหนัก", rgb: [214, 160, 107] },
  { max: Infinity, label: "300 ม. ขึ้นไป", meaning: "ภูเขาสูง", rgb: [140, 81, 10] }
];

export function decodeTerrarium(r, g, b) {
  return r * 256 + g + b / 256 - 32768;
}

export function bandIndex(meters) {
  if (!Number.isFinite(meters) || meters <= 0) return -1; // ทะเล/ต่ำกว่าระดับทะเล: โปร่งใส
  return ELEVATION_BANDS.findIndex((band) => meters < band.max);
}

export function bandFor(meters) {
  const index = bandIndex(meters);
  return index >= 0 ? ELEVATION_BANDS[index] : null;
}

/** แปลงพิกเซล Terrarium (RGBA) → ภาพสีตามช่วงความสูง + ค่าความสูง (สำหรับอ่านค่าเมื่อชี้) */
export function colorizeTerrarium(pixels, alpha = 150) {
  const out = new Uint8ClampedArray(pixels.length);
  const heights = new Float32Array(pixels.length / 4);
  for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
    const meters = decodeTerrarium(pixels[i], pixels[i + 1], pixels[i + 2]);
    heights[p] = meters;
    const index = bandIndex(meters);
    if (index < 0) continue;
    const [r, g, b] = ELEVATION_BANDS[index].rgb;
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = alpha;
  }
  return { rgba: out, heights };
}

/** ตำแหน่งภาพ (tile) และพิกเซลที่พิกัดนี้อยู่ ณ zoom ที่กำหนด (Web Mercator, ภาพ 256 px) */
export function tilePixelAt(lat, lng, zoom) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  return {
    key: `${zoom}/${tileX}/${tileY}`,
    px: Math.min(255, Math.floor((x - tileX) * 256)),
    py: Math.min(255, Math.floor((y - tileY) * 256))
  };
}

export function elevationText(meters) {
  if (!Number.isFinite(meters)) return "";
  if (meters <= 0) return "ระดับทะเล/ผิวน้ำ";
  return `${meters < 10 ? meters.toFixed(1) : Math.round(meters)} ม. จากระดับทะเล`;
}
