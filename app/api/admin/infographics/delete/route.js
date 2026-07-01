import { NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import path from 'path';
import { requireAuth } from '@/lib/auth';
import { isSafeFilename, resolveInside } from '@/lib/fileUpload';
import { publicInternalError } from '@/lib/apiResponse';

export async function DELETE(request) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

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
        if (!isSafeFilename(filename) || !/\.(jpg|jpeg|png)$/i.test(filename)) {
            return NextResponse.json({
                success: false,
                message: 'ชื่อไฟล์ไม่ถูกต้อง'
            }, { status: 400 });
        }

        const uploadBaseDir = path.join(process.cwd(), 'public', 'infographics');
        const filepath = resolveInside(uploadBaseDir, eocType, filename);

        await unlink(filepath);

        return NextResponse.json({
            success: true,
            message: 'ลบไฟล์สำเร็จ'
        });

    } catch (error) {
        console.error('Delete error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการลบไฟล์');
    }
}
