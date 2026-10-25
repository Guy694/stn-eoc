import { startTracking } from '@/lib/incidentTrackingDb';
import { formatTrackingCode } from '@/lib/helpTracking';
import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { parseOccurredAt } from '@/lib/publicReportTime';
import { writeFile, mkdir } from 'fs/promises';
import { DEFAULT_MAX_IMAGE_SIZE_BYTES, createRandomFilename, getPrivateUploadDir, resolveInside, validateImageFile } from '@/lib/fileUpload';
import { stripImageMetadata } from '@/lib/imageSanitize';
import { isValidCategory } from '@/lib/incidentPublishing';
import { publicInternalError } from '@/lib/apiResponse';
import { escapeTelegramHtml } from '@/lib/telegram';
import { sendCategorized } from '@/lib/telegramChannels';
import { notifyOfficersOfNewHelp } from '@/lib/helpAlertsServer';
import { enforceIpRateLimit } from "@/lib/rateLimit";
import { HELP_CLOSED_MESSAGE, PROBLEM_CLOSED_MESSAGE, WATER_CLOSED_MESSAGE, getOpenEocSessions, hasOpenEoc } from '@/lib/eocOpen';
import { WATER_ADMIN_CLOSED_MESSAGE, waterReportStatus } from '@/lib/waterReportSetting';
import { getWaterReportSetting } from '@/lib/waterReportSettingServer';
import { hasWaterTrendColumn } from '@/lib/incidentPublishingDb';
import { WATER_PASSABILITY, isWaterLevel, travelForPassability, waterLevelMeta, waterTrendMeta } from '@/lib/waterReport';

const MAX_PHOTO_SIZE_BYTES = DEFAULT_MAX_IMAGE_SIZE_BYTES;
const HELP_CATEGORY_LABELS = {
    medicine: 'ด้านยา',
    vulnerable: 'ด้านกลุ่มเปราะบาง',
    other: 'อื่นๆ'
};

function buildHelpDescription({ helpCategory, helpReason, description }) {
    const categoryLabel = HELP_CATEGORY_LABELS[helpCategory] || helpCategory || '-';
    const lines = [
        `ประเภทความช่วยเหลือ: ${categoryLabel}`,
        `เหตุผลการขอความช่วยเหลือ: ${helpReason || description || '-'}`
    ];
    if (description && description !== helpReason) {
        lines.push(`รายละเอียดเพิ่มเติม: ${description}`);
    }
    return lines.join('\n');
}

function truncateForTelegram(value, maxLength = 350) {
    const text = String(value || '-').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1)}…`;
}

function buildTelegramHelpMessage(report, { compact = false } = {}) {
    const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${report.latitude},${report.longitude}`)}`;
    const reason = compact ? truncateForTelegram(report.helpReason, 280) : (report.helpReason || '-');

    return [
        '<b>มีคำขอใหม่ รอเจ้าหน้าที่ติดต่อกลับ</b>',
        `เลขที่: #${escapeTelegramHtml(report.id)}${report.trackingCode ? ` (ติดตาม ${escapeTelegramHtml(formatTrackingCode(report.trackingCode))})` : ''}`,
        `ประเภท: ${escapeTelegramHtml(report.helpCategoryLabel)}`,
        `ผู้แจ้ง: ${escapeTelegramHtml(`${report.firstName} ${report.lastName}`)}`,
        `โทร: ${escapeTelegramHtml(report.phone)}`,
        `พื้นที่: ${escapeTelegramHtml([report.village, report.subDistrict, report.district].filter(Boolean).join(' ') || '-')}`,
        `เหตุผล: ${escapeTelegramHtml(reason)}`,
        `พิกัด: ${escapeTelegramHtml(`${report.latitude}, ${report.longitude}`)}`,
        `<a href="${mapsUrl}">เปิดแผนที่</a>`
    ].join('\n');
}

// ส่งเข้ากลุ่มเจ้าหน้าที่ + เจ้าหน้าที่ที่เชื่อม Telegram ส่วนตัว (ประเภท "คำขอความช่วยเหลือ" — lib/telegramChannels.js)
async function notifyTelegramOfficers(pool, report) {
    if (!process.env.TELEGRAM_BOT_TOKEN) return;
    try {
        await sendCategorized('help', buildTelegramHelpMessage(report), {
            photo: report.telegramPhoto || null,
            photoCaption: report.telegramPhoto ? buildTelegramHelpMessage(report, { compact: true }) : null,
            run: async (sql, params) => (await pool.execute(sql, params))[0]
        });
    } catch (error) {
        console.error('Telegram notification error:', error);
    }
}

