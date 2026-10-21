import { redirect } from "next/navigation";

// ย้ายไปเป็นหัวข้อหนึ่งในตั้งค่าระบบ
export default function AlertTestRedirect() {
  redirect("/admin/settings?section=alert-test");
}
