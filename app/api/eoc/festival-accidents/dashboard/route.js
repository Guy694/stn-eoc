import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { publicInternalError } from '@/lib/apiResponse';

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

// GET - ดึงข้อมูลรวมสำหรับ Festival Dashboard
export async function GET(request) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');
        const festivalType = searchParams.get('festival_type'); // newyear | songkran

        connection = await pool.getConnection();

        // ตรวจสอบว่ามีคอลัมน์ festival_type หรือยัง
        let hasFestivalType = false;
        try {
            const [cols] = await connection.execute(
                `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'eoc_sessions' AND COLUMN_NAME = 'festival_type'`
            );
            hasFestivalType = cols.length > 0;
        } catch { hasFestivalType = false; }

        const festivalCol = hasFestivalType ? 'festival_type,' : '';

        // ดึง session ที่ต้องการ
        let activeSession = null;
        let activeSessionId = sessionId;

        if (activeSessionId) {
            const [sessionResult] = await connection.execute(
                `SELECT id, session_number, eoc_type, ${festivalCol} status, opened_at, closed_at, open_reason 
                 FROM eoc_sessions WHERE id = ?`,
                [activeSessionId]
            );
            if (sessionResult.length > 0) activeSession = sessionResult[0];
        } else {
            // ดึง active session ตาม festival_type
            let sessionQuery = `
                SELECT id, session_number, eoc_type, ${festivalCol} status, opened_at, closed_at, open_reason 
                FROM eoc_sessions 
                WHERE eoc_type = 'festival-accidents' AND status = 'active'
            `;
            const sessionParams = [];
            if (festivalType && hasFestivalType) {
                sessionQuery += ' AND festival_type = ?';
                sessionParams.push(festivalType);
            }
            sessionQuery += ' ORDER BY opened_at DESC LIMIT 1';

            const [sessionResult] = await connection.execute(sessionQuery, sessionParams);
            if (sessionResult.length > 0) {
                activeSession = sessionResult[0];
                activeSessionId = activeSession.id;
            }
        }

        // ดึงรายการทุก sessions (สำหรับ dropdown)
        let sessionsQuery = `
            SELECT id, session_number, ${festivalCol} status, opened_at, closed_at, open_reason
            FROM eoc_sessions 
            WHERE eoc_type = 'festival-accidents'
        `;
        const sessionsParams = [];
        if (festivalType && hasFestivalType) {
            sessionsQuery += ' AND festival_type = ?';
            sessionsParams.push(festivalType);
        }
        sessionsQuery += ' ORDER BY opened_at DESC';
        const [allSessions] = await connection.execute(sessionsQuery, sessionsParams);

        if (!activeSessionId) {
            return NextResponse.json({
                success: true,
                hasActiveSession: false,
                sessions: allSessions,
                message: 'ไม่มี EOC Session ที่เปิดอยู่'
            });
        }

        // ดึงข้อมูลอุบัติเหตุทั้งหมดใน session
        const [accidents] = await connection.execute(
            'SELECT * FROM accident_reports WHERE session_id = ? ORDER BY report_date, report_time',
            [activeSessionId]
        );

        // สรุปสถิติรวม
        const totalAccidents = accidents.length;
        const totalDeaths = accidents.reduce((s, a) => s + (a.deaths || 0), 0);
        const totalInjuries = accidents.reduce((s, a) => s + (a.injuries || 0), 0);
        const drunkCases = accidents.filter(a => a.drunk_driving).length;
        const noHelmetCases = accidents.filter(a => a.no_helmet).length;
        const noSeatbeltCases = accidents.filter(a => a.no_seatbelt).length;
        const speedingCases = accidents.filter(a => a.speeding).length;

        // สถิติรายวัน
        const dailyMap = {};
        accidents.forEach(a => {
            const dateKey = a.report_date ? new Date(a.report_date).toISOString().split('T')[0] : 'unknown';
            if (!dailyMap[dateKey]) {
                dailyMap[dateKey] = { date: dateKey, accidents: 0, deaths: 0, injuries: 0, drunk: 0 };
            }
            dailyMap[dateKey].accidents++;
            dailyMap[dateKey].deaths += (a.deaths || 0);
            dailyMap[dateKey].injuries += (a.injuries || 0);
            if (a.drunk_driving) dailyMap[dateKey].drunk++;
        });
        const dailySummary = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

        // สถิติตามประเภทอุบัติเหตุ
        const typeMap = {};
        accidents.forEach(a => {
            const type = a.accident_type || 'อื่นๆ';
            typeMap[type] = (typeMap[type] || 0) + 1;
        });
        const accidentTypeBreakdown = Object.entries(typeMap).map(([type, count]) => ({ type, count }));

        // สถิติตามอำเภอ
        const districtMap = {};
        accidents.forEach(a => {
            const dist = a.district || 'ไม่ระบุ';
            if (!districtMap[dist]) {
                districtMap[dist] = { district: dist, accidents: 0, deaths: 0, injuries: 0 };
            }
            districtMap[dist].accidents++;
            districtMap[dist].deaths += (a.deaths || 0);
            districtMap[dist].injuries += (a.injuries || 0);
        });
        const districtBreakdown = Object.values(districtMap).sort((a, b) => b.accidents - a.accidents);

        // สรุปปัจจัยเสี่ยง
        const causeAnalysis = [
            { cause: 'เมาแล้วขับ', count: drunkCases, icon: '🍺', color: 'purple' },
            { cause: 'ไม่สวมหมวกกันน็อค', count: noHelmetCases, icon: '⛑', color: 'orange' },
            { cause: 'ไม่คาดเข็มขัด', count: noSeatbeltCases, icon: '🪢', color: 'yellow' },
            { cause: 'ขับรถเร็ว', count: speedingCases, icon: '🚀', color: 'red' },
        ];

        // จุดบริการชั่วคราว
        let checkpointCount = 0;
        let servicePointsData = [];
        try {
            const [checkpoints] = await connection.execute(
                'SELECT * FROM temporary_service_points WHERE session_id = ? AND is_active = 1',
                [activeSessionId]
            );
            checkpointCount = checkpoints.length;
            servicePointsData = checkpoints;
        } catch { checkpointCount = 0; }

        // 5 เหตุการณ์ล่าสุด
        const recentAccidents = accidents.slice(-5).reverse();

        return NextResponse.json({
            success: true,
            hasActiveSession: true,
            activeSession,
            sessions: allSessions,
            stats: {
                totalAccidents,
                totalDeaths,
                totalInjuries,
                drunkCases,
                checkpoints: checkpointCount
            },
            dailySummary,
            accidentTypeBreakdown,
            districtBreakdown,
            causeAnalysis,
            recentAccidents,
            mapData: {
                accidents: accidents,
                servicePoints: servicePointsData
            }
        });

    } catch (error) {
        console.error('Festival dashboard error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลแดชบอร์ดเทศกาล');
    } finally {
        if (connection) connection.release();
    }
}
