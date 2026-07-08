import seed from "@/data/eoc-flood-management.json";

export const FLOOD_EOC_BASE_PATH = "/eoc/flood/management";

export const REPORTING_STATUSES = {
  "Not Started": { label: "ยังไม่เริ่มกรอก", color: "slate" },
  Draft: { label: "บันทึกร่าง", color: "sky" },
  Submitted: { label: "ส่งข้อมูลแล้ว", color: "blue" },
  Incomplete: { label: "ข้อมูลไม่ครบ", color: "yellow" },
  "Need Review": { label: "รอตรวจสอบ", color: "cyan" },
  Verified: { label: "ตรวจสอบแล้ว", color: "green" },
  Approved: { label: "อนุมัติแล้ว", color: "violet" },
  Late: { label: "ส่งหลังเวลา", color: "orange" },
  Missing: { label: "ไม่ส่งข้อมูล", color: "red" },
  "Not Required": { label: "ไม่ต้องรายงาน", color: "gray" }
};

export const MISSION_COLUMNS = [
  { key: "intake", label: "รอรับเรื่อง" },
  { key: "assigned", label: "มอบหมายแล้ว" },
  { key: "in_progress", label: "กำลังดำเนินการ" },
  { key: "review", label: "รอตรวจสอบ" },
  { key: "done", label: "เสร็จสิ้น" },
  { key: "overdue", label: "เกินกำหนด" }
];

const districts = seed.districts;
const tambons = ["พิมาน", "คลองขุด", "ควนขัน", "ฉลุง", "กำแพง", "ปากน้ำ", "ทุ่งนุ้ย", "ปาล์มพัฒนา"];
const villages = ["บ้านทุ่ง", "บ้านคลอง", "บ้านเหนือ", "บ้านใต้", "บ้านเขา", "บ้านน้ำใส", "บ้านสะพาน", "บ้านตลาด"];
const floodTypes = ["อุทกภัยน้ำท่วมขัง", "น้ำป่าไหลหลาก", "น้ำล้นตลิ่ง", "ดินสไลด์จากฝน"];
const trends = ["เพิ่มขึ้น", "ทรงตัว", "ลดลง"];
const priorities = ["สูงมาก", "สูง", "ปานกลาง", "ต่ำ"];
const missionTypes = ["อพยพประชาชน", "สนับสนุนยาและเวชภัณฑ์", "เปิดศูนย์พักพิง", "สำรวจระดับน้ำ", "ซ่อมระบบสื่อสาร", "กระจายถุงยังชีพ", "แจ้งเตือนประชาชน"];

function toIso(date, time = "09:00") {
  return `${date}T${time}:00+07:00`;
}

function pad(number) {
  return String(number).padStart(3, "0");
}

function getStatusMeta(status) {
  return REPORTING_STATUSES[status] || REPORTING_STATUSES.Draft;
}

function statusToInputStatus(status) {
  if (status === "Verified" || status === "Approved") return "ส่งครบ";
  if (status === "Incomplete" || status === "Need Review" || status === "Submitted") return "ข้อมูลบางส่วน";
  if (status === "Late") return "ส่งหลังเวลา";
  if (status === "Missing") return "ยังไม่ส่ง";
  return getStatusMeta(status).label;
}

function buildCycles() {
  return seed.reporting_cycle_seed.map((cycle, index) => {
    const statuses = seed.team_status_patterns[index] || seed.team_status_patterns[0];
    const submitted = statuses.filter((status) => !["Missing", "Not Started"].includes(status)).length;
    const missing = statuses.filter((status) => status === "Missing").length;
    const late = statuses.filter((status) => status === "Late").length;
    return {
      id: index + 1,
      session_id: seed.session.id,
      report_date: cycle.report_date,
      day_no: cycle.day_no,
      deadline_at: toIso(cycle.report_date, "15:00"),
      cycle_status: index === seed.reporting_cycle_seed.length - 1 ? "briefing_ready" : "closed",
      closed_at: toIso(cycle.report_date, "15:00"),
      dashboard_generated_at: toIso(cycle.report_date, "15:15"),
      briefing_meeting_at: toIso(cycle.report_date, "16:00"),
      data_completeness_score: cycle.completeness,
      submitted_team_count: submitted,
      missing_team_count: missing,
      late_team_count: late,
      need_review_count: statuses.filter((status) => status === "Need Review").length
    };
  });
}

