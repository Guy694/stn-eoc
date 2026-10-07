import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { getPool } from "@/lib/db";
import { recordChange } from "@/lib/recordArchive";
import { canPublish, findDuplicateCandidates, normalizePublishInput } from "@/lib/incidentPublishing";
import { createPublicPhotoCopy, parsePhotoPaths, removePublicPhotoCopy } from "@/lib/incidentPhotos";
import { hasConfirmationColumns, hasPublishingColumns } from "@/lib/incidentPublishingDb";

const pool = getPool();
const VIEWERS = ["admin", "commander", "MCATT", "SAT", "SeRHT", "staff"];
const EDITORS = ["admin", "commander", "MCATT", "SAT"];

const SUMMARY_COLUMNS = `id, first_name, last_name, phone, village, sub_district, district, latitude, longitude,
    description, water_level, urgency, travel_status, report_type, problem_category, occurred_at, created_at, photo_path,
    status, publish_status, public_title, public_detail, public_photo_path, published_at, expires_at,
    merged_into_id, normal_reports, normal_reported_at`;

function notReady() {
  return NextResponse.json({ success: false, message: "ยังไม่ได้ติดตั้งระบบเผยแพร่ กรุณารัน npm run db:migrate" }, { status: 409 });
}

async function loadReport(connection, id) {
  const [rows] = await connection.execute(`SELECT ${SUMMARY_COLUMNS} FROM public_incident_reports WHERE id = ?`, [id]);
  return rows[0] || null;
}

// GET ?id= — รายละเอียดสำหรับหน้าตรวจ: เรื่องที่รวมเข้ามาแล้ว และเรื่องใกล้เคียงที่น่าจะซ้ำ
export async function GET(request) {
  const auth = await requireAuth(request, VIEWERS);
  if (!auth.success) return auth.response;

  const connection = await pool.getConnection();
  try {
    if (!(await hasPublishingColumns(connection))) return notReady();
    const id = Number(new URL(request.url).searchParams.get("id"));
    const report = await loadReport(connection, id);
    if (!report) return NextResponse.json({ success: false, message: "ไม่พบเรื่องนี้" }, { status: 404 });

    const [children] = await connection.execute(
      `SELECT ${SUMMARY_COLUMNS} FROM public_incident_reports WHERE merged_into_id = ? ORDER BY created_at`,
      [id]
    );
    const [nearby] = await connection.execute(
      `SELECT ${SUMMARY_COLUMNS} FROM public_incident_reports
       WHERE id <> ? AND merged_into_id IS NULL AND report_type = ?
         AND created_at >= DATE_SUB(?, INTERVAL 2 DAY) AND created_at <= DATE_ADD(?, INTERVAL 2 DAY)
       LIMIT 300`,
      [id, report.report_type, report.created_at, report.created_at]
    );

    return NextResponse.json({
      success: true,
      data: {
        report,
        children,
        duplicates: findDuplicateCandidates(report, nearby).slice(0, 5),
        photos: [...parsePhotoPaths(report.photo_path), ...children.flatMap((child) => parsePhotoPaths(child.photo_path))]
      }
    });
  } catch (error) {
    console.error("Error loading incident publishing detail:", error);
    return publicInternalError("โหลดรายละเอียดไม่สำเร็จ");
  } finally {
    connection.release();
  }
}

