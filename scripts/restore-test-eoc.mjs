import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import mysql from "mysql2/promise";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function decrypt(buffer, secret) {
  if (buffer.subarray(0, 7).toString() !== "STNEOC1") throw new Error("รูปแบบ backup ไม่ถูกต้อง");
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = buffer.subarray(7, 19);
  const tag = buffer.subarray(19, 35);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buffer.subarray(35)), decipher.final()]);
}

const input = arg("--input");
const secret = process.env.BACKUP_ENCRYPTION_KEY;
if (!input) throw new Error("กรุณาระบุ --input");
if (!secret || secret.length < 16) throw new Error("BACKUP_ENCRYPTION_KEY ต้องมีอย่างน้อย 16 ตัวอักษร");
const encrypted = await fs.readFile(path.resolve(input));
const payload = JSON.parse(decrypt(encrypted, secret).toString("utf8"));
if (payload.format !== "stn-eoc-backup-v1") throw new Error("backup version ไม่รองรับ");

const restoreDatabase = `stneoc_restore_test_${Date.now()}`;
if (!/^stneoc_restore_test_\d+$/.test(restoreDatabase)) throw new Error("ชื่อฐานข้อมูล restore test ไม่ปลอดภัย");
const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  multipleStatements: true,
});
let verified = false;
const fileRestoreRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stneoc-file-restore-"));
try {
  await connection.query(`CREATE DATABASE \`${restoreDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE \`${restoreDatabase}\``);
  // Preserve legacy implicit ENUM values during a fidelity restore. New
  // application mutations are still validated before reaching MySQL.
  await connection.query("SET SESSION sql_mode = ''");
  await connection.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const table of payload.tables) {
    await connection.query(table.create_sql);
    if (table.rows.length) {
      const placeholders = table.rows.map(() => `(${table.columns.map((column) => /geometry|point|polygon/.test(table.column_types?.[column] || "") ? "ST_GeomFromText(?)" : "?").join(",")})`).join(",");
      const values = table.rows.flatMap((row) => table.columns.map((column) => row[column]));
      await connection.query(`INSERT INTO \`${table.name}\` (${table.columns.map((column) => `\`${column}\``).join(",")}) VALUES ${placeholders}`, values);
    }
  }
  await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  for (const table of payload.tables) {
    const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table.name}\``);
    if (Number(rows[0].total) !== table.rows.length) throw new Error(`จำนวนข้อมูล ${table.name} หลัง restore ไม่ตรง`);
  }
  for (const file of payload.files) {
    if (file.relative_path.includes("..") || path.isAbsolute(file.relative_path)) throw new Error("พบ path traversal ใน backup");
    const buffer = Buffer.from(file.content_base64, "base64");
    if (sha256(buffer) !== file.checksum_sha256) throw new Error(`checksum ไฟล์ ${file.relative_path} ไม่ตรง`);
    const output = path.join(fileRestoreRoot, file.relative_path);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, buffer);
  }
  verified = true;
  console.log(JSON.stringify({ success: true, restore_verified: true, tables: payload.tables.length, files: payload.files.length, tested_at: new Date().toISOString() }));
} finally {
  if (/^stneoc_restore_test_\d+$/.test(restoreDatabase)) await connection.query(`DROP DATABASE IF EXISTS \`${restoreDatabase}\``);
  await connection.end();
  await fs.rm(fileRestoreRoot, { recursive: true, force: true });
  if (!verified) console.error("Restore test failed; temporary restore targets were cleaned up");
}