function buildTeamInputs(cycles) {
  return cycles.flatMap((cycle, cycleIndex) => {
    const statuses = seed.team_status_patterns[cycleIndex] || seed.team_status_patterns[0];
    return seed.teams.map((team, teamIndex) => {
      const status = statuses[teamIndex];
      const isMissing = status === "Missing";
      const isLate = status === "Late";
      const submittedMinute = 10 + teamIndex * 7;
      const submittedAt = isMissing ? null : toIso(cycle.report_date, isLate ? "15:18" : `14:${String(submittedMinute).padStart(2, "0")}`);
      const completedPercent = status === "Missing" ? 0 : status === "Incomplete" ? 58 : status === "Need Review" ? 72 : status === "Late" ? 86 : 100;
      return {
        id: Number(`${cycle.id}${teamIndex + 1}`),
        session_id: seed.session.id,
        reporting_cycle_id: cycle.id,
        report_date: cycle.report_date,
        team_code: team.team_code,
        team_name: team.team_name_th,
        required_data_name: team.required_data.join(", "),
        input_status: statusToInputStatus(status),
        raw_status: status,
        completed_percent: completedPercent,
        deadline_at: cycle.deadline_at,
        submitted_at: submittedAt,
        is_late: isLate,
        submitted_by: isMissing ? "-" : team.lead,
        reviewed_by: ["Verified", "Approved", "Need Review", "Late"].includes(status) ? "EOC Officer" : "-",
        reviewed_at: ["Verified", "Approved", "Need Review", "Late"].includes(status) ? toIso(cycle.report_date, "15:05") : null,
        review_status: status,
        approved_by: status === "Approved" ? seed.session.commander_name : null,
        approved_at: status === "Approved" ? toIso(cycle.report_date, "15:20") : null,
        missing_fields: status === "Missing"
          ? team.required_data
          : status === "Incomplete"
            ? team.required_data.slice(-2)
            : status === "Need Review"
              ? ["ต้องตรวจสอบความถูกต้องกับพื้นที่"]
              : [],
        remarks: status === "Late" ? "ส่งหลังเวลา 15:00 น." : status === "Missing" ? "แจ้งเตือนแล้ว ต้องติดตาม" : "-"
      };
    });
  });
}

function buildFloodReports(cycles) {
  return Array.from({ length: 30 }, (_, index) => {
    const district = districts[index % districts.length];
    const cycle = cycles[index % cycles.length];
    const severity = index % 5 === 0 ? "critical" : index % 3 === 0 ? "high" : "watch";
    return {
      id: index + 1,
      session_id: seed.session.id,
      reporting_cycle_id: cycle.id,
      report_date: cycle.report_date,
      district,
      subdistrict: tambons[index % tambons.length],
      village: villages[index % villages.length],
      latitude: Number((6.55 + (index % 10) * 0.055).toFixed(5)),
      longitude: Number((99.72 + (index % 8) * 0.055).toFixed(5)),
      flood_type: floodTypes[index % floodTypes.length],
      water_level_cm: 35 + (index % 9) * 15,
      water_trend: trends[index % trends.length],
      severity_level: severity,
      affected_households: 18 + index * 4,
      affected_population: 76 + index * 23,
      vulnerable_population: 8 + index * 3,
      road_affected: index % 2 === 0,
      health_facility_affected: index % 11 === 0,
      verification_status: index % 4 === 0 ? "Need Review" : "Verified",
      public_visibility: index % 5 !== 0,
      publish_status: index % 5 === 0 ? "internal" : "public",
      reported_by_team: "SAT",
      reported_by: "ทีมประเมินสถานการณ์",
      submitted_at: toIso(cycle.report_date, index % 6 === 0 ? "15:18" : "14:20")
    };
  });
}