async function savePhoto(photo) {
    if (!photo || !photo.size) return { photoPath: null };
    const validation = await validateImageFile(photo, { maxSizeBytes: MAX_PHOTO_SIZE_BYTES });
    if (!validation.ok) return { error: validation.error, status: 400 };
    try {
        const uploadDir = getPrivateUploadDir('incidents');
        await mkdir(uploadDir, { recursive: true });
        const cleanBuffer = await stripImageMetadata(validation.buffer, validation.extension);
        const filename = createRandomFilename(validation.extension);
        await writeFile(resolveInside(uploadDir, filename), cleanBuffer);
        return { photoPath: `/uploads/incidents/${filename}` };
    } catch (uploadError) {
        console.error('Photo upload error:', uploadError);
        return { error: 'ไม่สามารถบันทึกรูปภาพได้ กรุณาลองใหม่อีกครั้ง', status: 500 };
    }
}

function clean(value, max) {
    return String(value || '').trim().slice(0, max);
}

// รายงานระดับน้ำจากประชาชน → เก็บเป็น "จุดปัญหา" ประเภทน้ำท่วม เพื่อเข้าคิวตรวจสอบ/เผยแพร่เดิมของเจ้าหน้าที่
async function handleWaterReport({ firstName, lastName, phone, village, subDistrict, district, notes, waterLevel, waterTrend, passability, latitude, longitude, photo, occurredAt }) {
    const openSessions = await getOpenEocSessions();
    // เปิดรับตาม EOC อุทกภัย หรือตามที่ผู้ดูแลระบบตั้งเปิด/ปิดไว้ (เมนูตั้งค่าระบบ › เมนูประชาชน)
    const setting = await getWaterReportSetting().catch(() => ({ mode: 'auto' }));
    const water = waterReportStatus(setting.mode, openSessions);
    if (!water.open) {
        return NextResponse.json({ success: false, code: 'EOC_NOT_OPEN', message: water.reason === 'admin' ? WATER_ADMIN_CLOSED_MESSAGE : WATER_CLOSED_MESSAGE }, { status: 403 });
    }
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!latitude || !longitude || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return NextResponse.json({ success: false, message: 'กรุณาระบุตำแหน่งที่พบน้ำท่วม' }, { status: 400 });
    }
    if (!isWaterLevel(waterLevel)) {
        return NextResponse.json({ success: false, message: 'กรุณาเลือกระดับน้ำ' }, { status: 400 });
    }
    if (waterTrend && !waterTrendMeta(waterTrend)) {
        return NextResponse.json({ success: false, message: 'แนวโน้มน้ำไม่ถูกต้อง' }, { status: 400 });
    }
    if (passability && !WATER_PASSABILITY.some((item) => item.value === passability)) {
        return NextResponse.json({ success: false, message: 'สถานะการสัญจรไม่ถูกต้อง' }, { status: 400 });
    }
    const contactPhone = clean(phone, 20);
    if (contactPhone && !/^[0-9+\-\s]{9,20}$/.test(contactPhone)) {
        return NextResponse.json({ success: false, message: 'เบอร์โทรไม่ถูกต้อง' }, { status: 400 });
    }

    const saved = await savePhoto(photo);
    if (saved.error) return NextResponse.json({ success: false, message: saved.error }, { status: saved.status });

    const level = waterLevelMeta(waterLevel);
    const trend = waterTrendMeta(waterTrend);
    const travel = travelForPassability(passability) || level.travel;
    const noteText = clean(notes, 1000);
    const description = [
        `รายงานระดับน้ำ: ${level.label} (${level.range})`,
        trend ? `แนวโน้ม: ${trend.label}` : null,
        passability ? `การสัญจร: ${WATER_PASSABILITY.find((item) => item.value === passability).label}` : null,
        noteText ? `หมายเหตุ: ${noteText}` : null
    ].filter(Boolean).join('\n');

    const pool = await getConnection();
    const withTrend = await hasWaterTrendColumn(pool);
    const [result] = await pool.execute(
        `INSERT INTO public_incident_reports
        (first_name, last_name, phone, village, sub_district, district,
         description, water_level, affected_people, urgency, travel_status, report_type, disaster_type, occurred_at,
         latitude, longitude, photo_path, verified_by_thaiid, citizen_id, citizen_pid_hash, status, reported_at, problem_category${withTrend ? ', water_trend' : ''})
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'problem_point', 'flood', ?, ?, ?, ?, 0, NULL, NULL, 'pending', NOW(), 'flood'${withTrend ? ', ?' : ''})`,
        [
            clean(firstName, 100),
            clean(lastName, 100),
            contactPhone,
            village || null,
            subDistrict || null,
            district || null,
            description,
            level.value,
            level.urgency,
            travel,
            occurredAt,
            lat,
            lng,
            saved.photoPath,
            ...(withTrend ? [trend ? trend.value : null] : [])
        ]
    );

    const trackingCode = await startTracking(pool, result.insertId);
    return NextResponse.json({
        success: true,
        message: 'ได้รับรายงานระดับน้ำแล้ว เจ้าหน้าที่จะตรวจสอบก่อนแสดงบนแผนที่',
        reportId: result.insertId,
        trackingCode
    });
}

