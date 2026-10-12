#!/usr/bin/env node
// ลบข้อมูลจำลองที่ติดป้าย "[ทดสอบ]" ออกจากฐานข้อมูล (ใช้หลังทดลองระบบ)
//   ดูก่อนว่าจะลบอะไร:  npm run test-data:cleanup
//   ลบจริง:            npm run test-data:cleanup -- --apply
import mysql from "mysql2/promise";

const apply = process.argv.includes("--apply");

import { STEPS, paramsFor, toCount } from "../lib/testDataCleanup.mjs";

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "stneoc",
  charset: "utf8mb4"
});

try {
  if (apply) await connection.beginTransaction();
  for (const [label, sql] of STEPS) {
    try {
      if (apply) {
        const [result] = await connection.query(sql, paramsFor(sql));
        console.log(`ลบ ${label}: ${result.affectedRows} แถว`);
      } else {
        const [rows] = await connection.query(toCount(sql), paramsFor(sql));
        console.log(`${label}: ${rows[0].count} แถว`);
      }
    } catch (error) {
      if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR") console.log(`${label}: ข้าม (${error.code})`);
      else throw error;
    }
  }
  if (apply) {
    await connection.commit();
    console.log("ลบข้อมูลทดสอบเรียบร้อย");
  } else {
    console.log("\nยังไม่ได้ลบ — รันอีกครั้งพร้อม --apply เพื่อลบจริง");
  }
} catch (error) {
  if (apply) await connection.rollback();
  console.error("ล้มเหลว ไม่มีการลบใด ๆ:", error.message);
  process.exitCode = 1;
} finally {
  await connection.end();
}
