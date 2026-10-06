import { redirect } from "next/navigation";

// หน้าแรกของเมนู "ภารกิจและข้อสั่งการ" คือสถานการณ์/ข้อสั่งการรายวัน (ภาพรวมอยู่ที่หน้าภาพรวมสถานการณ์)
export default function FloodEocManagementPage() {
  redirect("/eoc/flood/management/directives");
}
