#!/usr/bin/env node
// ปรับชื่อโรคในข้อมูลเก่าให้เป็นชื่อมาตรฐานเดียว (ใช้กฎเดียวกับตอนบันทึก: lib/diseaseNames.js)
//   ดูก่อนว่าจะเปลี่ยนอะไร:  npm run diseases:normalize
//   เปลี่ยนจริง:            npm run diseases:normalize -- --apply
// รันซ้ำได้ (ถ้าไม่มีอะไรต้องเปลี่ยนจะไม่แก้อะไร) — ควรรันหลังนำเข้าข้อมูลจาก Google Sheet ด้วย
// ต้องใช้ Node 22 ขึ้นไป
import mysql from "mysql2/promise";
import { normalizeDiseaseName, planMasterListCleanup } from "../lib/diseaseNames.js";

const apply = process.argv.includes("--apply");
const counts = Object.create(null);
const bump = (key, by = 1) => { counts[key] = (counts[key] || 0) + by; };

let connection;
try {
  connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "stneoc",
    charset: "utf8mb4",
    timezone: process.env.DB_TIMEZONE || "+07:00"
  });
} catch (error) {
  console.error(`เชื่อมต่อฐานข้อมูลไม่ได้ (${error.code || error.message}) — ตรวจค่า DB_HOST/DB_USER/DB_PASSWORD/DB_NAME ใน .env`);
  process.exit(1);
}

async function tableExists(name) {
  const [rows] = await connection.query(
    "SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?", [name]);
  return Number(rows[0].count) > 0;
}

// ชื่อที่ต้องเปลี่ยนในคอลัมน์หนึ่ง: [{ from, to, rows }]
async function plannedRenames(table, column) {
  const [rows] = await connection.query(`SELECT ${column} AS name, COUNT(*) AS rows_count FROM ${table} WHERE ${column} IS NOT NULL GROUP BY ${column}`);
  return rows
    .map((row) => ({ from: row.name, to: normalizeDiseaseName(row.name), rows: Number(row.rows_count) }))
    .filter((item) => item.to && item.to !== item.from);
}

function show(title, renames) {
  if (!renames.length) { console.log(`${title}: ไม่มีชื่อที่ต้องเปลี่ยน`); return; }
  console.log(`${title}:`);
  for (const item of renames) console.log(`  "${item.from}" → "${item.to}"  (${item.rows} แถว)`);
}

// 1) รายการหลัก common_diseases: ชื่อซ้ำที่เป็นโรคเดียวกัน เหลือแถวชื่อมาตรฐานแถวเดียว ที่เหลือปิดใช้งาน (ไม่ลบ)
async function normalizeMasterList() {
  if (!(await tableExists("common_diseases"))) return;
  const [rows] = await connection.query("SELECT id, name, is_active FROM common_diseases ORDER BY id");
  const changes = planMasterListCleanup(rows);
  if (!changes.length) { console.log("รายการโรคหลัก: ไม่มีชื่อซ้ำ"); return; }
  console.log("รายการโรคหลัก (common_diseases):");
  for (const change of changes) {
    const merged = change.others.map((row) => `"${row.name}"`).join(", ");
    console.log(`  ใช้ "${change.canonical}"${change.keep.name !== change.canonical ? ` (เปลี่ยนชื่อจาก "${change.keep.name}")` : ""}${merged ? ` · ปิดใช้งานชื่อซ้ำ ${merged}` : ""}`);
  }
  if (!apply) return;
  for (const change of changes) {
    // ปิดชื่อซ้ำก่อน แล้วเปลี่ยนชื่อเป็นชื่อเฉพาะชั่วคราว เพื่อไม่ชน UNIQUE(name) ระหว่างเปลี่ยนชื่อ
    for (const row of change.others) {
      await connection.query("UPDATE common_diseases SET is_active = 0, name = ? WHERE id = ?", [`${row.name} [รวมแล้ว #${row.id}]`.slice(0, 250), row.id]);
      bump("common_diseases ปิดใช้งาน");
    }
    if (change.keep.name !== change.canonical || !change.keep.is_active) {
      await connection.query("UPDATE common_diseases SET name = ?, is_active = 1 WHERE id = ?", [change.canonical, change.keep.id]);
      bump("common_diseases เปลี่ยนชื่อ");
    }
  }
}

