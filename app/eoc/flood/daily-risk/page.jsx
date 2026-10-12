import { redirect } from "next/navigation";

// หน้าสรุปความเสี่ยงรายวันเดิม — รวมเข้า "ภาพรวมสถานการณ์" แล้ว (ลิงก์เก่าพามาที่หน้าใหม่)
export default function FloodDailyRiskRedirect() {
  redirect("/eoc/flood/overview");
}
