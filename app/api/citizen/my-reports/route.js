import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getCitizenSession } from "@/lib/citizenAuth";

// Database Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

/**
 * API: Get incident reports submitted by a specific citizen
 * GET /api/citizen/my-reports
 */
export async function GET() {
    try {
        const session = await getCitizenSession();

        if (!session?.pidHash) {
            return NextResponse.json(
                { success: false, message: 'Authentication required' },
                { status: 401 }
            );
        }

        const connection = await pool.getConnection();

        try {
            const [citizens] = await connection.execute(
                'SELECT id, given_name, family_name FROM citizens WHERE pid_hash = ?',
                [session.pidHash]
            );

            if (citizens.length === 0) {
                return NextResponse.json(
                    { success: false, message: 'Citizen not found' },
                    { status: 404 }
                );
            }

            const citizen = citizens[0];

            const [reports] = await connection.execute(
                `SELECT 
                    id, 
                    disaster_type,
                    report_type,
                    status,
                    district,
                    sub_district,
                    village,
                    created_at,
                    occurred_at
                FROM public_incident_reports
                WHERE citizen_id = ? OR citizen_pid_hash = ?
                ORDER BY created_at DESC
                LIMIT 50`,
                [citizen.id, session.pidHash]
            );

            return NextResponse.json({
                success: true,
                reports: reports
            });

        } catch (dbError) {
            throw dbError;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Error fetching citizen reports:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
