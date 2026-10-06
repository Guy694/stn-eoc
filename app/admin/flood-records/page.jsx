import { redirect } from "next/navigation";

// หน้าบันทึกพื้นที่น้ำท่วมของ EOC ครอบคลุมทุกเหตุการณ์ (เลือกเหตุการณ์/ปี/วันที่ได้) จึงใช้หน้าเดียว
export default function FloodRecordsRedirect() {
  redirect("/eoc/flood/records");
}
