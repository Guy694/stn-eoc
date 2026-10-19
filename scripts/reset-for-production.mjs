#!/usr/bin/env node
// ล้างข้อมูลช่วงทดลองระบบ ก่อนเริ่มใช้สถานการณ์จริง
// เก็บ: ข้อมูลที่ระบบต้องใช้ (หน่วยบริการ ขอบเขตหมู่บ้าน/ตำบล/อำเภอ ประชากร ประเภท/โมดูล/สิทธิ์ ทีมภารกิจ การตั้งค่า บัญชีเจ้าหน้าที่จริง)
//       + เหตุการณ์ที่ระบุ (ค่าเริ่มต้น อุทกภัย ครั้งที่ 3) เฉพาะตัวเหตุการณ์และทีม/ผู้บัญชาการที่ตั้งไว้ — ข้อมูลที่รายงานในเหตุการณ์ถูกล้างด้วย
// ลบ: เหตุการณ์อื่นทั้งหมด และข้อมูลที่เกิดระหว่างทดลองทุกตาราง (รายงาน คำขอ เวชภัณฑ์ ออกซิเจน ศูนย์พักพิงที่เปิด แจ้งเตือน ฯลฯ)
//
// วิธีใช้ (ผ่าน ./scripts/docker-migrate.sh reset ...):
//   reset                                  ดูว่าจะลบอะไรกี่แถว (ไม่แตะข้อมูล) + รายชื่อบัญชีเจ้าหน้าที่
//   reset --apply                          ลบจริง (สำรองฐานข้อมูลอัตโนมัติก่อน)
// ตัวเลือก:
//   --keep-session flood:3                 เหตุการณ์ที่เก็บไว้ (ประเภท:ครั้งที่) — ไม่ใส่ = flood:3, none = ไม่เก็บเลย
//   --delete-officers user1,user2          ลบบัญชีเจ้าหน้าที่ที่ทดลองสร้าง (ระบุ username) — ผู้ดูแลระบบ (admin) จะไม่ถูกลบ
//   --keep-registers                       เก็บทะเบียนศูนย์พักพิง/กลุ่มเปราะบาง/ทรัพยากร IT ไว้
//   --keep-announcements --keep-citizens --keep-logs   เก็บกลุ่มนั้นไว้
import mysql from "mysql2/promise";

const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const value = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const apply = has("--apply");
const keepSpec = value("--keep-session", "flood:3");
const deleteOfficers = String(value("--delete-officers", "")).split(",").map((s) => s.trim()).filter(Boolean);

// ตารางที่ระบบต้องใช้ — ไม่แตะ
const KEEP = new Set([
  "schema_migrations", "system_settings", "health_facilities", "facility_types", "hospital_drug_sources",
  "districts_polygon", "tambons_polygon", "satun_village_polygon", "area_population", "area_risk_profiles", "route_corridors",
  "common_diseases", "disaster_types", "eoc_status", "eoc_type_modules", "eoc_module_permissions", "module_permissions",
  "eoc_teams", "agency_contacts", "dpm_water_readings", "officer", "eoc_sessions", "eoc_session_teams", "eoc_team_members",
  "eoc_session_commanders", "user_sessions", "push_subscriptions", "registration_requests", "officer_telegram_links"
]);