function buildRoadClosures(cycles) {
  return Array.from({ length: 15 }, (_, index) => ({
    id: index + 1,
    report_date: cycles[index % cycles.length].report_date,
    district: districts[index % districts.length],
    route_name: `สตูล-${districts[(index + 2) % districts.length]} ช่วง กม.${12 + index}`,
    status: index % 4 === 0 ? "ปิดการจราจร" : "ผ่านได้ยาก",
    water_level_cm: 20 + (index % 5) * 18
  }));
}

function buildShelters() {
  return Array.from({ length: 12 }, (_, index) => {
    const capacity = 90 + index * 18;
    const occupancy = Math.min(capacity, 45 + index * 16);
    return {
      id: index + 1,
      shelter_name: `ศูนย์พักพิง${districts[index % districts.length]} ${index + 1}`,
      district: districts[index % districts.length],
      capacity,
      current_occupancy: occupancy,
      available_capacity: Math.max(capacity - occupancy, 0),
      elderly_count: 6 + index,
      children_count: 8 + index * 2,
      pregnant_count: index % 4,
      disabled_count: 2 + (index % 5),
      food_status: index % 5 === 0 ? "ต้องเติมภายในวันนี้" : "เพียงพอ",
      water_status: index % 4 === 0 ? "ใกล้หมด" : "เพียงพอ",
      toilet_status: index % 6 === 0 ? "ไม่เพียงพอ" : "เพียงพอ",
      medical_point_status: index % 3 === 0 ? "มีจุดบริการ" : "ประสานทีมแพทย์"
    };
  });
}

function buildHealthFacilities() {
  return Array.from({ length: 20 }, (_, index) => ({
    id: index + 1,
    facility_name: `${index % 4 === 0 ? "โรงพยาบาล" : "รพ.สต."}${districts[index % districts.length]} ${index + 1}`,
    district: districts[index % districts.length],
    service_status: index % 7 === 0 ? "ได้รับผลกระทบ" : "เปิดบริการ",
    emergency_patients: index % 5,
    flood_related_disease_cases: 2 + (index % 6),
    medical_supply_needed: index % 4 === 0 ? "ORS, ยาแก้ผื่น, เวชภัณฑ์ฉุกเฉิน" : "-"
  }));
}

function buildMissions(cycles) {
  return Array.from({ length: 40 }, (_, index) => {
    const column = MISSION_COLUMNS[index % MISSION_COLUMNS.length];
    const district = districts[index % districts.length];
    return {
      id: index + 1,
      session_id: seed.session.id,
      reporting_cycle_id: cycles[index % cycles.length].id,
      report_date: cycles[index % cycles.length].report_date,
      mission_code: `MIS-FLD-${pad(index + 1)}`,
      mission_type: missionTypes[index % missionTypes.length],
      mission_name: `${missionTypes[index % missionTypes.length]} พื้นที่${district}`,
      area: `อ.${district} ต.${tambons[index % tambons.length]}`,
      assigned_team: seed.teams[index % seed.teams.length].team_name_th,
      responsible_agency: index % 3 === 0 ? "ปภ.สตูล" : index % 3 === 1 ? "สสจ.สตูล" : "อำเภอ",
      priority: priorities[index % priorities.length],
      due_at: toIso(cycles[index % cycles.length].report_date, index % 6 === 0 ? "14:30" : "17:00"),
      status: column.key,
      status_label: column.label,
      progress_percent: column.key === "done" ? 100 : column.key === "overdue" ? 45 : (index % 5) * 18,
      evidence_file: index % 4 === 0 ? `evidence-${pad(index + 1)}.jpg` : null,
      ordered_by: seed.session.commander_name,
      responsible_person: seed.teams[index % seed.teams.length].lead,
      remarks: index % 6 === 0 ? "ต้องเร่งติดตามก่อนประชุม" : "-"
    };
  });
}

