import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { modulePermissions } from "@/lib/eocModuleAccess";
import { getOperationalSessionAccess } from "@/lib/eocOperationalAccess";
import { recordChange } from "@/lib/recordArchive";
import { logVulnerableAccess } from "@/lib/vulnerableAccessLog";
import { decodePerson, decryptNote, encodePerson } from "@/lib/vulnerablePersonsCrypto";
import { DEFAULT_STATUS, summarizePersons, validatePerson } from "@/lib/vulnerablePersons";

// ทะเบียนกลุ่มเปราะบางรายบุคคล (ชื่อ เบอร์ ที่อยู่ พิกัดบ้าน เข้ารหัสในฐานข้อมูล)
// - ทุก endpoint ต้องเข้าสู่ระบบเป็นเจ้าหน้าที่ ไม่มีเส้นทางสาธารณะ
// - ส่งข้อมูลแบบ no-store และบันทึกการเข้าดูทุกครั้ง (vulnerable_access_log)
// - รายชื่อเต็ม (ชื่อ เบอร์ ที่อยู่ พิกัด) เห็นเฉพาะแอดมิน/ผู้บัญชาการ และผู้ที่ได้รับมอบหมายในเหตุการณ์ คนอื่นเห็นเฉพาะยอดรวม
export const dynamic = "force-dynamic";

const SUPPORTED = ["flood", "disease", "festival-accidents"];
const PRIVILEGED = ["admin", "commander"];
const PERSON_COLUMNS = "id, vulnerable_type, district, tambon, village, name_enc, phone_enc, address_enc, location_enc, needs_enc, caregiver_enc, clinical_enc, updated_at";
const CARE_COLUMNS = ", care_group, power_dependent";
const isMissingColumn = (error) => error?.code === "ER_BAD_FIELD_ERROR";

// ถ้ายังไม่ได้รัน migration กลุ่มสี (20261012_vulnerable_care_group.sql) ใช้คำสั่งเดิมที่ไม่มีคอลัมน์ใหม่
async function withCareFallback(withCare, withoutCare) {
  try {
    return await withCare();
  } catch (error) {
    if (isMissingColumn(error)) return withoutCare();
    throw error;
  }
}

const noStore = (response) => {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
};
const json = (body, init) => noStore(NextResponse.json(body, init));
const bad = (message, status = 400) => json({ success: false, message }, { status });
const isMissingTable = (error) => error?.code === "ER_NO_SUCH_TABLE";
const isMissingKey = (error) => error?.code === "missing_encryption_key";

async function resolveSession(eocType, sessionId) {
  const rows = await query(
    sessionId
      ? `SELECT id, eoc_type, session_number, status, opened_at, closed_at FROM eoc_sessions WHERE id = ? LIMIT 1`
      : `SELECT id, eoc_type, session_number, status, opened_at, closed_at FROM eoc_sessions WHERE eoc_type = ?
         ORDER BY (status = 'active') DESC, opened_at DESC LIMIT 1`,
    [sessionId || eocType]
  );
  return rows[0] || null;
}

async function permissionsFor(user, session) {
  const perms = session ? await modulePermissions(user, session.id, "vulnerable") : { can_edit: false };
  const privileged = PRIVILEGED.includes(user.role);
  const active = session?.status === "active";
  return {
    can_edit_registry: privileged || Boolean(perms.can_edit),
    can_update_status: Boolean(active && (perms.can_edit || privileged)),
    can_delete: privileged,
    read_only_message: perms.can_edit || privileged ? null : perms.read_only_message || null
  };
}

