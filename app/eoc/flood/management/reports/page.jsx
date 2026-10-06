import { redirect } from "next/navigation";

// รายงานของกลุ่มภารกิจรวมอยู่ในแท็บเดียว
export default function Page() {
  redirect("/eoc/flood/management/team-workspace");
}
