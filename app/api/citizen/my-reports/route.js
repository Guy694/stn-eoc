import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

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
export async function GET(request) {
    try {
        const citizenId = request.headers.get('x-citizen-id');

        if (!citizenId) {
            return NextResponse.json(
                { success: false, message: 'Citizen ID is required' },
                { status: 400 }
            );
        }

        const connection = await pool.getConnection();

        try {
            // Query incident_reports where citizen_id matches
            // Note: This assumes we have a citizen_id field in incident_reports table
            // If not, we'll search by first_name and last_name matching the citizen's data

            // First, get citizen info
            const [citizens] = await connection.execute(
                'SELECT given_name, family_name FROM citizens WHERE id = ?',
                [citizenId]
            );

            if (citizens.length === 0) {
                connection.release();
                return NextResponse.json(
                    { success: false, message: 'Citizen not found' },
                    { status: 404 }
                );
            }

            const citizen = citizens[0];

            // Query reports by matching name
            // This is a temporary solution until we add citizen_id to incident_reports
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
                FROM incident_reports 
                WHERE first_name = ? AND last_name = ?
                ORDER BY created_at DESC
                LIMIT 50`,
                [citizen.given_name, citizen.family_name]
            );

            connection.release();

            return NextResponse.json({
                success: true,
                reports: reports
            });

        } catch (dbError) {
            connection.release();
            throw dbError;
        }

    } catch (error) {
        console.error('Error fetching citizen reports:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
