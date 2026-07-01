import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import path from 'path';
import { requireAuth } from '@/lib/auth';
import { isSafeFilename, resolveInside } from '@/lib/fileUpload';
import { publicInternalError } from '@/lib/apiResponse';

export async function GET(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const eocTypes = ['flood', 'drought', 'tsunami', 'earthquake', 'disease'];
        const files = {};

        for (const eocType of eocTypes) {
            const dirPath = resolveInside(path.join(process.cwd(), 'public', 'infographics'), eocType);

            try {
                const fileList = await readdir(dirPath);
                // Filter only image files
                files[eocType] = fileList.filter(file =>
                    isSafeFilename(file) && /\.(jpg|jpeg|png)$/i.test(file)
                ).sort();
            } catch (error) {
                // Directory doesn't exist yet
                files[eocType] = [];
            }
        }

        return NextResponse.json({
            success: true,
            files
        });

    } catch (error) {
        console.error('List files error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการอ่านรายการไฟล์');
    }
}
