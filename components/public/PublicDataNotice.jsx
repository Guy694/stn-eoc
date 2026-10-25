import { TriangleAlert } from "lucide-react";

export default function PublicDataNotice() {
  return (
    <aside role="note" aria-label="ข้อควรทราบเกี่ยวกับข้อมูลสถานการณ์" className="border-b border-amber-300 bg-amber-50 text-amber-950">
      <div className="mx-auto flex max-w-[1600px] items-start gap-2.5 px-3 py-2.5 text-xs leading-5 sm:px-5 sm:text-sm">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 sm:h-5 sm:w-5" aria-hidden="true" />
        <p>
          <strong>ระบบอยู่ระหว่างทดสอบการแสดงผลและประเมินสถานการณ์</strong> ข้อมูลอาจล่าช้าหรือคลาดเคลื่อน ใช้ประกอบการติดตามเท่านั้น ไม่ใช่ประกาศเตือนภัยหรือคำสั่งอพยพ <strong>โปรดยึดประกาศและคำแนะนำจาก ปภ. จังหวัดสตูล และหน่วยงานทางการเป็นหลัก</strong>
        </p>
      </div>
    </aside>
  );
}
