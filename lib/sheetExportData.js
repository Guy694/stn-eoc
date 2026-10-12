// โหลดข้อมูลของเหตุการณ์สำหรับส่งออก Excel รูปแบบชีตของหน่วยงาน (ฝั่งเซิร์ฟเวอร์)
// แต่ละส่วนโหลดแยกกัน ถ้าตารางยังไม่มี (ยังไม่ migrate) ส่วนนั้นว่าง ไม่ทำให้ทั้งไฟล์ล้ม
import { query } from "@/lib/db";
import { getEocTypeLabel } from "@/lib/eocDisplay";
import { facilityTypeInfo } from "@/lib/healthFacilityStatus";
import { loadOxygenLatest } from "@/lib/liquidOxygenServer";
import { VULNERABLE_TYPES } from "@/lib/vulnerableEvent";

const TYPE_KEYS = VULNERABLE_TYPES.map((type) => type.key);

async function safe(loader, fallback = []) {
  try {
    return await loader();
  } catch (error) {
    if (["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"].includes(error.code)) return fallback;
    throw error;
  }
}

export async function loadSheetExportData(session, date) {
  const sid = session.id;
  const sumTypes = TYPE_KEYS.map((key) => `SUM(${key}) AS ${key}`).join(", ");
  const [
    vulnerableBaseline, vulnerableEvent, polygons, floodRows, affected, facilities,
    teamReports, stock, oxygen, diseaseCommunity, diseaseShelter, shelters
  ] = await Promise.all([
    safe(() => query(`SELECT district, ${sumTypes} FROM vulnerable_group_baselines GROUP BY district`)),
    safe(() => query(`SELECT district, ${sumTypes}, SUM(cared_count) AS cared_count, SUM(moved_count) AS moved_count FROM vulnerable_groups WHERE session_id = ? GROUP BY district`, [sid]))
      .then((rows) => (rows.length ? rows : safe(() => query(`SELECT district, ${sumTypes} FROM vulnerable_groups WHERE session_id = ? GROUP BY district`, [sid])))),
    safe(() => query(`SELECT distname AS district, subdistnam AS tambon, villname AS village FROM satun_village_polygon WHERE distname IS NOT NULL`)),
    safe(() => query(
      `SELECT district, tambon, village, DATE_FORMAT(flood_start_date, '%Y-%m-%d') AS date, flood_level AS level, affected_households AS households
       FROM flood_records WHERE session_id = ? AND flood_start_date IS NOT NULL`, [sid])),
    safe(() => query(
      `SELECT district_name AS district,
              SUM(citizen_property) AS citizen_property, SUM(citizen_injured) AS citizen_injured, SUM(citizen_deaths) AS citizen_deaths, SUM(citizen_missing) AS citizen_missing,
              SUM(volunteer_property) AS volunteer_property, SUM(volunteer_injured) AS volunteer_injured, SUM(volunteer_deaths) AS volunteer_deaths, SUM(volunteer_missing) AS volunteer_missing,
              SUM(staff_property) AS staff_property, SUM(staff_injured) AS staff_injured, SUM(staff_deaths) AS staff_deaths, SUM(staff_missing) AS staff_missing,
              SUM(medicine_support) AS medicine_support, SUM(evacuated) AS evacuated, SUM(not_evacuated) AS not_evacuated
       FROM affected_persons WHERE session_id = ? AND (report_date IS NULL OR report_date <= ?) GROUP BY district_name`, [sid, date])),
    safe(() => query(`SELECT name, district_name, typecode, service_status, flood_status FROM health_facilities WHERE is_active = 1`))
      .then((rows) => rows.map((row) => ({ ...row, level: facilityTypeInfo(row.typecode).level }))),
    safe(() => query(
      `SELECT report_type, DATE_FORMAT(report_date, '%Y-%m-%d') AS report_date, district_name, metrics, area_note, note
       FROM eoc_team_daily_reports WHERE session_id = ?`, [sid])),
    safe(() => query(
      `SELECT s.agency_name, s.item_code, s.opening_qty, s.received_qty, s.issued_qty, s.balance_qty
       FROM medical_inventory_stock s JOIN medical_inventory_events e ON e.id = s.inventory_event_id
       WHERE e.eoc_type = ? AND e.session_number = ? ORDER BY s.agency_name`, [session.eoc_type, session.session_number])),
    safe(() => loadOxygenLatest(sid)),
    safe(() => query(
      `SELECT district_name AS district, disease_name AS disease, DATE_FORMAT(report_date, '%Y-%m-%d') AS date, SUM(patient_count) AS cases
       FROM disease_reports WHERE session_id = ? GROUP BY district_name, disease_name, report_date`, [sid])),
    safe(() => query(
      `SELECT sc.district_name AS district, r.disease_type AS disease, DATE_FORMAT(r.report_date, '%Y-%m-%d') AS date, SUM(r.new_cases) AS cases
       FROM shelter_disease_reports r LEFT JOIN shelter_centers sc ON sc.id = r.shelter_id WHERE r.session_id = ?
       GROUP BY sc.district_name, r.disease_type, r.report_date`, [sid])),
    safe(() => query(
      `SELECT sc.sheltername, sc.district_name, sc.tambon, sc.shelter_capacity, sc.coordinator_name, sc.coordinator_phone, sc.contact_phone,
              CASE WHEN ssa.id IS NOT NULL AND ssa.is_active = 1 THEN 1 ELSE 0 END AS active, COALESCE(ssa.current_occupancy, 0) AS occupancy
       FROM shelter_centers sc LEFT JOIN shelter_session_activations ssa ON ssa.shelter_id = sc.id AND ssa.session_id = ?
       WHERE sc.eoc_type = ?`, [sid, session.eoc_type]))
  ]);

  return {
    eventLabel: `${getEocTypeLabel(session.eoc_type)} ครั้งที่ ${session.session_number}`,
    date,
    startDate: session.opened_at ? new Date(new Date(session.opened_at).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10) : null,
    endDate: session.closed_at ? new Date(new Date(session.closed_at).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10) : null,
    vulnerableBaseline, vulnerableEvent, polygons, floodRows, affected, facilities,
    teamReports, stock, oxygen, diseaseCommunity, diseaseShelter, shelters
  };
}
