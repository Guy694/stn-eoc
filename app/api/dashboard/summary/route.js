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
                activeSessions: [],
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
        let activeSessions = [];
        let announcements = [];
        let recentActivities = [];

        // 1. นับจำนวน EOC ที่เปิดอยู่
        try {
            const [activeEOCs] = await connection.execute(`
                SELECT COUNT(*) as count FROM eoc_status WHERE is_active = 1
            `);
            activeEOCsCount = activeEOCs[0]?.count || 0;
        } catch {
        }

        // 2. นับจำนวนทีมที่ active
        try {
            const [activeTeams] = await connection.execute(`
                SELECT COUNT(DISTINCT team_id) as count 
                FROM eoc_team_modules 
                WHERE is_active = 1
            `);
            activeTeamsCount = activeTeams[0]?.count || 0;
        } catch (e) {
            try {
                const [teams] = await connection.execute(`
                    SELECT COUNT(*) as count FROM eoc_teams WHERE is_active = 1
                `);
                activeTeamsCount = teams[0]?.count || 0;
            } catch {
            }
        }

        // 3. นับรายงานวันนี้ (activity_logs)
        try {
            const [todayReports] = await connection.execute(`
                SELECT COUNT(*) as count 
                FROM activity_logs 
                WHERE DATE(created_at) = CURDATE()
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
                    sess.opened_at
                FROM eoc_status es
                LEFT JOIN eoc_sessions sess ON es.eoc_type = sess.eoc_type AND sess.status = 'active'
                WHERE es.is_active = 1
            `);
            activeSessions = sessions;
        } catch {
        }

        // 5. คำนวณผู้ได้รับผลกระทบจากข้อมูลน้ำท่วมล่าสุด (ถ้ามี)
        try {
            const [floodSession] = await connection.execute(`
                SELECT id FROM eoc_sessions 
                WHERE eoc_type = 'flood' AND status = 'active' 
                LIMIT 1
            `);

            if (floodSession.length > 0) {
                const [affectedData] = await connection.execute(`
                    SELECT COALESCE(SUM(affected_people), 0) as total
                    FROM daily_flood_village
                    WHERE session_id = ?
                `, [floodSession[0].id]);
                totalAffected = affectedData[0]?.total || 0;
            }
        } catch {
        }

        // 6. ดึงประกาศล่าสุด 3 รายการ
        try {
            const [announcementData] = await connection.execute(`
                SELECT id, title, content, priority, created_at
                FROM announcements
                WHERE is_active = 1
                ORDER BY priority DESC, created_at DESC
                LIMIT 3
            `);
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

        return NextResponse.json({
            success: true,
            data: {
                activeEOCs: activeEOCsCount,
                activeTeams: activeTeamsCount,
                todayReports: todayReportsCount,
                totalAffected: totalAffected,
                activeSessions: activeSessions,
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
                activeSessions: [],
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
        'eoc_activate': '🚨',
        'eoc_deactivate': '✅',
        'create': '➕',
        'update': '✏️',
        'delete': '🗑️',
        'login': '🔐',
        'logout': '🚪',
        'report': '📝',
        'flood_record': '💧',
        'disease_report': '🦠'
    };
    return icons[actionType] || '📋';
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
        'flood_record': 'บันทึกน้ำท่วม',
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
