// ไฟล์รูปของรายงานจากประชาชน (ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น)
// ต้นฉบับ: /uploads/incidents/<file> (เจ้าหน้าที่เท่านั้น) · สำเนาเผยแพร่: /uploads/incidents-public/<file>
import fs from "fs/promises";
import path from "path";
import { createRandomFilename, getPrivateUploadDir, getUploadBaseDir, isSafeFilename, resolveInside } from "./fileUpload.js";
import { stripImageMetadata } from "./imageSanitize.js";

export function parsePhotoPaths(raw) {
  if (!raw) return [];
  let list = [raw];
  if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try { list = JSON.parse(raw); } catch { list = [raw]; }
  }
  return list.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
}

// แปลง "/uploads/incidents/a.jpg" หรือ "/stn-eoc/uploads/incidents/a.jpg" → { dir, file }
export function parseUploadPath(value) {
  const parts = String(value || "").split("/").filter(Boolean);
  if (parts[0] === "stn-eoc") parts.shift();
  if (parts[0] === "uploads") parts.shift();
  if (parts.length !== 2 || !isSafeFilename(parts[1])) return null;
  return { dir: parts[0], file: parts[1] };
}

async function readFirst(candidates) {
  for (const candidate of candidates) {
    try { return await fs.readFile(candidate); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return null;
}

// สร้างสำเนารูปที่เลือกเผยแพร่: ล้าง EXIF/GPS ใหม่ทุกครั้ง (รูปเก่าก่อนมีระบบนี้ยังมีพิกัดติดอยู่)
export async function createPublicPhotoCopy(originalPath) {
  const parsed = parseUploadPath(originalPath);
  if (!parsed || parsed.dir !== "incidents") throw new Error("รูปที่เลือกไม่ใช่รูปของเรื่องนี้");
  const buffer = await readFirst([
    resolveInside(getPrivateUploadDir("incidents"), parsed.file),
    resolveInside(getUploadBaseDir(), "incidents", parsed.file)
  ]);
  if (!buffer) throw new Error("ไม่พบไฟล์รูปต้นฉบับ");
  const extension = (path.extname(parsed.file).slice(1) || "jpg").toLowerCase().replace("jpeg", "jpg");
  const clean = await stripImageMetadata(buffer, extension);
  const dir = getPrivateUploadDir("incidents-public");
  await fs.mkdir(dir, { recursive: true });
  const filename = createRandomFilename(extension);
  await fs.writeFile(resolveInside(dir, filename), clean);
  return `/uploads/incidents-public/${filename}`;
}

export async function removePublicPhotoCopy(publicPath) {
  const parsed = parseUploadPath(publicPath);
  if (!parsed || parsed.dir !== "incidents-public") return;
  await fs.unlink(resolveInside(getPrivateUploadDir("incidents-public"), parsed.file)).catch(() => {});
}
