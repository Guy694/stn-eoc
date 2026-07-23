import { NextResponse } from "next/server";
import { rename, unlink } from "fs/promises";
import { requireAuth } from "@/lib/auth";
import { isSafeFilename, resolveInside } from "@/lib/fileUpload";
import { publicInternalError } from "@/lib/apiResponse";
import { query, transaction } from "@/lib/db";

export async function DELETE(request) {
    try {
        const auth = await requireAuth(request, ["admin"]);
        if (!auth.success) return auth.response;
        const { eocType, filename } = await request.json();
        if (!eocType || !filename || !isSafeFilename(filename)) {
            return NextResponse.json({ success: false, message: "ข้อมูลไฟล์ไม่ถูกต้อง" }, { status: 400 });
        }

        const assets = await query(`
            SELECT id, storage_path
            FROM eoc_file_assets
            WHERE asset_type = 'infographic' AND eoc_type = ? AND stored_filename = ?
            LIMIT 1
        `, [eocType, filename]);
        if (!assets.length) {
            return NextResponse.json({ success: false, message: "ไม่พบข้อมูลไฟล์ในฐานข้อมูล" }, { status: 404 });
        }

        const filePath = resolveInside(process.cwd(), ...assets[0].storage_path.split("/"));
        const stagedPath = `${filePath}.deleting-${assets[0].id}`;
        await rename(filePath, stagedPath);
        try {
            await transaction(async (execute) => {
                await execute("DELETE FROM eoc_file_assets WHERE id = ?", [assets[0].id]);
                await execute(`
                    INSERT INTO activity_logs (user_id, action_type, description, created_at)
                    VALUES (?, 'delete_infographic', ?, NOW())
                `, [auth.user.id, `ลบ infographic ${filename}`]);
            });
        } catch (databaseError) {
            await rename(stagedPath, filePath).catch(() => {});
            throw databaseError;
        }
        await unlink(stagedPath);

        return NextResponse.json({ success: true, message: "ลบไฟล์สำเร็จ" });
    } catch (error) {
        console.error("Delete infographic asset error:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการลบไฟล์");
    }
}