function buildMissingData(teamInputs) {
  return teamInputs
    .filter((input) => ["Missing", "Incomplete", "Need Review", "Late"].includes(input.raw_status))
    .slice(0, 14)
    .map((input, index) => ({
      id: index + 1,
      severity: input.raw_status === "Missing" ? "critical" : input.raw_status === "Late" ? "high" : "watch",
      team_code: input.team_code,
      team_name: input.team_name,
      report_date: input.report_date,
      issue: `${input.team_name} ${input.raw_status === "Missing" ? "ยังไม่ส่ง" : input.raw_status === "Late" ? "ส่งหลังเวลา" : "ข้อมูลยังไม่ครบ"}: ${input.missing_fields.join(", ") || input.required_data_name}`,
      action: input.raw_status === "Missing" ? "ส่งแจ้งเตือนหัวหน้าทีม" : "ตรวจสอบและส่งกลับแก้ไข"
    }));
}

function buildDecisionLogs(cycles, shelters, missions, missingData) {
  return Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    session_id: seed.session.id,
    reporting_cycle_id: cycles[index % cycles.length].id,
    decision_datetime: toIso(cycles[index % cycles.length].report_date, "16:20"),
    decision_maker: seed.session.commander_name,
    issue: index % 2 === 0 ? `เปิดศูนย์พักพิงเพิ่มในอำเภอ${districts[index % districts.length]}` : `เร่งติดตามข้อมูล ${missingData[index % missingData.length]?.team_name || "ทีมปฏิบัติการ"}`,
    supporting_data: index % 2 === 0 ? `${shelters[index % shelters.length].shelter_name} occupancy ${shelters[index % shelters.length].current_occupancy} คน` : "Data Completeness ต่ำกว่าเป้าหมาย",
    decision: index % 2 === 0 ? "อนุมัติเปิดศูนย์พักพิงสำรองและส่งทีม Shelter เข้าพื้นที่" : "ให้ EOC Officer แจ้งเตือนและติดตามภายใน 30 นาที",
    assigned_team: seed.teams[index % seed.teams.length].team_name_th,
    followup_due: toIso(cycles[index % cycles.length].report_date, "18:00"),
    status: index % 3 === 0 ? "กำลังดำเนินการ" : "รอติดตามผล",
    linked_mission_code: missions[index]?.mission_code || null
  }));
}

function buildMeetingNotes(cycles, decisions) {
  return cycles.map((cycle, index) => ({
    id: index + 1,
    session_id: seed.session.id,
    reporting_cycle_id: cycle.id,
    meeting_date: cycle.report_date,
    meeting_time: "16:00",
    chairperson: seed.session.commander_name,
    attendees: seed.teams.map((team) => team.team_name_th).join(", "),
    agenda: "สรุปสถานการณ์อุทกภัยน้ำท่วมประจำวัน, ตรวจสอบข้อมูลทีม, พิจารณาข้อสั่งการ",
    situation_summary: `วันที่ ${cycle.day_no} ยังมีพื้นที่ได้รับผลกระทบหลายอำเภอ ระดับข้อมูลครบถ้วน ${cycle.data_completeness_score}%`,
    key_issues: ["ทีมที่ยังไม่ส่งข้อมูล", "ศูนย์พักพิงใกล้เต็ม", "เส้นทางขนส่งได้รับผลกระทบ"],
    decisions: decisions.filter((decision) => decision.reporting_cycle_id === cycle.id).map((decision) => decision.decision),
    orders: `ให้ทุกทีมปิดข้อมูลรอบหลักก่อน 15:00 น. และรายงานความคืบหน้าภารกิจสำคัญก่อน 18:00 น.`,
    responsible_team: seed.teams[index % seed.teams.length].team_name_th,
    due_date: cycle.report_date,
    followup_status: index % 2 === 0 ? "กำลังติดตาม" : "ปิดรายการแล้ว",
    next_meeting_datetime: toIso(cycle.report_date, "09:30")
  }));
}

