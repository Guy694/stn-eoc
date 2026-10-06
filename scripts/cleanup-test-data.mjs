#!/usr/bin/env node
// ลบข้อมูลจำลองที่ติดป้าย "[ทดสอบ]" ออกจากฐานข้อมูล (ใช้หลังทดลองระบบ)
//   ดูก่อนว่าจะลบอะไร:  npm run test-data:cleanup
//   ลบจริง:            npm run test-data:cleanup -- --apply
import mysql from "mysql2/promise";

const TAG = "%[ทดสอบ]%";
const apply = process.argv.includes("--apply");

// ลำดับสำคัญ: ลบตารางลูกก่อนตารางแม่
// แจ้งเตือนระดับอำเภอ/ผู้เสียชีวิตคำนวณจากยอดรวม จึงไม่มีป้ายทดสอบในข้อความ —
// ลบเฉพาะที่เกิดหลังรายงานโรคทดสอบชิ้นแรก (ต้องลบก่อนรายงานโรค) เพื่อให้เหตุจริงภายหลังแจ้งเตือนได้อีก
const FIRST_TEST_REPORT = `LEAST(
    COALESCE((SELECT MIN(created_at) FROM disease_reports WHERE notes LIKE ?), '9999-12-31'),
    COALESCE((SELECT MIN(r.created_at) FROM shelter_disease_reports r JOIN shelter_centers sc ON sc.id = r.shelter_id WHERE sc.sheltername LIKE ? OR r.notes LIKE ?), '9999-12-31'))`;

const STEPS = [
  ["ประวัติแจ้งเตือนระดับอำเภอที่เกิดระหว่างทดสอบ", `DELETE FROM eoc_alert_log WHERE (alert_key LIKE 'health-district:%' OR alert_key LIKE 'deaths:%') AND created_at >= ${FIRST_TEST_REPORT}`],
  ["รายงานโรคในศูนย์ (ศูนย์ทดสอบ)", "DELETE r FROM shelter_disease_reports r JOIN shelter_centers sc ON sc.id = r.shelter_id WHERE sc.sheltername LIKE ?"],
  ["รายงานโรคในศูนย์ (หมายเหตุทดสอบ)", "DELETE FROM shelter_disease_reports WHERE notes LIKE ?"],
  ["การเปิดใช้ศูนย์ทดสอบ", "DELETE a FROM shelter_session_activations a JOIN shelter_centers sc ON sc.id = a.shelter_id WHERE sc.sheltername LIKE ?"],
  ["ยอดผู้พักพิงศูนย์ทดสอบ", "DELETE o FROM shelter_occupancy o JOIN shelter_centers sc ON sc.id = o.shelter_id WHERE sc.sheltername LIKE ?"],
  ["ศูนย์พักพิงทดสอบ", "DELETE FROM shelter_centers WHERE sheltername LIKE ?"],
  ["รายงานผู้ป่วยในชุมชน", "DELETE FROM disease_reports WHERE notes LIKE ?"],
  ["กลุ่มเปราะบางในเหตุการณ์", "DELETE FROM vulnerable_groups WHERE notes LIKE ? OR village LIKE ?"],
  ["ทะเบียนกลุ่มเปราะบาง (หมู่บ้านทดสอบ)", "DELETE FROM vulnerable_group_baselines WHERE notes LIKE ? OR village LIKE ?"],
  ["การรับ/จ่ายเวชภัณฑ์", "DELETE m FROM medical_inventory_movements m JOIN medical_inventory_stock s ON s.id = m.stock_id WHERE s.item_name LIKE ?"],
  ["รายการเวชภัณฑ์", "DELETE FROM medical_inventory_stock WHERE item_name LIKE ?"],
  ["สถานการณ์/ข้อสั่งการ", "DELETE FROM eoc_daily_directives WHERE content LIKE ?"],
  ["เรื่องแจ้งปัญหา IT", "DELETE FROM eoc_it_tickets WHERE title LIKE ?"],
  ["ทรัพยากร IT ทดสอบ", "DELETE FROM it_resources WHERE unit_name LIKE ?"],
  ["ประวัติแจ้งเตือนอัตโนมัติที่เกิดจากข้อมูลทดสอบ", "DELETE FROM eoc_alert_log WHERE message LIKE ?"]
];

const paramsFor = (sql) => Array((sql.match(/\?/g) || []).length).fill(TAG);

function toCount(sql) {
  return sql.replace(/^DELETE\s+(\w+\s+)?FROM/i, "SELECT COUNT(*) AS count FROM");
}

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
