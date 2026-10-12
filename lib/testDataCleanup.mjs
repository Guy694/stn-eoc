// ขั้นตอนลบข้อมูลจำลองที่ติดป้าย "[ทดสอบ]" (ใช้ร่วมกันระหว่างสคริปต์ scripts/cleanup-test-data.mjs และหน้าตั้งค่าระบบ)
// ไฟล์นี้เป็น .mjs ไม่ใช้ alias "@/" เพื่อให้ node รันสคริปต์ได้โดยตรง
export const TEST_TAG = "%[ทดสอบ]%";

// ลำดับสำคัญ: ลบตารางลูกก่อนตารางแม่
// แจ้งเตือนระดับอำเภอ/ผู้เสียชีวิตคำนวณจากยอดรวม จึงไม่มีป้ายทดสอบในข้อความ —
// ลบเฉพาะที่เกิดหลังรายงานโรคทดสอบชิ้นแรก (ต้องลบก่อนรายงานโรค) เพื่อให้เหตุจริงภายหลังแจ้งเตือนได้อีก
const FIRST_TEST_REPORT = `LEAST(
    COALESCE((SELECT MIN(created_at) FROM disease_reports WHERE notes LIKE ?), '9999-12-31'),
    COALESCE((SELECT MIN(r.created_at) FROM shelter_disease_reports r JOIN shelter_centers sc ON sc.id = r.shelter_id WHERE sc.sheltername LIKE ? OR r.notes LIKE ?), '9999-12-31'))`;

export const STEPS = [
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
  ["รายงานออกซิเจนเหลว", "DELETE FROM liquid_oxygen_reports WHERE problem_note LIKE ? OR reported_by_name LIKE ?"],
  ["รายงานประจำวันรายอำเภอ (MCATT/แพทย์/MERT/Doxy/ทรัพยากร)", "DELETE FROM eoc_team_daily_reports WHERE note LIKE ? OR area_note LIKE ?"],
  ["บันทึกพื้นที่น้ำท่วม", "DELETE FROM flood_records WHERE description LIKE ?"],
  ["ผู้ได้รับผลกระทบ", "DELETE FROM affected_persons WHERE notes LIKE ?"],
  ["คำขอ/จุดปัญหาจากประชาชน", "DELETE FROM public_incident_reports WHERE description LIKE ?"],
  ["ประวัติแจ้งเตือนอัตโนมัติที่เกิดจากข้อมูลทดสอบ", "DELETE FROM eoc_alert_log WHERE message LIKE ?"]
];

export const paramsFor = (sql) => Array((sql.match(/\?/g) || []).length).fill(TEST_TAG);

export function toCount(sql) {
  return sql.replace(/^DELETE\s+(\w+\s+)?FROM/i, "SELECT COUNT(*) AS count FROM");
}

/** execute(sql, params) → ผลลัพธ์แบบ mysql2 ([rows] หรือ rows); apply = ลบจริง */
export async function runTestDataCleanup(run, { apply = false } = {}) {
  const results = [];
  for (const [label, sql] of STEPS) {
    try {
      if (apply) {
        const result = await run(sql, paramsFor(sql));
        results.push({ label, count: Number(result?.affectedRows ?? result?.[0]?.affectedRows ?? 0) });
      } else {
        const rows = await run(toCount(sql), paramsFor(sql));
        const list = Array.isArray(rows?.[0]) ? rows[0] : rows;
        results.push({ label, count: Number(list?.[0]?.count || 0) });
      }
    } catch (error) {
      if (["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR", "ER_ROW_IS_REFERENCED_2"].includes(error.code)) results.push({ label, count: 0, skipped: error.code });
      else throw error;
    }
  }
  return results;
}
