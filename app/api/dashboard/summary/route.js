import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function hasDiseaseSubtypeColumns(connection) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'eoc_sessions'
           AND COLUMN_NAME IN ('disease_id', 'disease_name')`
    );
    return columns.length === 2;
}

async function hasAnnouncementEocTypeColumn(connection) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'announcements'
           AND COLUMN_NAME = 'eoc_type'`
    );
    return columns.length > 0;
}

async function getDiseaseReportLocationExpressions(connection) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'disease_reports'
           AND COLUMN_NAME IN ('district_name', 'tambon_name', 'moo', 'village_polygon_id')`
    );
    const columnSet = new Set(columns.map((column) => column.COLUMN_NAME));

    if (!columnSet.has('district_name')) {
        return {
            district: 'hf.district_name',
            facility: `CONCAT('hf:', dr.health_facility_id)`
        };
    }

    const facilityParts = [`CONCAT('hf:', dr.health_facility_id)`];
    if (columnSet.has('village_polygon_id')) {
        facilityParts.push(`CONCAT('v:', dr.village_polygon_id)`);
    }
    const districtPart = `COALESCE(dr.district_name, '')`;
    const tambonPart = columnSet.has('tambon_name') ? `COALESCE(dr.tambon_name, '')` : `''`;
    const mooPart = columnSet.has('moo') ? `COALESCE(dr.moo, '')` : `''`;
    facilityParts.push(`CONCAT('area:', ${districtPart}, '|', ${tambonPart}, '|', ${mooPart})`);

    return {
        district: 'COALESCE(dr.district_name, hf.district_name)',
        facility: `COALESCE(${facilityParts.join(', ')})`
    };
}

// GET - ดึงข้อมูลสรุปสำหรับ Dashboard
export async function GET(request) {
    let connection;

    try {
        connection = await pool.getConnection();
    } catch (error) {
        console.error('Database connection error:', error);
        return NextResponse.json({
            success: true,
            data: {
                activeEOCs: 0,
                activeTeams: 0,
                todayReports: 0,
                totalAffected: 0,
                publicReports: 0,
                activeShelters: 0,
                diseasePatients: 0,
                activeSessions: [],
                eocSessions: [],
                eocOverview: [],
                announcements: [],
                recentActivities: []
            }
        });
    }

    try {
        let activeEOCsCount = 0;
        let activeTeamsCount = 0;
        let todayReportsCount = 0;
        let totalAffected = 0;
        let publicReportsCount = 0;
        let activeSheltersCount = 0;
        let diseasePatientsCount = 0;
        let activeSessions = [];
        let eocSessions = [];
        let announcements = [];
        let recentActivities = [];
        let eocOverview = [];
        const hasDiseaseColumns = await hasDiseaseSubtypeColumns(connection).catch(() => false);
        const activeDiseaseSelect = hasDiseaseColumns
            ? `sess.disease_id,
               sess.disease_name,`
            : `NULL as disease_id,
               NULL as disease_name,`;
        const sessionDiseaseSelect = hasDiseaseColumns
            ? `s.disease_id,
               s.disease_name,`
            : `NULL as disease_id,
               NULL as disease_name,`;
        const overviewDiseaseSelect = hasDiseaseColumns
            ? `latest.disease_id,
               latest.disease_name,`
            : `NULL as disease_id,
               NULL as disease_name,`;
        const sessionDiseaseGroupBy = hasDiseaseColumns
            ? `s.disease_id,
                    s.disease_name,`
            : '';

        // 1. นับจำนวน EOC ที่เปิดอยู่
        try {
            const [activeEOCs] = await connection.execute(`
                SELECT COUNT(*) as count FROM eoc_status WHERE is_active = 1
            `);
            activeEOCsCount = activeEOCs[0]?.count || 0;
        } catch {
        }

        // 2. นับจำนวนทีมที่ active / ทีมใน session
        try {
            const [activeTeams] = await connection.execute(`
                SELECT COUNT(*) as count
                FROM eoc_session_teams
                WHERE is_active = 1
            `);
            activeTeamsCount = activeTeams[0]?.count || 0;
        } catch {
            try {
                const [teams] = await connection.execute(`
                    SELECT COUNT(*) as count FROM eoc_teams WHERE is_active = 1
                `);
                activeTeamsCount = teams[0]?.count || 0;
            } catch {
            }
        }

        // 3. นับรายงานวันนี้จากกิจกรรมและรายงานประชาชน
        try {
            const [todayReports] = await connection.execute(`
                SELECT
                    (
                        SELECT COUNT(*)
                        FROM activity_logs
                        WHERE DATE(created_at) = CURDATE()
                    ) +
                    (
                        SELECT COUNT(*)
                        FROM public_incident_reports
                        WHERE DATE(reported_at) = CURDATE()
                    ) as count
            `);
            todayReportsCount = todayReports[0]?.count || 0;
        } catch {
        }

        // 4. ดึง active sessions พร้อมข้อมูลเพิ่มเติม
        try {
            const [sessions] = await connection.execute(`
                SELECT 
                    es.eoc_type,
                    es.name_th,
                    es.icon,
                    sess.id as session_id,
                    sess.session_number,
                    ${activeDiseaseSelect}
                    sess.opened_at
                FROM eoc_status es
                LEFT JOIN eoc_sessions sess ON es.eoc_type = sess.eoc_type AND sess.status = 'active'
                WHERE es.is_active = 1
            `);
            activeSessions = sessions;
        } catch {
        }

        // 5. คำนวณผู้ได้รับผลกระทบจาก affected_persons
        try {
            const [affectedData] = await connection.execute(`
                SELECT COALESCE(SUM(affected), 0) as total
                FROM affected_persons
            `);
            totalAffected = affectedData[0]?.total || 0;
        } catch {
        }

        // 5.1 ตัวชี้วัดรวมที่หน้าแรกต้องใช้
        try {
            const [publicReports] = await connection.execute(`
                SELECT COUNT(*) as count
                FROM public_incident_reports
            `);
            publicReportsCount = publicReports[0]?.count || 0;
        } catch {
        }

        try {
            const [shelters] = await connection.execute(`
                SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active
                FROM shelter_centers
            `);
            activeSheltersCount = shelters[0]?.active || 0;
        } catch {
        }

        try {
            const [diseases] = await connection.execute(`
                SELECT COALESCE(SUM(patient_count), 0) as patients
                FROM disease_reports
            `);
            diseasePatientsCount = diseases[0]?.patients || 0;
        } catch {
        }

        // 5.2 รายการ session สำหรับตัวกรองหน้าแรก
        try {
            const [sessions] = await connection.execute(`
                SELECT
                    s.id,
                    s.eoc_type,
                    s.session_number,
                    ${sessionDiseaseSelect}
                    s.status,
                    DATE_FORMAT(s.opened_at, '%Y-%m-%d %H:%i:%s') as opened_at,
                    DATE_FORMAT(s.closed_at, '%Y-%m-%d %H:%i:%s') as closed_at,
                    s.open_reason,
                    s.close_reason,
                    s.summary,
                    DATE_FORMAT(DATE(s.opened_at), '%Y-%m-%d') as affected_period_start,
                    DATE_FORMAT(DATE(COALESCE(s.closed_at, NOW())), '%Y-%m-%d') as affected_period_end,
                    (
                        SELECT COALESCE(SUM(ap.affected), 0)
                        FROM affected_persons ap
                        WHERE ap.session_id = s.id
                          AND ap.report_date BETWEEN DATE(s.opened_at) AND DATE(COALESCE(s.closed_at, NOW()))
                    ) as affected_total,
                    (
                        SELECT COALESCE(SUM(ap.injured), 0)
                        FROM affected_persons ap
                        WHERE ap.session_id = s.id
                          AND ap.report_date BETWEEN DATE(s.opened_at) AND DATE(COALESCE(s.closed_at, NOW()))
                    ) as affected_injured,
                    (
                        SELECT COALESCE(SUM(ap.deaths), 0)
                        FROM affected_persons ap
                        WHERE ap.session_id = s.id
                          AND ap.report_date BETWEEN DATE(s.opened_at) AND DATE(COALESCE(s.closed_at, NOW()))
                    ) as affected_deaths,
                    (
                        SELECT COALESCE(SUM(ap.missing), 0)
                        FROM affected_persons ap
                        WHERE ap.session_id = s.id
                          AND ap.report_date BETWEEN DATE(s.opened_at) AND DATE(COALESCE(s.closed_at, NOW()))
                    ) as affected_missing,
                    (
                        SELECT COUNT(DISTINCT ap.district_name)
                        FROM affected_persons ap
                        WHERE ap.session_id = s.id
                          AND ap.report_date BETWEEN DATE(s.opened_at) AND DATE(COALESCE(s.closed_at, NOW()))
                    ) as affected_districts,
                    (
                        SELECT COUNT(DISTINCT ap.tambon)
                        FROM affected_persons ap
                        WHERE ap.session_id = s.id
                          AND ap.report_date BETWEEN DATE(s.opened_at) AND DATE(COALESCE(s.closed_at, NOW()))
                    ) as affected_tambons,
                    DATE_FORMAT(
                        COALESCE(
                            MAX(CASE WHEN fr.flood_level <> 'ไม่มี' THEN fr.flood_start_date END),
                            MAX(fr.flood_start_date)
                        ),
                        '%Y-%m-%d'
                    ) as latest_flood_record_date,
                    COUNT(fr.id) as flood_record_count
                FROM eoc_sessions s
                LEFT JOIN flood_records fr ON fr.session_id = s.id
                GROUP BY
                    s.id,
                    s.eoc_type,
                    s.session_number,
                    ${sessionDiseaseGroupBy}
                    s.status,
                    s.opened_at,
                    s.closed_at,
                    s.open_reason,
                    s.close_reason,
                    s.summary
                ORDER BY s.opened_at DESC, s.id DESC
                LIMIT 100
            `);
            eocSessions = sessions;
        } catch {
        }

        // 6. ดึงประกาศล่าสุด 3 รายการ
        try {
            const hasAnnouncementEocType = await hasAnnouncementEocTypeColumn(connection).catch(() => false);
            const activeEocTypes = [...new Set((activeSessions || []).map((session) => session.eoc_type).filter(Boolean))];

            let announcementQuery = `
                SELECT
                    id,
                    title,
                    description,
                    description AS content,
                    priority,
                    start_date,
                    end_date,
                    created_at
                FROM announcements
                WHERE is_active = 1
                    AND (start_date IS NULL OR start_date <= NOW())
                    AND (end_date IS NULL OR end_date >= NOW())
            `;
            const announcementParams = [];

            if (hasAnnouncementEocType && activeEocTypes.length > 0) {
                announcementQuery += ` AND eoc_type IN (${activeEocTypes.map(() => '?').join(', ')})`;
                announcementParams.push(...activeEocTypes);
            }

            announcementQuery += ' ORDER BY priority DESC, created_at DESC LIMIT 3';

            let [announcementData] = await connection.execute(announcementQuery, announcementParams);
            if (announcementData.length === 0) {
                const [fallbackAnnouncementData] = await connection.execute(`
                    SELECT
                        id,
                        title,
                        description,
                        description AS content,
                        priority,
                        start_date,
                        end_date,
                        created_at
                    FROM announcements
                    WHERE is_active = 1
                    ORDER BY priority DESC, created_at DESC
                    LIMIT 3
                `);
                announcementData = fallbackAnnouncementData;
            }
            announcements = announcementData;
        } catch {
        }

        // 7. ดึงกิจกรรมล่าสุด 10 รายการ
        try {
            const [activities] = await connection.execute(`
                SELECT 
                    al.id,
                    al.action_type,
                    al.target_type,
                    al.description,
                    al.created_at,
                    o.title as user_title,
                    o.given_name,
                    o.family_name
                FROM activity_logs al
                LEFT JOIN officer o ON al.user_id = o.id
                ORDER BY al.created_at DESC
                LIMIT 10
            `);

            recentActivities = activities.map(activity => ({
                id: activity.id,
                icon: getActivityIcon(activity.action_type),
                title: getActivityTitle(activity.action_type),
                description: activity.description || '-',
                time: formatThaiDateTime(activity.created_at),
                user: activity.given_name ? `${activity.user_title || ''}${activity.given_name} ${activity.family_name || ''}`.trim() : 'ระบบ'
            }));
        } catch {
        }

        // 8. ภาพรวมราย EOC สำหรับหน้าแรก
        try {
            const [eocRows] = await connection.execute(`
                SELECT
                    es.eoc_type,
                    es.name_th,
                    es.name_en,
                    es.icon,
                    es.color_primary,
                    es.is_active,
                    latest.id as session_id,
                    latest.session_number,
                    latest.status as session_status,
                    ${overviewDiseaseSelect}
                    latest.opened_at,
                    latest.closed_at
                FROM eoc_status es
                LEFT JOIN (
                    SELECT s1.*
                    FROM eoc_sessions s1
                    INNER JOIN (
                        SELECT eoc_type, MAX(id) as latest_id
                        FROM eoc_sessions
                        GROUP BY eoc_type
                    ) latest_session ON latest_session.latest_id = s1.id
                ) latest ON latest.eoc_type = es.eoc_type
                ORDER BY es.sort_order, es.eoc_type
            `);

            const [floodStats] = await connection.execute(`
                SELECT
                    COUNT(*) as rows_count,
                    COUNT(DISTINCT session_id) as sessions,
                    COUNT(DISTINCT district_name) as districts,
                    COALESCE(SUM(affected), 0) as affected,
                    COALESCE(SUM(injured), 0) as injured,
                    COALESCE(SUM(deaths), 0) as deaths,
                    COALESCE(SUM(missing), 0) as missing,
                    DATE_FORMAT(MIN(report_date), '%Y-%m-%d') as first_date,
                    DATE_FORMAT(MAX(report_date), '%Y-%m-%d') as last_date
                FROM affected_persons
            `);

            const [floodVillageStats] = await connection.execute(`
                SELECT
                    COUNT(*) as records,
                    COUNT(DISTINCT polygon_id) as villages,
                    COUNT(DISTINCT district) as districts,
                    COALESCE(SUM(affected_people), 0) as affected_people
                FROM flood_records
            `);

            const diseaseLocation = await getDiseaseReportLocationExpressions(connection).catch(() => ({
                district: 'hf.district_name',
                facility: `CONCAT('hf:', dr.health_facility_id)`
            }));

            const [diseaseBySessionRows] = await connection.execute(`
                SELECT
                    dr.session_id,
                    COUNT(*) as rows_count,
                    COUNT(DISTINCT dr.disease_name) as disease_count,
                    COUNT(DISTINCT ${diseaseLocation.facility}) as facilities,
                    COUNT(DISTINCT ${diseaseLocation.district}) as districts,
                    COALESCE(SUM(dr.patient_count), 0) as patients,
                    DATE_FORMAT(MIN(dr.report_date), '%Y-%m-%d') as first_date,
                    DATE_FORMAT(MAX(dr.report_date), '%Y-%m-%d') as last_date
                FROM disease_reports dr
                LEFT JOIN health_facilities hf ON dr.health_facility_id = hf.id
                GROUP BY dr.session_id
            `);

            const [accidentStatsRows] = await connection.execute(`
                SELECT
                    COUNT(*) as accidents,
                    COALESCE(SUM(injuries), 0) as injuries,
                    COALESCE(SUM(deaths), 0) as deaths,
                    COUNT(DISTINCT district) as districts,
                    DATE_FORMAT(MIN(report_date), '%Y-%m-%d') as first_date,
                    DATE_FORMAT(MAX(report_date), '%Y-%m-%d') as last_date
                FROM accident_reports
            `);

            const [servicePointStatsRows] = await connection.execute(`
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active
                FROM temporary_service_points
            `);

            const [shelterStatsRows] = await connection.execute(`
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                    COALESCE(SUM(shelter_capacity), 0) as capacity,
                    COALESCE(SUM(current_occupancy_total), 0) as occupancy
                FROM shelter_centers
            `);

            const [shelterByTypeRows] = await connection.execute(`
                SELECT
                    eoc_type,
                    COUNT(*) as total,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active
                FROM shelter_centers
                GROUP BY eoc_type
            `);

            const [publicIncidentStatsRows] = await connection.execute(`
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN status IN ('pending', 'reviewing') THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status IN ('verified', 'resolved') THEN 1 ELSE 0 END) as verified,
                    SUM(CASE WHEN urgency = 'critical' THEN 1 ELSE 0 END) as critical
                FROM public_incident_reports
            `);

            const [vulnerableStatsRows] = await connection.execute(`
                SELECT
                    COUNT(*) as locations,
                    COALESCE(SUM(total_cared), 0) as total_cared,
                    COALESCE(SUM(elderly), 0) as elderly,
                    COALESCE(SUM(disabled), 0) as disabled,
                    COALESCE(SUM(bedridden), 0) as bedridden
                FROM vulnerable_group_baselines
            `);

            const flood = floodStats[0] || {};
            const floodVillage = floodVillageStats[0] || {};
            const diseaseBySession = new Map(
                (diseaseBySessionRows || [])
                    .filter((row) => row.session_id !== null && row.session_id !== undefined)
                    .map((row) => [String(row.session_id), row])
            );
            const accident = accidentStatsRows[0] || {};
            const servicePoints = servicePointStatsRows[0] || {};
            const shelter = shelterStatsRows[0] || {};
            const shelterByType = new Map((shelterByTypeRows || []).map((row) => [row.eoc_type, row]));
            const incidents = publicIncidentStatsRows[0] || {};
            const vulnerable = vulnerableStatsRows[0] || {};
            const sessionImpactById = new Map(
                (eocSessions || []).map((session) => [String(session.id), session])
            );

            eocOverview = eocRows.map((eoc) => {
                const sessionImpact = sessionImpactById.get(String(eoc.session_id)) || {};
                const base = {
                    eoc_type: eoc.eoc_type,
                    name_th: eoc.name_th,
                    name_en: eoc.name_en,
                    icon: eoc.icon,
                    color_primary: eoc.color_primary,
                    is_active: Boolean(eoc.is_active),
                    session_id: eoc.session_id,
                    session_number: eoc.session_number,
                    session_status: eoc.session_status,
                    disease_id: eoc.disease_id,
                    disease_name: eoc.disease_name,
                    opened_at: eoc.opened_at,
                    closed_at: eoc.closed_at,
                    affected_period_start: sessionImpact.affected_period_start || null,
                    affected_period_end: sessionImpact.affected_period_end || null,
                    summary: [],
                    links: []
                };

                if (eoc.eoc_type === 'flood') {
                    return {
                        ...base,
                        description: 'ภาพรวมสถานการณ์อุทกภัย ผู้ได้รับผลกระทบ ศูนย์พักพิง และรายงานประชาชน',
                        summary: [
                            { key: 'affected', label: 'ผู้ได้รับผลกระทบ', value: sessionImpact.affected_total || 0, unit: 'คน' },
                            { key: 'injured', label: 'บาดเจ็บ', value: sessionImpact.affected_injured || 0, unit: 'คน' },
                            { key: 'deaths', label: 'เสียชีวิต', value: sessionImpact.affected_deaths || 0, unit: 'คน' },
                            { key: 'districts', label: 'อำเภอที่มีรายงาน', value: sessionImpact.affected_districts || flood.districts || floodVillage.districts || 0, unit: 'อำเภอ' },
                            { key: 'shelters', label: 'ศูนย์พักพิง', value: shelterByType.get('flood')?.total || shelter.total || 0, unit: 'แห่ง' },
                            { key: 'public_reports', label: 'รายงานประชาชน', value: incidents.total || 0, unit: 'รายการ' }
                        ],
                        period: {
                            first_date: sessionImpact.affected_period_start || flood.first_date,
                            last_date: sessionImpact.affected_period_end || flood.last_date
                        },
                        links: [
                            { label: 'เปิดภาพรวม', href: '/eoc/flood/overview' },
                            { label: 'ผู้ได้รับผลกระทบ', href: '/eoc/flood/affected' },
                            { label: 'แผนที่', href: '/public/disaster-map' }
                        ]
                    };
                }

                if (eoc.eoc_type === 'disease') {
                    const diseaseSession = diseaseBySession.get(String(eoc.session_id)) || {};
                    return {
                        ...base,
                        description: 'ภาพรวมการเฝ้าระวังโรค จำนวนผู้ป่วย โรคที่รายงาน และหน่วยบริการ',
                        summary: [
                            { key: 'patients', label: 'ผู้ป่วย/อาการ', value: diseaseSession.patients || 0, unit: 'ราย' },
                            { key: 'diseases', label: 'โรคที่รายงาน', value: diseaseSession.disease_count || 0, unit: 'โรค' },
                            { key: 'facilities', label: 'หน่วยบริการ', value: diseaseSession.facilities || 0, unit: 'แห่ง' },
                            { key: 'districts', label: 'อำเภอที่มีรายงาน', value: diseaseSession.districts || 0, unit: 'อำเภอ' },
                            { key: 'shelters', label: 'ศูนย์พักพิง', value: shelterByType.get('disease')?.total || 0, unit: 'แห่ง' }
                        ],
                        period: { first_date: diseaseSession.first_date, last_date: diseaseSession.last_date },
                        links: [
                            { label: 'เปิดแผนที่โรค', href: '/eoc/disease' },
                            { label: 'รายงานโรค', href: '/admin/disease-reports' }
                        ]
                    };
                }

                if (eoc.eoc_type === 'festival-accidents' || eoc.eoc_type === 'accident') {
                    return {
                        ...base,
                        description: 'ภาพรวมอุบัติเหตุช่วงเทศกาล ผู้บาดเจ็บ ผู้เสียชีวิต และจุดบริการ',
                        summary: [
                            { key: 'accidents', label: 'อุบัติเหตุ', value: accident.accidents || 0, unit: 'ครั้ง' },
                            { key: 'injuries', label: 'บาดเจ็บ', value: accident.injuries || 0, unit: 'ราย' },
                            { key: 'deaths', label: 'เสียชีวิต', value: accident.deaths || 0, unit: 'ราย' },
                            { key: 'districts', label: 'อำเภอที่มีรายงาน', value: accident.districts || 0, unit: 'อำเภอ' },
                            { key: 'service_points', label: 'จุดบริการ', value: servicePoints.total || 0, unit: 'จุด' }
                        ],
                        period: { first_date: accident.first_date, last_date: accident.last_date },
                        links: [
                            { label: 'เปิดภาพรวม', href: '/eoc/festival-accidents' },
                            { label: 'บันทึกอุบัติเหตุ', href: '/eoc/accident/records' }
                        ]
                    };
                }

                return {
                    ...base,
                    description: 'ยังไม่มีข้อมูลสรุปเฉพาะประเภทภัยนี้',
                    summary: [
                        { key: 'sessions', label: 'Session', value: eoc.session_id ? 1 : 0, unit: 'ครั้ง' }
                    ],
                    links: []
                };
            });

            eocOverview.push({
                eoc_type: 'population',
                name_th: 'ข้อมูลประชาชน/กลุ่มเปราะบาง',
                name_en: 'Population Data',
                icon: 'users',
                color_primary: 'emerald',
                is_active: false,
                description: 'ฐานข้อมูลกลางสำหรับสนับสนุนทุก EOC',
                summary: [
                    { key: 'vulnerable_total', label: 'กลุ่มเปราะบางที่ดูแล', value: vulnerable.total_cared || 0, unit: 'คน' },
                    { key: 'locations', label: 'พื้นที่', value: vulnerable.locations || 0, unit: 'พื้นที่' },
                    { key: 'elderly', label: 'ผู้สูงอายุ', value: vulnerable.elderly || 0, unit: 'คน' },
                    { key: 'bedridden', label: 'ติดเตียง', value: vulnerable.bedridden || 0, unit: 'คน' }
                ],
                links: [
                    { label: 'เปิดข้อมูล', href: '/eoc/vulnerable-groups' }
                ]
            });
        } catch (error) {
            console.error('Error building EOC overview:', error);
        }

        return NextResponse.json({
            success: true,
            data: {
                activeEOCs: activeEOCsCount,
                activeTeams: activeTeamsCount,
                todayReports: todayReportsCount,
                totalAffected: totalAffected,
                publicReports: publicReportsCount,
                activeShelters: activeSheltersCount,
                diseasePatients: diseasePatientsCount,
                activeSessions: activeSessions,
                eocSessions,
                eocOverview,
                announcements: announcements,
                recentActivities: recentActivities
            }
        });

    } catch (error) {
        console.error('Error fetching dashboard summary:', error);
        return NextResponse.json({
            success: true,
            data: {
                activeEOCs: 0,
                activeTeams: 0,
                todayReports: 0,
                totalAffected: 0,
                publicReports: 0,
                activeShelters: 0,
                diseasePatients: 0,
                activeSessions: [],
                eocSessions: [],
                eocOverview: [],
                announcements: [],
                recentActivities: []
            }
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

function getActivityIcon(actionType) {
    const icons = {
        'eoc_activate': 'siren',
        'eoc_deactivate': 'checkCircle',
        'create': 'plus',
        'update': 'edit',
        'delete': 'trash',
        'login': 'lock',
        'logout': 'logout',
        'report': 'file',
        'flood_record': 'droplets',
        'disease_report': 'disease'
    };
    return icons[actionType] || 'clipboard';
}

function getActivityTitle(actionType) {
    const titles = {
        'eoc_activate': 'เปิด EOC',
        'eoc_deactivate': 'ปิด EOC',
        'create': 'สร้างข้อมูลใหม่',
        'update': 'แก้ไขข้อมูล',
        'delete': 'ลบข้อมูล',
        'login': 'เข้าสู่ระบบ',
        'logout': 'ออกจากระบบ',
        'report': 'รายงาน',
        'flood_record': 'บันทึกอุทกภัยน้ำท่วม',
        'disease_report': 'รายงานโรคระบาด'
    };
    return titles[actionType] || 'กิจกรรม';
}

function formatThaiDateTime(date) {
    if (!date) return '-';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'เมื่อสักครู่';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`;

    return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
