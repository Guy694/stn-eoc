import { NextResponse } from 'next/server';

// API สำหรับอัพโหลดและบันทึกภาพแผนที่รายวัน
export async function POST(request) {
    try {
        const formData = await request.formData();
        const imageFile = formData.get('image');
        const recordDate = formData.get('date');
        const createdBy = formData.get('officer_id') || 1; // Default officer

        if (!imageFile || !recordDate) {
            return NextResponse.json(
                { error: 'Missing required fields: image and date' },
                { status: 400 }
            );
        }

        // แปลงภาพเป็น Buffer
        const bytes = await imageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // ในการใช้งานจริง ควรบันทึกลง MySQL
        // const connection = await mysql.createConnection({...});
        // await connection.execute(
        //     'INSERT INTO daily_flood_maps (record_date, map_image, file_name, file_size, created_by) VALUES (?, ?, ?, ?, ?)',
        //     [recordDate, buffer, imageFile.name, buffer.length, createdBy]
        // );

        // หรือบันทึกเป็นไฟล์ในโฟลเดอร์ public/flood-maps/
        const fs = require('fs').promises;
        const path = require('path');

        const uploadDir = path.join(process.cwd(), 'public', 'flood-maps');

        // สร้างโฟลเดอร์ถ้ายังไม่มี
        try {
            await fs.access(uploadDir);
        } catch {
            await fs.mkdir(uploadDir, { recursive: true });
        }

        const fileName = `flood-map-${recordDate}.png`;
        const filePath = path.join(uploadDir, fileName);

        await fs.writeFile(filePath, buffer);

        return NextResponse.json({
            success: true,
            message: 'Map image uploaded successfully',
            data: {
                fileName: fileName,
                url: `/flood-maps/${fileName}`,
                size: buffer.length,
                date: recordDate
            }
        });

    } catch (error) {
        console.error('Error uploading map image:', error);
        return NextResponse.json(
            { error: 'Failed to upload map image', details: error.message },
            { status: 500 }
        );
    }
}

// API สำหรับดึงภาพแผนที่ที่บันทึกไว้
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        if (!date) {
            // ส่งรายการภาพทั้งหมด
            const fs = require('fs').promises;
            const path = require('path');

            const uploadDir = path.join(process.cwd(), 'public', 'flood-maps');

            try {
                const files = await fs.readdir(uploadDir);
                const mapList = files
                    .filter(f => f.endsWith('.png'))
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