// ข้อมูลที่เกิดระหว่างใช้งาน — ล้างทั้งตาราง
const EVENT_DATA = [
  "accident_reports", "affected_persons", "affected_persons_cumulative_summary", "affected_persons_daily_summary", "affected_persons_province_summary",
  "decision_logs", "disease_reports", "disease_cumulative_summary", "disease_summary_by_district",
  "eoc_alert_log", "eoc_area_trigger_actions", "eoc_area_triggers", "eoc_daily_directives", "eoc_daily_summaries", "eoc_file_assets",
  "eoc_it_tickets", "eoc_notifications", "eoc_reporting_cycles", "eoc_team_daily_reports", "eoc_team_reports",
  "flood_records", "flood_reports", "health_reports", "incident_status_events", "it_status_reports", "liquid_oxygen_reports", "logistics_reports",
  "medical_inventory_daily_reports", "medical_inventory_lots", "medical_inventory_movements", "medical_inventory_usage_baseline",
  "medical_inventory_stock", "medical_inventory_events", "meeting_notes", "missions", "public_incident_reports", "public_push_log",
  "shelter_disease_reports", "shelter_occupancy", "shelter_reports", "shelter_session_activations", "team_daily_inputs",
  "temporary_service_points", "vulnerable_case_events", "vulnerable_person_cases", "vulnerable_groups",
  "water_alert_log", "water_station_alert_state", "deleted_records"
];
const GROUPS = {
  registers: { keep: has("--keep-registers"), label: "ทะเบียน (ศูนย์พักพิง กลุ่มเปราะบาง ทรัพยากร IT)", tables: ["shelter_centers", "vulnerable_group_baselines", "vulnerable_persons", "it_resources"] },
  announcements: { keep: has("--keep-announcements"), label: "ประกาศ/ข่าว", tables: ["announcements"] },
  citizens: { keep: has("--keep-citizens"), label: "บัญชีประชาชน", tables: ["citizens"] },
  logs: { keep: has("--keep-logs"), label: "บันทึกกิจกรรม/ประวัติการใช้งาน", tables: ["activity_logs", "security_logs", "login_attempts", "suspicious_activities", "rate_limit_hits", "site_statistics", "site_analytics_daily", "site_visit_daily", "backup_runs", "vulnerable_access_log"] }
};

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost", port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root", password: process.env.DB_PASSWORD || "", database: process.env.DB_NAME || "stneoc", charset: "utf8mb4"
});
const q = async (sql, params = []) => (await connection.query(sql, params))[0];

