import { redirect } from "next/navigation";

// รวมเข้าหน้า "โรคและสุขภาพ" ของ EOC อุทกภัย (แท็บในศูนย์พักพิง)
export default function ShelterDiseaseReportsRedirect() {
  redirect("/eoc/flood/health?tab=shelter");
}
