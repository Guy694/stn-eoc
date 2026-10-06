#!/usr/bin/env node
// ย้ายรูปจากประชาชนออกจาก public/uploads/incidents ไปเก็บที่ private/uploads/incidents และล้างพิกัด GPS/EXIF ออกจากทุกรูป
//   ดูก่อนว่าจะทำอะไร:  npm run incidents:secure-photos
//   ทำจริง:             npm run incidents:secure-photos -- --apply
// ชื่อไฟล์และ path ในฐานข้อมูล (/uploads/incidents/<ชื่อไฟล์>) ไม่เปลี่ยน — app/uploads หาไฟล์ใน private ก่อนเสมอ
// รันซ้ำได้: รูปที่ไม่มี EXIF แล้วและอยู่ใน private แล้วจะข้าม
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { stripImageMetadata } from "../lib/imageSanitize.js";

const apply = process.argv.includes("--apply");
const publicDir = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads"), "incidents");
const privateDir = path.join(process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), "private", "uploads"), "incidents");
const IMAGE = /\.(jpe?g|png|webp)$/i;

async function list(dir) {
  try {
    return (await fs.readdir(dir, { withFileTypes: true })).filter((entry) => entry.isFile() && IMAGE.test(entry.name)).map((entry) => entry.name);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

const counts = { moved: 0, stripped: 0, skipped: 0, failed: 0 };
const fromPublic = await list(publicDir);
const inPrivate = await list(privateDir);

console.log(`รูปใน public (เปิดได้โดยไม่ต้องเข้าสู่ระบบ): ${fromPublic.length} ไฟล์ — ${publicDir}`);
console.log(`รูปใน private: ${inPrivate.length} ไฟล์ — ${privateDir}`);
if (apply) await fs.mkdir(privateDir, { recursive: true });

async function processFile(sourcePath, name, move) {
  const buffer = await fs.readFile(sourcePath);
  const meta = await sharp(buffer).metadata();
  const hasMeta = Boolean(meta.exif || meta.xmp || meta.iptc);
  if (!hasMeta && !move) { counts.skipped += 1; return; }
  const label = `${move ? "ย้าย" : "คงที่เดิม"}${hasMeta ? " + ล้าง EXIF" : ""}`;
  console.log(`  ${label}: ${name}`);
  if (!apply) { if (move) counts.moved += 1; if (hasMeta) counts.stripped += 1; return; }
  const extension = path.extname(name).slice(1);
  const output = hasMeta ? await stripImageMetadata(buffer, extension) : buffer;
  const target = path.join(privateDir, name);
  await fs.writeFile(target, output);
  if (move) {
    // ห้ามลบต้นฉบับก่อนเขียนสำเนาเสร็จ
    await fs.rename(sourcePath, `${sourcePath}.moved-to-private`).catch(() => {});
    await fs.unlink(`${sourcePath}.moved-to-private`).catch(() => {});
    counts.moved += 1;
  }
  if (hasMeta) counts.stripped += 1;
}

for (const name of fromPublic) {
  try { await processFile(path.join(publicDir, name), name, true); }
  catch (error) { counts.failed += 1; console.error(`  ผิดพลาด ${name}: ${error.message}`); }
}
for (const name of inPrivate) {
  if (fromPublic.includes(name)) continue;
  try { await processFile(path.join(privateDir, name), name, false); }
  catch (error) { counts.failed += 1; console.error(`  ผิดพลาด ${name}: ${error.message}`); }
}

console.log(`\nสรุป: ย้าย ${counts.moved} · ล้าง EXIF ${counts.stripped} · ไม่ต้องทำ ${counts.skipped} · ผิดพลาด ${counts.failed}`);
if (!apply) console.log("ยังไม่ได้เปลี่ยนอะไร — เพิ่ม -- --apply เพื่อทำจริง");
