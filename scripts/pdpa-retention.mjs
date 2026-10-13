#!/usr/bin/env node
// ระยะเก็บข้อมูลส่วนบุคคล (PDPA)
//   ดูก่อนว่าจะทำอะไร:  npm run pdpa:retention
//   ทำจริง:             npm run pdpa:retention -- --apply
// ระยะเก็บคำขอจากประชาชนที่ปิดเรื่องแล้ว: PDPA_RETENTION_DAYS (ค่าเริ่มต้น 365 วัน, ต่ำสุด 30)
import fs from "fs/promises";
import path from "path";
import mysql from "mysql2/promise";
import {
  ANONYMIZE_SQL, COUNT_DUE_SQL, HOUSEKEEPING, PHOTOS_DUE_SQL,
  anonymizeParams, dueParams, incidentPhotoFile, retentionDays
} from "../lib/pdpaRetention.mjs";

const apply = process.argv.includes("--apply");
const days = retentionDays();
const photoDirs = [
  path.join(process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), "private", "uploads"), "incidents"),
  path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads"), "incidents")
];

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "stneoc",
  charset: "utf8mb4"
});

const skip = (label, error) => {
  if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR") { console.log(`${label}: ข้าม (${error.code})`); return true; }
  return false;
};

try {
  for (const [label, sql] of HOUSEKEEPING) {
    try {
      if (apply) console.log(`ลบ ${label}: ${(await connection.query(sql))[0].affectedRows} แถว`);
      else console.log(`${label}: ${(await connection.query(sql.replace(/^DELETE FROM/, "SELECT COUNT(*) AS count FROM")))[0][0].count} แถว`);
    } catch (error) { if (!skip(label, error)) throw error; }
  }

  const label = `คำขอจากประชาชนที่ปิดเรื่องแล้วเกิน ${days} วัน`;
  try {
    const [[{ count }]] = await connection.query(COUNT_DUE_SQL, dueParams(days));
    const [photos] = await connection.query(PHOTOS_DUE_SQL, dueParams(days));
    console.log(`${label}: ${count} เรื่อง (รูปต้นฉบับ ${photos.length} รูป)`);
    if (apply && count) {
      await connection.beginTransaction();
      const [result] = await connection.query(ANONYMIZE_SQL, anonymizeParams(days));
      await connection.commit();
      let removed = 0;
      for (const row of photos) {
        const file = incidentPhotoFile(row.photo_path);
        if (!file) continue;
        for (const dir of photoDirs) {
          try { await fs.unlink(path.join(dir, file)); removed += 1; } catch (error) { if (error.code !== "ENOENT") console.warn(`  ลบรูป ${file} ไม่ได้: ${error.message}`); }
        }
      }
      console.log(`  ลบข้อมูลระบุตัวตนแล้ว ${result.affectedRows} เรื่อง · ลบไฟล์รูป ${removed} ไฟล์`);
    }
  } catch (error) {
    await connection.rollback().catch(() => {});
    if (!skip(label, error)) throw error;
  }

  if (!apply) console.log("\nยังไม่ได้เปลี่ยนอะไร — รันอีกครั้งพร้อม --apply เพื่อทำจริง");
} finally {
  await connection.end();
}
