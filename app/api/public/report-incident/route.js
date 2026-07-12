import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { DEFAULT_MAX_IMAGE_SIZE_BYTES, createRandomFilename, getUploadDir, resolveInside, validateImageFile } from '@/lib/fileUpload';
import { publicInternalError } from '@/lib/apiResponse';
import { escapeTelegramHtml, getTelegramHelpNotifyChatIds, sendTelegramMessage, sendTelegramPhoto } from '@/lib/telegram';

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
        '<b>คำขอความช่วยเหลือใหม่</b>',
        `เลขที่: #${escapeTelegramHtml(report.id)}`,
        `ประเภท: ${escapeTelegramHtml(report.helpCategoryLabel)}`,
        `ผู้แจ้ง: ${escapeTelegramHtml(`${report.firstName} ${report.lastName}`)}`,
        `โทร: ${escapeTelegramHtml(report.phone)}`,
        `พื้นที่: ${escapeTelegramHtml([report.village, report.subDistrict, report.district].filter(Boolean).join(' ') || '-')}`,
        `เหตุผล: ${escapeTelegramHtml(reason)}`,
        `พิกัด: ${escapeTelegramHtml(`${report.latitude}, ${report.longitude}`)}`,
        `<a href="${mapsUrl}">เปิดแผนที่</a>`
    ].join('\n');
}

async function notifyTelegramOfficers(pool, report) {
    if (!process.env.TELEGRAM_BOT_TOKEN) return;

    try {
        const chatIds = getTelegramHelpNotifyChatIds();
        const [columns] = await pool.execute(
            `SELECT COLUMN_NAME
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'officer'
               AND COLUMN_NAME IN ('telegram_chat_id', 'telegram_notify_enabled')`
        );
        const names = new Set(columns.map((column) => column.COLUMN_NAME));
        if (names.has('telegram_chat_id') && names.has('telegram_notify_enabled')) {
            const [officers] = await pool.execute(
                `SELECT telegram_chat_id
                 FROM officer
                 WHERE telegram_notify_enabled = 1
                   AND telegram_chat_id IS NOT NULL
                   AND telegram_chat_id <> ''`
            );
            chatIds.push(...officers.map((officer) => officer.telegram_chat_id));
        }

        const recipients = [...new Set(chatIds.map((chatId) => String(chatId || '').trim()).filter(Boolean))];
        if (!recipients.length) return;

        const text = buildTelegramHelpMessage(report);
        const photoCaption = buildTelegramHelpMessage(report, { compact: true });

        await Promise.allSettled(
            recipients.map(async (chatId) => {
                if (report.telegramPhoto) {
                    const photoResult = await sendTelegramPhoto(chatId, report.telegramPhoto, photoCaption);
                    if (photoResult.ok) return photoResult;
                }

                return sendTelegramMessage(chatId, text);
            })
        );
    } catch (error) {
        console.error('Telegram notification error:', error);
    }
}

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
        const helpCategory = formData.get('helpCategory') || null;
        const helpReason = formData.get('helpReason') || description;
        const waterLevel = formData.get('waterLevel');
        const affectedPeople = formData.get('affectedPeople') || null;
        const urgency = formData.get('urgency') || 'medium';
        const travelStatus = formData.get('travelStatus') || null; // สถานะการสัญจร
        const reportType = formData.get('reportType') || 'help_request'; // ประเภทรายงาน
        const disasterType = formData.get('disasterType') || 'assistance'; // ประเภทภัย
        const occurredAt = formData.get('occurredAt') || new Date().toISOString();
        const latitude = formData.get('latitude');
        const longitude = formData.get('longitude');
        const photo = formData.get('photo');

        // Validate required fields
        if (!firstName || !lastName || !phone || !latitude || !longitude) {
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

                // Create upload directory if not exists
                const uploadDir = getUploadDir('incidents');
                await mkdir(uploadDir, { recursive: true });

                // Generate unique filename
                const filename = createRandomFilename(validation.extension);
                const filepath = resolveInside(uploadDir, filename);

                // Write file
                await writeFile(filepath, validation.buffer);
                photoPath = `/uploads/incidents/${filename}`;
                telegramPhoto = {
                    buffer: validation.buffer,
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
             latitude, longitude, photo_path, verified_by_thaiid, citizen_id, citizen_pid_hash, status, reported_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
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
                disasterType,
                occurredAt,
                latitude,
                longitude,
                photoPath,
                false,
                null,
                null
            ]
        );

        if (reportType === 'help_request') {
            await notifyTelegramOfficers(pool, {
                id: result.insertId,
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
        }

        return NextResponse.json({
            success: true,
            message: 'ส่งคำขอความช่วยเหลือเรียบร้อยแล้ว เจ้าหน้าที่จะตรวจสอบและติดต่อกลับโดยเร็วที่สุด',
            reportId: result.insertId
        });

    } catch (error) {
        console.error('Report incident error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
}
