import { redirect } from "next/navigation";

// EOC อุบัติเหตุทั่วไปยังไม่เปิดใช้ — งานอุบัติเหตุอยู่ที่ "อุบัติเหตุช่วงเทศกาล"
export default function AccidentEOCRedirect() {
  redirect("/eoc/festival-accidents");
}
