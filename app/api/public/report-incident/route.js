import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getCitizenSession } from '@/lib/citizenAuth';
import { createRandomFilename, resolveInside, validateImageFile } from '@/lib/fileUpload';
import { publicInternalError } from '@/lib/apiResponse';

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

export async function POST(request) {
    try {
        const formData = await request.formData();

        // Extract form data
        const firstName = formData.get('firstName');
        const lastName = formData.get('lastName');
        const phone = formData.get('phone');
        const village = formData.get('village') || null;
        const subDistrict = formData.get('subDistrict') || null;
        const district = formData.get('district') || null;
        const description = formData.get('description');
        const waterLevel = formData.get('waterLevel');
        const affectedPeople = formData.get('affectedPeople') || null;
        const urgency = formData.get('urgency') || 'medium';
        const travelStatus = formData.get('travelStatus') || null; // สถานะการสัญจร
        const reportType = formData.get('reportType') || 'help_request'; // ประเภทรายงาน
        const disasterType = formData.get('disasterType') || 'flood'; // ประเภทภัย
        const occurredAt = formData.get('occurredAt') || new Date().toISOString();
        const latitude = formData.get('latitude');
        const longitude = formData.get('longitude');
        const photo = formData.get('photo');

        // Validate required fields
        if (!firstName || !lastName || !phone || !description || !latitude || !longitude) {
            return NextResponse.json({
                success: false,
                message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน'
            }, { status: 400 });
        }

        // Validate report_type
        if (reportType !== 'help_request' && reportType !== 'traffic_report') {
            return NextResponse.json({
                success: false,
                message: 'ประเภทรายงานไม่ถูกต้อง'
            }, { status: 400 });
        }

        const requiresWaterLevel = reportType === 'help_request' && disasterType === 'flood';
        if (requiresWaterLevel && !waterLevel) {
            return NextResponse.json({
                success: false,
                message: 'กรุณาระบุระดับน้ำ'
            }, { status: 400 });
        }

        if (reportType === 'traffic_report' && !travelStatus) {
            return NextResponse.json({
                success: false,
                message: 'กรุณาระบุสถานะการสัญจร'
            }, { status: 400 });
        }

        if (travelStatus && !['passable', 'difficult', 'impassable'].includes(travelStatus)) {
            return NextResponse.json({
                success: false,
                message: 'สถานะการสัญจรไม่ถูกต้อง'
            }, { status: 400 });
        }

        // Handle photo upload
        let photoPath = null;
        if (photo && photo.size > 0) {
            try {
                const validation = await validateImageFile(photo, {
                    maxSizeBytes: MAX_PHOTO_SIZE_BYTES
                });
                if (!validation.ok) {
                    return NextResponse.json({
                        success: false,
                        message: validation.error
                    }, { status: 400 });
                }

                // Create upload directory if not exists
                const uploadBaseDir = path.join(process.cwd(), 'public', 'uploads');
                const uploadDir = resolveInside(uploadBaseDir, 'incidents');
                await mkdir(uploadDir, { recursive: true });

                // Generate unique filename
                const filename = createRandomFilename(validation.extension);
                const filepath = resolveInside(uploadDir, filename);

                // Write file
                await writeFile(filepath, validation.buffer);
                photoPath = `/uploads/incidents/${filename}`;
            } catch (uploadError) {
                console.error('Photo upload error:', uploadError);
                // Continue without photo if upload fails
            }
        }

        // Connect to database
        const pool = await getConnection();
        const citizenSession = await getCitizenSession();
        let citizenId = null;
        let citizenPidHash = null;

        if (citizenSession?.pidHash) {
            const [citizens] = await pool.execute(
                'SELECT id FROM citizens WHERE pid_hash = ?',
                [citizenSession.pidHash]
            );

            if (citizens.length > 0) {
                citizenId = citizens[0].id;
                citizenPidHash = citizenSession.pidHash;
            }
        }

        // Insert incident report
        const [result] = await pool.execute(
            `INSERT INTO public_incident_reports
            (first_name, last_name, phone, village, sub_district, district, 
             description, water_level, affected_people, urgency, travel_status, report_type, disaster_type, occurred_at, 
             latitude, longitude, photo_path, verified_by_thaiid, citizen_id, citizen_pid_hash, status, reported_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
            [
                firstName,
                lastName,
                phone,
                village,
                subDistrict,
                district,
                description,
                requiresWaterLevel ? waterLevel : (waterLevel || ''),
                affectedPeople,
                urgency,
                travelStatus,
                reportType,
                disasterType,
                occurredAt,
                latitude,
                longitude,
                photoPath,
                Boolean(citizenId),
                citizenId,
                citizenPidHash
            ]
        );

        return NextResponse.json({
            success: true,
            message: 'บันทึกรายงานเรียบร้อยแล้ว',
            reportId: result.insertId
        });

    } catch (error) {
        console.error('Report incident error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
}