try {
  const tables = new Set((await q("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")).map((row) => Object.values(row)[0]));
  const steps = [];
  const add = (group, table, where = "1=1", params = []) => { if (tables.has(table)) steps.push({ group, table, where, params }); };

  // เหตุการณ์ที่เก็บไว้
  let keepSession = null;
  if (keepSpec !== "none") {
    const [type, number] = keepSpec.split(":");
    const rows = await q("SELECT id, eoc_type, session_number, opened_at, closed_at FROM eoc_sessions WHERE eoc_type = ? AND session_number = ?", [type, Number(number)]);
    if (!rows.length) throw new Error(`ไม่พบเหตุการณ์ ${keepSpec} — ตรวจด้วย --keep-session ประเภท:ครั้งที่ หรือ none`);
    keepSession = rows[0];
  }
  const sid = keepSession ? keepSession.id : -1;

  for (const table of EVENT_DATA) add("ข้อมูลเหตุการณ์", table);
  add("เหตุการณ์อื่น", "eoc_team_members", "session_team_id NOT IN (SELECT id FROM eoc_session_teams WHERE eoc_session_id = ?)", [sid]);
  add("เหตุการณ์อื่น", "eoc_session_teams", "eoc_session_id <> ?", [sid]);
  add("เหตุการณ์อื่น", "eoc_session_commanders", "eoc_session_id <> ?", [sid]);
  add("เหตุการณ์อื่น", "eoc_sessions", "id <> ?", [sid]);
  for (const [key, group] of Object.entries(GROUPS)) {
    if (group.keep) continue;
    for (const table of group.tables) add(group.label, table);
    if (key === "citizens") {
      add(group.label, "push_subscriptions", "audience = 'public'");
      add(group.label, "registration_requests", "user_type = 'citizen'");
    }
  }

  // บัญชีเจ้าหน้าที่ที่ทดลองสร้าง (ไม่ลบ admin)
  const officers = await q("SELECT id, username, CONCAT_WS(' ', given_name, family_name) AS name, role, is_approved FROM officer ORDER BY id");
  const targets = officers.filter((o) => deleteOfficers.includes(o.username));
  const blocked = targets.filter((o) => o.role === "admin");
  const notFound = deleteOfficers.filter((u) => !officers.some((o) => o.username === u));
  const ids = targets.filter((o) => o.role !== "admin").map((o) => o.id);
  if (ids.length) {
    const inList = ids.map(() => "?").join(",");
    add("บัญชีเจ้าหน้าที่ทดลอง", "eoc_team_members", `officer_id IN (${inList})`, ids);
    add("บัญชีเจ้าหน้าที่ทดลอง", "eoc_session_commanders", `officer_id IN (${inList})`, ids);
    add("บัญชีเจ้าหน้าที่ทดลอง", "push_subscriptions", `officer_id IN (${inList})`, ids);
    add("บัญชีเจ้าหน้าที่ทดลอง", "officer_telegram_links", `officer_id IN (${inList})`, ids);
    add("บัญชีเจ้าหน้าที่ทดลอง", "user_sessions", `user_id IN (${inList})`, ids);
    add("บัญชีเจ้าหน้าที่ทดลอง", "registration_requests", `officer_id IN (${inList})`, ids);
    add("บัญชีเจ้าหน้าที่ทดลอง", "officer", `id IN (${inList})`, ids);
  }

  const touched = new Set(steps.map((s) => s.table));
  const keptGroups = Object.values(GROUPS).filter((g) => g.keep).flatMap((g) => g.tables);
  const unknown = [...tables].filter((t) => !KEEP.has(t) && !touched.has(t) && !EVENT_DATA.includes(t) && !keptGroups.includes(t) && !Object.values(GROUPS).some((g) => g.tables.includes(t)));

  console.log(apply ? "=== ลบจริง ===" : "=== ตรวจก่อนลบ (ยังไม่แตะข้อมูล) ===");
  console.log(keepSession ? `เก็บเหตุการณ์: ${keepSession.eoc_type} ครั้งที่ ${keepSession.session_number} (id ${keepSession.id}, เปิด ${keepSession.opened_at?.toISOString?.() || keepSession.opened_at}${keepSession.closed_at ? ", ปิดแล้ว" : ", เปิดอยู่"}) — เก็บตัวเหตุการณ์/ทีม/ผู้บัญชาการ ข้อมูลรายงานถูกล้าง` : "ไม่เก็บเหตุการณ์ใดเลย");

  if (apply) {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    await connection.beginTransaction();
  }
  let total = 0;
  let current = "";
  for (const step of steps) {
    if (step.group !== current) { current = step.group; console.log(`\n[${current}]`); }
    const count = apply
      ? (await q(`DELETE FROM \`${step.table}\` WHERE ${step.where}`, step.params)).affectedRows
      : (await q(`SELECT COUNT(*) AS c FROM \`${step.table}\` WHERE ${step.where}`, step.params))[0].c;
    total += Number(count);
    if (Number(count)) console.log(`  ${step.table}: ${count} แถว`);
  }
  if (apply) {
    // ประเภทที่ไม่มีเหตุการณ์เปิดอยู่แล้ว → สถานะ "ไม่เปิด"
    if (tables.has("eoc_status")) await q("UPDATE eoc_status SET is_active = 0 WHERE is_active = 1 AND eoc_type NOT IN (SELECT eoc_type FROM eoc_sessions WHERE closed_at IS NULL)");
    await connection.commit();
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  }

  console.log(`\nรวม ${total} แถว${apply ? " ลบแล้ว" : " (จะถูกลบ)"}`);
  console.log(`\nตารางที่เก็บไว้ (บางตารางลบเฉพาะแถวตามรายการด้านบน): ${[...KEEP].filter((t) => tables.has(t)).join(", ")}`);
  if (keptGroups.length) console.log(`เก็บตามตัวเลือก: ${keptGroups.filter((t) => tables.has(t)).join(", ")}`);
  if (unknown.length) console.log(`ตารางที่สคริปต์ไม่รู้จัก (ไม่ลบ ตรวจเอง): ${unknown.join(", ")}`);

  console.log("\nบัญชีเจ้าหน้าที่ทั้งหมด (ใช้ --delete-officers username1,username2 เพื่อลบบัญชีทดลอง):");
  for (const o of officers) {
    const mark = ids.includes(o.id) ? (apply ? "  [ลบแล้ว]" : "  [จะลบ]") : blocked.some((b) => b.id === o.id) ? "  [admin — ไม่ลบ]" : "";
    console.log(`  ${String(o.id).padStart(4)}  ${o.username.padEnd(20)} ${String(o.role || "").padEnd(12)} ${o.name || ""}${mark}`);
  }
  if (notFound.length) console.log(`ไม่พบ username: ${notFound.join(", ")}`);
  if (!apply) console.log("\nยังไม่ได้ลบ — ตรวจรายการแล้วรันอีกครั้งพร้อม --apply");
} catch (error) {
  if (apply) { await connection.rollback().catch(() => {}); await connection.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => {}); }
  console.error("ล้มเหลว ไม่มีการลบใด ๆ:", error.message);
  process.exitCode = 1;
} finally {
  await connection.end();
}
