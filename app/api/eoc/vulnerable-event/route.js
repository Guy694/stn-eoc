import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { getEocTypeLabel } from "@/lib/eocDisplay";
import { modulePermissions, requireModuleEdit } from "@/lib/eocModuleAccess";
import { handleArchiveDelete, recordChange } from "@/lib/recordArchive";
import { VULNERABLE_TYPES, affectedOf, differsFromRegistry, findBaselineFor, summarizeVulnerableEvent, validateEventRecord } from "@/lib/vulnerableEvent";
import { loadMergedRegistry } from "@/lib/vulnerableRegistryServer";

// กลุ่มเปราะบาง "ในเหตุการณ์ที่เปิด"
// - จำนวนแต่ละประเภทดึงจากทะเบียนกลาง (vulnerable_group_baselines) ตอนเพิ่มหมู่บ้าน / กดอัปเดตจากทะเบียน
// - เจ้าหน้าที่แก้เฉพาะสถานะ: ดูแลแล้ว เคลื่อนย้ายแล้ว ย้ายไปที่ ความต้องการ หมายเหตุ
// บันทึกได้เฉพาะกลุ่มภารกิจเจ้าของเมนู (CASE MGMT / MCATT) และแอดมิน/ผู้บัญชาการ — ตรวจด้วย requireModuleEdit
const SUPPORTED = ["flood", "disease", "festival-accidents"];
const TYPE_KEYS = VULNERABLE_TYPES.map((type) => type.key);

const bad = (message, status = 400) => NextResponse.json({ success: false, message }, { status });
const int = (value) => Math.max(0, Math.round(Number(value) || 0));
const areaLabel = (row) => [row.village, `ต.${row.tambon}`, `อ.${row.district}`].filter(Boolean).join(" ");

let careColumnsReady = null;
async function hasCareColumns() {
  if (careColumnsReady) return true;
  const rows = await query(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vulnerable_groups' AND COLUMN_NAME IN ('cared_count', 'moved_count', 'moved_to', 'care_updated_at')`
  );
  careColumnsReady = Number(rows[0]?.count) === 4 ? true : null;
  return Boolean(careColumnsReady);
}

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

export async function GET(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const params = new URL(request.url).searchParams;
    const eocType = params.get("eoc") || "flood";
    if (!SUPPORTED.includes(eocType)) return bad("ประเภท EOC ไม่ถูกต้อง");
    const session = await resolveSession(eocType, params.get("session_id"));
    if (!session) return NextResponse.json({ success: true, session: null, message: `ยังไม่เคยเปิด EOC ${getEocTypeLabel(eocType)}` });

    const ready = await hasCareColumns();
    const [rows, baseline] = await Promise.all([
      query(
        `SELECT id, session_id, district, tambon, village, ${TYPE_KEYS.join(", ")}, notes, needs, created_by, created_at, updated_at
                ${ready ? ", cared_count, moved_count, moved_to, care_updated_at" : ""}
         FROM vulnerable_groups WHERE session_id = ? ORDER BY district, tambon, village`,
        [session.id]
      ),
      loadMergedRegistry().catch(() => [])
    ]);
    const records = rows.map((row) => ({ ...row, cared_count: row.cared_count ?? 0, moved_count: row.moved_count ?? 0, affected: affectedOf(row), registry_changed: differsFromRegistry(row, baseline), in_registry: Boolean(findBaselineFor(baseline, row)) }));
    const active = session.status === "active";
    return NextResponse.json({
      success: true,
      session,
      migration_needed: !ready,
      summary: summarizeVulnerableEvent(records, baseline),
      data: records,
      baseline,
      permissions: await (async () => {
        const perms = await modulePermissions(auth.user, session.id, "vulnerable");
        return {
          can_edit: active && perms.can_edit,
          can_update_care: active && ready && perms.can_edit,
          can_delete: auth.user.role === "admin",
          read_only_message: perms.can_edit ? null : perms.read_only_message
        };
      })()
    });
  } catch (error) {
    console.error("Vulnerable event GET error:", error);
    return publicInternalError("ไม่สามารถโหลดข้อมูลกลุ่มเปราะบางในเหตุการณ์ได้");
  }
}

