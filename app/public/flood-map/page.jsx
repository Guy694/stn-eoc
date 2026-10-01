import { redirect } from "next/navigation";

// รวมเป็นแผนที่เดียว: /public/disaster-map (เลือกประเภทภัยได้ในหน้า)
export default function PublicFloodMapPage() {
  redirect("/public/disaster-map?type=flood");
}
