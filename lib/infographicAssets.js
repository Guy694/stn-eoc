// คลังอินโฟกราฟิก (ฝ่ายสื่อสารความเสี่ยง): ไฟล์อยู่ใน public/infographics/<ประเภทภัย>/<ไฟล์> และมีข้อมูลในตาราง eoc_file_assets
export const INFOGRAPHIC_TYPES = ["flood", "drought", "tsunami", "earthquake", "disease"];
export const INFOGRAPHIC_CONTENT_TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

export const infographicUrl = (type, file) => `/stn-eoc/infographics/${type}/${file}`;

/** ชื่อที่แสดงให้ประชาชน: ชื่อไฟล์เดิมโดยตัดนามสกุลและขีดล่างออก */
export function infographicTitle(originalName, fallback = "อินโฟกราฟิก") {
  const name = String(originalName || "").replace(/\.(png|jpe?g)$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return name || fallback;
}
