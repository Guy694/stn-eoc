import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';
import { resolveInside, validateImageFile } from '@/lib/fileUpload';
import { publicInternalError } from '@/lib/apiResponse';
import { createHash } from 'crypto';
import { query } from '@/lib/db';

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
        const backupPath = `${filePath}.backup`;
        let hasBackup = false;

        try {
            await fs.rename(filePath, backupPath);
            hasBackup = true;
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
        await fs.writeFile(filePath, validation.buffer);
        try {
            const checksum = createHash('sha256').update(validation.buffer).digest('hex');
            await query(`
                INSERT INTO eoc_file_assets
                  (asset_type, eoc_type, report_date, storage_path, stored_filename,
                   original_filename, mime_type, file_size, checksum_sha256, uploaded_by)
                VALUES ('daily_flood_map', 'flood', ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  original_filename = VALUES(original_filename),
                  mime_type = VALUES(mime_type),
                  file_size = VALUES(file_size),
                  checksum_sha256 = VALUES(checksum_sha256),
                  uploaded_by = VALUES(uploaded_by),
                  updated_at = CURRENT_TIMESTAMP
            `, [
                recordDate,
                `public/flood-maps/${fileName}`,
                fileName,
                imageFile.name || fileName,
                imageFile.type,
                validation.buffer.length,
                checksum,
                auth.user.id
            ]);
            if (hasBackup) await fs.unlink(backupPath).catch(() => {});
        } catch (databaseError) {
            await fs.unlink(filePath).catch(() => {});
            if (hasBackup) await fs.rename(backupPath, filePath).catch(() => {});
            throw databaseError;
        }

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
        const auth = await requireAuth(request);
        if (!auth.success) return auth.response;
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        if (!date) {
            const rows = await query(`
                SELECT id, stored_filename, report_date, file_size, checksum_sha256, created_at
                FROM eoc_file_assets
                WHERE asset_type = 'daily_flood_map' AND eoc_type = 'flood'
                ORDER BY report_date DESC, id DESC
            `);
            return NextResponse.json({
                maps: rows.map((row) => ({
                    id: row.id,
                    fileName: row.stored_filename,
                    url: `/flood-maps/${row.stored_filename}`,
                    date: String(row.report_date).slice(0, 10),
                    size: row.file_size,
                    checksum: row.checksum_sha256
                })),
                meta: { source_type: 'database', source_name: 'eoc_file_assets' }
            });
        } else {
            if (!DATE_PATTERN.test(date)) {
                return NextResponse.json(
                    { error: 'Invalid date' },
                    { status: 400 }
                );
            }

            const rows = await query(`
                SELECT id, stored_filename, report_date, file_size, checksum_sha256
                FROM eoc_file_assets
                WHERE asset_type = 'daily_flood_map' AND eoc_type = 'flood' AND report_date = ?
                ORDER BY id DESC
                LIMIT 1
            `, [date]);
            if (!rows.length) {
                return NextResponse.json({ error: 'ไม่พบภาพแผนที่สำหรับวันที่เลือก' }, { status: 404 });
            }
            const asset = rows[0];
            const filePath = resolveInside(path.join(process.cwd(), 'public', 'flood-maps'), asset.stored_filename);
            try {
                await fs.access(filePath);
            } catch {
                return NextResponse.json({ error: 'พบ metadata แต่ไม่พบไฟล์ใน storage' }, { status: 410 });
            }
            return NextResponse.json({
                id: asset.id,
                fileName: asset.stored_filename,
                url: `/flood-maps/${asset.stored_filename}`,
                date,
                size: asset.file_size,
                checksum: asset.checksum_sha256,
                meta: { source_type: 'database', source_name: 'eoc_file_assets' }
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
