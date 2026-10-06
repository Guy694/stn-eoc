import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { publicInternalError } from '@/lib/apiResponse';

// ยอดเข้าชมรวมของเว็บไซต์ (ไม่เก็บ IP หรือข้อมูลส่วนบุคคล)
// ตาราง site_statistics สร้างจาก migrations/create_site_statistics.sql
async function readTotalVisits() {
    const rows = await query(
        `SELECT metric_value FROM site_statistics WHERE metric_key = 'total_visits' LIMIT 1`
    );
    return Number(rows[0]?.metric_value || 0);
}

async function recordVisit() {
    // นับทั้งยอดสะสมและยอดรายวัน โดยไม่เก็บ IP, cookie หรือข้อมูลระบุตัวบุคคล
    await query(
        `INSERT INTO site_statistics (metric_key, metric_value)
         VALUES ('total_visits', 1)
         ON DUPLICATE KEY UPDATE metric_value = metric_value + 1`
    );
    await query(
        `INSERT INTO site_visit_daily (visit_date, visit_count)
         VALUES (CURDATE(), 1)
         ON DUPLICATE KEY UPDATE visit_count = visit_count + 1`
    );
}

export async function GET() {
    try {
        return NextResponse.json({ success: true, data: { total_visits: await readTotalVisits() } });
    } catch (error) {
        console.error('Get site views error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงยอดเข้าชมเว็บไซต์');
    }
}

export async function POST() {
    try {
        await recordVisit();
        return NextResponse.json({ success: true, data: { total_visits: await readTotalVisits() } });
    } catch (error) {
        console.error('Record site view error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการบันทึกยอดเข้าชมเว็บไซต์');
    }
}
