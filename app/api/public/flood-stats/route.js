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

        // ดึงข้อมูลสถิติน้ำท่วมจาก flood_records
        let baseQuery = 'FROM flood_records WHERE 1=1';
        const params = [];

        if (sessionId) {
            baseQuery += ' AND session_id = ?';
            params.push(sessionId);
        }

        // นับจำนวนพื้นที่ที่ได้รับผลกระทบ (ตำบลที่มีน้ำท่วม)
        const [affectedAreas] = await connection.execute(
            `SELECT COUNT(DISTINCT CONCAT(district, '-', tambon)) as count ${baseQuery} AND flood_level != 'ไม่มี'`,
            params
        );

        // นับจำนวนผู้ได้รับผลกระทบ
        const [affectedPeople] = await connection.execute(
            `SELECT COALESCE(SUM(affected_people), 0) as total ${baseQuery}`,
            params
        );

        // นับจำนวนครัวเรือนที่ได้รับผลกระทบ
        const [affectedHouseholds] = await connection.execute(
            `SELECT COALESCE(SUM(affected_households), 0) as total ${baseQuery}`,
            params
        );

        // นับจำนวนหมู่บ้านที่มีน้ำท่วม
        const [floodedVillages] = await connection.execute(
            `SELECT COUNT(DISTINCT polygon_id) as count ${baseQuery} AND flood_level != 'ไม่มี'`,
            params
        );

        // สรุปตามระดับน้ำท่วม
        const [floodLevelSummary] = await connection.execute(
            `SELECT flood_level, COUNT(*) as count ${baseQuery} GROUP BY flood_level`,
            params
        );

        // ดึงจุดพักพิง (if table exists)
        let sheltersCount = 0;
        try {
            const [shelters] = await connection.execute(
                'SELECT COUNT(*) as count FROM shelters WHERE is_active = 1'
            );
            sheltersCount = shelters[0]?.count || 0;
        } catch (e) {
            // Table might not exist
            sheltersCount = 0;
        }

        await connection.end();

        return NextResponse.json({
            success: true,
            data: {
                affected: affectedPeople[0]?.total || 0,
                affectedHouseholds: affectedHouseholds[0]?.total || 0,
                affectedAreas: affectedAreas[0]?.count || 0,
                floodedVillages: floodedVillages[0]?.count || 0,
                shelters: sheltersCount,
                floodLevelSummary: floodLevelSummary.reduce((acc, item) => {
                    acc[item.flood_level] = item.count;
                    return acc;
                }, {})
            }
        });

    } catch (error) {
        console.error('Error fetching flood stats:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
            data: {
                affected: 0,
                affectedHouseholds: 0,
                affectedAreas: 0,
                floodedVillages: 0,
                shelters: 0,
                floodLevelSummary: {}
            }
        }, { status: 500 });
    }
}
