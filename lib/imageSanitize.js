// ล้างข้อมูลแฝงในรูป (EXIF: พิกัด GPS, รุ่นมือถือ, เวลา) ก่อนเก็บรูปจากประชาชน
// sharp จะไม่คัดลอก metadata ออกไปเว้นแต่สั่ง withMetadata() — rotate() หมุนรูปตาม EXIF ก่อนทิ้ง
// ถ้าประมวลผลรูปไม่ได้จะโยน error (ไม่บันทึกรูปที่ยังมีพิกัดติดอยู่)

const MAX_EDGE = 2400;

const FORMAT_BY_EXTENSION = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp" };

export async function stripImageMetadata(buffer, extension = "jpg") {
  const { default: sharp } = await import("sharp");
  const format = FORMAT_BY_EXTENSION[String(extension).toLowerCase()] || "jpeg";
  const pipeline = sharp(buffer, { failOn: "error" })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });
  if (format === "png") return pipeline.png({ compressionLevel: 8 }).toBuffer();
  if (format === "webp") return pipeline.webp({ quality: 82 }).toBuffer();
  return pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

// ใช้ในเทสต์/สคริปต์: รูปนี้ยังมี EXIF หรือ GPS อยู่หรือไม่
export async function readImageMetadataFlags(buffer) {
  const { default: sharp } = await import("sharp");
  const meta = await sharp(buffer).metadata();
  return { hasExif: Boolean(meta.exif), hasXmp: Boolean(meta.xmp), hasIptc: Boolean(meta.iptc) };
}
