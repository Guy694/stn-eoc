import { redirect } from "next/navigation";

// แบบบันทึกหลักคือหน้าบันทึกพื้นที่น้ำท่วม
export default function Page() {
  redirect("/eoc/flood/records");
}
