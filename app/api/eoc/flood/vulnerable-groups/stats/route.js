import { NextResponse } from 'next/server';
import { OFFICER_ROLES, requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';
import { getPool } from "@/lib/db";
import { VULNERABLE_TYPES } from '@/lib/vulnerableEvent';

const TYPE_KEYS = VULNERABLE_TYPES.map((type) => type.key);
const SUM_COLUMNS = TYPE_KEYS.map((key) => `SUM(${key}) as total_${key}`).join(', ');
const SUM_ALL = `SUM(${TYPE_KEYS.map((key) => `COALESCE(${key}, 0)`).join(' + ')})`;
const ZERO_TOTALS = Object.fromEntries(TYPE_KEYS.map((key) => [`total_${key}`, 0]));

const pool = getPool();

async function tableExists(connection, tableName) {
    const [rows] = await connection.execute(
        `SELECT TABLE_NAME
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?`,
        [tableName]
    );
    return rows.length > 0;
}

// GET - ดึงสถิติกลุ่มเปราะบาง แยกตามตำบล, อำเภอ, และจังหวัด
export async function GET(request) {
    // ข้อมูลปฏิบัติการภายใน — เฉพาะเจ้าหน้าที่ที่เข้าสู่ระบบ
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;

    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');
        const source = searchParams.get('source'); // session, baseline

        if (!sessionId) {
            return NextResponse.json({
                success: false,
                error: 'session_id is required'
            }, { status: 400 });
        }

        connection = await pool.getConnection();

        let tableName = 'vulnerable_groups';
        let whereClause = 'session_id = ?';
        let params = [sessionId];
        let sourceType = 'session';

        if (source === 'baseline' || source === 'base') {
            if (!(await tableExists(connection, 'vulnerable_group_baselines'))) {
                return NextResponse.json({
                    success: true,
                    data: {
                        province: {
                            province: 'สตูล',
                            ...ZERO_TOTALS,
                            grand_total: 0,
                            district_count: 0,
                            tambon_count: 0,
                            village_count: 0
                        },
                        districts: [],
                        tambons: []
                    },
                    source: 'baseline'
                });
            }
            tableName = 'vulnerable_group_baselines';
            whereClause = '1=1';
            params = [];
            sourceType = 'baseline';
        } else {
            const [sessionCount] = await connection.execute(
                'SELECT COUNT(*) as count FROM vulnerable_groups WHERE session_id = ?',
                [sessionId]
            );

            if (sessionCount[0].count === 0 && await tableExists(connection, 'vulnerable_group_baselines')) {
                tableName = 'vulnerable_group_baselines';
                whereClause = '1=1';
                params = [];
                sourceType = 'baseline';
            }
        }

        // สถิติรวมทั้งจังหวัด
        const [provinceStats] = await connection.execute(`
            SELECT 
                province,
                ${SUM_COLUMNS},
                ${SUM_ALL} as grand_total,
                COUNT(DISTINCT district) as district_count,
                COUNT(DISTINCT CONCAT(district, '-', tambon)) as tambon_count,
                COUNT(*) as village_count
            FROM ${tableName}
            WHERE ${whereClause}
            GROUP BY province
        `, params);

        // สถิติรวมแต่ละอำเภอ
        const [districtStats] = await connection.execute(`
            SELECT 
                district,
                ${SUM_COLUMNS},
                ${SUM_ALL} as total,
                COUNT(DISTINCT CONCAT(district, '-', tambon)) as tambon_count,
                COUNT(*) as village_count
            FROM ${tableName}
            WHERE ${whereClause}
            GROUP BY district
            ORDER BY district
        `, params);

        // สถิติรวมแต่ละตำบล
        const [tambonStats] = await connection.execute(`
            SELECT 
                district,
                tambon,
                ${SUM_COLUMNS},
                ${SUM_ALL} as total,
                COUNT(*) as village_count
            FROM ${tableName}
            WHERE ${whereClause}
            GROUP BY district, tambon
            ORDER BY district, tambon
        `, params);

        return NextResponse.json({
            success: true,
            data: {
                province: provinceStats[0] || {
                    province: 'สตูล',
                    ...ZERO_TOTALS,
                    grand_total: 0,
                    district_count: 0,
                    tambon_count: 0,
                    village_count: 0
                },
                districts: districtStats,
                tambons: tambonStats
            },
            source: sourceType
        });

    } catch (error) {
        console.error('Error fetching vulnerable groups stats:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงสถิติกลุ่มเปราะบาง');
    } finally {
        if (connection) connection.release();
    }
}
