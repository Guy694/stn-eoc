"use client";

// อ่านความสูงพื้นที่ ณ พิกัดเดียวจากภาพ Terrain Tiles (ทำในเบราว์เซอร์ ไม่ผ่านเซิร์ฟเวอร์)
// ข้อมูล ~30 ม. ใช้ประกอบการตัดสินใจ ไม่ใช่ค่ารังวัด
import { ELEVATION_MAX_ZOOM, ELEVATION_TILE_URL, decodeTerrarium, tilePixelAt } from "@/lib/elevation";

const cache = new Map();

export function loadElevation(lat, lng) {
  const { key, px, py } = tilePixelAt(lat, lng, ELEVATION_MAX_ZOOM);
  const cacheKey = `${key}/${px}/${py}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const [z, x, y] = key.split("/");
  const promise = new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const context = canvas.getContext("2d");
        context.drawImage(image, px, py, 1, 1, 0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        resolve(decodeTerrarium(r, g, b));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = ELEVATION_TILE_URL.replace("{z}", z).replace("{x}", x).replace("{y}", y);
  });
  cache.set(cacheKey, promise);
  return promise;
}
