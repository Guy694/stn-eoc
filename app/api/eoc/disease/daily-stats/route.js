import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { publicInternalError } from '@/lib/apiResponse';

// GET - ดึงสถิติโรครายวันสำหรับ EOC Session
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');

        // ดึงข้อมูล Session: ถ้าไม่ระบุ session_id ให้ใช้ session ล่าสุดที่มีรายงานโรค
        const sessionData = sessionId
            ? await query(`
                SELECT 
                    s.id,
                    s.session_number,
                    s.eoc_type,
                    s.status,
                    s.opened_at,
                    s.closed_at,
                    s.open_reason,
                    et.name_th as eoc_name
                FROM eoc_sessions s
                LEFT JOIN eoc_status et ON s.eoc_type = et.eoc_type
                WHERE s.id = ?
            `, [sessionId])
            : await query(`
                SELECT 
                    s.id,
                    s.session_number,
                    s.eoc_type,
                    s.status,
                    s.opened_at,
                    s.closed_at,
                    s.open_reason,
                    et.name_th as eoc_name
                FROM disease_reports dr
                JOIN eoc_sessions s ON dr.session_id = s.id
                LEFT JOIN eoc_status et ON s.eoc_type = et.eoc_type
                GROUP BY
                    s.id,
                    s.session_number,
                    s.eoc_type,
                    s.status,
                    s.opened_at,
                    s.closed_at,
                    s.open_reason,
                    et.name_th
                ORDER BY MAX(dr.report_date) DESC, s.opened_at DESC, s.id DESC
                LIMIT 1
            `);

        if (!sessionData || sessionData.length === 0) {
            return NextResponse.json({
                success: true,
                session: null,
                daily_data: [],
                diseases: [],
                summary: {
                    total_patients: 0,
                    total_reports: 0,
                    diseases_count: 0,
                    facilities_count: 0,
                    date_range: { start: null, end: null, days: 0 }
                },
                disease_stats: [],
                facility_stats: []
            });
        }

        const session = sessionData[0];
        const effectiveSessionId = session.id;

        // Format วันที่สำหรับ SQL (ใช้ local date เพื่อรองรับ timezone ไทย)
        const formatLocalDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        // ให้กราฟแสดงเต็มช่วงเปิด-ปิด EOC และเติมวันที่ไม่มีรายงานเป็น 0
        const startDate = new Date(session.opened_at);
        const endDate = session.closed_at
            ? new Date(session.closed_at)
            : new Date(); // ถ้ายังไม่ปิด ใช้วันปัจจุบัน

        const startDateStr = formatLocalDate(startDate);
        const endDateStr = formatLocalDate(endDate);

        // ดึงข้อมูลรายงานโรครายวัน
        const dailyData = await query(`
            SELECT 
                DATE(dr.report_date) as date,
                dr.disease_name,
                SUM(dr.patient_count) as patient_count,
                COUNT(DISTINCT COALESCE(
                    CONCAT('hf:', dr.health_facility_id),
                    CONCAT('v:', dr.village_polygon_id),
                    CONCAT('area:', dr.district_name, '|', dr.tambon_name, '|', dr.moo)
                )) as facilities_count
            FROM disease_reports dr
            WHERE dr.session_id = ?
                AND DATE(dr.report_date) BETWEEN ? AND ?
            GROUP BY DATE(dr.report_date), dr.disease_name
            ORDER BY DATE(dr.report_date) ASC, dr.disease_name ASC
        `, [effectiveSessionId, startDateStr, endDateStr]);

        // จัดกลุ่มข้อมูลตามวันที่
        const groupedByDate = {};
        const diseaseSet = new Set();

        dailyData.forEach(row => {
            // ใช้ formatLocalDate เพื่อให้วันที่ตรงกับ allDates
            const dateStr = formatLocalDate(new Date(row.date));

            if (!groupedByDate[dateStr]) {
                groupedByDate[dateStr] = {
                    date: dateStr,
                    diseases: [],
                    total: 0
                };
            }

            groupedByDate[dateStr].diseases.push({
                disease_name: row.disease_name,
                patient_count: parseInt(row.patient_count),
                facilities_count: parseInt(row.facilities_count)
            });

            groupedByDate[dateStr].total += parseInt(row.patient_count);
            diseaseSet.add(row.disease_name);
        });

        // สร้าง array ของวันที่ทั้งหมดในช่วง (รวมวันที่ไม่มีข้อมูล)
        const allDates = [];
        const currentDate = new Date(startDate);
        currentDate.setHours(0, 0, 0, 0); // Reset เวลาเป็น 00:00:00
        const endDateCompare = new Date(endDate);
        endDateCompare.setHours(23, 59, 59, 999); // Set เป็นสิ้นสุดวัน

        while (currentDate <= endDateCompare) {
            const dateStr = formatLocalDate(currentDate);
            allDates.push(dateStr);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // สร้างข้อมูลรายวันที่ครบถ้วน
        const completeDailyData = allDates.map(dateStr => {
            if (groupedByDate[dateStr]) {
                return groupedByDate[dateStr];
            } else {
                return {
                    date: dateStr,
                    diseases: [],
                    total: 0
                };
            }
        });

        // คำนวณสถิติสรุป
        const summaryStats = await query(`
            SELECT 
                COUNT(*) as total_reports,
                SUM(patient_count) as total_patients,
                COUNT(DISTINCT disease_name) as diseases_count,
                COUNT(DISTINCT COALESCE(
                    CONCAT('hf:', health_facility_id),
                    CONCAT('v:', village_polygon_id),
                    CONCAT('area:', district_name, '|', tambon_name, '|', moo)
                )) as facilities_count,
                MIN(report_date) as first_report_date,
                MAX(report_date) as last_report_date
            FROM disease_reports
            WHERE session_id = ?
                AND DATE(report_date) BETWEEN ? AND ?
        `, [effectiveSessionId, startDateStr, endDateStr]);

        // สถิติแยกตามโรค
        const diseaseStats = await query(`
            SELECT 
                disease_name,
                SUM(patient_count) as total_patients,
                COUNT(*) as report_count,
                COUNT(DISTINCT COALESCE(
                    CONCAT('hf:', health_facility_id),
                    CONCAT('v:', village_polygon_id),
                    CONCAT('area:', district_name, '|', tambon_name, '|', moo)
                )) as facilities_count,
                MIN(report_date) as first_report,
                MAX(report_date) as last_report
            FROM disease_reports
            WHERE session_id = ?
                AND DATE(report_date) BETWEEN ? AND ?
            GROUP BY disease_name
            ORDER BY SUM(patient_count) DESC
        `, [effectiveSessionId, startDateStr, endDateStr]);

        // สถิติแยกตามหน่วยบริการ
        const facilityStats = await query(`
            SELECT 
                hf.name as facility_name,
                hf.district_name,
                COUNT(*) as report_count,
                SUM(dr.patient_count) as total_patients,
                COUNT(DISTINCT dr.disease_name) as diseases_count
            FROM disease_reports dr
            JOIN health_facilities hf ON dr.health_facility_id = hf.id
            WHERE dr.session_id = ?
                AND DATE(dr.report_date) BETWEEN ? AND ?
            GROUP BY dr.health_facility_id
            ORDER BY SUM(dr.patient_count) DESC
            LIMIT 10
        `, [effectiveSessionId, startDateStr, endDateStr]);

        return NextResponse.json({
            success: true,
            session: {
                id: session.id,
                session_number: session.session_number,
                eoc_type: session.eoc_type,
                eoc_name: session.eoc_name,
                status: session.status,
                opened_at: session.opened_at,
                closed_at: session.closed_at
            },
            daily_data: completeDailyData,
            diseases: Array.from(diseaseSet),
            summary: {
                total_patients: parseInt(summaryStats[0]?.total_patients || 0),
                total_reports: parseInt(summaryStats[0]?.total_reports || 0),
                diseases_count: parseInt(summaryStats[0]?.diseases_count || 0),
                facilities_count: parseInt(summaryStats[0]?.facilities_count || 0),
                date_range: {
                    start: startDateStr,
                    end: endDateStr,
                    days: allDates.length
                }
            },
            disease_stats: diseaseStats.map(row => ({
                disease_name: row.disease_name,
                total_patients: parseInt(row.total_patients),
                report_count: parseInt(row.report_count),
                facilities_count: parseInt(row.facilities_count),
                first_report: row.first_report,
                last_report: row.last_report
            })),
            facility_stats: facilityStats.map(row => ({
                facility_name: row.facility_name,
                district_name: row.district_name,
                total_patients: parseInt(row.total_patients),
                report_count: parseInt(row.report_count),
                diseases_count: parseInt(row.diseases_count)
            }))
        });

    } catch (error) {
        console.error('Error fetching disease daily stats:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงสถิติโรครายวัน');
    }
}
