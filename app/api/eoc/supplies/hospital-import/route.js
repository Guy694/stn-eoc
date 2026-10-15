import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { ImportError } from "@/lib/imports/server";
import { commitHospitalImport, hospitalImportContext, previewHospitalImport } from "@/lib/hospitalDrugImportServer";

// นำเข้าข้อมูลจากระบบคลังยาของโรงพยาบาล — เบราว์เซอร์อ่านไฟล์และสรุปเป็นรายการยาแล้ว ส่งมาเฉพาะรายการที่เลือก
function fail(error, label) {
  if (error instanceof ImportError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
  console.error(label, error);
  return publicInternalError("นำเข้าข้อมูลคลังยาไม่สำเร็จ");
}

export async function GET(request) {
  const auth = await requireAuth(request, OFFICER_ROLES);
  if (!auth.success) return auth.response;
  const params = new URL(request.url).searchParams;
  try {
    const context = await hospitalImportContext({
      user: auth.user, eocType: params.get("eoc") || "flood", sessionId: params.get("session_id") || null, hospCode: params.get("hosp_code") || ""
    });
    return NextResponse.json({ success: true, ...context });
  } catch (error) {
    return fail(error, "Hospital drug import context error:");
  }
}

export async function POST(request) {
  const auth = await requireAuth(request, OFFICER_ROLES);
  if (!auth.success) return auth.response;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const input = {
    user: auth.user,
    request,
    eocType: body.eoc || "flood",
    sessionId: body.session_id || null,
    facilityId: body.facility_id,
    hospCode: body.hosp_code,
    filenames: Array.isArray(body.files) ? body.files.map((name) => String(name).slice(0, 120)).slice(0, 50) : [],
    onhandDate: body.onhand_date,
    inventoryComplete: body.inventory_complete === true,
    items: body.items
  };
  try {
    // preview = ตรวจแผนก่อนบันทึก (ยังไม่เขียนอะไร)
    if (body.preview === true) return NextResponse.json({ success: true, plan: await previewHospitalImport(input) });
    const counts = await commitHospitalImport(input);
    return NextResponse.json({ success: true, counts });
  } catch (error) {
    return fail(error, "Hospital drug import error:");
  }
}
