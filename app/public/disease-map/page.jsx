import { redirect } from "next/navigation";

// รวมเป็นแผนที่เดียว: /public/disaster-map (เลือกประเภทภัยได้ในหน้า)
export default function PublicDiseaseMapPage() {
  redirect("/public/disaster-map?type=disease");
}
