import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { INFOGRAPHIC_TYPES, infographicTitle, infographicUrl } from "@/lib/infographicAssets";

// อินโฟกราฟิกจากคลังของฝ่ายสื่อสารความเสี่ยง สำหรับหน้า "ประกาศและความรู้" (ภาพเผยแพร่ ไม่มีข้อมูลบุคคล)
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query(
      `SELECT id, eoc_type, stored_filename, original_filename, created_at FROM eoc_file_assets
       WHERE asset_type = 'infographic' ORDER BY created_at DESC, id DESC LIMIT 120`
    );
    const data = rows
      .filter((row) => INFOGRAPHIC_TYPES.includes(row.eoc_type))
      .map((row) => ({
        id: row.id,
        eoc_type: row.eoc_type,
        title: infographicTitle(row.original_filename),
        image: infographicUrl(row.eoc_type, row.stored_filename),
        created_at: row.created_at
      }));
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=600" } });
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") console.error("Public infographic gallery error:", error?.message || error);
    return NextResponse.json({ success: true, data: [] });
  }
}
