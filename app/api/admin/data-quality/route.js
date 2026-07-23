import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { buildQualitySummary, evaluatePopulationRow, findUntrackedUploadFiles, inspectFileAsset } from "@/lib/dataQuality";

function issue({ type, table, id, label, detail, editUrl }) {
  return { issue_type: type, table_name: table, record_id: id, label, detail, edit_url: editUrl };
}

export async function GET(request) {
  try {
    const auth = await requireAuth(request, ["admin"]);
    if (!auth.success) return auth.response;
    const { searchParams } = new URL(request.url);
    const requestedType = searchParams.get("type");
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 100, 1), 500);
    const issues = [];

    const [populations, orphanReports, duplicateReports, unverifiedReports, invalidMissions, invalidFlood, duplicateFlood, unmatchedAreas, missingSources, files] = await Promise.all([
      query(`SELECT * FROM area_population WHERE is_active = 1 ORDER BY district_name, id`),
      query(`
        SELECT r.id, r.title
        FROM eoc_team_reports r
        LEFT JOIN eoc_sessions s ON s.id = r.eoc_session_id
        WHERE s.id IS NULL OR r.report_date IS NULL
        LIMIT 200
      `),
      query(`
        SELECT MIN(id) AS id, eoc_session_id, session_team_id, DATE(report_date) AS report_day, COUNT(*) AS duplicate_count
        FROM eoc_team_reports
        GROUP BY eoc_session_id, session_team_id, DATE(report_date), title
        HAVING COUNT(*) > 1
        LIMIT 200
      `),
      query(`SELECT id, title, status FROM eoc_team_reports WHERE status <> 'approved' ORDER BY updated_at DESC LIMIT 200`),
      query(`SELECT id, mission_code, progress_percent, status FROM missions WHERE progress_percent < 0 OR progress_percent > 100 OR status NOT IN ('intake','assigned','in_progress','blocked','completed','verified','closed') LIMIT 200`),
      query(`
        SELECT id, district, tambon, village
        FROM flood_records
        WHERE session_id IS NULL OR flood_start_date IS NULL
           OR water_depth_cm < 0 OR affected_area_sqm < 0
           OR affected_households < 0 OR affected_people < 0
        LIMIT 200
      `),
      query(`
        SELECT MIN(id) AS id, session_id, DATE(flood_start_date) AS report_day,
               district, tambon, village, COUNT(*) AS duplicate_count
        FROM flood_records
        GROUP BY session_id, DATE(flood_start_date), district, tambon, village
        HAVING COUNT(*) > 1
        LIMIT 200
      `),
      query(`
        SELECT fr.id, fr.district, fr.tambon, fr.village
        FROM flood_records fr
        LEFT JOIN satun_village_polygon svp
          ON svp.distname = fr.district AND svp.subdistnam = fr.tambon
         AND svp.villname = fr.village AND svp.is_active = 1
        WHERE svp.id IS NULL
        LIMIT 200
      `),
      query(`
        SELECT 'agency_contacts' COLLATE utf8mb4_unicode_ci AS table_name, id,
               CONVERT(name USING utf8mb4) COLLATE utf8mb4_unicode_ci AS label
        FROM agency_contacts WHERE is_active = 1 AND (source_name IS NULL OR source_name = '')
        UNION ALL
        SELECT 'health_facilities' COLLATE utf8mb4_unicode_ci, id,
               CONVERT(name USING utf8mb4) COLLATE utf8mb4_unicode_ci
        FROM health_facilities WHERE is_active = 1 AND (source_name IS NULL OR source_name = '')
        UNION ALL
        SELECT 'common_diseases' COLLATE utf8mb4_unicode_ci, id,
               CONVERT(name USING utf8mb4) COLLATE utf8mb4_unicode_ci
        FROM common_diseases WHERE is_active = 1 AND (source_name IS NULL OR source_name = '')
        UNION ALL
        SELECT 'satun_village_polygon' COLLATE utf8mb4_unicode_ci, id,
               CONVERT(COALESCE(villname, area_name) USING utf8mb4) COLLATE utf8mb4_unicode_ci
        FROM satun_village_polygon WHERE is_active = 1 AND (source_name IS NULL OR source_name = '')
        LIMIT 500
      `),
      query(`SELECT id, original_filename, storage_path, file_size, checksum_sha256 FROM eoc_file_assets ORDER BY created_at DESC LIMIT 500`),
    ]);

    for (const row of populations) {
      for (const populationIssue of evaluatePopulationRow(row)) {
        issues.push(issue({
          type: populationIssue,
          table: "area_population",
          id: row.id,
          label: row.district_name,
          detail: populationIssue === "population_year_missing" ? "ยังไม่ระบุปีอ้างอิง" : "ข้อมูลประชากรไม่ผ่านกฎคุณภาพ",
          editUrl: `/admin/data-management?section=population&id=${row.id}`,
        }));
      }
    }
    orphanReports.forEach((row) => issues.push(issue({ type: "report_context_missing", table: "eoc_team_reports", id: row.id, label: row.title, detail: "รายงานไม่มี Session หรือวันที่ที่ถูกต้อง", editUrl: "/eoc/staff" })));
    duplicateReports.forEach((row) => issues.push(issue({ type: "duplicate_report", table: "eoc_team_reports", id: row.id, label: `Session ${row.eoc_session_id}`, detail: `พบ ${row.duplicate_count} รายการซ้ำในทีมและวันเดียวกัน`, editUrl: "/eoc/staff" })));
    unverifiedReports.forEach((row) => issues.push(issue({ type: "report_not_approved", table: "eoc_team_reports", id: row.id, label: row.title, detail: `สถานะ ${row.status}`, editUrl: "/eoc/staff" })));
    invalidMissions.forEach((row) => issues.push(issue({ type: "mission_value_invalid", table: "missions", id: row.id, label: row.mission_code, detail: "สถานะหรือความคืบหน้าไม่ถูกต้อง", editUrl: "/eoc/flood/management/missions" })));
    invalidFlood.forEach((row) => issues.push(issue({ type: "flood_value_invalid", table: "flood_records", id: row.id, label: [row.district, row.tambon, row.village].filter(Boolean).join(" / "), detail: "Session วันที่ หรือค่าตัวเลขไม่ถูกต้อง", editUrl: "/admin/flood-records" })));
    duplicateFlood.forEach((row) => issues.push(issue({ type: "duplicate_flood_record", table: "flood_records", id: row.id, label: [row.district, row.tambon, row.village].filter(Boolean).join(" / "), detail: `พบ ${row.duplicate_count} รายการใน Session และวันเดียวกัน`, editUrl: "/admin/flood-records" })));
    unmatchedAreas.forEach((row) => issues.push(issue({ type: "geography_not_in_master", table: "flood_records", id: row.id, label: [row.district, row.tambon, row.village].filter(Boolean).join(" / "), detail: "พื้นที่ไม่ตรงกับ Master Geography", editUrl: "/admin/flood-records" })));
    missingSources.forEach((row) => issues.push(issue({ type: "source_name_missing", table: row.table_name, id: row.id, label: row.label, detail: "Master Data ไม่มีแหล่งข้อมูล", editUrl: row.table_name === "health_facilities" ? "/admin/health-facilities" : row.table_name === "satun_village_polygon" ? "/admin/village-polygons" : "/admin/master-data/agencies" })));

    const fileResults = await Promise.all(files.map((row) => inspectFileAsset(row)));
    fileResults.filter(Boolean).forEach((row) => issues.push(issue({
      type: row.issue,
      table: "eoc_file_assets",
      id: row.id,
      label: row.original_filename,
      detail: "ไฟล์จริงไม่ตรงกับ metadata",
      editUrl: "/admin/upload-infographics",
    })));
    const untrackedFiles = await findUntrackedUploadFiles(files);
    untrackedFiles.forEach((row, index) => issues.push(issue({
      type: row.issue, table: "filesystem", id: index + 1, label: row.storage_path,
      detail: "พบไฟล์จริงแต่ไม่มี metadata ใน eoc_file_assets", editUrl: "/admin/upload-infographics",
    })));

    const filtered = requestedType ? issues.filter((item) => item.issue_type === requestedType) : issues;
    return NextResponse.json({
      success: true,
      summary: buildQualitySummary(issues),
      data: filtered.slice(0, limit),
      meta: {
        source_type: "database",
        source_name: "data_quality_service",
        generated_at: new Date().toISOString(),
        file_integrity_checked: true,
      },
    });
  } catch (error) {
    console.error("Data quality API error:", error);
    return publicInternalError("ไม่สามารถตรวจคุณภาพข้อมูลได้");
  }
}
