import { NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import path from 'path';
import { cookies } from 'next/headers';

export async function DELETE(request) {
    try {
        // Check authentication
        const cookieStore = cookies();
        const token = cookieStore.get('token');

        if (!token) {
            return NextResponse.json({
                success: false,
                message: 'ไม่ได้รับอนุญาต'
            }, { status: 401 });
        }

        const { eocType, filename } = await request.json();

        if (!eocType || !filename) {
            return NextResponse.json({
                success: false,
                message: 'ข้อมูลไม่ครบถ้วน'
            }, { status: 400 });
        }

        if (!['flood', 'drought', 'tsunami', 'earthquake', 'disease'].includes(eocType)) {
            return NextResponse.json({
                success: false,
                message: 'ประเภท EOC ไม่ถูกต้อง'
            }, { status: 400 });
        }

        // Validate filename to prevent path traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return NextResponse.json({
                success: false,
                message: 'ชื่อไฟล์ไม่ถูกต้อง'
            }, { status: 400 });
        }

        const filepath = path.join(process.cwd(), 'public', 'infographics', eocType, filename);

        await unlink(filepath);

        return NextResponse.json({
            success: true,
            message: 'ลบไฟล์สำเร็จ'
        });

    } catch (error) {
        console.error('Delete error:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบไฟล์: ' + error.message
        }, { status: 500 });
    }
}
