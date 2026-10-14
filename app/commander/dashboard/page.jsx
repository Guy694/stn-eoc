import { redirect } from "next/navigation";

// เมนู "ห้องบัญชาการ" ยกเลิกแล้ว — สรุปสำหรับห้องประชุมเข้าได้จากเมนูของแต่ละเหตุการณ์ และทางลัดในหน้าหลัก
// เก็บเส้นทางไว้ให้ลิงก์/บุ๊กมาร์กเดิมพาไปหน้าหลักแทนการขึ้น 404
export default function CommanderDashboardRedirect() {
  redirect("/dashboard");
}
