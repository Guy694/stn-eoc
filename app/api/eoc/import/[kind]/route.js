import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { enforceIpRateLimit } from "@/lib/rateLimit";
import { MAX_IMPORT_BYTES } from "@/lib/imports/core";
import { importSpec } from "@/lib/imports/specs";
import { ImportError, buildTemplate, runImport } from "@/lib/imports/server";

// นำเข้าข้อมูลจาก Excel: /api/eoc/import/{vulnerable|flood-records|supplies}
// GET  = ดาวน์โหลดไฟล์ตัวอย่าง (มีแผ่นคำอธิบายและรายการให้เลือก)
// POST = multipart: file, mode=check|commit, only_valid=1, eoc, session_id
export const dynamic = "force-dynamic";

const bad = (message, status = 400) => NextResponse.json({ success: false, message }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request, { params }) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const { kind } = await params;
    if (!importSpec(kind)) return bad("ไม่รู้จักชนิดข้อมูลที่จะนำเข้า", 404);
    const { buffer, filename } = await buildTemplate(kind);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="import-${kind}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof ImportError) return bad(error.message, error.status);
    console.error("Import template error:", error?.message || error);
    return publicInternalError("สร้างไฟล์ตัวอย่างไม่สำเร็จ");
  }
}

export async function POST(request, { params }) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const limited = await enforceIpRateLimit(request, "importUpload", { store: "memory" });
    if (limited) return limited;
    const { kind } = await params;
    if (!importSpec(kind)) return bad("ไม่รู้จักชนิดข้อมูลที่จะนำเข้า", 404);

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file.arrayBuffer !== "function" || !file.size) return bad("กรุณาเลือกไฟล์ Excel");
    if (file.size > MAX_IMPORT_BYTES) return bad("ไฟล์ใหญ่เกิน 5 MB — แบ่งไฟล์แล้วนำเข้าทีละส่วน");
    const filename = String(file.name || "import.xlsx");
    if (!/\.(xlsx|csv|xls)$/i.test(filename)) return bad("รองรับเฉพาะไฟล์ .xlsx หรือ .csv");

    const mode = String(form.get("mode") || "check");
    const sessionId = Number(form.get("session_id")) || null;
    const result = await runImport(kind, {
      buffer: Buffer.from(await file.arrayBuffer()),
      filename,
      user: auth.user,
      request,
      eocType: String(form.get("eoc") || "flood"),
      sessionId,
      commit: mode === "commit",
      onlyValid: form.get("only_valid") === "1"
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ImportError || error?.code === "spreadsheet_invalid") return bad(error.message, error.status || 400);
    if (error?.code === "missing_encryption_key") return bad(error.message, 503);
    console.error("Import error:", error?.message || error);
    return publicInternalError("นำเข้าข้อมูลไม่สำเร็จ");
  }
}
