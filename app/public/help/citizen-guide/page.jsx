import PublicLayout from "@/components/layouts/PublicLayout";
import GuideView from "@/components/guide/GuideView";
import { citizenGuide } from "@/lib/guides";

export const metadata = {
  title: "คู่มือสำหรับประชาชน | Satun Geo-EOC",
  description: "วิธีดูสถานการณ์ เช็กความเสี่ยงบ้าน ขอความช่วยเหลือ ติดตามคำขอ รายงานระดับน้ำ และรับแจ้งเตือนภัย จังหวัดสตูล"
};

export default function CitizenGuidePage() {
  return (
    <PublicLayout>
      <div className="px-4 py-6 sm:py-8">
        <GuideView guide={citizenGuide} current="citizen" />
      </div>
    </PublicLayout>
  );
}