async function activeSessionOr409(sessionId) {
  const rows = await query(`SELECT id, status FROM eoc_sessions WHERE id = ? LIMIT 1`, [sessionId]);
  if (!rows.length) return bad("ไม่พบเหตุการณ์", 404);
  if (rows[0].status !== "active") return bad("เหตุการณ์นี้ปิดแล้ว ดูข้อมูลได้อย่างเดียว", 409);
  return null;
}

// ทะเบียนที่รวมรายชื่อรายบุคคลแล้ว — เพิ่มหมู่บ้านในเหตุการณ์จะได้จำนวนชุดเดียวกับหน้าทะเบียน
async function loadRegistry() {
  return loadMergedRegistry();
}

// POST action:
//  add  = เพิ่มหมู่บ้านที่ประสบภัย (หลายหมู่บ้าน) โดยคัดลอกจำนวนจากทะเบียน
//  sync = อัปเดตจำนวนของทุกหมู่บ้านในเหตุการณ์ให้ตรงกับทะเบียนล่าสุด
export async function POST(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const body = await request.json().catch(() => ({}));
    const sessionId = Number(body.session_id);
    if (!sessionId) return bad("กรุณาระบุเหตุการณ์");
    const gate = await requireModuleEdit(auth.user, sessionId, "vulnerable");
    if (gate.response) return gate.response;
    const blocked = await activeSessionOr409(sessionId);
    if (blocked) return blocked;
    const registry = await loadRegistry();

    if (body.action === "sync") {
      const rows = await query(`SELECT id, district, tambon, village, ${TYPE_KEYS.join(", ")} FROM vulnerable_groups WHERE session_id = ?`, [sessionId]);
      let updated = 0;
      for (const row of rows) {
        const base = findBaselineFor(registry, row);
        if (!base || !differsFromRegistry(row, registry)) continue;
        await query(`UPDATE vulnerable_groups SET ${TYPE_KEYS.map((key) => `${key} = ?`).join(", ")} WHERE id = ?`, [...TYPE_KEYS.map((key) => int(base[key])), row.id]);
        updated += 1;
      }
      await recordChange({ request, user: auth.user, action: "data_update", table: "vulnerable_groups", id: "-", sessionId, description: `อัปเดตจำนวนกลุ่มเปราะบางจากทะเบียน ${updated} พื้นที่` });
      return NextResponse.json({ success: true, message: updated ? `อัปเดตจำนวนจากทะเบียนแล้ว ${updated} พื้นที่` : "จำนวนตรงกับทะเบียนอยู่แล้ว" });
    }

    const areas = Array.isArray(body.areas) ? body.areas.slice(0, 300) : [];
    if (!areas.length) return bad("กรุณาเลือกหมู่บ้านอย่างน้อย 1 แห่ง");
    const existing = await query(`SELECT district, tambon, COALESCE(village, '') AS village FROM vulnerable_groups WHERE session_id = ?`, [sessionId]);
    const taken = new Set(existing.map((row) => `${row.district}|${row.tambon}|${row.village}`));
    const added = [];
    const missing = [];
    for (const raw of areas) {
      const area = { district: String(raw.district || "").trim(), tambon: String(raw.tambon || "").trim(), village: String(raw.village || "").trim() };
      if (!area.district || !area.tambon) continue;
      const key = `${area.district}|${area.tambon}|${area.village}`;
      if (taken.has(key)) continue;
      const base = findBaselineFor(registry, area);
      if (!base) { missing.push(area.village || `ต.${area.tambon}`); continue; }
      const result = await query(
        `INSERT INTO vulnerable_groups (session_id, province, district, tambon, village, ${TYPE_KEYS.join(", ")}, created_by)
         VALUES (?, 'สตูล', ?, ?, ?, ${TYPE_KEYS.map(() => "?").join(", ")}, ?)`,
        [sessionId, area.district, area.tambon, area.village || null, ...TYPE_KEYS.map((key2) => int(base[key2])), auth.user.username || null]
      );
      taken.add(key);
      added.push({ id: result.insertId, ...area, total: affectedOf(base) });
    }
    if (added.length) {
      await recordChange({
        request, user: auth.user, action: "data_create", table: "vulnerable_groups", id: added.map((row) => row.id).join(","), sessionId,
        description: `เพิ่มหมู่บ้านที่ประสบภัย ${added.length} แห่ง (กลุ่มเปราะบางรวม ${added.reduce((sum, row) => sum + row.total, 0)} คน จากทะเบียน)`
      });
    }
    if (!added.length) return bad(missing.length ? `ไม่พบในทะเบียน: ${missing.join(", ")} (เพิ่มในทะเบียนกลางก่อน)` : "หมู่บ้านที่เลือกอยู่ในเหตุการณ์แล้ว", missing.length ? 404 : 409);
    return NextResponse.json({
      success: true,
      message: `เพิ่ม ${added.length} หมู่บ้านแล้ว${missing.length ? ` (ไม่พบในทะเบียน: ${missing.join(", ")})` : ""}`
    });
  } catch (error) {
    console.error("Vulnerable event POST error:", error);
    return publicInternalError("ไม่สามารถบันทึกข้อมูลกลุ่มเปราะบางได้");
  }
}

