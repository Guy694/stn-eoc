"use client";

import { useEffect, useState } from "react";
import { TriangleAlert, X } from "lucide-react";

const DISMISSED_KEY = "stn-eoc:public-data-notice-dismissed";

export default function PublicDataNotice() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(DISMISSED_KEY) === "1") setVisible(false);
    } catch {
      // หาก sessionStorage ใช้ไม่ได้ ปุ่มปิดยังซ่อนข้อความได้ในหน้าปัจจุบัน
    }
  }, []);
  if (!visible) return null;

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ยังคงซ่อนข้อความในหน้าปัจจุบันได้
    }
    setVisible(false);
  };

  return (
    <aside role="note" aria-label="ข้อควรทราบเกี่ยวกับข้อมูลสถานการณ์" className="border-b border-amber-300 bg-amber-50 text-amber-950">
      <div className="mx-auto flex max-w-[1600px] items-start gap-2.5 px-3 py-2.5 text-xs leading-5 sm:px-5 sm:text-sm">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 sm:h-5 sm:w-5" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          <strong>ระบบอยู่ระหว่างทดสอบการแสดงผลและประเมินสถานการณ์</strong> ข้อมูลอาจล่าช้าหรือคลาดเคลื่อน ใช้ประกอบการติดตามเท่านั้น ไม่ใช่ประกาศเตือนภัยหรือคำสั่งอพยพ <strong>โปรดยึดประกาศและคำแนะนำจาก ปภ. จังหวัดสตูล และหน่วยงานทางการเป็นหลัก</strong>
        </p>
        <button type="button" onClick={dismiss} aria-label="ปิดข้อควรทราบ" title="ปิดข้อความ" className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-amber-800 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
