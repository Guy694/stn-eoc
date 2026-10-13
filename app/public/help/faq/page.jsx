import { redirect } from "next/navigation";

// คำถามที่พบบ่อยรวมอยู่ในคู่มือประชาชนแล้ว (หัวข้อท้ายคู่มือ) — ลิงก์เดิมพาไปที่หัวข้อนั้น
export default function FaqRedirect() {
  redirect("/public/help/citizen-guide#faq");
}
