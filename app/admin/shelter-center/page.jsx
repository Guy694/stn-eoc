import { redirect } from "next/navigation";

// รวมเข้ากับหน้าศูนย์พักพิงใหม่ (แท็บทะเบียนกลาง)
export default function ShelterCenterRedirect() {
  redirect("/eoc/shelters?tab=registry");
}
