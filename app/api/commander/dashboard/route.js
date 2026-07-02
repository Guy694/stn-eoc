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
                SUM(shelter_capacity) as total_capacity
             FROM shelter_centers
             WHERE eoc_type = ?`,
            [session.eoc_type]
        );

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

        // 11. กิจกรรมล่าสุด
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
                shelters: shelters[0] || {
                    total_shelters: 0,
                    active_shelters: 0,
                    total_capacity: 0
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
