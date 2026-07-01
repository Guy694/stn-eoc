import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { requireAuth } from '@/lib/auth';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export async function PUT(request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const { title, givenName, familyName, email, phone, department, position } = body;
        const userId = auth.user.id;

        // Validation
        if (!givenName || !familyName) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกชื่อและนามสกุล' },
                { status: 400 }
            );
        }

        const connection = await pool.getConnection();

        try {
            // อัพเดทข้อมูล officer
            const [result] = await connection.execute(
                `UPDATE officer 
                SET title = ?, 
                    given_name = ?, 
                    family_name = ?, 
                    email = ?, 
                    phone = ?, 
                    department = ?, 
                    position = ?
                WHERE id = ?`,
                [title, givenName, familyName, email, phone, department, position, userId]
            );

            if (result.affectedRows === 0) {
                connection.release();
                return NextResponse.json(
                    { success: false, message: 'ไม่พบข้อมูลผู้ใช้ในระบบ' },
                    { status: 404 }
                );
            }

            // ดึงข้อมูลที่อัพเดทแล้ว
            const [officers] = await connection.execute(
                'SELECT id, username, title, given_name, family_name, email, phone, role, department, position FROM officer WHERE id = ?',
                [userId]
            );

            connection.release();

            if (officers.length === 0) {
                return NextResponse.json(
                    { success: false, message: 'ไม่สามารถดึงข้อมูลที่อัพเดทได้' },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                message: 'อัพเดทข้อมูลสำเร็จ',
                data: officers[0]
            });

        } catch (error) {
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Error updating profile:', error);
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาดในการอัพเดทข้อมูล' },
            { status: 500 }
        );
    }
}
