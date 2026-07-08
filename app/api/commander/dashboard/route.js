import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { publicInternalError } from '@/lib/apiResponse';

async function tableExists(tableName) {
    const rows = await pool.query(
        `SELECT TABLE_NAME
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?`,
        [tableName]
    );
    return rows.length > 0;
}

function toDateKey(value) {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        return value.slice(0, 10);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function asNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function getSeverityLabel(level) {
    return ({
        severe: 'สูง/สูงมาก',
        moderate: 'ปานกลาง',
        mild: 'ต่ำ',
        safe: 'ไม่มีอุทกภัยน้ำท่วม'
    })[level] || level || '-';
}

// GET - ดึงข้อมูล Dashboard สำหรับ Commander
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');
        const mode = searchParams.get('mode') === 'daily' ? 'daily' : 'cumulative';
        const requestedDate = searchParams.get('date');

        if (!sessionId) {
            return NextResponse.json(
                { success: false, error: 'กรุณาระบุ EOC Session ID' },
                { status: 400 }
            );
        }

        // 1. ดึงข้อมูล EOC Session
        const sessions = await pool.query(
            `SELECT es.*, 
                    CONCAT(o.given_name, ' ', o.family_name) as opened_by_name,
                    es.eoc_type as eoc_type_name
             FROM eoc_sessions es
             LEFT JOIN officer o ON es.opened_by = o.id
             WHERE es.id = ?`,
            [sessionId]
        );

        if (sessions.length === 0) {
            return NextResponse.json(
                { success: false, error: 'ไม่พบ EOC Session' },
                { status: 404 }
            );
        }

        const session = sessions[0];
        const sessionStartDate = toDateKey(session.opened_at);
        const sessionEndDate = toDateKey(session.closed_at) || toDateKey(new Date());
        const latestEventDateRows = await pool.query(
            `SELECT DATE_FORMAT(MAX(event_date), '%Y-%m-%d') as latest_event_date
             FROM (
                SELECT DATE(report_date) as event_date FROM affected_persons WHERE session_id = ?
                UNION ALL
                SELECT DATE(report_date) as event_date FROM disease_reports WHERE session_id = ?
             ) event_dates`,
            [sessionId, sessionId]
        );
        const availableDateRows = await pool.query(
            `SELECT DATE_FORMAT(event_date, '%Y-%m-%d') as event_date
             FROM (
                SELECT DATE(report_date) as event_date FROM affected_persons WHERE session_id = ?
                UNION
                SELECT DATE(report_date) as event_date FROM disease_reports WHERE session_id = ?
             ) event_dates
             WHERE event_date IS NOT NULL
             ORDER BY event_date DESC`,
            [sessionId, sessionId]
        );
        const effectiveDate = mode === 'daily'
            ? (requestedDate || latestEventDateRows[0]?.latest_event_date || null)
            : null;
        const reportDateFilter = mode === 'daily' && effectiveDate ? ' AND DATE(report_date) = ?' : '';
        const reportDateParams = mode === 'daily' && effectiveDate ? [effectiveDate] : [];

        // แผนที่อุทกภัยน้ำท่วมตลอดช่วง session ใช้ข้อมูลเดียวกับเมนูแผนที่สาธารณะ (flood_records)
        let floodMap = {
            start_date: sessionStartDate,
            end_date: sessionEndDate,
            available_dates: [],
            stats: {
                total_records: 0,
                total_days: 0,
                affected_districts: 0,
                affected_tambons: 0,
                affected_villages: 0,
                affected_people: 0,
                affected_households: 0,
                severe_count: 0,
                moderate_count: 0,
                mild_count: 0
            },
            events: []
        };

        if (await tableExists('flood_records')) {
            const floodRangeFilter = sessionStartDate && sessionEndDate
                ? ' AND DATE(f.flood_start_date) BETWEEN ? AND ?'
                : '';
            const floodRangeParams = sessionStartDate && sessionEndDate ? [sessionStartDate, sessionEndDate] : [];

            const floodStatsRows = await pool.query(
                `SELECT
                    COUNT(*) as total_records,
                    COUNT(DISTINCT DATE(f.flood_start_date)) as total_days,
                    COUNT(DISTINCT f.district) as affected_districts,
                    COUNT(DISTINCT f.tambon) as affected_tambons,
                    COUNT(DISTINCT COALESCE(f.polygon_id, CONCAT(f.district, '|', f.tambon, '|', f.village))) as affected_villages,
                    SUM(COALESCE(f.affected_people, 0)) as affected_people,
                    SUM(COALESCE(f.affected_households, 0)) as affected_households,
                    SUM(CASE WHEN f.flood_level IN ('สูง', 'สูงมาก') THEN 1 ELSE 0 END) as severe_count,
                    SUM(CASE WHEN f.flood_level = 'ปานกลาง' THEN 1 ELSE 0 END) as moderate_count,
                    SUM(CASE WHEN f.flood_level = 'ต่ำ' THEN 1 ELSE 0 END) as mild_count
                 FROM flood_records f
                 WHERE f.session_id = ?${floodRangeFilter}
                   AND f.flood_level <> 'ไม่มี'`,
                [sessionId, ...floodRangeParams]
            );

            const floodDateRows = await pool.query(
                `SELECT DATE_FORMAT(event_date, '%Y-%m-%d') as event_date
                 FROM (
                    SELECT DATE(f.flood_start_date) as event_date
                    FROM flood_records f
                    WHERE f.session_id = ?${floodRangeFilter}
                      AND f.flood_level <> 'ไม่มี'
                      AND f.flood_start_date IS NOT NULL
                    GROUP BY DATE(f.flood_start_date)
                 ) flood_dates
                 ORDER BY event_date ASC`,
                [sessionId, ...floodRangeParams]
            );

            const floodEventRows = await pool.query(
                `SELECT
                    f.id,
                    DATE_FORMAT(f.flood_start_date, '%Y-%m-%d') as recorded_day,
                    f.district,
                    f.tambon,
                    f.village,
                    f.flood_level,
                    CASE
                        WHEN f.flood_level IN ('สูง', 'สูงมาก') THEN 'severe'
                        WHEN f.flood_level = 'ปานกลาง' THEN 'moderate'
                        WHEN f.flood_level = 'ต่ำ' THEN 'mild'
                        ELSE 'safe'
                    END as severity,
                    f.water_depth_cm,
                    f.affected_people,
                    f.affected_households,
                    f.description
                 FROM flood_records f
                 WHERE f.session_id = ?${floodRangeFilter}
                   AND f.flood_level <> 'ไม่มี'
                 ORDER BY
                    FIELD(f.flood_level, 'สูงมาก', 'สูง', 'ปานกลาง', 'ต่ำ', 'ไม่มี'),
                    f.flood_start_date DESC,
                    f.updated_at DESC
                 LIMIT 80`,
                [sessionId, ...floodRangeParams]
            );

            floodMap = {
                ...floodMap,
                available_dates: floodDateRows.map(row => row.event_date),
                stats: floodStatsRows[0] || floodMap.stats,
                events: floodEventRows.map(row => ({
                    id: row.id,
                    recorded_day: row.recorded_day,
                    district: row.district,
                    tambon: row.tambon,
                    village: row.village,
                    flood_level: row.flood_level,
                    severity: row.severity,
                    severity_label: getSeverityLabel(row.severity),
                    water_depth_cm: asNumber(row.water_depth_cm),
                    affected_people: asNumber(row.affected_people),
                    affected_households: asNumber(row.affected_households),
                    description: row.description
                }))
            };
        }

        // 2. สถิติผู้ประสบภัย (ใช้ affected_persons table)
        const casualtyData = await pool.query(
            `SELECT 
                SUM(deaths) as total_deaths,
                SUM(missing) as total_missing,
                SUM(injured) as total_injured,
                SUM(affected) as total_affected,
                COUNT(DISTINCT district_name) as affected_districts,
                COUNT(DISTINCT tambon) as affected_tambons
             FROM affected_persons
             WHERE session_id = ?${reportDateFilter}`,
            [sessionId, ...reportDateParams]
        );

        const casualties = {
            death: parseInt(casualtyData[0]?.total_deaths) || 0,
            missing: parseInt(casualtyData[0]?.total_missing) || 0,
            injured: parseInt(casualtyData[0]?.total_injured) || 0,
            total: (parseInt(casualtyData[0]?.total_deaths) || 0) +
                (parseInt(casualtyData[0]?.total_missing) || 0) +
                (parseInt(casualtyData[0]?.total_injured) || 0) +
                (parseInt(casualtyData[0]?.total_affected) || 0)
        };

        // 3. พื้นที่ที่ได้รับผลกระทบ
        const affectedAreas = await pool.query(
            `SELECT 
                COUNT(DISTINCT district_name) as total_districts,
                COUNT(DISTINCT tambon) as total_tambons
             FROM affected_persons
             WHERE session_id = ?${reportDateFilter} AND (deaths > 0 OR missing > 0 OR injured > 0 OR affected > 0)`,
            [sessionId, ...reportDateParams]
        );

        const areas = affectedAreas[0] || {
            total_districts: 0,
            total_tambons: 0
        };

        // 4. รายชื่ออำเภอที่ได้รับผลกระทบ
        const districtList = await pool.query(
            `SELECT 
                district_name as district, 
                SUM(deaths + missing + injured + affected) as total_casualties
             FROM affected_persons
             WHERE session_id = ?${reportDateFilter} AND district_name IS NOT NULL
             GROUP BY district_name
             ORDER BY total_casualties DESC`,
            [sessionId, ...reportDateParams]
        );

        // 5. สถิติทรัพยากร IT (ใช้ it_resources table)
        const itResourceStats = await pool.query(
            `SELECT 
                resource_type,
                status,
                COUNT(*) as count
             FROM it_resources
             GROUP BY resource_type, status`
        );

        // จัดกลุ่มทรัพยากร IT ตามประเภท
        const itResources = {
            server: { online: 0, offline: 0, maintenance: 0, unknown: 0, total: 0 },
            internet: { online: 0, offline: 0, maintenance: 0, unknown: 0, total: 0 },
            network: { online: 0, offline: 0, maintenance: 0, unknown: 0, total: 0 },
            hardware: { online: 0, offline: 0, maintenance: 0, unknown: 0, total: 0 }
        };

        itResourceStats.forEach(stat => {
            const type = stat.resource_type;
            const status = stat.status;
            const count = parseInt(stat.count) || 0;

            if (itResources[type]) {
                if (status === 'online' || status === 'offline' || status === 'maintenance' || status === 'unknown') {
                    itResources[type][status] = count;
                }
                itResources[type].total += count;
            }
        });

        // 6. สรุปทรัพยากร IT ทั้งหมด
        const totalITResources = await pool.query(
            `SELECT 
                COUNT(*) as total_items,
                SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_count,
                SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_count,
                SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance_count,
                SUM(CASE WHEN status = 'unknown' THEN 1 ELSE 0 END) as unknown_count
             FROM it_resources`
        );

        // 7. ทีมปฏิบัติการ
        const teams = await pool.query(
            `SELECT 
                t.team_code,
                t.team_name_th,
                t.icon,
                COUNT(DISTINCT tm.officer_id) as member_count,
                CONCAT(o.given_name, ' ', o.family_name) as team_lead_name
             FROM eoc_session_teams st
             JOIN eoc_teams t ON st.team_id = t.id
             LEFT JOIN eoc_team_members tm ON st.id = tm.session_team_id AND tm.is_active = 1
             LEFT JOIN officer o ON st.team_lead_officer_id = o.id
             WHERE st.eoc_session_id = ? AND st.is_active = 1
             GROUP BY t.id, st.id`,
            [sessionId]
        );

        // 8. ศูนย์พักพิง
        const shelters = await pool.query(
            `SELECT 
                COUNT(*) as total_shelters,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_shelters,
                SUM(shelter_capacity) as total_capacity,
                SUM(COALESCE(current_occupancy_total, 0)) as current_occupancy_total
             FROM shelter_centers
             WHERE eoc_type = ?`,
            [session.eoc_type]
        );
        let shelterSessionStats = {
            activated_shelters: 0,
            active_session_shelters: 0,
            session_occupancy: 0
        };
        let shelterTopList = [];
        if (await tableExists('shelter_session_activations')) {
            const shelterSessionRows = await pool.query(
                `SELECT
                    COUNT(DISTINCT ssa.shelter_id) as activated_shelters,
                    SUM(CASE WHEN ssa.is_active = 1 THEN 1 ELSE 0 END) as active_session_shelters,
                    SUM(COALESCE(ssa.current_occupancy, 0)) as session_occupancy
                 FROM shelter_session_activations ssa
                 WHERE ssa.session_id = ?`,
                [sessionId]
            );
            shelterSessionStats = shelterSessionRows[0] || shelterSessionStats;

            shelterTopList = await pool.query(
                `SELECT
                    sc.id,
                    sc.sheltername,
                    sc.district_name,
                    sc.tambon,
                    sc.shelter_capacity,
                    ssa.is_active,
                    ssa.current_occupancy,
                    ssa.activated_at,
                    ssa.deactivated_at
                 FROM shelter_session_activations ssa
                 JOIN shelter_centers sc ON sc.id = ssa.shelter_id
                 WHERE ssa.session_id = ?
                 ORDER BY ssa.is_active DESC, COALESCE(ssa.current_occupancy, 0) DESC, sc.sheltername
                 LIMIT 10`,
                [sessionId]
            );
        }

        // 9. สถิติโรคย้อนหลัง ใช้วันที่เลือกในโหมดรายวัน หรือวันล่าสุดที่มีข้อมูลใน session
        const diseaseLatestDateRows = await pool.query(
            `SELECT DATE_FORMAT(MAX(DATE(report_date)), '%Y-%m-%d') as latest_report_date
             FROM disease_reports
             WHERE session_id = ?`,
            [sessionId]
        );
        const diseaseDisplayDate = mode === 'daily'
            ? effectiveDate
            : (diseaseLatestDateRows[0]?.latest_report_date || null);

        const diseaseToday = await pool.query(
            `SELECT 
                dr.disease_name,
                hf.district_name,
                SUM(dr.patient_count) as today_patients
             FROM disease_reports dr
             JOIN health_facilities hf ON dr.health_facility_id = hf.id
             WHERE dr.session_id = ? AND DATE(dr.report_date) = ?
             GROUP BY dr.disease_name, hf.district_name`,
            [sessionId, diseaseDisplayDate]
        );

        const diseaseCumulative = await pool.query(
            `SELECT 
                dr.disease_name,
                hf.district_name,
                SUM(dr.patient_count) as cumulative_patients
             FROM disease_reports dr
             JOIN health_facilities hf ON dr.health_facility_id = hf.id
             WHERE dr.session_id = ?
             GROUP BY dr.disease_name, hf.district_name`,
            [sessionId]
        );

        const diseaseByType = await pool.query(
            `SELECT 
                dr.disease_name,
                SUM(dr.patient_count) as cumulative_total
             FROM disease_reports dr
             WHERE dr.session_id = ?
             ${mode === 'daily' && effectiveDate ? 'AND DATE(dr.report_date) = ?' : ''}
             GROUP BY dr.disease_name
             ORDER BY cumulative_total DESC`,
            mode === 'daily' && effectiveDate ? [sessionId, effectiveDate] : [sessionId]
        );

        const healthFacilitiesCount = await pool.query(
            `SELECT COUNT(DISTINCT id) as total FROM health_facilities`
        );

        // 10. สถิติกลุ่มเปราะบาง
        const vulnerableSessionCount = await pool.query(
            `SELECT COUNT(*) as count
             FROM vulnerable_groups
             WHERE session_id = ?`,
            [sessionId]
        );
        const useVulnerableBaseline = (parseInt(vulnerableSessionCount[0]?.count) || 0) === 0
            && await tableExists('vulnerable_group_baselines');
        const vulnerableTable = useVulnerableBaseline ? 'vulnerable_group_baselines' : 'vulnerable_groups';
        const vulnerableWhere = useVulnerableBaseline ? '1=1' : 'session_id = ?';
        const vulnerableParams = useVulnerableBaseline ? [] : [sessionId];

        const vulnerableGroups = await pool.query(
            `SELECT 
                district,
                tambon,
                SUM(elderly) as elderly,
                SUM(children) as children,
                SUM(disabled) as disabled,
                SUM(pregnant) as pregnant,
                SUM(bedridden) as bedridden
             FROM ${vulnerableTable}
             WHERE ${vulnerableWhere}
             GROUP BY district, tambon`,
            vulnerableParams
        );

        const vulnerableTotal = await pool.query(
            `SELECT 
                SUM(elderly) as total_elderly,
                SUM(children) as total_children,
                SUM(disabled) as total_disabled,
                SUM(pregnant) as total_pregnant,
                SUM(bedridden) as total_bedridden
             FROM ${vulnerableTable}
             WHERE ${vulnerableWhere}`,
            vulnerableParams
        );

        // 11. สถิติโรคในศูนย์พักพิง
        let shelterDiseases = {
            summary: {
                total_reports: 0,
                shelters_with_reports: 0,
                total_new_cases: 0,
                total_recovered: 0,
                total_hospitalized: 0,
                total_deaths: 0,
                latest_report_date: null
            },
            by_disease: [],
            by_shelter: [],
            severity_counts: []
        };
        if (await tableExists('shelter_disease_reports')) {
            const shelterDiseaseDateFilter = mode === 'daily' && effectiveDate ? ' AND DATE(sdr.report_date) = ?' : '';
            const shelterDiseaseParams = mode === 'daily' && effectiveDate ? [sessionId, effectiveDate] : [sessionId];

            const shelterDiseaseSummaryRows = await pool.query(
                `SELECT
                    COUNT(*) as total_reports,
                    COUNT(DISTINCT sdr.shelter_id) as shelters_with_reports,
                    SUM(COALESCE(sdr.new_cases, 0)) as total_new_cases,
                    SUM(COALESCE(sdr.recovered, 0)) as total_recovered,
                    SUM(COALESCE(sdr.hospitalized, 0)) as total_hospitalized,
                    SUM(COALESCE(sdr.deaths, 0)) as total_deaths,
                    DATE_FORMAT(MAX(sdr.report_date), '%Y-%m-%d') as latest_report_date
                 FROM shelter_disease_reports sdr
                 WHERE sdr.session_id = ?${shelterDiseaseDateFilter}`,
                shelterDiseaseParams
            );

            const shelterDiseaseByDisease = await pool.query(
                `SELECT
                    sdr.disease_type as disease_name,
                    SUM(COALESCE(sdr.new_cases, 0)) as new_cases,
                    SUM(COALESCE(sdr.recovered, 0)) as recovered,
                    SUM(COALESCE(sdr.hospitalized, 0)) as hospitalized,
                    SUM(COALESCE(sdr.deaths, 0)) as deaths,
                    COUNT(DISTINCT sdr.shelter_id) as shelter_count
                 FROM shelter_disease_reports sdr
                 WHERE sdr.session_id = ?${shelterDiseaseDateFilter}
                 GROUP BY sdr.disease_type
                 ORDER BY new_cases DESC, hospitalized DESC
                 LIMIT 10`,
                shelterDiseaseParams
            );

            const shelterDiseaseByShelter = await pool.query(
                `SELECT
                    sc.sheltername,
                    sc.district_name,
                    sc.tambon,
                    SUM(COALESCE(sdr.new_cases, 0)) as new_cases,
                    SUM(COALESCE(sdr.hospitalized, 0)) as hospitalized,
                    COUNT(DISTINCT sdr.disease_type) as disease_count
                 FROM shelter_disease_reports sdr
                 LEFT JOIN shelter_centers sc ON sdr.shelter_id = sc.id
                 WHERE sdr.session_id = ?${shelterDiseaseDateFilter}
                 GROUP BY sdr.shelter_id, sc.sheltername, sc.district_name, sc.tambon
                 ORDER BY new_cases DESC, hospitalized DESC
                 LIMIT 10`,
                shelterDiseaseParams
            );

            const shelterDiseaseSeverityRows = await pool.query(
                `SELECT
                    sdr.severity,
                    COUNT(*) as count
                 FROM shelter_disease_reports sdr
                 WHERE sdr.session_id = ?${shelterDiseaseDateFilter}
                 GROUP BY sdr.severity`,
                shelterDiseaseParams
            );

            shelterDiseases = {
                summary: shelterDiseaseSummaryRows[0] || shelterDiseases.summary,
                by_disease: shelterDiseaseByDisease,
                by_shelter: shelterDiseaseByShelter,
                severity_counts: shelterDiseaseSeverityRows
            };
        }

        // 12. สรุปข้อมูลเวชภัณฑ์จากฐานข้อมูล
        let medicalInventory = {
            source: 'database',
            event: null,
            summary: {
                total_rows: 0,
                agency_count: 0,
                item_types: 0,
                opening_qty: 0,
                received_qty: 0,
                issued_qty: 0,
                balance_qty: 0,
                not_recorded_rows: 0,
                zero_balance_rows: 0
            },
            top_items: [],
            agency_summary: []
        };
        const hasMedicalInventoryTables = await tableExists('medical_inventory_events')
            && await tableExists('medical_inventory_stock');
        if (hasMedicalInventoryTables) {
            let inventoryEvents = await pool.query(
                `SELECT id, event_name, eoc_type, session_number, source_file, created_at
                 FROM medical_inventory_events
                 WHERE eoc_type = ? AND (session_number = ? OR session_number IS NULL)
                 ORDER BY CASE WHEN session_number = ? THEN 0 ELSE 1 END, created_at DESC
                 LIMIT 5`,
                [session.eoc_type, session.session_number, session.session_number]
            );

            if (inventoryEvents.length === 0) {
                inventoryEvents = await pool.query(
                    `SELECT id, event_name, eoc_type, session_number, source_file, created_at
                     FROM medical_inventory_events
                     WHERE eoc_type = ?
                     ORDER BY created_at DESC
                     LIMIT 1`,
                    [session.eoc_type]
                );
            }

            const inventoryEventIds = inventoryEvents.map(event => event.id);
            if (inventoryEventIds.length > 0) {
                const placeholders = inventoryEventIds.map(() => '?').join(',');
                const inventorySummaryRows = await pool.query(
                    `SELECT
                        COUNT(*) as total_rows,
                        COUNT(DISTINCT COALESCE(health_facility_id, inventory_agency_id)) as agency_count,
                        COUNT(DISTINCT item_code) as item_types,
                        SUM(COALESCE(opening_qty, 0)) as opening_qty,
                        SUM(COALESCE(received_qty, 0)) as received_qty,
                        SUM(COALESCE(issued_qty, 0)) as issued_qty,
                        SUM(COALESCE(balance_qty, 0)) as balance_qty,
                        SUM(CASE WHEN data_status = 'not_recorded' THEN 1 ELSE 0 END) as not_recorded_rows,
                        SUM(CASE WHEN data_status = 'recorded' AND COALESCE(balance_qty, 0) <= 0 THEN 1 ELSE 0 END) as zero_balance_rows
                     FROM medical_inventory_stock
                     WHERE inventory_event_id IN (${placeholders})`,
                    inventoryEventIds
                );

                const inventoryTopItems = await pool.query(
                    `SELECT
                        item_code,
                        item_name,
                        unit,
                        SUM(COALESCE(balance_qty, 0)) as balance_qty,
                        SUM(COALESCE(issued_qty, 0)) as issued_qty,
                        COUNT(DISTINCT COALESCE(health_facility_id, inventory_agency_id)) as agency_count
                     FROM medical_inventory_stock
                     WHERE inventory_event_id IN (${placeholders})
                     GROUP BY item_code, item_name, unit
                     ORDER BY issued_qty DESC, balance_qty DESC, item_name
                     LIMIT 10`,
                    inventoryEventIds
                );

                const inventoryAgencySummary = await pool.query(
                    `SELECT
                        agency_name,
                        COUNT(DISTINCT item_code) as item_types,
                        SUM(COALESCE(balance_qty, 0)) as balance_qty,
                        SUM(COALESCE(issued_qty, 0)) as issued_qty,
                        SUM(CASE WHEN data_status = 'not_recorded' THEN 1 ELSE 0 END) as not_recorded_rows
                     FROM medical_inventory_stock
                     WHERE inventory_event_id IN (${placeholders})
                     GROUP BY agency_name
                     ORDER BY issued_qty DESC, balance_qty DESC, agency_name
                     LIMIT 10`,
                    inventoryEventIds
                );

                medicalInventory = {
                    source: 'database',
                    event: inventoryEvents[0] || null,
                    summary: inventorySummaryRows[0] || medicalInventory.summary,
                    top_items: inventoryTopItems,
                    agency_summary: inventoryAgencySummary
                };
            }
        }

        const vulnerableSummary = vulnerableTotal[0] || {};
        const totalVulnerable = asNumber(vulnerableSummary.total_elderly)
            + asNumber(vulnerableSummary.total_children)
            + asNumber(vulnerableSummary.total_disabled)
            + asNumber(vulnerableSummary.total_pregnant)
            + asNumber(vulnerableSummary.total_bedridden);
        const totalDiseasePatients = diseaseByType.reduce((sum, item) => sum + asNumber(item.cumulative_total), 0);
        const meetingFocus = [];
        if (asNumber(floodMap.stats.severe_count) > 0) {
            meetingFocus.push(`ติดตามพื้นที่อุทกภัยน้ำท่วมระดับสูง/สูงมาก ${asNumber(floodMap.stats.severe_count).toLocaleString('th-TH')} จุด`);
        }
        if (casualties.total > 0) {
            meetingFocus.push(`เร่งช่วยเหลือผู้ได้รับผลกระทบรวม ${casualties.total.toLocaleString('th-TH')} คน`);
        }
        if (asNumber(shelterSessionStats.active_session_shelters) > 0) {
            meetingFocus.push(`บริหารศูนย์พักพิงที่ยังเปิด ${asNumber(shelterSessionStats.active_session_shelters).toLocaleString('th-TH')} แห่ง`);
        }
        if (asNumber(shelterDiseases.summary.total_new_cases) > 0) {
            meetingFocus.push(`เฝ้าระวังโรคในศูนย์พักพิง ${asNumber(shelterDiseases.summary.total_new_cases).toLocaleString('th-TH')} รายใหม่`);
        }
        if (asNumber(medicalInventory.summary.not_recorded_rows) > 0) {
            meetingFocus.push(`ติดตามหน่วยบริการที่ยังไม่บันทึกเวชภัณฑ์ ${asNumber(medicalInventory.summary.not_recorded_rows).toLocaleString('th-TH')} รายการ`);
        }
        if (asNumber(totalITResources[0]?.offline_count) > 0) {
            meetingFocus.push(`แก้ไขทรัพยากร IT offline ${asNumber(totalITResources[0]?.offline_count).toLocaleString('th-TH')} รายการ`);
        }

        const meetingSummary = {
            period: {
                start_date: sessionStartDate,
                end_date: sessionEndDate,
                status: session.status
            },
            kpis: {
                affected_people: casualties.total,
                flood_records: asNumber(floodMap.stats.total_records),
                affected_districts: asNumber(affectedAreas[0]?.total_districts),
                active_shelters: asNumber(shelterSessionStats.active_session_shelters) || asNumber(shelters[0]?.active_shelters),
                shelter_occupancy: asNumber(shelterSessionStats.session_occupancy) || asNumber(shelters[0]?.current_occupancy_total),
                disease_patients: totalDiseasePatients,
                shelter_new_cases: asNumber(shelterDiseases.summary.total_new_cases),
                vulnerable_people: totalVulnerable,
                medical_item_types: asNumber(medicalInventory.summary.item_types),
                medical_balance_qty: asNumber(medicalInventory.summary.balance_qty),
                it_offline: asNumber(totalITResources[0]?.offline_count)
            },
            focus_points: meetingFocus
        };

        // 13. กิจกรรมล่าสุด
        const activityDateFilter = mode === 'daily' && effectiveDate ? ' AND DATE(al.created_at) = ?' : '';
        const recentActivities = await pool.query(
            `SELECT 
                al.action_type,
                al.description,
                al.created_at,
                o.given_name,
                o.family_name
             FROM activity_logs al
             LEFT JOIN officer o ON al.user_id = o.id
             WHERE al.eoc_session_id = ?${activityDateFilter}
             ORDER BY al.created_at DESC
             LIMIT 10`,
            mode === 'daily' && effectiveDate ? [sessionId, effectiveDate] : [sessionId]
        );

        return NextResponse.json({
            success: true,
            data: {
                session: {
                    id: session.id,
                    eoc_type: session.eoc_type,
                    eoc_type_name: session.eoc_type_name,
                    session_number: session.session_number,
                    status: session.status,
                    open_time: session.opened_at,
                    close_time: session.closed_at,
                    opened_by_name: session.opened_by_name
                },
                filters: {
                    mode,
                    date: requestedDate,
                    effective_date: effectiveDate,
                    available_dates: availableDateRows.map(row => row.event_date)
                },
                casualties: casualties,
                affected_areas: {
                    districts: parseInt(areas.total_districts) || 0,
                    tambons: parseInt(areas.total_tambons) || 0,
                    district_list: districtList
                },
                resources: {
                    by_type: itResources,
                    summary: totalITResources[0] || {
                        total_items: 0,
                        online_count: 0,
                        offline_count: 0,
                        maintenance_count: 0,
                        unknown_count: 0
                    }
                },
                teams: teams,
                shelters: {
                    ...(shelters[0] || {
                        total_shelters: 0,
                        active_shelters: 0,
                        total_capacity: 0,
                        current_occupancy_total: 0
                    }),
                    session: shelterSessionStats,
                    top_list: shelterTopList
                },
                diseases: {
                    today: diseaseToday,
                    latest_report_date: diseaseDisplayDate,
                    cumulative: diseaseCumulative,
                    by_disease: diseaseByType,
                    health_facilities: healthFacilitiesCount[0]?.total || 0
                },
                vulnerable_groups: {
                    by_location: vulnerableGroups,
                    source: useVulnerableBaseline ? 'baseline' : 'session',
                    summary: vulnerableTotal[0] || {
                        total_elderly: 0,
                        total_children: 0,
                        total_disabled: 0,
                        total_pregnant: 0,
                        total_bedridden: 0
                    }
                },
                flood_map: floodMap,
                shelter_diseases: shelterDiseases,
                medical_inventory: medicalInventory,
                meeting_summary: meetingSummary,
                recent_activities: recentActivities.map(activity => ({
                    action: activity.action_type,
                    details: activity.description,
                    time: activity.created_at,
                    user: `${activity.given_name || ''} ${activity.family_name || ''}`.trim()
                }))
            }
        });

    } catch (error) {
        console.error('Error fetching commander dashboard:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลแดชบอร์ดผู้บัญชาการ');
    }
}
