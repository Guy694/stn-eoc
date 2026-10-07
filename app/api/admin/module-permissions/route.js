import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { query, transaction } from "@/lib/db";
import { recordChange } from "@/lib/recordArchive";
import { ALL_TEAMS, CONFIGURABLE_MODULES, defaultOwners, normalizeOwnerInput, resolveOwners } from "@/lib/eocModulePermissions";
import { invalidateOwnerOverrides, loadOwnerOverrides } from "@/lib/eocModuleOwners";
import { TEAM_CODES, getTeam, normalizeTeamCode } from "@/src/features/eoc/registries/team.registry";
import { getEocTypeLabel } from "@/lib/eocDisplay";

// ตั้งค่าว่ากลุ่มภารกิจไหนบันทึกเมนูไหนของเหตุการณ์ได้ (เฉพาะแอดมิน)
const bad = (message, status = 400) => NextResponse.json({ success: false, message }, { status });

function findModule(eocType, moduleKey) {
  return (CONFIGURABLE_MODULES[eocType] || []).find((item) => item.key === moduleKey) || null;
}

const describeOwners = (owners) => (owners === null ? "ทุกทีมที่ได้รับมอบหมาย" : owners.map((code) => getTeam(code)?.shortName || code).join(", "));

// ทีมเจ้าของที่ยังไม่มีสมาชิกในเหตุการณ์ที่เปิดอยู่ → เมนูนั้นไม่มีใครบันทึกได้นอกจากแอดมิน/ผู้บัญชาการ
async function staffingWarnings(eocType, modules) {
  const sessions = await query(`SELECT id, session_number FROM eoc_sessions WHERE eoc_type = ? AND status = 'active'`, [eocType]).catch(() => []);
  const warnings = [];
  for (const session of sessions) {
    const rows = await query(
      `SELECT t.team_code, COUNT(m.id) AS members
       FROM eoc_session_teams st
       JOIN eoc_teams t ON t.id = st.team_id
       LEFT JOIN eoc_team_members m ON m.session_team_id = st.id AND m.is_active = 1
       WHERE st.eoc_session_id = ? AND st.is_active = 1
       GROUP BY t.team_code`, [session.id]).catch(() => []);
    const staffed = new Set(rows.filter((row) => Number(row.members) > 0).map((row) => normalizeTeamCode(row.team_code)).filter(Boolean));
    for (const mod of modules) {
      if (mod.owners === null) continue;
      if (!mod.owners.some((code) => staffed.has(code))) {
        warnings.push({
          module: mod.key,
          message: `${mod.label}: ทีม ${describeOwners(mod.owners)} ยังไม่มีสมาชิกใน${getEocTypeLabel(eocType)} ครั้งที่ ${session.session_number} — ตอนนี้บันทึกได้เฉพาะแอดมิน/ผู้บัญชาการ`
        });
      }
    }
  }
  return warnings;
}

export async function GET(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const overrides = await loadOwnerOverrides();
    const types = [];
    for (const [eocType, list] of Object.entries(CONFIGURABLE_MODULES)) {
      const modules = list.map((item) => {
        const owners = resolveOwners(eocType, item.key, overrides);
        return {
          ...item,
          owners,
          defaults: defaultOwners(item.key),
          customized: Object.prototype.hasOwnProperty.call(overrides, `${eocType}:${item.key}`)
        };
      });
      types.push({ eocType, label: getEocTypeLabel(eocType), modules, warnings: await staffingWarnings(eocType, modules) });
    }
    return NextResponse.json({
      success: true,
      types,
      teams: TEAM_CODES.map((code) => ({ code, shortName: getTeam(code).shortName, name: getTeam(code).name }))
    });
  } catch (error) {
    console.error("Module permissions admin GET error:", error);
    return publicInternalError("โหลดสิทธิ์กลุ่มภารกิจไม่สำเร็จ");
  }
}

// PUT { eoc_type, module_key, teams: ["sat", ...] | ["*"] }
export async function PUT(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const mod = findModule(body.eoc_type, body.module_key);
    if (!mod) return bad("ไม่พบเมนูที่ต้องการตั้งค่า");
    const input = normalizeOwnerInput(body.teams);
    if (!input.ok) return bad(input.error);
    const before = resolveOwners(body.eoc_type, body.module_key, await loadOwnerOverrides());

    await transaction(async (execute) => {
      await execute("DELETE FROM eoc_module_permissions WHERE eoc_type = ? AND module_key = ?", [body.eoc_type, body.module_key]);
      for (const code of input.value) {
        await execute(
          "INSERT INTO eoc_module_permissions (eoc_type, module_key, team_code, updated_by) VALUES (?, ?, ?, ?)",
          [body.eoc_type, body.module_key, code, auth.user.id]
        );
      }
    });
    invalidateOwnerOverrides();
    const after = input.value[0] === ALL_TEAMS ? null : input.value;
    await recordChange({
      request, user: auth.user, action: "data_update", table: "eoc_module_permissions", id: `${body.eoc_type}:${body.module_key}`,
      description: `ตั้งสิทธิ์บันทึก ${getEocTypeLabel(body.eoc_type)} › ${mod.label}: ${describeOwners(before ?? null)} → ${describeOwners(after)}`,
      oldValues: { teams: before }, newValues: { teams: after }
    });
    return NextResponse.json({ success: true, message: `บันทึกสิทธิ์ “${mod.label}” แล้ว` });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") return bad("ยังไม่ได้ติดตั้งตารางสิทธิ์ กรุณารัน npm run db:migrate", 409);
    console.error("Module permissions PUT error:", error);
    return publicInternalError("บันทึกสิทธิ์ไม่สำเร็จ");
  }
}

// DELETE ?eoc_type=&module_key= — คืนค่าเริ่มต้น (ไม่ระบุ module_key = ทั้งประเภทเหตุการณ์)
export async function DELETE(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const params = new URL(request.url).searchParams;
    const eocType = params.get("eoc_type");
    const moduleKey = params.get("module_key");
    if (!CONFIGURABLE_MODULES[eocType]) return bad("ไม่พบประเภทเหตุการณ์");
    if (moduleKey && !findModule(eocType, moduleKey)) return bad("ไม่พบเมนู");
    await query(
      `DELETE FROM eoc_module_permissions WHERE eoc_type = ?${moduleKey ? " AND module_key = ?" : ""}`,
      moduleKey ? [eocType, moduleKey] : [eocType]
    );
    invalidateOwnerOverrides();
    const label = moduleKey ? findModule(eocType, moduleKey).label : `ทุกเมนูของ${getEocTypeLabel(eocType)}`;
    await recordChange({
      request, user: auth.user, action: "data_update", table: "eoc_module_permissions", id: `${eocType}:${moduleKey || "*"}`,
      description: `คืนค่าสิทธิ์เริ่มต้น: ${label}`
    });
    return NextResponse.json({ success: true, message: `คืนค่าเริ่มต้น ${label} แล้ว` });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") return NextResponse.json({ success: true, message: "ใช้ค่าเริ่มต้นอยู่แล้ว" });
    console.error("Module permissions DELETE error:", error);
    return publicInternalError("คืนค่าเริ่มต้นไม่สำเร็จ");
  }
}
