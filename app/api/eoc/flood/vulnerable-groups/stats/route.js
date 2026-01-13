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

// GET - ดึงสถิติกลุ่มเปราะบาง แยกตามตำบล, อำเภอ, และจังหวัด
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');

        if (!sessionId) {
            return NextResponse.json({
                success: false,
                error: 'session_id is required'
            }, { status: 400 });
        }

        connection = await pool.getConnection();

        const params = [sessionId];

        // สถิติรวมทั้งจังหวัด
        const [provinceStats] = await connection.execute(`
            SELECT 
                province,
                SUM(elderly) as total_elderly,
                SUM(children) as total_children,
                SUM(disabled) as total_disabled,
                SUM(bedridden) as total_bedridden,
                SUM(pregnant) as total_pregnant,
                SUM(chronic_illness) as total_chronic_illness,
                SUM(elderly + children + disabled + bedridden + pregnant + chronic_illness) as grand_total,
                COUNT(DISTINCT district) as district_count,
                COUNT(DISTINCT CONCAT(district, '-', tambon)) as tambon_count,
                COUNT(*) as village_count
            FROM vulnerable_groups
            WHERE session_id = ?
            GROUP BY province
        `, params);

        // สถิติรวมแต่ละอำเภอ
        const [districtStats] = await connection.execute(`
            SELECT 
                district,
                SUM(elderly) as total_elderly,
                SUM(children) as total_children,
                SUM(disabled) as total_disabled,
                SUM(bedridden) as total_bedridden,
                SUM(pregnant) as total_pregnant,
                SUM(chronic_illness) as total_chronic_illness,
                SUM(elderly + children + disabled + bedridden + pregnant + chronic_illness) as total,
                COUNT(DISTINCT CONCAT(district, '-', tambon)) as tambon_count,
                COUNT(*) as village_count
            FROM vulnerable_groups
            WHERE session_id = ?
            GROUP BY district
            ORDER BY district
        `, params);

        // สถิติรวมแต่ละตำบล
        const [tambonStats] = await connection.execute(`
            SELECT 
                district,
                tambon,
                SUM(elderly) as total_elderly,
                SUM(children) as total_children,
                SUM(disabled) as total_disabled,
                SUM(bedridden) as total_bedridden,
                SUM(pregnant) as total_pregnant,
                SUM(chronic_illness) as total_chronic_illness,
                SUM(elderly + children + disabled + bedridden + pregnant + chronic_illness) as total,
                COUNT(*) as village_count
            FROM vulnerable_groups
            WHERE session_id = ?
            GROUP BY district, tambon
            ORDER BY district, tambon
        `, params);

        return NextResponse.json({
            success: true,
            data: {
                province: provinceStats[0] || {
                    province: 'สตูล',
                    total_elderly: 0,
                    total_children: 0,
                    total_disabled: 0,
                    total_bedridden: 0,
                    total_pregnant: 0,
                    total_chronic_illness: 0,
                    grand_total: 0,
                    district_count: 0,
                    tambon_count: 0,
                    village_count: 0
                },
                districts: districtStats,
                tambons: tambonStats
            }
        });

    } catch (error) {
        console.error('Error fetching vulnerable groups stats:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
