import { redirect } from "next/navigation";

// ความครบของรายงานอยู่ในหน้าภาพรวมสถานการณ์
export default function Page() {
  redirect("/eoc/flood/overview#sec-completeness");
}
