#!/usr/bin/env node
// นำเข้าเส้นขอบอำเภอสตูลต้นฉบับจาก GeoJSON สู่ spatial master table
// ใช้ครั้งเดียวเมื่อปรับปรุงข้อมูล: npm run import:district-boundaries

import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const sourcePath = path.resolve(process.cwd(), "database", "ampure.geojson");

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
  feature?.properties?.pro_code === "91" && feature?.geometry?.type === "MultiPolygon"
);

if (features.length !== 7) {
  throw new Error(`ampure.geojson ต้องมีขอบเขตอำเภอสตูล 7 รายการ แต่พบ ${features.length}`);
}

const connection = await mysql.createConnection(dbConfig());
try {
  await connection.beginTransaction();
  for (const feature of features) {
    const { dis_name, pro_name, dis_code, pro_code } = feature.properties;
    const [result] = await connection.execute(
      `UPDATE districts_polygon
       SET dis_name = ?, pro_name = ?, pro_code = ?,
           geometry = ST_SRID(ST_GeomFromGeoJSON(?), 4326)
       WHERE dis_code = ? AND pro_code = ?`,
      [dis_name, pro_name, pro_code, JSON.stringify(feature.geometry), dis_code, pro_code]
    );
    if (result.affectedRows !== 1) {
      throw new Error(`ไม่พบหรือพบขอบเขตซ้ำของอำเภอรหัส ${dis_code} ใน districts_polygon`);
    }
  }
  await connection.commit();
  console.log(`นำเข้าขอบเขตอำเภอสตูล ${features.length} อำเภอจาก ${sourcePath} เรียบร้อย`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
