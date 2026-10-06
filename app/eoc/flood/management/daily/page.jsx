import { redirect } from "next/navigation";

// ซ้ำกับหน้าภาพรวมสถานการณ์ — รวมไปที่นั่น
export default function Page() {
  redirect("/eoc/flood/overview");
}