export async function POST(request) {
    // กันการส่งข้อมูลขยะ/สแปมจาก IP เดียวกัน
    const rateLimited = await enforceIpRateLimit(request, 'publicReport');
    if (rateLimited) return rateLimited;

    try {
        const formData = await request.formData();

        // Extract form data — รับเฉพาะข้อความ (กันไฟล์ที่ส่งมาแทนช่องข้อความ) ตัดช่องว่าง และจำกัดความยาวตามคอลัมน์
        const text = (name, max) => {
            const value = formData.get(name);
            if (typeof value !== 'string') return null;
            const clean = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[ \t]+/g, ' ').trim();
            return clean ? clean.slice(0, max) : null;
        };
        const firstName = text('firstName', 100);
        const lastName = text('lastName', 100);
        const phone = text('phone', 20);
        const village = text('village', 100);
        const subDistrict = text('subDistrict', 100);
        const district = text('district', 100);
        const description = text('description', 5000);
        const helpCategory = text('helpCategory', 100);
        const helpReason = text('helpReason', 5000) || description;
        const waterLevel = text('waterLevel', 50);
        const affectedRaw = text('affectedPeople', 10);
        const affectedPeople = affectedRaw && /^\d{1,6}$/.test(affectedRaw) ? Number(affectedRaw) : null;
        const urgencyRaw = text('urgency', 20) || 'medium';
        const urgency = ['low', 'medium', 'high', 'critical'].includes(urgencyRaw) ? urgencyRaw : 'medium';
        const travelStatus = text('travelStatus', 20); // สถานะการสัญจร
        const reportType = text('reportType', 30) || 'help_request'; // ประเภทรายงาน
        const disasterType = text('disasterType', 30) || 'assistance'; // ประเภทภัย
        // เวลาเกิดเหตุ (เวลาไทยจากฟอร์ม) → Date ให้ mysql2 แปลงตามโซนเวลาของฐานข้อมูล ดู lib/publicReportTime.js
        const occurredAt = parseOccurredAt(text('occurredAt', 40));
        const latitude = text('latitude', 30);
        const longitude = text('longitude', 30);
        const photo = formData.get('photo');
        const problemCategory = text('problemCategory', 50);
        // รายงานระดับน้ำ: ไม่บังคับชื่อ/เบอร์ (ให้ประชาชนรายงานได้เร็ว) แต่ต้องมีตำแหน่งและระดับน้ำ
        const isWaterReport = formData.get('reportSource') === 'water_level';
        const waterTrend = text('waterTrend', 20);
        const passability = text('passability', 20);

        if (isWaterReport) {
            return handleWaterReport({
                formData,
                firstName, lastName, phone, village, subDistrict, district,
                notes: description, waterLevel, waterTrend, passability,
                latitude, longitude, photo, occurredAt
            });
        }

        // Validate required fields
        if (!firstName || !lastName || !phone || !latitude || !longitude) {
            return NextResponse.json({
                success: false,
                message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน'
            }, { status: 400 });
        }
        if (!/^[0-9+\-\s]{9,20}$/.test(phone) || phone.replace(/\D/g, '').length < 9) {
            return NextResponse.json({ success: false, message: 'เบอร์โทรไม่ถูกต้อง (9–10 หลัก)' }, { status: 400 });
        }
        // พิกัดต้องเป็นตัวเลขและอยู่ในประเทศไทยโดยประมาณ (กันค่าผิด/สลับละติจูด-ลองจิจูด)
        const latValue = Number(latitude);
        const lngValue = Number(longitude);
        if (!Number.isFinite(latValue) || !Number.isFinite(lngValue) || latValue < 5 || latValue > 21 || lngValue < 97 || lngValue > 106) {
            return NextResponse.json({ success: false, message: 'ตำแหน่งไม่ถูกต้อง กรุณาปักหมุดใหม่' }, { status: 400 });
        }

        // Validate report_type
        if (!['help_request', 'traffic_report', 'problem_point'].includes(reportType)) {
            return NextResponse.json({
                success: false,
                message: 'ประเภทรายงานไม่ถูกต้อง'
            }, { status: 400 });
        }

        // รับคำขอความช่วยเหลือเฉพาะตอนที่มี EOC เปิดอยู่ (ตรวจที่เซิร์ฟเวอร์ ไม่พึ่งแค่ปุ่มบนหน้าเว็บ)
        if (reportType === 'help_request' && !(await hasOpenEoc())) {
            return NextResponse.json({
                success: false,
                code: 'EOC_NOT_OPEN',
                message: HELP_CLOSED_MESSAGE
            }, { status: 403 });
        }

        // แจ้งจุดปัญหาเปิดรับเฉพาะช่วงที่มี EOC เปิด และผูกกับประเภทภัยของ EOC ที่เปิดอยู่
        let resolvedDisasterType = disasterType;
        if (reportType === 'problem_point') {
            const openSessions = await getOpenEocSessions();
            if (!openSessions.length) {
                return NextResponse.json({ success: false, code: 'EOC_NOT_OPEN', message: PROBLEM_CLOSED_MESSAGE }, { status: 403 });
            }
            if (!isValidCategory(problemCategory)) {
                return NextResponse.json({ success: false, message: 'กรุณาเลือกประเภทปัญหา' }, { status: 400 });
            }
            if (!description || String(description).trim().length < 3) {
                return NextResponse.json({ success: false, message: 'กรุณาเล่าสั้น ๆ ว่าเกิดอะไรขึ้น' }, { status: 400 });
            }
            const types = openSessions.map((session) => session.eoc_type);
            resolvedDisasterType = types.includes('flood') ? 'flood' : types[0];
        }

        if (reportType === 'help_request' && (!helpCategory || !helpReason)) {
            return NextResponse.json({
                success: false,
                message: 'กรุณาระบุประเภทและเหตุผลการขอความช่วยเหลือ'
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
        let telegramPhoto = null;
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

                // เก็บนอก public (เปิดได้เฉพาะเจ้าหน้าที่) และล้างพิกัด GPS/EXIF ออกก่อนบันทึก
                const uploadDir = getPrivateUploadDir('incidents');
                await mkdir(uploadDir, { recursive: true });

                const cleanBuffer = await stripImageMetadata(validation.buffer, validation.extension);
                const filename = createRandomFilename(validation.extension);
                const filepath = resolveInside(uploadDir, filename);

                await writeFile(filepath, cleanBuffer);
                photoPath = `/uploads/incidents/${filename}`;
                telegramPhoto = {
                    buffer: cleanBuffer,
                    filename,
                    contentType: photo.type
                };
            } catch (uploadError) {
                console.error('Photo upload error:', uploadError);
                return NextResponse.json({
                    success: false,
                    message: 'ไม่สามารถบันทึกรูปภาพได้ กรุณาลองใหม่อีกครั้ง'
                }, { status: 500 });
            }
        }

        // Connect to database
        const pool = await getConnection();
        const finalDescription = reportType === 'help_request'
            ? buildHelpDescription({ helpCategory, helpReason, description })
            : description;

        // Insert incident report
        const [result] = await pool.execute(
            `INSERT INTO public_incident_reports
            (first_name, last_name, phone, village, sub_district, district, 
             description, water_level, affected_people, urgency, travel_status, report_type, disaster_type, occurred_at, 
             latitude, longitude, photo_path, verified_by_thaiid, citizen_id, citizen_pid_hash, status, reported_at${reportType === 'problem_point' ? ', problem_category' : ''})
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW()${reportType === 'problem_point' ? ', ?' : ''})`,
            [
                firstName,
                lastName,
                phone,
                village,
                subDistrict,
                district,
                finalDescription,
                requiresWaterLevel ? waterLevel : (waterLevel || ''),
                affectedPeople,
                urgency,
                travelStatus,
                reportType,
                resolvedDisasterType,
                occurredAt,
                latitude,
                longitude,
                photoPath,
                false,
                null,
                null,
                ...(reportType === 'problem_point' ? [problemCategory] : [])
            ]
        );

        const trackingCode = await startTracking(pool, result.insertId);

        if (reportType === 'help_request') {
            await notifyTelegramOfficers(pool, {
                id: result.insertId,
                trackingCode,
                firstName,
                lastName,
                phone,
                village,
                subDistrict,
                district,
                latitude,
                longitude,
                helpCategoryLabel: HELP_CATEGORY_LABELS[helpCategory] || helpCategory || '-',
                helpReason: helpReason || description || '-',
                telegramPhoto
            });
            // เด้งเข้ามือถือเจ้าหน้าที่ที่เปิดรับแจ้งเตือน (ไม่ทำให้การส่งคำขอของประชาชนล้มถ้าส่งไม่สำเร็จ)
            await notifyOfficersOfNewHelp(result.insertId).catch((error) => console.warn('Officer push error:', error?.message));
        }

        return NextResponse.json({
            success: true,
            message: reportType === 'problem_point'
                ? 'ส่งข้อมูลจุดปัญหาแล้ว เจ้าหน้าที่จะตรวจสอบก่อนแสดงบนแผนที่'
                : 'ส่งคำขอความช่วยเหลือเรียบร้อยแล้ว เจ้าหน้าที่จะตรวจสอบและติดต่อกลับโดยเร็วที่สุด',
            reportId: result.insertId,
            trackingCode
        });

    } catch (error) {
        console.error('Report incident error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
}
