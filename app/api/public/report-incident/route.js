import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

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
        if (!firstName || !lastName || !phone || !description || !waterLevel || !latitude || !longitude) {
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

        // Handle photo upload
        let photoPath = null;
        if (photo && photo.size > 0) {
            try {
                const bytes = await photo.arrayBuffer();
                const buffer = Buffer.from(bytes);

                // Create upload directory if not exists
                const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'incidents');
                try {
                    await mkdir(uploadDir, { recursive: true });
                } catch (err) {
                    // Directory might already exist
                }

                // Generate unique filename
                const timestamp = Date.now();
                const filename = `${timestamp}_${photo.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                const filepath = path.join(uploadDir, filename);

                // Write file
                await writeFile(filepath, buffer);
                photoPath = `/uploads/incidents/${filename}`;
            } catch (uploadError) {
                console.error('Photo upload error:', uploadError);
                // Continue without photo if upload fails
            }
        }

        // Connect to database
        const pool = await getConnection();

        // Insert incident report
        const [result] = await pool.execute(
            `INSERT INTO public_incident_reports 
            (first_name, last_name, phone, village, sub_district, district, 
             description, water_level, affected_people, urgency, travel_status, report_type, disaster_type, occurred_at, 
             latitude, longitude, photo_path, status, reported_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
            [
                firstName,
                lastName,
                phone,
                village,
                subDistrict,
                district,
                description,
                waterLevel,
                affectedPeople,
                urgency,
                travelStatus,
                reportType,
                disasterType,
                occurredAt,
                latitude,
                longitude,
                photoPath
            ]
        );

        return NextResponse.json({
            success: true,
            message: 'บันทึกรายงานเรียบร้อยแล้ว',
            reportId: result.insertId
        });

    } catch (error) {
        console.error('Report incident error:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message
        }, { status: 500 });
    }
}
