#!/usr/bin/env node
// นำเข้าขอบเขตตำบลสตูลจาก GeoJSON สู่ spatial master table
// ใช้: npm run import:tambon-boundaries

import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const sourcePath = path.resolve(process.cwd(), "database", "tambonnn.geojson");

function dbConfig() {
  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME || "stneoc"
  };
}

const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const features = (source.features || []).filter((feature) =>
  feature?.properties?.pro_name === "สตูล" && feature?.properties?.tam_name && feature?.geometry?.type === "MultiPolygon"
);

if (features.length !== 39) {
  throw new Error(`tambonnn.geojson ต้องมีขอบเขตตำบลสตูล 39 รายการ แต่พบ ${features.length}`);
}

const connection = await mysql.createConnection(dbConfig());
try {
  // ตรวจ source ทุก geometry ก่อนเริ่มแก้ไขฐานข้อมูล
  for (const feature of features) {
    const [rows] = await connection.execute(
      "SELECT ST_IsValid(ST_SRID(ST_GeomFromGeoJSON(?), 4326)) AS is_valid",
      [JSON.stringify(feature.geometry)]
    );
    if (Number(rows[0]?.is_valid) !== 1) {
      throw new Error(`geometry ของตำบล${feature.properties.tam_name} ไม่ถูกต้อง จึงไม่ได้นำเข้า`);
    }
  }

  const [existingRows] = await connection.query(
    "SELECT id, tam_name, dis_name, tum_code, dis_code, pro_code FROM tambons_polygon WHERE pro_name = 'สตูล'"
  );
  const existingByName = new Map(existingRows.map((row) => [`${row.dis_name}:${row.tam_name}`, row]));
  const [districtRows] = await connection.query(
    "SELECT dis_name, dis_code, pro_code FROM districts_polygon WHERE pro_name = 'สตูล'"
  );
  const districtByName = new Map(districtRows.map((row) => [row.dis_name, row]));

  await connection.beginTransaction();
  let updated = 0;
  let inserted = 0;
  for (const feature of features) {
    const { tam_name, dis_name, pro_name } = feature.properties;
    const existing = existingByName.get(`${dis_name}:${tam_name}`);
    const district = districtByName.get(dis_name);
    if (!district) throw new Error(`ไม่พบรหัสอำเภอสำหรับตำบล${tam_name} (${dis_name})`);

    const geometry = JSON.stringify(feature.geometry);
    if (existing) {
      await connection.execute(
        `UPDATE tambons_polygon
         SET geometry = ST_SRID(ST_GeomFromGeoJSON(?), 4326),
             pro_name = ?, pro_code = ?, dis_code = ?
         WHERE id = ?`,
        [geometry, pro_name, district.pro_code, district.dis_code, existing.id]
      );
      updated += 1;
    } else {
      await connection.execute(
        `INSERT INTO tambons_polygon (tam_name, dis_name, pro_name, tum_code, dis_code, pro_code, geometry)
         VALUES (?, ?, ?, NULL, ?, ?, ST_SRID(ST_GeomFromGeoJSON(?), 4326))`,
        [tam_name, dis_name, pro_name, district.dis_code, district.pro_code, geometry]
      );
      inserted += 1;
    }
  }
  await connection.commit();
  console.log(`นำเข้าขอบเขตตำบลสตูลสำเร็จ: อัปเดต ${updated} รายการ, เพิ่ม ${inserted} รายการ`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
