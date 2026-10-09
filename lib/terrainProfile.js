// ลักษณะภูมิประเทศรายตำบล จาก AWS Terrain Tiles (SRTM, ความละเอียด ~76 ม. ที่ zoom 11) — ฝั่งเซิร์ฟเวอร์
// - สัดส่วนพื้นที่ลุ่มต่ำ (< 2, < 5, < 10 ม. จาก รทก.) และความสูงเฉลี่ย
// - ตำบลติดทะเล: พบจุดทะเล (ความสูง < 0) ในระยะ ~1.3 กม. รอบตำบล
// ข้อมูลภูมิประเทศไม่เปลี่ยน จึงคำนวณครั้งเดียวแล้วเก็บไฟล์ไว้ 30 วัน
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ELEVATION_TILE_URL, decodeTerrarium } from "@/lib/elevation";
import { geometryBounds, gridPoints, lonLatToPixel, pointInGeometry, tilesForBounds } from "@/lib/geoSample";

const ZOOM = 11;
const STEP = 0.0018; // ~200 ม.
const SEA_PAD = 0.012; // ~1.3 กม.
const CACHE_FILE = path.join(tmpdir(), "stn-eoc-terrain-tambon-v1.json");
const CACHE_MS = 30 * 24 * 3600e3;
let memory = null;
let inflight = null;

async function loadTile({ x, y, z }) {
  const sharp = (await import("sharp")).default;
  const url = ELEVATION_TILE_URL.replace("{z}", z).replace("{x}", x).replace("{y}", y);
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), cache: "no-store" });
  if (!response.ok) throw new Error(`terrain tile ${z}/${x}/${y} HTTP ${response.status}`);
  const { data, info } = await sharp(Buffer.from(await response.arrayBuffer())).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, channels: info.channels };
}

async function loadTiles(tiles) {
  const result = new Map();
  const queue = [...tiles];
  const worker = async () => {
    while (queue.length) {
      const tile = queue.shift();
      result.set(`${tile.x}/${tile.y}`, await loadTile(tile));
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return result;
}

function elevationAt(tiles, lon, lat) {
  const { x, y } = lonLatToPixel(lon, lat, ZOOM);
  const tile = tiles.get(`${Math.floor(x / 256)}/${Math.floor(y / 256)}`);
  if (!tile) return null;
  const px = Math.min(255, Math.floor(x % 256));
  const py = Math.min(255, Math.floor(y % 256));
  const offset = (py * tile.width + px) * tile.channels;
  return decodeTerrarium(tile.data[offset], tile.data[offset + 1], tile.data[offset + 2]);
}

/** tambons: [{ key, geometry }] → Map(key → profile) */
export function profileFromSamples(inside, outside) {
  const land = inside.filter((v) => Number.isFinite(v) && v > 0);
  const share = (limit) => (land.length ? Math.round((land.filter((v) => v < limit).length / land.length) * 100) : null);
  const seaNearby = outside.filter((v) => Number.isFinite(v) && v < 0).length + inside.filter((v) => Number.isFinite(v) && v < 0).length;
  const sorted = [...land].sort((a, b) => a - b);
  return {
    samples: land.length,
    mean_m: land.length ? Math.round(land.reduce((s, v) => s + v, 0) / land.length) : null,
    median_m: sorted.length ? Math.round(sorted[Math.floor(sorted.length / 2)]) : null,
    low2_pct: share(2),
    low5_pct: share(5),
    low10_pct: share(10),
    coastal: seaNearby >= 3
  };
}

async function compute(tambons) {
  const allBounds = tambons.map((t) => geometryBounds(t.geometry)).filter(Boolean);
  const bounds = {
    minX: Math.min(...allBounds.map((b) => b.minX)) - SEA_PAD,
    minY: Math.min(...allBounds.map((b) => b.minY)) - SEA_PAD,
    maxX: Math.max(...allBounds.map((b) => b.maxX)) + SEA_PAD,
    maxY: Math.max(...allBounds.map((b) => b.maxY)) + SEA_PAD
  };
  const tiles = await loadTiles(tilesForBounds(bounds, ZOOM));
  const profiles = {};
  for (const tambon of tambons) {
    const box = geometryBounds(tambon.geometry);
    const inside = [];
    const outside = [];
    for (const point of gridPoints(box, STEP, SEA_PAD)) {
      const value = elevationAt(tiles, point[0], point[1]);
      if (pointInGeometry(point, tambon.geometry)) inside.push(value);
      else outside.push(value);
    }
    profiles[tambon.key] = profileFromSamples(inside, outside);
  }
  return profiles;
}

export async function getTerrainProfiles(tambons) {
  const signature = tambons.map((t) => t.key).sort().join("|");
  if (memory && memory.signature === signature && Date.now() - memory.at < CACHE_MS) return memory.profiles;
  try {
    const cached = JSON.parse(await readFile(CACHE_FILE, "utf8"));
    if (cached.signature === signature && Date.now() - cached.at < CACHE_MS) {
      memory = cached;
      return cached.profiles;
    }
  } catch {
    // ยังไม่มีไฟล์
  }
  if (!inflight) {
    inflight = compute(tambons)
      .then(async (profiles) => {
        memory = { signature, at: Date.now(), profiles };
        try {
          await mkdir(path.dirname(CACHE_FILE), { recursive: true });
          await writeFile(CACHE_FILE, JSON.stringify(memory));
        } catch (error) {
          console.warn("[terrain] cannot write cache:", error?.message);
        }
        return profiles;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}
