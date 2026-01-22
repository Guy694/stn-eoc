import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

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
 * API: Promote citizen to officer
 * POST /api/admin/citizens/promote
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { citizen_id, role, position, department, username } = body;

        // Validate required fields
        if (!citizen_id || !role || !username) {
            return NextResponse.json(
                { success: false, message: 'citizen_id, role, and username are required' },
                { status: 400 }
            );
        }

        const connection = await pool.getConnection();

        try {
            // Start transaction
            await connection.beginTransaction();

            // 1. Fetch citizen data
            const [citizens] = await connection.execute(
                'SELECT * FROM citizens WHERE id = ?',
                [citizen_id]
            );

            if (citizens.length === 0) {
                await connection.rollback();
                connection.release();
                return NextResponse.json(
                    { success: false, message: 'Citizen not found' },
                    { status: 404 }
                );
            }

            const citizen = citizens[0];

            // 2. Check if username already exists
            const [existingOfficers] = await connection.execute(
                'SELECT id FROM officer WHERE username = ?',
                [username]
            );

            if (existingOfficers.length > 0) {
                await connection.rollback();
                connection.release();
                return NextResponse.json(
                    { success: false, message: 'Username already exists' },
                    { status: 409 }
                );
            }

            // 3. Check if PID already exists in officer table
            const [existingPID] = await connection.execute(
                'SELECT id FROM officer WHERE pid_hash = ?',
                [citizen.pid_hash]
            );

            if (existingPID.length > 0) {
                await connection.rollback();
                connection.release();
                return NextResponse.json(
                    { success: false, message: 'This citizen is already an officer' },
                    { status: 409 }
                );
            }

            // 4. Generate a temporary password (user should change it on first login)
            const tempPassword = Math.random().toString(36).slice(-8);
            const passwordHash = await bcrypt.hash(tempPassword, 10);

            // 5. Insert into officer table
            const [result] = await connection.execute(
                `INSERT INTO officer 
                (username, password_hash, title, given_name, family_name, role, pid_hash, 
                position, department, is_approved, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())`,
                [
                    username,
                    passwordHash,
                    citizen.title,
                    citizen.given_name,
                    citizen.family_name,
                    role,
                    citizen.pid_hash,
                    position || null,
                    department || null
                ]
            );

            // 6. Delete from citizens table
            await connection.execute(
                'DELETE FROM citizens WHERE id = ?',
                [citizen_id]
            );

            // 7. Log activity
            try {
                await connection.execute(
                    `INSERT INTO activity_logs 
                    (user_id, action_type, details, timestamp) 
                    VALUES (?, ?, ?, NOW())`,
                    [
                        result.insertId,
                        'PROMOTE',
                        `Promoted citizen ${citizen.given_name} ${citizen.family_name} to officer with role ${role}`
                    ]
                );
            } catch (logError) {
                console.error('Failed to log activity:', logError);
                // Don't fail the whole operation if logging fails
            }

            // Commit transaction
            await connection.commit();
            connection.release();

            return NextResponse.json({
                success: true,
                message: 'Citizen promoted to officer successfully',
                officer_id: result.insertId,
                temporary_password: tempPassword // Return temp password to show to admin
            });

        } catch (dbError) {
            await connection.rollback();
            connection.release();
            throw dbError;
        }

    } catch (error) {
        console.error('Error promoting citizen:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error', error: error.message },
            { status: 500 }
        );
    }
}
