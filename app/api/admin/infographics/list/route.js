import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";

export async function GET(request) {
    try {
        const auth = await requireAuth(request, ["admin", "commander", "MCATT", "SAT", "SeRHT", "staff"]);
        if (!auth.success) return auth.response;

        const rows = await query(`
            SELECT id, eoc_type, stored_filename, original_filename, mime_type,
                   file_size, checksum_sha256, created_at
            FROM eoc_file_assets
            WHERE asset_type = 'infographic'
            ORDER BY created_at DESC, id DESC
        `);
        const types = ["flood", "drought", "tsunami", "earthquake", "disease"];
        const files = Object.fromEntries(types.map((type) => [type, []]));
        rows.forEach((row) => {
            if (files[row.eoc_type]) files[row.eoc_type].push(row.stored_filename);
        });

        return NextResponse.json({
            success: true,
            files,
            assets: rows,
            meta: {
                source_type: "database",
                source_name: "eoc_file_assets",
                record_count: rows.length,
                generated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error("List infographic assets error:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการอ่านรายการไฟล์");
    }
}
