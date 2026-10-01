#!/usr/bin/env node
// ตัวรัน migration ของฐานข้อมูล EOC
//
//   npm run db:migrate:status            ดูว่าไฟล์ไหนรันแล้ว/ยังไม่รัน
//   npm run db:migrate                   รันไฟล์ที่ยังไม่รันตามลำดับใน migrations/manifest.json
//   npm run db:migrate -- --dry-run      แสดงรายการที่จะรันโดยไม่แตะฐานข้อมูล
//   npm run db:migrate:baseline -- --through reconcile_eoc_team_registry.sql
//        (ครั้งแรกบนฐานข้อมูลเดิม) บันทึกว่าไฟล์ตั้งแต่ต้นจนถึงไฟล์ที่ระบุถูกใช้ไปแล้ว โดยไม่รันซ้ำ
//
// หลักการ:
// - ลำดับการรันมาจาก migrations/manifest.json เท่านั้น (migration ใหม่ต่อท้ายไฟล์นั้นเสมอ)
// - บันทึกไฟล์ที่รันแล้วพร้อม checksum ไว้ในตาราง schema_migrations
// - ถ้าไฟล์ที่รันไปแล้วถูกแก้ไข จะแจ้งเตือนและหยุด เพราะฐานข้อมูลแต่ละที่จะไม่ตรงกัน
// - MySQL ทำ DDL แบบ transaction ไม่ได้ ถ้าไฟล์ใดล้มเหลวให้แก้ฐานข้อมูลตามข้อความ error แล้วรันใหม่

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");
const MANIFEST_PATH = path.join(MIGRATIONS_DIR, "manifest.json");

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

export function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export async function loadMigrations(dir = MIGRATIONS_DIR) {
  const manifest = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8"));
  const listed = manifest.migrations || [];
  const onDisk = (await fs.readdir(dir)).filter((name) => name.endsWith(".sql"));

  const duplicates = listed.filter((name, index) => listed.indexOf(name) !== index);
  if (duplicates.length) throw new Error(`manifest.json มีชื่อซ้ำ: ${duplicates.join(", ")}`);

  const missingFromManifest = onDisk.filter((name) => !listed.includes(name));
  if (missingFromManifest.length) {
    throw new Error(`มีไฟล์ migration ที่ยังไม่ได้ใส่ใน manifest.json: ${missingFromManifest.join(", ")}`);
  }
  const missingOnDisk = listed.filter((name) => !onDisk.includes(name));
  if (missingOnDisk.length) {
    throw new Error(`manifest.json อ้างถึงไฟล์ที่ไม่มีอยู่: ${missingOnDisk.join(", ")}`);
  }

  return Promise.all(listed.map(async (name) => {
    const sql = await fs.readFile(path.join(dir, name), "utf8");
    return { name, sql, checksum: sha256(sql) };
  }));
}

async function connect() {
  return mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME || "stneoc",
    port: Number(process.env.DB_PORT || 3306),
    charset: "utf8mb4",
    multipleStatements: true,
  });
}

async function ensureTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(191) NOT NULL PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      applied_by VARCHAR(100) NULL,
      mode ENUM('applied', 'baseline') NOT NULL DEFAULT 'applied'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function appliedMap(connection) {
  const [rows] = await connection.query("SELECT name, checksum, applied_at, mode FROM schema_migrations");
  return new Map(rows.map((row) => [row.name, row]));
}

function checkDrift(migrations, applied) {
  const changed = migrations.filter((m) => applied.has(m.name) && applied.get(m.name).checksum !== m.checksum);
  if (changed.length) {
    throw new Error(
      `ไฟล์ migration ที่รันไปแล้วถูกแก้ไข: ${changed.map((m) => m.name).join(", ")}\n` +
      "ให้สร้าง migration ใหม่ต่อท้ายแทนการแก้ไฟล์เดิม"
    );
  }
}

async function main() {
  const command = process.argv[2] || "status";
  const dryRun = process.argv.includes("--dry-run");
  const migrations = await loadMigrations();

  if (command === "check") {
    console.log(`manifest ถูกต้อง: ${migrations.length} ไฟล์`);
    return;
  }

  const connection = await connect();
  try {
    await ensureTable(connection);
    const applied = await appliedMap(connection);
    checkDrift(migrations, applied);
    const pending = migrations.filter((m) => !applied.has(m.name));
    const who = process.env.USER || process.env.USERNAME || null;

    if (command === "status") {
      for (const m of migrations) {
        const row = applied.get(m.name);
        console.log(`${row ? (row.mode === "baseline" ? "[baseline]" : "[applied] ") : "[pending] "} ${m.name}`);
      }
      console.log(`\nรันแล้ว ${migrations.length - pending.length} / ${migrations.length} ไฟล์`);
      return;
    }

    if (command === "baseline") {
      const through = argValue("--through");
      if (!through) {
        throw new Error("ต้องระบุ --through <ชื่อไฟล์ migration ล่าสุดที่ฐานข้อมูลนี้มีอยู่แล้ว>");
      }
      const lastIndex = migrations.findIndex((m) => m.name === through);
      if (lastIndex < 0) throw new Error(`ไม่พบ ${through} ใน manifest`);
      const targets = migrations.slice(0, lastIndex + 1).filter((m) => !applied.has(m.name));
      for (const m of targets) {
        console.log(`baseline ${m.name}`);
        if (!dryRun) {
          await connection.query(
            "INSERT INTO schema_migrations (name, checksum, applied_by, mode) VALUES (?, ?, ?, 'baseline')",
            [m.name, m.checksum, who]
          );
        }
      }
      console.log(`\nบันทึก baseline ${targets.length} ไฟล์${dryRun ? " (dry-run)" : ""} — ไฟล์ถัดจากนี้จะถูกรันด้วยคำสั่ง up`);
      return;
    }

    if (command === "up") {
      if (pending.length === 0) {
        console.log("ฐานข้อมูลเป็นปัจจุบันแล้ว");
        return;
      }
      for (const m of pending) {
        console.log(`${dryRun ? "จะรัน" : "กำลังรัน"} ${m.name}`);
        if (dryRun) continue;
        await connection.query(m.sql);
        await connection.query(
          "INSERT INTO schema_migrations (name, checksum, applied_by, mode) VALUES (?, ?, ?, 'applied')",
          [m.name, m.checksum, who]
        );
      }
      console.log(`\nเสร็จสิ้น ${pending.length} ไฟล์${dryRun ? " (dry-run)" : ""}`);
      return;
    }

    throw new Error(`ไม่รู้จักคำสั่ง "${command}" (ใช้ได้: status, up, baseline, check)`);
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
