import { redirect } from "next/navigation";

// รวมเข้ากับหน้ารายงานผู้ป่วยโรคระบาด (แท็บรายงานจากหน่วยบริการ)
export default function DiseaseReportsRedirect() {
  redirect("/eoc/disease/records?tab=facility");
}
