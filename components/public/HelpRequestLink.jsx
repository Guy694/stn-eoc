"use client";

import Link from "next/link";
import useHelpAvailability, { HELP_CLOSED_HINT } from "@/components/public/useHelpAvailability";

// ลิงก์ไปหน้า "ขอความช่วยเหลือ" — ใช้ได้เฉพาะเมื่อมี EOC เปิดอยู่
// เมื่อ EOC ปิด จะเปลี่ยนเป็นปุ่มสีเทาที่กดไม่ได้ พร้อมคำอธิบาย (ไม่ซ่อนปุ่ม เพื่อให้ประชาชนรู้ว่าเมื่อไหร่จะใช้ได้)
// children เป็นฟังก์ชันได้: ({ helpOpen }) => ... เพื่อเปลี่ยนข้อความตามสถานะ
export default function HelpRequestLink({ className = "", disabledClassName = "", onClick, children }) {
  const { helpOpen } = useHelpAvailability();
  const content = typeof children === "function" ? children({ helpOpen }) : children;

  if (!helpOpen) {
    return (
      <span
        role="link"
        aria-disabled="true"
        title={HELP_CLOSED_HINT}
        className={`${className} ${disabledClassName || "cursor-not-allowed bg-slate-300 text-slate-600 hover:bg-slate-300"}`}
      >
        {content}
      </span>
    );
  }

  return <Link href="/public/report-incident" onClick={onClick} className={className}>{content}</Link>;
}
