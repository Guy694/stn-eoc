"use client";

import Link from "next/link";
import useHelpAvailability, { HELP_CLOSED_HINT, WATER_CLOSED_HINT } from "@/components/public/useHelpAvailability";

// ลิงก์ไปหน้า "ขอความช่วยเหลือ" — ใช้ได้เฉพาะเมื่อมี EOC เปิดอยู่
// เมื่อ EOC ปิด จะเปลี่ยนเป็นปุ่มสีเทาที่กดไม่ได้ พร้อมคำอธิบาย (ไม่ซ่อนปุ่ม เพื่อให้ประชาชนรู้ว่าเมื่อไหร่จะใช้ได้)
// children เป็นฟังก์ชันได้: ({ helpOpen }) => ... เพื่อเปลี่ยนข้อความตามสถานะ
// kind="water" → ลิงก์ "รายงานระดับน้ำ" ซึ่งเปิดเฉพาะเมื่อมี EOC ด้านอุทกภัย
export default function HelpRequestLink({ kind = "help", className = "", disabledClassName = "", onClick, children, ...rest }) {
  const availability = useHelpAvailability();
  const isWater = kind === "water";
  const helpOpen = isWater ? availability.floodOpen : availability.helpOpen;
  const content = typeof children === "function" ? children({ helpOpen }) : children;

  if (!helpOpen) {
    return (
      <span
        role="link"
        aria-disabled="true"
        title={isWater ? WATER_CLOSED_HINT : HELP_CLOSED_HINT}
        className={`${className} ${disabledClassName || "cursor-not-allowed bg-slate-300 text-slate-600 hover:bg-slate-300"}`}
      >
        {content}
      </span>
    );
  }

  return <Link href={isWater ? "/public/report-water" : "/public/report-incident"} onClick={onClick} className={className} {...rest}>{content}</Link>;
}