// POST { reportId, action, ... }
//   publish   { title, detail, expiresHours, photo } — ยืนยัน + เผยแพร่ (ถ้ายังไม่ยืนยันจะยืนยันให้ด้วย)
//   withdraw  — ถอดออกจากแผนที่สาธารณะ
//   merge     { targetId } — รวมเข้ากับเรื่องหลัก
//   unmerge   — แยกออกจากเรื่องหลัก
//   clear_normal — ล้างจำนวน "ตอนนี้ปกติแล้ว" หลังตรวจแล้วว่ายังมีปัญหาอยู่
export async function POST(request) {
  const auth = await requireAuth(request, EDITORS);
  if (!auth.success) return auth.response;

  const connection = await pool.getConnection();
  try {
    if (!(await hasPublishingColumns(connection))) return notReady();
    const body = await request.json();
    const reportId = Number(body.reportId);
    const report = await loadReport(connection, reportId);
    if (!report) return NextResponse.json({ success: false, message: "ไม่พบเรื่องนี้" }, { status: 404 });

    const audit = (description, newValues) => recordChange({
      request, user: auth.user, action: "data_update", table: "public_incident_reports", id: reportId, description, newValues
    });

    if (body.action === "publish") {
      const check = canPublish(report);
      if (!check.ok) return NextResponse.json({ success: false, message: check.reason }, { status: 400 });
      const input = normalizePublishInput(body, report);
      if (!input.ok) return NextResponse.json({ success: false, message: input.error }, { status: 400 });

      const [children] = await connection.execute("SELECT photo_path FROM public_incident_reports WHERE merged_into_id = ?", [reportId]);
      const allowedPhotos = [...parsePhotoPaths(report.photo_path), ...children.flatMap((child) => parsePhotoPaths(child.photo_path))];
      let publicPhotoPath = null;
      if (input.value.photo) {
        if (!allowedPhotos.includes(input.value.photo)) {
          return NextResponse.json({ success: false, message: "รูปที่เลือกไม่ใช่รูปของเรื่องนี้" }, { status: 400 });
        }
        try {
          publicPhotoPath = await createPublicPhotoCopy(input.value.photo);
        } catch (error) {
          console.error("Public photo copy failed:", error);
          const message = /[ก-๙]/.test(error.message) ? error.message : "เตรียมรูปสำหรับเผยแพร่ไม่สำเร็จ ลองเผยแพร่โดยไม่ใช้รูป";
          return NextResponse.json({ success: false, message }, { status: 400 });
        }
      }

      await connection.execute(
        `UPDATE public_incident_reports
         SET status = IF(status IN ('pending', 'reviewing'), 'verified', status),
             reviewed_by = IF(status IN ('pending', 'reviewing'), ?, reviewed_by),
             reviewed_at = IF(status IN ('pending', 'reviewing'), NOW(), reviewed_at),
             publish_status = 'published',
             public_title = ?, public_detail = ?, public_photo_path = ?,
             published_at = NOW(), published_by = ?,
             expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR),
             normal_reports = 0, normal_reported_at = NULL
             ${(await hasConfirmationColumns(connection)) ? ", still_reports = 0, still_reported_at = NULL, wrong_reports = 0, wrong_reported_at = NULL" : ""}
         WHERE id = ?`,
        [auth.user.id, input.value.title, input.value.detail, publicPhotoPath, auth.user.id, String(input.value.expiresHours), reportId]
      );
      if (report.public_photo_path && report.public_photo_path !== publicPhotoPath) {
        await removePublicPhotoCopy(report.public_photo_path);
      }
      await audit(`เผยแพร่รายงานจากประชาชน #${reportId} "${input.value.title}" (${input.value.expiresHours} ชม.)`, {
        publish_status: "published", public_title: input.value.title, public_detail: input.value.detail,
        public_photo: Boolean(publicPhotoPath), expires_hours: input.value.expiresHours
      });
      return NextResponse.json({ success: true, message: `เผยแพร่ "${input.value.title}" บนแผนที่แล้ว (แสดง ${input.value.expiresHours} ชม.)` });
    }

    if (body.action === "withdraw") {
      await connection.execute(
        "UPDATE public_incident_reports SET publish_status = 'withdrawn', public_photo_path = NULL WHERE id = ?",
        [reportId]
      );
      await removePublicPhotoCopy(report.public_photo_path);
      await audit(`ถอดรายงานจากประชาชน #${reportId} ออกจากแผนที่สาธารณะ`, { publish_status: "withdrawn" });
      return NextResponse.json({ success: true, message: "ถอดออกจากแผนที่สาธารณะแล้ว" });
    }

    if (body.action === "merge") {
      const target = await loadReport(connection, Number(body.targetId));
      if (!target || target.id === reportId) return NextResponse.json({ success: false, message: "ไม่พบเรื่องหลักที่จะรวม" }, { status: 400 });
      if (target.merged_into_id) return NextResponse.json({ success: false, message: "เรื่องปลายทางถูกรวมกับเรื่องอื่นแล้ว" }, { status: 400 });
      if (target.report_type !== report.report_type) return NextResponse.json({ success: false, message: "รวมได้เฉพาะเรื่องประเภทเดียวกัน" }, { status: 400 });

      await connection.beginTransaction();
      try {
        // เรื่องที่เคยรวมเข้ากับเรื่องนี้ ย้ายไปอยู่ใต้เรื่องหลักใหม่ด้วย
        await connection.execute("UPDATE public_incident_reports SET merged_into_id = ? WHERE merged_into_id = ?", [target.id, reportId]);
        await connection.execute(
          `UPDATE public_incident_reports
           SET merged_into_id = ?, publish_status = IF(publish_status = 'published', 'withdrawn', publish_status), public_photo_path = NULL
           WHERE id = ?`,
          [target.id, reportId]
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
      await removePublicPhotoCopy(report.public_photo_path);
      await audit(`รวมรายงานจากประชาชน #${reportId} เข้ากับ #${target.id}`, { merged_into_id: target.id });
      return NextResponse.json({ success: true, message: `รวมเข้ากับเรื่อง #${target.id} แล้ว` });
    }

    if (body.action === "unmerge") {
      await connection.execute("UPDATE public_incident_reports SET merged_into_id = NULL WHERE id = ?", [reportId]);
      await audit(`แยกรายงานจากประชาชน #${reportId} ออกจากเรื่องหลัก`, { merged_into_id: null });
      return NextResponse.json({ success: true, message: "แยกออกเป็นเรื่องเดี่ยวแล้ว" });
    }

    if (body.action === "clear_normal") {
      const withWrong = await hasConfirmationColumns(connection);
      await connection.execute(
        `UPDATE public_incident_reports SET normal_reports = 0, normal_reported_at = NULL${withWrong ? ", wrong_reports = 0, wrong_reported_at = NULL" : ""} WHERE id = ?`,
        [reportId]
      );
      await audit(`ตรวจแล้วว่าจุด #${reportId} ยังถูกต้อง/ยังมีปัญหาอยู่ (ล้างแจ้งว่าปกติแล้วและแจ้งข้อมูลผิด)`, { normal_reports: 0, ...(withWrong ? { wrong_reports: 0 } : {}) });
      return NextResponse.json({ success: true, message: "บันทึกว่าจุดนี้ยังถูกต้องและยังมีปัญหาอยู่" });
    }

    return NextResponse.json({ success: false, message: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
  } catch (error) {
    console.error("Error publishing incident report:", error);
    return publicInternalError("บันทึกการเผยแพร่ไม่สำเร็จ");
  } finally {
    connection.release();
  }
}
