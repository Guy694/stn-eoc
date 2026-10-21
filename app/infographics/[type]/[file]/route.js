import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { isSafeFilename } from "@/lib/fileUpload";
import { INFOGRAPHIC_CONTENT_TYPES, INFOGRAPHIC_TYPES } from "@/lib/infographicAssets";

// ส่งภาพอินโฟกราฟิกที่อัปโหลดหลังเปิดเซิร์ฟเวอร์ (Next ส่งไฟล์ใน public/ ได้เฉพาะที่มีอยู่ตอนเริ่มเซิร์ฟเวอร์)
// ไฟล์ที่มีอยู่ก่อนแล้ว Next ส่งให้เองโดยไม่ผ่าน route นี้ · ภาพเป็นข้อมูลเผยแพร่ ไม่ต้องเข้าสู่ระบบ
export async function GET(request, { params }) {
  const { type, file } = await params;
  const ext = path.extname(String(file || "")).toLowerCase();
  if (!INFOGRAPHIC_TYPES.includes(type) || !isSafeFilename(file) || !INFOGRAPHIC_CONTENT_TYPES[ext]) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const body = await fs.readFile(path.join(process.cwd(), "public", "infographics", type, file));
    return new NextResponse(body, {
      headers: {
        "Content-Type": INFOGRAPHIC_CONTENT_TYPES[ext],
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
