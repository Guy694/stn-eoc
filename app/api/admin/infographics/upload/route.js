import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { requireAuth } from '@/lib/auth';
import { createRandomFilename, resolveInside, validateImageFile } from '@/lib/fileUpload';
import { publicInternalError } from '@/lib/apiResponse';

const MAX_INFOGRAPHIC_SIZE_BYTES = 10 * 1024 * 1024;
const INFOGRAPHIC_IMAGE_TYPES = new Map([
    ['image/jpeg', 'jpg'],
    ['image/jpg', 'jpg'],
    ['image/png', 'png']
]);

export async function POST(request) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

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
        const uploadBaseDir = path.join(process.cwd(), 'public', 'infographics');
        const uploadDir = resolveInside(uploadBaseDir, eocType);
        await mkdir(uploadDir, { recursive: true });

        const uploadedFiles = [];

        for (const file of files) {
            const validation = await validateImageFile(file, {
                maxSizeBytes: MAX_INFOGRAPHIC_SIZE_BYTES,
                allowedTypes: INFOGRAPHIC_IMAGE_TYPES
            });
            if (!validation.ok) {
                continue;
            }

            // Generate filename with timestamp
            const filename = createRandomFilename(validation.extension);
            const filepath = resolveInside(uploadDir, filename);

            await writeFile(filepath, validation.buffer);
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
        return publicInternalError('เกิดข้อผิดพลาดในการอัปโหลด');
    }
}
