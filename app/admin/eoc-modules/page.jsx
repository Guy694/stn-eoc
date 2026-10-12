import { redirect } from "next/navigation";

// หน้าจัดการโมดูล EOC เดิม — เมนูงานของแต่ละเหตุการณ์กำหนดในระบบแล้ว ให้ไปที่หน้าเปิด/ปิด EOC
export default function EocModulesRedirect() {
  redirect("/admin/eoc-management");
}
