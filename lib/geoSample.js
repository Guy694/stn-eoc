// เรขาคณิตอย่างง่ายสำหรับวิเคราะห์พื้นที่ (ไม่มีการเรียกเครือข่าย)
// พิกัดแบบ GeoJSON: [lon, lat]

/** จุดอยู่ในวงรอบ (ray casting) */
export function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** จุดอยู่ใน Polygon/MultiPolygon (รองรับรู) */
export function pointInGeometry(point, geometry) {
  const polygons = geometry?.type === "Polygon" ? [geometry.coordinates] : geometry?.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons.some((rings) => rings.length && pointInRing(point, rings[0]) && !rings.slice(1).some((hole) => pointInRing(point, hole)));
}

export function geometryBounds(geometry) {
  const polygons = geometry?.type === "Polygon" ? [geometry.coordinates] : geometry?.type === "MultiPolygon" ? geometry.coordinates : [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rings of polygons) {
    for (const [x, y] of rings[0] || []) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/** จุดตารางห่างเท่า ๆ กันในกรอบ (ขยายขอบได้) */
export function gridPoints(bounds, step, pad = 0) {
  const points = [];
  if (!bounds) return points;
  for (let y = bounds.minY - pad + step / 2; y <= bounds.maxY + pad; y += step) {
    for (let x = bounds.minX - pad + step / 2; x <= bounds.maxX + pad; x += step) points.push([x, y]);
  }
  return points;
}

/** พื้นที่โดยประมาณ (ตร.กม.) จากจำนวนจุดตารางที่อยู่ในรูป */
export function cellAreaKm2(step, lat) {
  const km = 111.32;
  return (step * km) * (step * km * Math.cos((lat * Math.PI) / 180));
}

// ---- tile ของ Web Mercator ----
export function lonLatToPixel(lon, lat, zoom, tileSize = 256) {
  const scale = tileSize * 2 ** zoom;
  const x = ((lon + 180) / 360) * scale;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

export function tilesForBounds(bounds, zoom, tileSize = 256) {
  const a = lonLatToPixel(bounds.minX, bounds.maxY, zoom, tileSize);
  const b = lonLatToPixel(bounds.maxX, bounds.minY, zoom, tileSize);
  const tiles = [];
  for (let tx = Math.floor(a.x / tileSize); tx <= Math.floor(b.x / tileSize); tx += 1) {
    for (let ty = Math.floor(a.y / tileSize); ty <= Math.floor(b.y / tileSize); ty += 1) tiles.push({ x: tx, y: ty, z: zoom });
  }
  return tiles;
}
