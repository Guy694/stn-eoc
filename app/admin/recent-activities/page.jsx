import { redirect } from "next/navigation";

// หน้ากิจกรรมล่าสุดเดิม — ใช้ "ประวัติการใช้งาน" แทน
export default function RecentActivitiesRedirect() {
  redirect("/admin/activity-logs");
}
