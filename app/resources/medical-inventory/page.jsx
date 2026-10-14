import { redirect } from "next/navigation";

// เมนู "เวชภัณฑ์และคงคลัง" รวมเข้ากับ "เวชภัณฑ์และคลังยา" แล้ว (ยอดตั้งต้น + รายงานประจำวัน + dashboard อยู่หน้าเดียว)
// เก็บเส้นทางไว้ให้ลิงก์/บุ๊กมาร์กเดิมพาไปหน้าใหม่แทนการขึ้น 404
export default function MedicalInventoryRedirect() {
  redirect("/eoc/flood/supplies");
}
