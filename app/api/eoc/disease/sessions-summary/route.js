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

// GET - ดึงข้อมูลสรุป sessions ของ disease EOC
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const year = searchParams.get('year') || new Date().getFullYear();

        connection = await pool.getConnection();
        const hasDiseaseColumns = await hasDiseaseSubtypeColumns(connection);
        const diseaseSubtypeSelect = hasDiseaseColumns
            ? `es.disease_id, es.disease_name,`
            : `NULL as disease_id, NULL as disease_name,`;

        // ดึงข้อมูล sessions ทั้งหมดของปีที่เลือก
        const [sessions] = await connection.execute(`
            SELECT 
                es.id,
                es.session_number,
                es.eoc_type,
                ${diseaseSubtypeSelect}
                es.status,
                es.opened_at,
                es.closed_at,
                es.open_reason,
                es.close_reason,
                es.total_activities,
                es.total_data_entries,
                TIMESTAMPDIFF(DAY, es.opened_at, COALESCE(es.closed_at, NOW())) as duration_days,
                (SELECT COUNT(*) FROM disease_reports dr WHERE dr.session_id = es.id) as reports_count,
                (SELECT COALESCE(SUM(patient_count), 0) FROM disease_reports dr WHERE dr.session_id = es.id) as total_patients
            FROM eoc_sessions es
            WHERE es.eoc_type = 'disease' AND YEAR(es.opened_at) = ?
            ORDER BY es.opened_at DESC
        `, [year]);

        // สรุปรายปี
        const [yearSummary] = await connection.execute(`
            SELECT 
                COUNT(*) as total_sessions,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_sessions,
                SUM(total_activities) as total_activities,
                SUM(total_data_entries) as total_data_entries,
                (
                    SELECT COALESCE(SUM(dr.patient_count), 0) 
                    FROM disease_reports dr 
                    JOIN eoc_sessions es2 ON dr.session_id = es2.id 
                    WHERE es2.eoc_type = 'disease' AND YEAR(es2.opened_at) = ?
                ) as total_patients
            FROM eoc_sessions es
            WHERE es.eoc_type = 'disease' AND YEAR(es.opened_at) = ?
        `, [year, year]);

        // ดึงปีที่มีข้อมูล
        const [availableYears] = await connection.execute(`
            SELECT DISTINCT YEAR(opened_at) as year 
            FROM eoc_sessions 
            WHERE eoc_type = 'disease'
            ORDER BY year DESC
        `);

        return NextResponse.json({
            success: true,
            year: parseInt(year),
            yearSummaries: [{
                year: parseInt(year),
                ...yearSummary[0],
                sessions: sessions
            }],
            availableYears: availableYears.map(y => y.year)
        });

    } catch (error) {
        console.error('Database error:', error);

        // Mock data
        const currentYear = new Date().getFullYear();
        return NextResponse.json({
            success: true,
            useMockData: true,
            year: currentYear,
            yearSummaries: [{
                year: currentYear,
                total_sessions: 3,
                active_sessions: 1,
                total_activities: 45,
                total_data_entries: 120,
                total_patients: 350,
                sessions: [
                    {
                        id: 3,
                        session_number: 3,
                        eoc_type: 'disease',
                        disease_id: 1,
                        disease_name: 'ไข้เลือดออก',
                        status: 'active',
                        opened_at: '2026-01-13T09:00:00.000Z',
                        closed_at: null,
                        open_reason: 'พบการระบาดของไข้เลือดออกในพื้นที่',
                        duration_days: 1,
                        reports_count: 12,
                        total_patients: 127
                    },
                    {
                        id: 2,
                        session_number: 2,
                        eoc_type: 'disease',
                        disease_id: 4,
                        disease_name: 'ไข้หวัดใหญ่',
                        status: 'closed',
                        opened_at: '2025-08-01T09:00:00.000Z',
                        closed_at: '2025-08-15T17:00:00.000Z',
                        open_reason: 'การระบาดของไข้หวัดใหญ่',
                        duration_days: 14,
                        reports_count: 45,
                        total_patients: 180
                    }
                ]
            }],
            availableYears: [2026, 2025]
        });
    } finally {
        if (connection) connection.release();
    }
}
