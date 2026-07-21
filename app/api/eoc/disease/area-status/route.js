import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

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

// GET - ดึงข้อมูลสถานะพื้นที่โรคระบาด
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');
        const date = searchParams.get('date');
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');

        connection = await pool.getConnection();
        const hasDiseaseColumns = await hasDiseaseSubtypeColumns(connection);
        const diseaseSubtypeSelect = hasDiseaseColumns
            ? `disease_id, disease_name,`
            : `NULL as disease_id, NULL as disease_name,`;

        // ดึง active session ถ้าไม่ได้ระบุ session_id
        let activeSessionId = sessionId;
        let activeSession = null;

        if (!activeSessionId) {
            const [sessionResult] = await connection.execute(`
                SELECT id, session_number, ${diseaseSubtypeSelect} opened_at, closed_at, open_reason
                FROM eoc_sessions 
                WHERE eoc_type = 'disease' AND status = 'active' 
                LIMIT 1
            `);

            if (sessionResult.length > 0) {
                activeSession = sessionResult[0];
                activeSessionId = activeSession.id;
            }
        } else {
            const [sessionResult] = await connection.execute(
                `SELECT id, session_number, ${diseaseSubtypeSelect} opened_at, closed_at, open_reason FROM eoc_sessions WHERE id = ?`,
                [activeSessionId]
            );
            if (sessionResult.length > 0) {
                activeSession = sessionResult[0];
            }
        }

        if (!activeSessionId) {
            return NextResponse.json({
                success: true,
                hasActiveSession: false,
                message: 'ไม่มี EOC Session ที่เปิดอยู่',
                data: [],
                stats: {}
            });
        }

        // ดึงข้อมูลรายงานโรค โดยรวมเป็นจุดตามพื้นที่ เพื่อรองรับข้อมูลนำเข้าระดับหมู่บ้าน
        let query = `
            SELECT 
                MIN(dr.id) as id,
                MAX(dr.report_date) as report_date,
                dr.disease_name,
                SUM(dr.patient_count) as patient_count,
                COUNT(*) as report_count,
                CASE
                    WHEN SUM(CASE WHEN dr.import_source IS NOT NULL THEN 1 ELSE 0 END) > 0
                    THEN CONCAT('นำเข้าจาก Google Sheet ', SUM(CASE WHEN dr.import_source IS NOT NULL THEN dr.patient_count ELSE 0 END), ' ราย')
                    ELSE GROUP_CONCAT(DISTINCT dr.notes SEPARATOR '\\n')
                END as notes,
                hf.name as facility_name,
                COALESCE(dr.district_name, hf.district_name) as district,
                COALESCE(dr.tambon_name, hf.tambon) as tambon,
                dr.moo,
                COALESCE(dr.village_name, v.villname) as village_name,
                dr.village_polygon_id,
                COALESCE(dr.home_lat, ST_Y(ST_Centroid(ST_SRID(v.geom, 0))), hf.lat) as lat,
                COALESCE(dr.home_lng, ST_X(ST_Centroid(ST_SRID(v.geom, 0))), hf.lon) as lng
            FROM disease_reports dr
            LEFT JOIN health_facilities hf ON dr.health_facility_id = hf.id
            LEFT JOIN satun_village_polygon v ON dr.village_polygon_id = v.id
            WHERE dr.session_id = ?
        `;
        const params = [activeSessionId];

        if (date) {
            query += ' AND DATE(dr.report_date) = ?';
            params.push(date);
        } else if (startDate && endDate) {
            query += ' AND DATE(dr.report_date) BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        query += `
            GROUP BY
                dr.disease_name,
                COALESCE(dr.district_name, hf.district_name),
                COALESCE(dr.tambon_name, hf.tambon),
                dr.moo,
                COALESCE(dr.village_name, v.villname),
                dr.village_polygon_id,
                hf.name,
                COALESCE(dr.home_lat, ST_Y(ST_Centroid(ST_SRID(v.geom, 0))), hf.lat),
                COALESCE(dr.home_lng, ST_X(ST_Centroid(ST_SRID(v.geom, 0))), hf.lon)
            ORDER BY MAX(dr.report_date) DESC, district, tambon, CAST(dr.moo AS UNSIGNED), village_name
        `;

        const [reports] = await connection.execute(query, params);

        // สรุปตามตำบล
        const tambonSummary = {};
        reports.forEach(report => {
            const key = `${report.district}-${report.tambon}`;
            if (!tambonSummary[key]) {
                tambonSummary[key] = {
                    district: report.district,
                    tambon: report.tambon,
                    total_patients: 0,
                    diseases: new Set(),
                    facilities: new Set()
                };
            }
            tambonSummary[key].total_patients += Number(report.patient_count || 0);
            tambonSummary[key].diseases.add(report.disease_name);
            tambonSummary[key].facilities.add(report.facility_name);
        });

        // คำนวณระดับความรุนแรงและแปลง Set เป็น Array
        const tambonData = Object.values(tambonSummary).map(t => ({
            ...t,
            diseases: Array.from(t.diseases),
            facilities: Array.from(t.facilities),
            severity_level: getSeverityLevel(t.total_patients)
        }));

        // สถิติรวม
        const stats = {
            total_reports: reports.length,
            total_patients: reports.reduce((sum, r) => sum + Number(r.patient_count || 0), 0),
            affected_districts: [...new Set(reports.map(r => r.district))].length,
            affected_tambons: Object.keys(tambonSummary).length,
            diseases: [...new Set(reports.map(r => r.disease_name))]
        };

        return NextResponse.json({
            success: true,
            hasActiveSession: true,
            activeSession: activeSession,
            data: reports,
            tambonSummary: tambonData,
            stats: stats
        });

    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานะพื้นที่โรคระบาด'
        }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// Helper function สำหรับกำหนดระดับความรุนแรง
function getSeverityLevel(patientCount) {
    if (patientCount >= 300) return 'severe';      // 🔴 แดง - ระบาดหนัก
    if (patientCount >= 100) return 'moderate';    // 🟡 เหลือง - ระบาดปานกลาง  
    if (patientCount >= 1) return 'mild';          // 🔵 ฟ้า - เฝ้าระวัง
    return 'safe';                                  // 🟢 เขียว - ปลอดภัย
}
