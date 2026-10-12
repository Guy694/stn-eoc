import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { requireModuleEdit } from "@/lib/eocModuleAccess";
import { logVulnerableAccess } from "@/lib/vulnerableAccessLog";
import { decryptNote, encryptNote } from "@/lib/vulnerablePersonsCrypto";
import { caseStatus, validateStatusChange } from "@/lib/vulnerablePersons";

// สถานะการเข้าช่วยเหลือรายบุคคลในเหตุการณ์ (เจ้าหน้าที่กดเปลี่ยนจากหน้างาน)
export const dynamic = "force-dynamic";

const noStore = (response) => {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
};
const json = (body, init) => noStore(NextResponse.json(body, init));
const bad = (message, status = 400) => json({ success: false, message }, { status });

// GET ?session_id=&person_id= → ประวัติการเปลี่ยนสถานะ
export async function GET(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return noStore(auth.response);
    const params = new URL(request.url).searchParams;
    const sessionId = Number(params.get("session_id"));
    const personId = Number(params.get("person_id"));
    if (!sessionId || !personId) return bad("ไม่ระบุเหตุการณ์หรือรายชื่อ");
    const rows = await query(
      `SELECT e.id, e.status, e.moved_to, e.note_enc, e.created_at,
              TRIM(CONCAT(COALESCE(o.given_name, ''), ' ', COALESCE(o.family_name, ''))) AS created_by_name
       FROM vulnerable_case_events e LEFT JOIN officer o ON o.id = e.created_by
       WHERE e.session_id = ? AND e.person_id = ? ORDER BY e.created_at DESC, e.id DESC LIMIT 50`,
      [sessionId, personId]
    );
    await logVulnerableAccess({ request, user: auth.user, action: "history", sessionId, personId, count: rows.length });
    return json({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        status: row.status,
        label: caseStatus(row.status).label,
        moved_to: row.moved_to,
        note: decryptNote(row.note_enc),
        created_at: row.created_at,
        created_by: row.created_by_name || null
      }))
    });
  } catch (error) {
    console.error("Vulnerable case history error:", error?.message || error);
    return noStore(publicInternalError("โหลดประวัติไม่สำเร็จ"));
  }
}

// POST { session_id, person_id, status, moved_to?, note? }
export async function POST(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return noStore(auth.response);
    const body = await request.json().catch(() => ({}));
    const sessionId = Number(body.session_id);
    const personId = Number(body.person_id);
    if (!sessionId || !personId) return bad("ไม่ระบุเหตุการณ์หรือรายชื่อ");
    const gate = await requireModuleEdit(auth.user, sessionId, "vulnerable");
    if (gate.response) return noStore(gate.response);
    const checked = validateStatusChange(body);
    if (checked.error) return bad(checked.error);
    const { status, moved_shelter_id: movedShelterId, note } = checked.value;
    let movedTo = checked.value.moved_to;
    if (movedShelterId) {
      const shelter = (await query(`SELECT id, sheltername FROM shelter_centers WHERE id = ? LIMIT 1`, [movedShelterId]))[0];
      if (!shelter) return bad("ไม่พบศูนย์พักพิงที่เลือก", 404);
      movedTo = movedTo || shelter.sheltername;
    }

    const people = await query(`SELECT id FROM vulnerable_persons WHERE id = ? AND is_active = 1 LIMIT 1`, [personId]);
    if (!people.length) return bad("ไม่พบรายชื่อ", 404);
    const noteEnc = encryptNote(note);

    // บันทึกศูนย์ปลายทาง (moved_shelter_id) ถ้ามีคอลัมน์แล้ว — ยังไม่ migrate ก็บันทึกแบบเดิมได้
    const write = (withShelter) => transaction(async (execute) => {
      await execute(
        withShelter
          ? `INSERT INTO vulnerable_person_cases (session_id, person_id, status, moved_to, moved_shelter_id, note_enc, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status), moved_to = VALUES(moved_to), moved_shelter_id = VALUES(moved_shelter_id), note_enc = VALUES(note_enc), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`
          : `INSERT INTO vulnerable_person_cases (session_id, person_id, status, moved_to, note_enc, updated_by)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status), moved_to = VALUES(moved_to), note_enc = VALUES(note_enc), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`,
        withShelter ? [sessionId, personId, status, movedTo, movedShelterId, noteEnc, auth.user.id] : [sessionId, personId, status, movedTo, noteEnc, auth.user.id]
      );
      await execute(
        withShelter
          ? `INSERT INTO vulnerable_case_events (session_id, person_id, status, moved_to, moved_shelter_id, note_enc, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`
          : `INSERT INTO vulnerable_case_events (session_id, person_id, status, moved_to, note_enc, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
        withShelter ? [sessionId, personId, status, movedTo, movedShelterId, noteEnc, auth.user.id] : [sessionId, personId, status, movedTo, noteEnc, auth.user.id]
      );
    });
    try {
      await write(true);
    } catch (error) {
      if (error?.code !== "ER_BAD_FIELD_ERROR") throw error;
      await write(false);
    }
    await logVulnerableAccess({ request, user: auth.user, action: `status:${status}`, sessionId, personId });
    return json({ success: true, status, label: caseStatus(status).label, message: `อัปเดตเป็น "${caseStatus(status).label}"${status === "moved" && movedTo ? ` → ${movedTo}` : ""} แล้ว` });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return bad("ยังไม่ได้รัน migration 20261009_vulnerable_persons.sql", 503);
    if (error?.code === "missing_encryption_key") return bad(error.message, 503);
    console.error("Vulnerable case status error:", error?.message || error);
    return noStore(publicInternalError("อัปเดตสถานะไม่สำเร็จ"));
  }
}