// 2) รายงานผู้ป่วยในชุมชน/หน่วยบริการ
async function normalizeSimple(table, column, label) {
  if (!(await tableExists(table))) return;
  const renames = await plannedRenames(table, column);
  show(label, renames);
  if (!apply) return;
  for (const item of renames) {
    const [result] = await connection.query(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`, [item.to, item.from]);
    bump(label, result.affectedRows);
  }
}

// 3) รายงานโรคในศูนย์พักพิง: มี UNIQUE(shelter, session, date, disease_type)
//    ถ้าศูนย์เดียวกันวันเดียวกันมีทั้ง "โรคฉี่หนู" และ "เลปโตสไปโรซิส" ต้องรวมยอดเป็นแถวเดียว
async function normalizeShelterReports() {
  const table = "shelter_disease_reports";
  if (!(await tableExists(table))) return;
  const renames = await plannedRenames(table, "disease_type");
  show("รายงานโรคในศูนย์พักพิง (shelter_disease_reports)", renames);
  if (!renames.length) return;
  const severityRank = { low: 1, medium: 2, high: 3, critical: 4 };
  let merges = 0;
  for (const item of renames) {
    const [rows] = await connection.query(`SELECT * FROM ${table} WHERE disease_type = ?`, [item.from]);
    for (const row of rows) {
      const [targets] = await connection.query(
        `SELECT * FROM ${table} WHERE shelter_id = ? AND session_id = ? AND report_date = ? AND disease_type = ? LIMIT 1`,
        [row.shelter_id, row.session_id, row.report_date, item.to]);
      if (!targets.length) {
        if (apply) await connection.query(`UPDATE ${table} SET disease_type = ? WHERE id = ?`, [item.to, row.id]);
        bump("รายงานโรคในศูนย์ เปลี่ยนชื่อ");
        continue;
      }
      merges += 1;
      if (!apply) continue;
      const target = targets[0];
      const severity = (severityRank[row.severity] || 0) > (severityRank[target.severity] || 0) ? row.severity : target.severity;
      const join = (a, b) => [a, b].filter((text) => text && String(text).trim()).join(" | ") || null;
      await connection.query(
        `UPDATE ${table} SET new_cases = ?, recovered = ?, hospitalized = ?, deaths = ?, severity = ?, symptoms = ?, treatment_given = ?, notes = ? WHERE id = ?`,
        [
          Number(target.new_cases || 0) + Number(row.new_cases || 0),
          Number(target.recovered || 0) + Number(row.recovered || 0),
          Number(target.hospitalized || 0) + Number(row.hospitalized || 0),
          Number(target.deaths || 0) + Number(row.deaths || 0),
          severity,
          join(target.symptoms, row.symptoms),
          join(target.treatment_given, row.treatment_given),
          join(target.notes, row.notes),
          target.id
        ]);
      await connection.query(`DELETE FROM ${table} WHERE id = ?`, [row.id]);
      bump("รายงานโรคในศูนย์ รวมแถวซ้ำ");
    }
  }
  if (merges) console.log(`  * ${merges} แถวจะถูกรวมยอดเข้ากับแถวชื่อมาตรฐานของศูนย์/วันเดียวกัน (ยอดผู้ป่วยรวมไม่เปลี่ยน)`);
}

try {
  if (apply) await connection.beginTransaction();
  await normalizeMasterList();
  await normalizeSimple("disease_reports", "disease_name", "รายงานผู้ป่วยในชุมชน/หน่วยบริการ (disease_reports)");
  await normalizeShelterReports();
  await normalizeSimple("eoc_sessions", "disease_name", "โรคของเหตุการณ์ EOC (eoc_sessions)");
  if (apply) {
    await connection.commit();
    console.log("\nปรับชื่อโรคเรียบร้อย", counts);
  } else {
    console.log("\nยังไม่ได้เปลี่ยนข้อมูล — รันอีกครั้งพร้อม --apply เพื่อเปลี่ยนจริง");
  }
} catch (error) {
  if (apply) await connection.rollback();
  console.error("ล้มเหลว ไม่มีการเปลี่ยนแปลงใด ๆ:", error.message);
  process.exitCode = 1;
} finally {
  await connection.end();
}
