import { query } from "@/lib/db";
import { cleanTitle } from "@/components/public/announcements/announcementTopics";

// ตัวอย่างลิงก์เวลาแชร์ประกาศเข้า LINE / Facebook: ใช้ชื่อเรื่อง คำอธิบาย และอินโฟกราฟิกของประกาศนั้น
// (หน้า page.jsx เป็น client component จึงตั้ง metadata ที่ layout นี้แทน)
const SITE = "ศูนย์ข้อมูลสถานการณ์ฉุกเฉิน จังหวัดสตูล";
const FALLBACK = {
  title: `ประกาศและความรู้ | ${SITE}`,
  description: "ประกาศและความรู้จากศูนย์ข้อมูลสถานการณ์ฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล"
};

function summary(text, max = 160) {
  const plain = String(text || "").replace(/\s+/g, " ").trim();
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain;
}

// อินโฟกราฟิกต้นฉบับบางไฟล์ใหญ่หลาย MB: ส่งรุ่นย่อกว้าง 1200 px ให้แอปแชตดึงได้เร็ว
function shareImage(imagePath) {
  if (!imagePath) return null;
  if (/^https?:\/\//.test(imagePath)) return imagePath;
  // metadataBase ใน app/layout.jsx มี /stn-eoc อยู่แล้ว: path ที่ส่งให้ metadata ต้องไม่ซ้ำ /stn-eoc
  const file = `${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
  return /\.(svg|gif)$/i.test(file) ? file : `/_next/image/?url=${encodeURIComponent(`/stn-eoc${file}`)}&w=1200&q=75`;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const announcementId = Number.parseInt(String(id || ""), 10);
  if (!Number.isInteger(announcementId) || announcementId <= 0) return FALLBACK;

  try {
    const rows = await query(
      "SELECT title, description, image_path FROM announcements WHERE id = ? AND is_active = 1 LIMIT 1",
      [announcementId]
    );
    const item = rows?.[0];
    if (!item) return FALLBACK;

    const title = cleanTitle(item.title);
    const description = summary(item.description) || FALLBACK.description;
    const image = shareImage(item.image_path);
    const url = `/public/announcements/${announcementId}/`;

    return {
      title: `${title} | ${SITE}`,
      description,
      alternates: { canonical: url },
      openGraph: {
        type: "article",
        locale: "th_TH",
        siteName: SITE,
        url,
        title,
        description,
        ...(image ? { images: [{ url: image, width: 1200, alt: title }] } : {})
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title,
        description,
        ...(image ? { images: [image] } : {})
      }
    };
  } catch (error) {
    console.error("Announcement metadata error:", error?.message || error);
    return FALLBACK;
  }
}

export default function AnnouncementDetailLayout({ children }) {
  return children;
}