export async function GET(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return noStore(auth.response);
    const params = new URL(request.url).searchParams;
    const eocType = params.get("eoc") || "flood";
    if (!SUPPORTED.includes(eocType)) return bad("ประเภท EOC ไม่ถูกต้อง");
    const session = await resolveSession(eocType, params.get("session_id"));
    const canSeePeople = PRIVILEGED.includes(auth.user.role)
      || Boolean(session && (await getOperationalSessionAccess(auth.user, session.id).catch(() => ({ ok: false }))).ok);

    let rows;
    let cases = [];
    let shelters = [];
    try {
      const listSql = (extra) => `SELECT ${PERSON_COLUMNS}${extra} FROM vulnerable_persons WHERE is_active = 1 ORDER BY district, tambon, village, id`;
      rows = await withCareFallback(() => query(listSql(CARE_COLUMNS)), () => query(listSql("")));
      if (session) {
        shelters = await loadSessionShelters(session);
        const caseSql = (withShelter) => `SELECT c.person_id, c.status, c.moved_to, ${withShelter ? "c.moved_shelter_id," : ""} c.note_enc, c.updated_at,
                  TRIM(CONCAT(COALESCE(o.given_name, ''), ' ', COALESCE(o.family_name, ''))) AS updated_by_name
           FROM vulnerable_person_cases c LEFT JOIN officer o ON o.id = c.updated_by
           WHERE c.session_id = ?`;
        cases = await query(caseSql(true), [session.id]).catch((error) => {
          if (error?.code === "ER_BAD_FIELD_ERROR") return query(caseSql(false), [session.id]);
          throw error;
        });
      }
    } catch (error) {
      if (isMissingTable(error)) return json({ success: true, migration_needed: true, session, persons: [], summary: summarizePersons([]), permissions: await permissionsFor(auth.user, session) });
      throw error;
    }

    const caseByPerson = new Map(cases.map((row) => [row.person_id, row]));
    if (!canSeePeople) {
      // ยอดรวมเท่านั้น — ไม่ถอดรหัส ไม่ส่งข้อมูลรายบุคคล
      const counted = rows.map((row) => ({ vulnerable_type: row.vulnerable_type, care_group: row.care_group, power_dependent: row.power_dependent, status: caseByPerson.get(row.id)?.status || DEFAULT_STATUS }));
      return json({
        success: true, session, persons: [], restricted: true, summary: summarizePersons(counted),
        restricted_message: "รายชื่อรายบุคคลเห็นได้เฉพาะเจ้าหน้าที่ที่ได้รับมอบหมายในเหตุการณ์นี้ (ติดต่อผู้บัญชาการเพื่อเพิ่มเข้ากล่องภารกิจ) — ตอนนี้แสดงเฉพาะยอดรวม",
        permissions: { can_edit_registry: false, can_update_status: false, can_delete: false, read_only_message: null }, shelters: []
      });
    }
    const persons = rows.map((row) => {
      const person = decodePerson(row);
      const current = caseByPerson.get(row.id);
      return {
        ...person,
        status: current?.status || DEFAULT_STATUS,
        moved_to: current?.moved_to || null,
        moved_shelter_id: current?.moved_shelter_id || null,
        case_note: current ? decryptNote(current.note_enc) : null,
        status_updated_at: current?.updated_at || null,
        status_updated_by: current?.updated_by_name || null
      };
    });

    await logVulnerableAccess({ request, user: auth.user, action: "list", sessionId: session?.id ?? null, count: persons.length });
    // ยอดกลุ่มเปราะบางที่ย้ายเข้าแต่ละศูนย์ (จากทะเบียนรายบุคคล)
    const movedCount = new Map();
    for (const person of persons) if (person.status === "moved" && person.moved_shelter_id) movedCount.set(person.moved_shelter_id, (movedCount.get(person.moved_shelter_id) || 0) + 1);
    return json({
      success: true, session, persons, summary: summarizePersons(persons), permissions: await permissionsFor(auth.user, session),
      shelters: shelters.map((shelter) => ({ ...shelter, vulnerable_moved: movedCount.get(shelter.id) || 0 }))
    });
  } catch (error) {
    if (isMissingKey(error)) return bad(error.message, 503);
    console.error("Vulnerable persons GET error:", error?.message || error);
    return noStore(publicInternalError("ไม่สามารถโหลดทะเบียนกลุ่มเปราะบางได้"));
  }
}

// ศูนย์พักพิงของเหตุการณ์ (พิกัด ประเภท ความพร้อม ที่ว่าง) — ใช้ซ้อนบนแผนที่และแนะนำตอนเคลื่อนย้าย
async function loadSessionShelters(session) {
  const base = (extra) => `SELECT sc.id, sc.sheltername AS name, sc.lat, sc.lon, sc.district_name, sc.tambon, sc.shelter_capacity AS capacity,
           ${extra}
           CASE WHEN ssa.id IS NOT NULL AND ssa.is_active = 1 THEN 1 ELSE 0 END AS active, COALESCE(ssa.current_occupancy, 0) AS occupancy
    FROM shelter_centers sc LEFT JOIN shelter_session_activations ssa ON ssa.shelter_id = sc.id AND ssa.session_id = ?
    WHERE sc.eoc_type = ? AND sc.lat IS NOT NULL AND sc.lon IS NOT NULL`;
  try {
    return await query(base("sc.shelter_type, sc.capabilities,"), [session.id, session.eoc_type]);
  } catch (error) {
    if (error?.code === "ER_BAD_FIELD_ERROR") return query(base(""), [session.id, session.eoc_type]).catch(() => []);
    if (isMissingTable(error)) return [];
    throw error;
  }
}

async function registryGate(request) {
  const auth = await requireAuth(request, OFFICER_ROLES);
  if (!auth.success) return { response: noStore(auth.response) };
  const body = await request.json().catch(() => ({}));
  const session = body.session_id ? await resolveSession(null, Number(body.session_id)) : null;
  const perms = await permissionsFor(auth.user, session);
  if (!perms.can_edit_registry) return { response: bad(perms.read_only_message || "ไม่มีสิทธิ์แก้ไขทะเบียนกลุ่มเปราะบาง", 403) };
  return { auth, body, session };
}

