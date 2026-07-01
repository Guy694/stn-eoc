import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';
import { isSafeFilename, resolveInside, validateImageFile } from '@/lib/fileUpload';
import { publicInternalError } from '@/lib/apiResponse';

const MAX_FLOOD_MAP_SIZE_BYTES = 10 * 1024 * 1024;
const FLOOD_MAP_TYPES = new Map([
    ['image/png', 'png']
]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// API สำหรับอัพโหลดและบันทึกภาพแผนที่รายวัน
export async function POST(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT']);
        if (!auth.success) return auth.response;

        const formData = await request.formData();
        const imageFile = formData.get('image');
        const recordDate = formData.get('date');

        if (!imageFile || !recordDate || !DATE_PATTERN.test(recordDate)) {
            return NextResponse.json(
                { error: 'Missing or invalid required fields: image and date' },
                { status: 400 }
            );
        }

        const validation = await validateImageFile(imageFile, {
            maxSizeBytes: MAX_FLOOD_MAP_SIZE_BYTES,
            allowedTypes: FLOOD_MAP_TYPES
        });
        if (!validation.ok) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
        }

        // ในการใช้งานจริง ควรบันทึกลง MySQL
        // const connection = await mysql.createConnection({...});
        // await connection.execute(
        //     'INSERT INTO daily_flood_maps (record_date, map_image, file_name, file_size, created_by) VALUES (?, ?, ?, ?, ?)',
        //     [recordDate, buffer, imageFile.name, buffer.length, createdBy]
        // );

        // หรือบันทึกเป็นไฟล์ในโฟลเดอร์ public/flood-maps/
        const uploadDir = path.join(process.cwd(), 'public', 'flood-maps');

        // สร้างโฟลเดอร์ถ้ายังไม่มี
        await fs.mkdir(uploadDir, { recursive: true });

        const fileName = `flood-map-${recordDate}.png`;
        const filePath = resolveInside(uploadDir, fileName);

        await fs.writeFile(filePath, validation.buffer);

        return NextResponse.json({
            success: true,
            message: 'Map image uploaded successfully',
            data: {
                fileName: fileName,
                url: `/flood-maps/${fileName}`,
                size: validation.buffer.length,
                date: recordDate
            }
        });

    } catch (error) {
        console.error('Error uploading map image:', error);
        return publicInternalError('Failed to upload map image');
    }
}

// API สำหรับดึงภาพแผนที่ที่บันทึกไว้
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        if (!date) {
            // ส่งรายการภาพทั้งหมด
            const uploadDir = path.join(process.cwd(), 'public', 'flood-maps');

            try {
                const files = await fs.readdir(uploadDir);
                const mapList = files
                    .filter(f => isSafeFilename(f) && /^flood-map-\d{4}-\d{2}-\d{2}\.png$/.test(f))
                    .map(f => ({
                        fileName: f,
                        url: `/flood-maps/${f}`,
                        date: f.replace('flood-map-', '').replace('.png', '')
                    }));

                return NextResponse.json({ maps: mapList });
            } catch {
                return NextResponse.json({ maps: [] });
            }
        } else {
            if (!DATE_PATTERN.test(date)) {
                return NextResponse.json(
                    { error: 'Invalid date' },
                    { status: 400 }
                );
            }

            // ส่งภาพของวันที่ที่ระบุ
            const fileName = `flood-map-${date}.png`;
            const url = `/flood-maps/${fileName}`;

            return NextResponse.json({
                fileName: fileName,
                url: url,
                date: date
            });
        }

    } catch (error) {
        console.error('Error fetching map images:', error);
        return NextResponse.json(
            { error: 'Failed to fetch map images' },
            { status: 500 }
        );
    }
}
