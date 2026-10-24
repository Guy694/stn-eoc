#!/usr/bin/env node
// สร้างไฟล์ขอบเขตอำเภอแบบย่อ (SVG path) สำหรับแผนที่บนหน้าแรก
//
//   node scripts/build-satun-district-svg.mjs [database/ampure.geojson] [public/geo/satun-districts.json]
//
// อ่าน GeoJSON ขอบเขตอำเภอทางการ (ไฟล์ ampure.geojson ที่เก็บนอก git) แล้ว
// ลดจำนวนจุดด้วย Douglas–Peucker ตัดเกาะเล็กมาก และแปลงเป็น path ในระบบพิกัด SVG
// ผลลัพธ์มีขนาดเล็ก (~ไม่กี่สิบ KB) จึงโหลดบนมือถือได้เร็ว แทนการดึง polygon หมู่บ้าน ~2.7 MB

import fs from "node:fs";
import path from "node:path";

const input = process.argv[2] || "database/ampure.geojson";
const output = process.argv[3] || "public/geo/satun-districts.json";
const TOLERANCE_DEG = 0.0018; // ~200 ม.
const MIN_RING_AREA = 0.0003; // ตัดเกาะ/แอ่งที่เล็กกว่า ~3.5 ตร.กม.
// แผนที่หน้าแรกแสดงเฉพาะแผ่นดินใหญ่: ตัดหมู่เกาะไกลฝั่ง (ตะรุเตา อาดัง หลีเป๊ะ) ทางตะวันตกเฉียงใต้
// ไม่ให้แผนที่กว้างจนอำเภอเล็กลง (ข้อมูลเต็มยังอยู่ในตาราง districts_polygon)
const isOffshoreIsland = ([lon, lat]) => lon < 99.6 || (lon < 99.75 && lat < 6.75);
const WIDTH = 1000;

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

function simplify(points, tolerance) {
  if (points.length <= 4) return points;
  const sqTol = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDist = 0;
    let index = 0;
    for (let i = first + 1; i < last; i += 1) {
      const dist = sqSegDist(points[i], points[first], points[last]);
      if (dist > maxDist) { maxDist = dist; index = i; }
    }
    if (maxDist > sqTol) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(area / 2);
}

function ringCentroid(ring) {
  let x = 0, y = 0, a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    x += (ring[j][0] + ring[i][0]) * f;
    y += (ring[j][1] + ring[i][1]) * f;
    a += f;
  }
  return a === 0 ? ring[0] : [x / (3 * a), y / (3 * a)];
}

const geo = JSON.parse(fs.readFileSync(input, "utf8"));
const features = geo.features.map((feature) => {
  const geometry = feature.geometry;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return {
    name: feature.properties.dis_name,
    code: feature.properties.dis_code,
    polygons: polygons
      .map((polygon) => polygon.map((ring) => simplify(ring, TOLERANCE_DEG)).filter((ring) => ring.length >= 4 && ringArea(ring) >= MIN_RING_AREA))
      .filter((polygon) => polygon.length > 0 && !isOffshoreIsland(ringCentroid(polygon[0])))
  };
});

let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
for (const feature of features) {
  for (const polygon of feature.polygons) for (const ring of polygon) for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  }
}
const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
const scale = WIDTH / ((maxLon - minLon) * kx);
const height = Math.round((maxLat - minLat) * scale);
const project = ([lon, lat]) => [((lon - minLon) * kx * scale), ((maxLat - lat) * scale)];
const fmt = (n) => Math.round(n * 10) / 10;

const districts = features.map((feature) => {
  let largest = null;
  const d = feature.polygons.map((polygon) => polygon.map((ring) => {
    if (!largest || ringArea(ring) > ringArea(largest)) largest = ring;
    return `M${ring.map((point) => project(point).map(fmt).join(",")).join("L")}Z`;
  }).join("")).join("");
  const [lx, ly] = project(ringCentroid(largest));
  return { name: feature.name, code: feature.code, d, label: [fmt(lx), fmt(ly)] };
});

const result = {
  source: path.basename(input),
  bounds: { minLon, maxLon, minLat, maxLat },
  projection: { kx, scale },
  viewBox: `0 0 ${WIDTH} ${height}`,
  districts
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(result));
console.log(`wrote ${output} (${(fs.statSync(output).size / 1024).toFixed(1)} KB, ${districts.length} districts, viewBox ${result.viewBox})`);
