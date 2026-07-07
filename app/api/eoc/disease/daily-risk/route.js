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

async function getFacilityTypeSelectExpression(connection) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'health_facilities'
           AND COLUMN_NAME IN ('facility_type', 'typecode')`
    );

    const columnSet = new Set(columns.map((column) => column.COLUMN_NAME));
    if (columnSet.has('facility_type')) {
        return 'hf.facility_type as facility_type';
    }
    if (columnSet.has('typecode')) {
        return 'hf.typecode as facility_type';
    }
    return `'' as facility_type`;
}

// GET - ดึงข้อมูลสรุปสถานการณ์โรครายวัน
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

        connection = await pool.getConnection();
        const hasDiseaseColumns = await hasDiseaseSubtypeColumns(connection);
        const facilityTypeSelect = await getFacilityTypeSelectExpression(connection);
        const diseaseSubtypeSelect = hasDiseaseColumns
            ? `disease_id, disease_name,`
            : `NULL as disease_id, NULL as disease_name,`;

        // ดึง session ที่ active
        const [sessionResult] = await connection.execute(`
            SELECT id FROM eoc_sessions 
            WHERE eoc_type = 'disease' AND status = 'active' 
            LIMIT 1
        `);

        if (!sessionResult.length) {
            return NextResponse.json({
                success: false,
                message: 'ไม่มี EOC Session ที่เปิดอยู่'
            }, { status: 404 });
        }

        const sessionId = sessionResult[0].id;

        // สรุปตามโรค
        const [diseaseSummary] = await connection.execute(`
            SELECT 
                dr.disease_name,
                COUNT(*) as report_count,
                SUM(dr.patient_count) as total_patients,
                COUNT(DISTINCT dr.health_facility_id) as facilities_count,
                MAX(dr.report_date) as last_report
            FROM disease_reports dr
            WHERE dr.session_id = ? AND DATE(dr.report_date) = ?
            GROUP BY dr.disease_name
            ORDER BY SUM(dr.patient_count) DESC
        `, [sessionId, date]);

        // สรุปตามอำเภอ
        const [districtSummary] = await connection.execute(`
            SELECT 
                hf.district_name as district,
                COUNT(DISTINCT dr.disease_name) as diseases_count,
                COUNT(DISTINCT dr.health_facility_id) as facilities_count,
                SUM(dr.patient_count) as total_patients,
                COUNT(*) as report_count
            FROM disease_reports dr
            JOIN health_facilities hf ON dr.health_facility_id = hf.id
            WHERE dr.session_id = ? AND DATE(dr.report_date) = ?
            GROUP BY hf.district_name
            ORDER BY SUM(dr.patient_count) DESC
        `, [sessionId, date]);

        // รายละเอียดทั้งหมด
        const [details] = await connection.execute(`
            SELECT 
                dr.id,
                dr.disease_name,
                dr.patient_count,
                dr.notes,
                dr.report_date,
                hf.name as facility_name,
                hf.district_name,
                ${facilityTypeSelect}
            FROM disease_reports dr
            JOIN health_facilities hf ON dr.health_facility_id = hf.id
            WHERE dr.session_id = ? AND DATE(dr.report_date) = ?
            ORDER BY dr.patient_count DESC, hf.district_name, hf.name
        `, [sessionId, date]);

        // สถิติรวม
        const [totalStats] = await connection.execute(`
            SELECT 
                COUNT(DISTINCT hf.district_name) as affected_districts,
                COUNT(DISTINCT dr.health_facility_id) as affected_facilities,
                COUNT(DISTINCT dr.disease_name) as diseases_count,
                SUM(dr.patient_count) as total_patients,
                COUNT(*) as total_reports
            FROM disease_reports dr
            JOIN health_facilities hf ON dr.health_facility_id = hf.id
            WHERE dr.session_id = ? AND DATE(dr.report_date) = ?
        `, [sessionId, date]);

        // EOC Session ที่เปิดอยู่
        const [activeSession] = await connection.execute(`
            SELECT 
                id,
                session_number,
                ${diseaseSubtypeSelect}
                opened_at,
                open_reason,
                total_activities,
                total_data_entries,
                TIMESTAMPDIFF(HOUR, opened_at, NOW()) as hours_open,
                TIMESTAMPDIFF(DAY, opened_at, NOW()) as days_open
            FROM eoc_sessions
            WHERE id = ?
        `, [sessionId]);

        // Classify severity level based on patient count
        const classifiedDiseases = diseaseSummary.map(d => ({
            ...d,
            severity: getSeverityLevel(d.total_patients)
        }));

        return NextResponse.json({
            success: true,
            date: date,
            session_id: sessionId,
            totalStats: totalStats[0] || {},
            diseaseSummary: classifiedDiseases,
            districtSummary: districtSummary,
            details: details,
            activeSession: activeSession[0] || null
        });

    } catch (error) {
        console.error('Database error:', error);

        // Mock data for development
        return NextResponse.json({
            success: true,
            useMockData: true,
            date: new Date().toISOString().split('T')[0],
            totalStats: {
                affected_districts: 3,
                affected_facilities: 5,
                diseases_count: 4,
                total_patients: 127,
                total_reports: 12
            },
            diseaseSummary: [
                { disease_name: 'ไข้เลือดออก', report_count: 5, total_patients: 45, facilities_count: 4, severity: 'high' },
                { disease_name: 'ไข้หวัดใหญ่', report_count: 4, total_patients: 52, facilities_count: 3, severity: 'high' },
                { disease_name: 'อุจจาระร่วง', report_count: 2, total_patients: 20, facilities_count: 2, severity: 'medium' },
                { disease_name: 'มือ เท้า ปาก', report_count: 1, total_patients: 10, facilities_count: 1, severity: 'low' }
            ],
            districtSummary: [
                { district: 'เมืองสตูล', diseases_count: 4, facilities_count: 3, total_patients: 78, report_count: 7 },
                { district: 'ควนโดน', diseases_count: 2, facilities_count: 1, total_patients: 29, report_count: 3 },
                { district: 'ท่าแพ', diseases_count: 2, facilities_count: 1, total_patients: 20, report_count: 2 }
            ],
            details: [
                { id: 1, disease_name: 'ไข้หวัดใหญ่', patient_count: 25, facility_name: 'รพ.สต.บ้านควนโดน', district_name: 'ควนโดน', facility_type: 'รพ.สต.' },
                { id: 2, disease_name: 'ไข้เลือดออก', patient_count: 18, facility_name: 'โรงพยาบาลสตูล', district_name: 'เมืองสตูล', facility_type: 'รพ.' },
                { id: 3, disease_name: 'อุจจาระร่วง', patient_count: 12, facility_name: 'รพ.สต.ท่าแพ', district_name: 'ท่าแพ', facility_type: 'รพ.สต.' }
            ],
            activeSession: {
                id: 3,
                session_number: 3,
                disease_id: 1,
                disease_name: 'ไข้เลือดออก',
                opened_at: '2026-01-13T09:00:00.000Z',
                open_reason: 'พบการระบาดของไข้เลือดออกในพื้นที่',
                total_activities: 15,
                total_data_entries: 45,
                hours_open: 48,
                days_open: 1
            }
        });
    } finally {
        if (connection) connection.release();
    }
}

// Helper function to determine severity level
function getSeverityLevel(patientCount) {
    if (patientCount >= 50) return 'high';
    if (patientCount >= 20) return 'medium';
    return 'low';
}
