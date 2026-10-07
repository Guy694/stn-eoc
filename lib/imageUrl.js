// ย่อรูปที่อัปโหลด (อินโฟกราฟิก PNG บางไฟล์ใหญ่ 3 MB) ผ่านตัวย่อรูปของ Next ก่อนส่งไปมือถือ
// เบราว์เซอร์ได้ WebP ขนาดตามที่แสดงจริง ส่วนปุ่ม "ดูภาพเต็ม" ยังเปิดไฟล์ต้นฉบับ
const BASE_PATH = "/stn-eoc";
// ต้องตรงกับ deviceSizes + imageSizes ค่าเริ่มต้นของ Next (ค่าอื่นจะถูกปฏิเสธ)
export const IMAGE_WIDTHS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];
const QUALITY = 75; // Next 16 รับเฉพาะคุณภาพที่ตั้งไว้ใน images.qualities (ค่าเริ่มต้น [75])

function snapWidth(width) {
  return IMAGE_WIDTHS.find((allowed) => allowed >= width) || IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];
}

function canOptimize(src) {
  return typeof src === "string" && src.startsWith("/") && !src.startsWith("//") && !/\.(svg|gif)(\?|$)/i.test(src);
}

export function optimizedImage(src, width) {
  if (!canOptimize(src)) return src;
  return `${BASE_PATH}/_next/image/?url=${encodeURIComponent(src)}&w=${snapWidth(width)}&q=${QUALITY}`;
}

/** props สำหรับ <img>: src + srcSet + sizes (ไม่ย่อได้ → คืนแค่ src เดิม) */
export function responsiveImage(src, widths, sizes) {
  if (!canOptimize(src)) return { src };
  const list = [...new Set(widths.map(snapWidth))].sort((a, b) => a - b);
  return {
    src: optimizedImage(src, list[list.length - 1]),
    srcSet: list.map((width) => `${optimizedImage(src, width)} ${width}w`).join(", "),
    sizes
  };
}