function buildDailySummaries(cycles, floodReports, shelters, healthFacilities, missions, teamInputs) {
  return cycles.map((cycle) => {
    const floodToday = floodReports.filter((report) => report.reporting_cycle_id === cycle.id);
    const missionToday = missions.filter((mission) => mission.reporting_cycle_id === cycle.id);
    const teamToday = teamInputs.filter((input) => input.reporting_cycle_id === cycle.id);
    const affectedDistricts = new Set(floodToday.map((report) => report.district)).size;
    return {
      id: cycle.id,
      session_id: seed.session.id,
      reporting_cycle_id: cycle.id,
      report_date: cycle.report_date,
      day_no: cycle.day_no,
      daily_status: cycle.cycle_status,
      situation_summary: `ฝนตกหนักต่อเนื่อง ส่งผลให้มีจุดอุทกภัยน้ำท่วม ${floodToday.length} จุด ครอบคลุม ${affectedDistricts} อำเภอ ความครบถ้วนข้อมูล ${cycle.data_completeness_score}%`,
      affected_districts: affectedDistricts,
      affected_subdistricts: Math.min(20, floodToday.length + 3),
      affected_villages: Math.min(42, floodToday.length * 2),
      affected_households: floodToday.reduce((sum, report) => sum + report.affected_households, 0),
      affected_population: floodToday.reduce((sum, report) => sum + report.affected_population, 0),
      vulnerable_population: floodToday.reduce((sum, report) => sum + report.vulnerable_population, 0),
      road_closed_count: Math.max(1, cycle.day_no + 1),
      shelter_open_count: shelters.filter((shelter) => shelter.current_occupancy > 0).length,
      shelter_occupancy: shelters.reduce((sum, shelter) => sum + shelter.current_occupancy, 0),
      health_facility_affected_count: healthFacilities.filter((facility) => facility.service_status === "ได้รับผลกระทบ").length,
      help_request_count: 12 + cycle.day_no * 5,
      mission_done_count: missionToday.filter((mission) => mission.status === "done").length,
      overdue_mission_count: missionToday.filter((mission) => mission.status === "overdue").length,
      resource_shortage_count: cycle.day_no + 2,
      data_completeness_score: cycle.data_completeness_score,
      submitted_team_count: cycle.submitted_team_count,
      missing_team_count: cycle.missing_team_count,
      late_team_count: cycle.late_team_count,
      need_review_count: teamToday.filter((input) => input.raw_status === "Need Review").length
    };
  });
}

function buildAuditLogs(teamInputs, missions) {
  const inputLogs = teamInputs.slice(0, 24).map((input, index) => ({
    id: index + 1,
    user_id: 100 + index,
    user_name: input.submitted_by,
    team_code: input.team_code,
    action_type: input.raw_status === "Missing" ? "alert_sent" : input.raw_status === "Late" ? "late_submit" : "submit_daily_input",
    table_name: "team_daily_inputs",
    record_id: input.id,
    old_value: null,
    new_value: input.review_status,
    action_datetime: input.submitted_at || toIso(input.report_date, "14:30"),
    ip_address: `10.10.1.${index + 10}`,
    remarks: input.remarks
  }));

  const missionLogs = missions.slice(0, 8).map((mission, index) => ({
    id: inputLogs.length + index + 1,
    user_id: 200 + index,
    user_name: mission.ordered_by,
    team_code: mission.assigned_team,
    action_type: "mission_update",
    table_name: "missions",
    record_id: mission.id,
    old_value: "assigned",
    new_value: mission.status,
    action_datetime: mission.due_at,
    ip_address: `10.10.2.${index + 10}`,
    remarks: mission.remarks
  }));

  return [...inputLogs, ...missionLogs];
}

