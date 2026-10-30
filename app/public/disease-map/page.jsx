import { redirect } from "next/navigation";

// แผนที่หลักของประชาชนคือ /public/weather-watch (หน้าแผนที่ภัยพิบัติเดิมเลิกใช้แล้ว)
export default function PublicDiseaseMapPage() {
  redirect("/public/weather-watch");
}