// เพิ่มบุคคล
export async function POST(request) {
  try {
    const gate = await registryGate(request);
    if (gate.response) return gate.response;
    const { auth, body } = gate;
    const checked = validatePerson(body);
    if (checked.error) return bad(checked.error);
    const row = encodePerson(checked.value);
    const base = [row.vulnerable_type, row.district, row.tambon, row.village, row.name_enc, row.phone_enc, row.address_enc, row.location_enc, row.needs_enc, row.caregiver_enc, row.clinical_enc];
    const result = await withCareFallback(
      () => query(
        `INSERT INTO vulnerable_persons (vulnerable_type, district, tambon, village, name_enc, phone_enc, address_enc, location_enc, needs_enc, caregiver_enc, clinical_enc, care_group, power_dependent, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [...base, row.care_group, row.power_dependent, auth.user.id, auth.user.id]
      ),
      () => query(
        `INSERT INTO vulnerable_persons (vulnerable_type, district, tambon, village, name_enc, phone_enc, address_enc, location_enc, needs_enc, caregiver_enc, clinical_enc, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [...base, auth.user.id, auth.user.id]
      )
    );
    await logVulnerableAccess({ request, user: auth.user, action: "create", personId: result.insertId });
    await recordChange({ request, user: auth.user, action: "CREATE", table: "vulnerable_persons", id: result.insertId, description: `เพิ่มกลุ่มเปราะบางรายบุคคล ต.${row.tambon} อ.${row.district}` });
    return json({ success: true, id: result.insertId, message: "เพิ่มรายชื่อแล้ว" });
  } catch (error) {
    if (isMissingTable(error)) return bad("ยังไม่ได้รัน migration 20261009_vulnerable_persons.sql", 503);
    if (isMissingKey(error)) return bad(error.message, 503);
    console.error("Vulnerable persons POST error:", error?.message || error);
    return noStore(publicInternalError("บันทึกรายชื่อไม่สำเร็จ"));
  }
}

// แก้ไขบุคคล (?id=)
export async function PUT(request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return bad("ไม่ระบุรายชื่อ");
    const gate = await registryGate(request);
    if (gate.response) return gate.response;
    const { auth, body } = gate;
    const checked = validatePerson(body);
    if (checked.error) return bad(checked.error);
    const row = encodePerson(checked.value);
    const base = [row.vulnerable_type, row.district, row.tambon, row.village, row.name_enc, row.phone_enc, row.address_enc, row.location_enc, row.needs_enc, row.caregiver_enc, row.clinical_enc];
    const setBase = "vulnerable_type = ?, district = ?, tambon = ?, village = ?, name_enc = ?, phone_enc = ?, address_enc = ?, location_enc = ?, needs_enc = ?, caregiver_enc = ?, clinical_enc = ?";
    const result = await withCareFallback(
      () => query(`UPDATE vulnerable_persons SET ${setBase}, care_group = ?, power_dependent = ?, updated_by = ? WHERE id = ? AND is_active = 1`, [...base, row.care_group, row.power_dependent, auth.user.id, id]),
      () => query(`UPDATE vulnerable_persons SET ${setBase}, updated_by = ? WHERE id = ? AND is_active = 1`, [...base, auth.user.id, id])
    );
    if (!result.affectedRows) return bad("ไม่พบรายชื่อ", 404);
    await logVulnerableAccess({ request, user: auth.user, action: "update", personId: id });
    await recordChange({ request, user: auth.user, action: "UPDATE", table: "vulnerable_persons", id, description: "แก้ไขข้อมูลกลุ่มเปราะบางรายบุคคล" });
    return json({ success: true, message: "บันทึกการแก้ไขแล้ว" });
  } catch (error) {
    if (isMissingKey(error)) return bad(error.message, 503);
    console.error("Vulnerable persons PUT error:", error?.message || error);
    return noStore(publicInternalError("บันทึกการแก้ไขไม่สำเร็จ"));
  }
}

// นำออกจากทะเบียน (?id=) — ซ่อนจากรายการ ไม่ลบประวัติการช่วยเหลือ; เฉพาะแอดมิน/ผู้บัญชาการ
export async function DELETE(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return noStore(auth.response);
    if (!PRIVILEGED.includes(auth.user.role)) return bad("เฉพาะผู้ดูแลระบบหรือผู้บัญชาการ", 403);
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return bad("ไม่ระบุรายชื่อ");
    const result = await query(`UPDATE vulnerable_persons SET is_active = 0, updated_by = ? WHERE id = ? AND is_active = 1`, [auth.user.id, id]);
    if (!result.affectedRows) return bad("ไม่พบรายชื่อ", 404);
    await logVulnerableAccess({ request, user: auth.user, action: "deactivate", personId: id });
    await recordChange({ request, user: auth.user, action: "DELETE", table: "vulnerable_persons", id, description: "นำรายชื่อกลุ่มเปราะบางออกจากทะเบียน" });
    return json({ success: true, message: "นำออกจากทะเบียนแล้ว" });
  } catch (error) {
    console.error("Vulnerable persons DELETE error:", error?.message || error);
    return noStore(publicInternalError("นำออกจากทะเบียนไม่สำเร็จ"));
  }
}
