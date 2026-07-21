import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';
import bcrypt from 'bcryptjs';
import { SYSTEM_ROLE_CODES } from '@/lib/eocRoles';

const SYSTEM_ROLES = new Set(SYSTEM_ROLE_CODES);

// GET - ดึงรายการเจ้าหน้าที่ทั้งหมด
export async function GET(request) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const role = searchParams.get('role');
        const search = searchParams.get('search');

        let sql = `
            SELECT 
                id, 
                username, 
                title,
                given_name, 
                family_name,
                CONCAT(COALESCE(title, ''), given_name, ' ', family_name) as full_name,
                email, 
                phone, 
                role,
                department,
                requested_role,
                is_approved,
                created_at,
                updated_at
            FROM officer
            WHERE 1=1
        `;
        const params = [];

        if (role) {
            sql += ' AND role = ?';
            params.push(role);
        }

        if (search) {
            sql += ' AND (given_name LIKE ? OR family_name LIKE ? OR username LIKE ? OR email LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY created_at DESC';

        const officers = await query(sql, params);

        // นับจำนวนตาม role
        const roleCounts = await query(`
            SELECT role, COUNT(*) as count 
            FROM officer 
            GROUP BY role
        `);

        const stats = roleCounts.reduce((acc, item) => {
            acc[item.role] = item.count;
            return acc;
        }, {});

        return NextResponse.json({
            success: true,
            data: officers,
            officers: officers,
            stats: stats,
            total: officers.length
        });

    } catch (error) {
        console.error('Error fetching officers:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลเจ้าหน้าที่');
    }
}

// POST - เพิ่มเจ้าหน้าที่ใหม่
export async function POST(request) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const { username, password, title, given_name, family_name, email, phone, role } = body;

        // Validate required fields
        if (!username || !password || !given_name || !family_name || !role) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        if (!SYSTEM_ROLES.has(role)) {
            return NextResponse.json(
                { success: false, error: 'บทบาทสิทธิ์ระบบไม่ถูกต้อง' },
                { status: 400 }
            );
        }

        // ตรวจสอบว่า username ซ้ำหรือไม่
        const existing = await query(
            'SELECT id FROM officer WHERE username = ?',
            [username]
        );

        if (existing.length > 0) {
            return NextResponse.json(
                { success: false, error: 'Username already exists' },
                { status: 409 }
            );
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 10);

        // Insert new officer
        const result = await query(`
            INSERT INTO officer (username, password_hash, title, given_name, family_name, email, phone, role, requested_role, is_approved)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [username, password_hash, title, given_name, family_name, email, phone, role, role]);

        // ดึงข้อมูลที่เพิ่งสร้าง
        const newOfficer = await query(
            'SELECT id, username, title, given_name, family_name, email, phone, role, requested_role, is_approved, created_at FROM officer WHERE id = ?',
            [result.insertId]
        );

        return NextResponse.json({
            success: true,
            message: 'Officer created successfully',
            data: newOfficer[0]
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating officer:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการเพิ่มเจ้าหน้าที่');
    }
}