// แก้ไขสถานะของหมู่บ้าน: ดูแลแล้ว เคลื่อนย้ายแล้ว ย้ายไปที่ ความต้องการ หมายเหตุ (จำนวนตามประเภทมาจากทะเบียน แก้ที่นี่ไม่ได้)
export async function PATCH(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    if (!(await hasCareColumns())) return bad("ยังไม่ได้อัปเดตฐานข้อมูล (npm run db:migrate)", 409);
    const body = await request.json().catch(() => ({}));
    const rows = await query(`SELECT * FROM vulnerable_groups WHERE id = ? LIMIT 1`, [Number(body.id) || 0]);
    if (!rows.length) return bad("ไม่พบข้อมูล", 404);
    const blocked = await activeSessionOr409(rows[0].session_id);
    if (blocked) return blocked;
    const gate = await requireModuleEdit(auth.user, rows[0].session_id, "vulnerable");
    if (gate.response) return gate.response;
    const next = { ...rows[0], cared_count: int(body.cared_count), moved_count: int(body.moved_count), moved_to: String(body.moved_to || "").trim().slice(0, 255) || null, needs: String(body.needs || "").trim() || null, notes: String(body.notes || "").trim() || null };
    const invalid = validateEventRecord(next);
    if (invalid) return bad(invalid);
    await query(
      `UPDATE vulnerable_groups SET cared_count = ?, moved_count = ?, moved_to = ?, needs = ?, notes = ?, care_updated_at = NOW() WHERE id = ?`,
      [next.cared_count, next.moved_count, next.moved_to, next.needs, next.notes, rows[0].id]
    );
    await recordChange({
      request, user: auth.user, action: "data_update", table: "vulnerable_groups", id: rows[0].id, sessionId: rows[0].session_id,
      description: `อัปเดตการดูแลกลุ่มเปราะบาง ${areaLabel(rows[0])}: ดูแลแล้ว ${next.cared_count}/${affectedOf(rows[0])} เคลื่อนย้าย ${next.moved_count}${next.moved_to ? ` ไป ${next.moved_to}` : ""}`,
      oldValues: { cared_count: rows[0].cared_count, moved_count: rows[0].moved_count, moved_to: rows[0].moved_to },
      newValues: { cared_count: next.cared_count, moved_count: next.moved_count, moved_to: next.moved_to }
    });
    return NextResponse.json({ success: true, message: "อัปเดตการดูแลแล้ว" });
  } catch (error) {
    console.error("Vulnerable event PATCH error:", error);
    return publicInternalError("ไม่สามารถอัปเดตการดูแลได้");
  }
}

// ลบ = ย้ายไปถังขยะ (กู้คืนได้) พร้อมเหตุผล
export async function DELETE(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  return handleArchiveDelete(request, auth.user, { table: "vulnerable_groups" });
}
