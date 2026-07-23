import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { appendAuditLog } from "@/lib/auditLog";
import { MASTER_DATA_CONFIG, normalizeMasterData } from "@/lib/masterDataConfig";

export async function GET(request, { params }) {
  try {
    const auth = await requireAuth(request, ["admin"]);
    if (!auth.success) return auth.response;
    const type = (await params).type;
    const config = MASTER_DATA_CONFIG[type];
    if (!config) return NextResponse.json({ success: false, message: "ประเภท Master Data ไม่ถูกต้อง" }, { status: 404 });
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const page = Math.max(Number(searchParams.get("page")) || 1, 1);
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 100);
    const conditions = [];
    const values = [];
    if (search) {
      conditions.push(`(${config.searchFields.map((field) => `${field} LIKE ?`).join(" OR ")})`);
      config.searchFields.forEach(() => values.push(`%${search}%`));
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const count = await query(`SELECT COUNT(*) AS total FROM ${config.table} ${where}`, values);
    const rows = await query(`SELECT * FROM ${config.table} ${where} ORDER BY ${config.order} LIMIT ${limit} OFFSET ${(page - 1) * limit}`, values);
    return NextResponse.json({ success: true, type, label: config.label, fields: config.fields, required: config.required, data: rows, pagination: { page, limit, total: Number(count[0]?.total || 0) } });
  } catch (error) {
    console.error("Master catalog GET error:", error);
    return publicInternalError("ไม่สามารถโหลด Master Data ได้");
  }
}

export async function POST(request, { params }) {
  try {
    const auth = await requireAuth(request, ["admin"]);
    if (!auth.success) return auth.response;
    const type = (await params).type;
    const normalized = normalizeMasterData(type, await request.json());
    if (!normalized.ok) return NextResponse.json({ success: false, message: normalized.message }, { status: 400 });
    const { config, values } = normalized;
    const uniqueValues = config.unique.map((field) => values[field]);
    const duplicate = await query(`SELECT id FROM ${config.table} WHERE ${config.unique.map((field) => `${field} = ?`).join(" AND ")} LIMIT 1`, uniqueValues);
    if (duplicate.length) return NextResponse.json({ success: false, message: "พบข้อมูลซ้ำ" }, { status: 409 });
    values.updated_by = auth.user.id;
    const id = await transaction(async (execute) => {
      const fields = Object.keys(values);
      const result = await execute(`INSERT INTO ${config.table} (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`, Object.values(values));
      await appendAuditLog(execute, { request, user: auth.user, action: "data_create", targetType: config.table, targetId: result.insertId, description: `เพิ่ม ${config.label}`, newValues: values });
      return result.insertId;
    });
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    console.error("Master catalog POST error:", error);
    return publicInternalError("ไม่สามารถเพิ่ม Master Data ได้");
  }
}
