import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { appendAuditLog } from "@/lib/auditLog";
import { validatePopulationInput } from "@/lib/eocValidation";

export async function GET(request) {
  try {
    const auth = await requireAuth(request, ["admin"]);
    if (!auth.success) return auth.response;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const scope = searchParams.get("scope");
    const page = Math.max(Number(searchParams.get("page")) || 1, 1);
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 100);
    const conditions = ["ap.is_active = 1"];
    const values = [];
    if (search) {
      conditions.push("(ap.district_name LIKE ? OR ap.source_name LIKE ? OR ap.district_code LIKE ?)");
      const wildcard = `%${search}%`;
      values.push(wildcard, wildcard, wildcard);
    }
    if (scope && ["thai", "all"].includes(scope)) {
      conditions.push("ap.population_scope = ?");
      values.push(scope);
    }
    const count = await query(`SELECT COUNT(*) AS total FROM area_population ap WHERE ${conditions.join(" AND ")}`, values);
    const rows = await query(`
      SELECT ap.*, CONCAT(COALESCE(o.title,''), COALESCE(o.given_name,''), ' ', COALESCE(o.family_name,'')) AS updated_by_name
      FROM area_population ap
      LEFT JOIN officer o ON o.id = ap.updated_by
      WHERE ${conditions.join(" AND ")}
      ORDER BY ap.district_name, ap.population_year DESC, ap.id DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `, values);
    return NextResponse.json({ success: true, data: rows, pagination: { page, limit, total: Number(count[0]?.total || 0) } });
  } catch (error) {
    console.error("Population master GET error:", error);
    return publicInternalError("ไม่สามารถโหลดข้อมูลประชากรได้");
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request, ["admin"]);
    if (!auth.success) return auth.response;
    const validation = validatePopulationInput(await request.json());
    if (!validation.ok) return NextResponse.json({ success: false, message: validation.message }, { status: 400 });
    const data = validation.value;
    const duplicate = await query(`
      SELECT id FROM area_population
      WHERE province_code = ? AND district_name = ? AND population_scope = ?
        AND source_name = ? AND is_active = 1
      LIMIT 1
    `, [data.province_code, data.district_name, data.population_scope, data.source_name]);
    if (duplicate.length) return NextResponse.json({ success: false, message: "มีข้อมูลประชากรจากแหล่งนี้อยู่แล้ว" }, { status: 409 });
    const id = await transaction(async (execute) => {
      const result = await execute(`
        INSERT INTO area_population
          (province_code, district_code, district_name, male_population, female_population,
           population, population_year, population_scope, source_name, source_updated_at,
           notes, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [...Object.values(data), auth.user.id]);
      await appendAuditLog(execute, {
        request, user: auth.user, action: "data_create", targetType: "area_population",
        targetId: result.insertId, description: `เพิ่มประชากร ${data.district_name}`, newValues: data,
      });
      return result.insertId;
    });
    return NextResponse.json({ success: true, id, data: { ...data, id } }, { status: 201 });
  } catch (error) {
    console.error("Population master POST error:", error);
    return publicInternalError("ไม่สามารถเพิ่มข้อมูลประชากรได้");
  }
}
