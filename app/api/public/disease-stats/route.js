import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
};

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');

        const connection = await mysql.createConnection(dbConfig);

        // หา session_id ถ้าไม่ได้ระบุ ให้ใช้ active session
        let activeSessionId = sessionId;
        if (!activeSessionId) {
            const [sessionResult] = await connection.execute(`
                SELECT id FROM eoc_sessions 
                WHERE eoc_type = 'disease' AND status = 'active' 
                LIMIT 1
            `);
            if (sessionResult.length > 0) {
                activeSessionId = sessionResult[0].id;
            }
        }

        if (!activeSessionId) {
            await connection.end();
            return NextResponse.json({
                success: true,
                data: {
                    patients: 0,
                    affectedFacilities: 0,
                    teams: 0,
                    affectedDistricts: 0
                }
            });
        }

        // นับจำนวนผู้ป่วยรวม
        const [patientCount] = await connection.execute(
            'SELECT COALESCE(SUM(patient_count), 0) as total FROM disease_reports WHERE session_id = ?',
            [activeSessionId]
        );

        // นับจำนวนสถานพยาบาลที่มีรายงาน
        const [facilityCount] = await connection.execute(
            'SELECT COUNT(DISTINCT health_facility_id) as count FROM disease_reports WHERE session_id = ?',
            [activeSessionId]
        );

        // นับอำเภอที่ได้รับผลกระทบ
        const [districtCount] = await connection.execute(`
            SELECT COUNT(DISTINCT hf.district_name) as count
            FROM disease_reports dr
            JOIN health_facilities hf ON dr.health_facility_id = hf.id
            WHERE dr.session_id = ?
        `, [activeSessionId]);

        // นับจำนวนโรคที่พบ
        const [diseaseCount] = await connection.execute(
            'SELECT COUNT(DISTINCT disease_name) as count FROM disease_reports WHERE session_id = ?',
            [activeSessionId]
        );

        // นับสถานพยาบาลทั้งหมดในระบบ
        let totalHospitals = 0;
        try {
            const [hospitals] = await connection.execute(
                "SELECT COUNT(*) as count FROM health_facilities WHERE facility_type LIKE '%hospital%' OR facility_type LIKE '%รพ%' OR facility_type LIKE '%โรง%'"
            );
            totalHospitals = hospitals[0]?.count || 0;
        } catch (e) {
            // Fallback: นับทั้งหมด
            try {
                const [all] = await connection.execute('SELECT COUNT(*) as count FROM health_facilities');
                totalHospitals = all[0]?.count || 0;
            } catch (e2) {
                totalHospitals = 0;
            }
        }

        await connection.end();

        return NextResponse.json({
            success: true,
            data: {
                patients: patientCount[0]?.total || 0,
                affectedFacilities: facilityCount[0]?.count || 0,
                affectedDistricts: districtCount[0]?.count || 0,
                hospitals: totalHospitals,
                diseases: diseaseCount[0]?.count || 0
            }
        });

    } catch (error) {
        console.error('Error fetching disease stats:', error);
        return NextResponse.json({
            success: true,
            data: {
                patients: 0,
                affectedFacilities: 0,
                affectedDistricts: 0,
                hospitals: 0,
                diseases: 0
            }
        });
    }
}
