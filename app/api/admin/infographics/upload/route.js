import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { cookies } from 'next/headers';

export async function POST(request) {
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

        const formData = await request.formData();
        const eocType = formData.get('eocType');
        const files = formData.getAll('files');

        if (!eocType || !['flood', 'drought', 'tsunami', 'earthquake', 'disease'].includes(eocType)) {
            return NextResponse.json({
                success: false,
                message: 'ประเภท EOC ไม่ถูกต้อง'
            }, { status: 400 });
        }

        if (files.length === 0) {
            return NextResponse.json({
                success: false,
                message: 'ไม่มีไฟล์ที่จะอัปโหลด'
            }, { status: 400 });
        }

        // Create directory if not exists
        const uploadDir = path.join(process.cwd(), 'public', 'infographics', eocType);
        await mkdir(uploadDir, { recursive: true });

        const uploadedFiles = [];

        for (const file of files) {
            if (file.size === 0) continue;

            // Validate file type
            const fileType = file.type;
            if (!['image/png', 'image/jpeg', 'image/jpg'].includes(fileType)) {
                continue;
            }

            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                continue;
            }

            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            // Generate filename with timestamp
            const timestamp = Date.now();
            const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const filename = `${timestamp}_${originalName}`;
            const filepath = path.join(uploadDir, filename);

            await writeFile(filepath, buffer);
            uploadedFiles.push(filename);
        }

        if (uploadedFiles.length === 0) {
            return NextResponse.json({
                success: false,
                message: 'ไม่สามารถอัปโหลดไฟล์ได้ (ตรวจสอบประเภทและขนาดไฟล์)'
            }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: `อัปโหลดสำเร็จ ${uploadedFiles.length} ไฟล์`,
            files: uploadedFiles
        });

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปโหลด: ' + error.message
        }, { status: 500 });
    }
}
