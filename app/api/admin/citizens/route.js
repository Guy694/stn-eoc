import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { requireAuth } from "@/lib/auth";

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
 * API: Get all citizens
 * GET /api/admin/citizens
 */
export async function GET(request) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const connection = await pool.getConnection();

        try {
            const [citizens] = await connection.execute(
                `SELECT 
                    id,
                    pid_hash,
                    title,
                    given_name,
                    family_name,
                    birthdate,
                    gender,
                    address,
                    phone,
                    created_at,
                    updated_at
                FROM citizens 
                ORDER BY created_at DESC`
            );

            connection.release();

            return NextResponse.json({
                success: true,
                citizens: citizens
            });

        } catch (dbError) {
            connection.release();
            throw dbError;
        }

    } catch (error) {
        console.error('Error fetching citizens:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