function buildReports(cycles, dailySummaries, meetingNotes) {
  return {
    daily_situation_reports: dailySummaries.map((summary) => ({
      id: summary.id,
      report_type: "Daily Situation Report",
      report_date: summary.report_date,
      title: `รายงานสถานการณ์อุทกภัยประจำวันที่ ${summary.report_date}`,
      base_time: "15:00",
      summary: summary.situation_summary,
      prepared_by: "EOC Officer",
      reviewed_by: "ผู้บัญชาการเหตุการณ์",
      approved_status: summary.data_completeness_score >= 85 ? "พร้อมอนุมัติ" : "รอข้อมูลเพิ่มเติม",
      export_formats: ["PDF", "Excel", "CSV"]
    })),
    session_summary_report: {
      report_type: "Session Summary Report",
      session_code: seed.session.session_code,
      title: `สรุปภาพรวม Session ${seed.session.session_name}`,
      coverage_days: cycles.length,
      cumulative_population: dailySummaries.reduce((sum, day) => sum + day.affected_population, 0),
      mission_total: 40,
      order_total: meetingNotes.length,
      aar_topics: ["การปิดข้อมูลก่อน 15:00 น.", "การติดตามข้อมูลทีมที่ยังไม่ส่ง", "การเผยแพร่ข้อมูลสาธารณะ", "การเชื่อมข้อมูลภาคสนาม"]
    }
  };
}

export function getFloodEocManagementData({ date } = {}) {
  const cycles = buildCycles();
  const selectedCycle = cycles.find((cycle) => cycle.report_date === date) || cycles[cycles.length - 1];
  const teamInputs = buildTeamInputs(cycles);
  const floodReports = buildFloodReports(cycles);
  const roadClosures = buildRoadClosures(cycles);
  const shelters = buildShelters();
  const healthFacilities = buildHealthFacilities();
  const missions = buildMissions(cycles);
  const missingData = buildMissingData(teamInputs);
  const decisions = buildDecisionLogs(cycles, shelters, missions, missingData);
  const meetingNotes = buildMeetingNotes(cycles, decisions);
  const dailySummaries = buildDailySummaries(cycles, floodReports, shelters, healthFacilities, missions, teamInputs);
  const auditLogs = buildAuditLogs(teamInputs, missions);
  const reports = buildReports(cycles, dailySummaries, meetingNotes);
  const latestSummary = dailySummaries.find((summary) => summary.reporting_cycle_id === selectedCycle.id) || dailySummaries[dailySummaries.length - 1];

  return {
    data_mode: "mock",
    generated_at: new Date().toISOString(),
    session: seed.session,
    selected_cycle: selectedCycle,
    selected_summary: latestSummary,
    teams: seed.teams,
    cycles,
    team_inputs: teamInputs,
    current_team_inputs: teamInputs.filter((input) => input.reporting_cycle_id === selectedCycle.id),
    flood_reports: floodReports,
    current_flood_reports: floodReports.filter((report) => report.reporting_cycle_id === selectedCycle.id),
    road_closures: roadClosures,
    shelters,
    health_facilities: healthFacilities,
    missions,
    current_missions: missions.filter((mission) => mission.reporting_cycle_id === selectedCycle.id),
    missing_data: missingData,
    decisions,
    meeting_notes: meetingNotes,
    daily_summaries: dailySummaries,
    forms: seed.form_sections,
    audit_logs: auditLogs,
    reports,
    role_access_mock: {
      commander: ["overview", "command-room", "decisions", "missions", "meetings", "reports", "approve-public"],
      eoc_officer: ["overview", "daily", "completeness", "forms", "missions", "meetings", "reports"],
      team_lead: ["team-workspace", "forms", "missions"],
      team_member: ["team-workspace", "forms"]
    }
  };
}
