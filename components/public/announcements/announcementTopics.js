// หมวดของประกาศสำหรับหน้าประชาชน: สีและไอคอนตามประเภทเหตุการณ์
import { getAnnouncementCategory } from "@/components/announcements/announcementUtils";

export const TOPIC_STYLE = {
  flood: { label: "น้ำท่วม", dot: "#0b72b9", soft: "#e3f1fb", text: "#0b4c86" },
  disease: { label: "โรคระบาด", dot: "#c2415d", soft: "#fde8ee", text: "#9f1d3f" },
  accident: { label: "อุบัติเหตุ", dot: "#d9731a", soft: "#fdeedd", text: "#9a4a07" },
  "festival-accidents": { label: "อุบัติเหตุ", dot: "#d9731a", soft: "#fdeedd", text: "#9a4a07" },
  drought: { label: "ภัยแล้ง", dot: "#b88a12", soft: "#fbf2d8", text: "#7a5a00" },
  general: { label: "ทั่วไป", dot: "#2a9db0", soft: "#e3f3f5", text: "#11586a" }
};

export function topicKey(item) {
  const key = item?.eoc_type === "festival-accidents" ? "accident" : item?.eoc_type;
  return TOPIC_STYLE[key] ? key : "general";
}

export function topicOf(item) {
  const key = topicKey(item);
  return { key, ...TOPIC_STYLE[key], category: item?.category || null, fullLabel: getAnnouncementCategory(item) };
}

/** "3 วันที่แล้ว" / "2 เดือนที่แล้ว" — ใช้คู่กับวันที่เต็ม */
export function relativeThai(value, now = Date.now()) {
  const time = new Date(value || 0).getTime();
  if (!time) return "";
  const days = Math.floor((now - time) / 86400000);
  if (days < 1) return "วันนี้";
  if (days < 2) return "เมื่อวาน";
  if (days < 7) return `${days} วันที่แล้ว`;
  if (days < 30) return `${Math.floor(days / 7)} สัปดาห์ที่แล้ว`;
  if (days < 365) return `${Math.floor(days / 30)} เดือนที่แล้ว`;
  return `${Math.floor(days / 365)} ปีที่แล้ว`;
}

/** ตัดอีโมจินำหน้าหัวข้อออกเวลาแสดงตัวใหญ่ (ยังคงไว้ในเนื้อหา) */
export function cleanTitle(title) {
  return String(title || "").replace(/^[\p{Extended_Pictographic}️\s]+/u, "").trim() || String(title || "");
}
