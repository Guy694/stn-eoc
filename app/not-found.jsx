import Link from "next/link";
import { Home, LifeBuoy, Map, Megaphone, Phone } from "lucide-react";
import PublicLayout from "@/components/layouts/PublicLayout";

export const metadata = {
  title: "ไม่พบหน้านี้ | ศูนย์ข้อมูลสถานการณ์ฉุกเฉิน จังหวัดสตูล"
};

// หน้าไม่พบ: คนที่หลงมาช่วงเกิดภัยต้องเจอทางไปต่อทันที ไม่ใช่หน้าเปล่า
const LINKS = [
  { href: "/", label: "หน้าแรก", note: "สถานการณ์และสภาพอากาศวันนี้", Icon: Home },
  { href: "/public/weather-watch", label: "แผนที่สถานการณ์", note: "จุดน้ำท่วม ถนน และสถานพยาบาล", Icon: Map },
  { href: "/public/announcements", label: "ประกาศและความรู้", note: "ประกาศล่าสุดจากศูนย์ฯ", Icon: Megaphone }
];

export default function NotFound() {
  return (
    <PublicLayout>
      <div className="min-h-[70vh] bg-[#eef2f1]">
        <section className="bg-[#0c2f4a] text-white">
          <div className="mx-auto max-w-3xl px-4 pb-14 pt-12 sm:px-6">
            <p className="font-[family-name:var(--font-kanit)] text-6xl font-semibold text-[#5cc8db] sm:text-7xl" aria-hidden="true">404</p>
            <h1 className="mt-3 font-[family-name:var(--font-kanit)] text-3xl font-semibold sm:text-4xl">ไม่พบหน้าที่คุณเปิด</h1>
            <p className="mt-3 max-w-xl leading-relaxed text-[#c9dde6]">ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายไปแล้ว เลือกหน้าที่ต้องการด้านล่างได้เลย</p>
          </div>
        </section>

        <div className="mx-auto -mt-8 max-w-3xl px-4 pb-14 sm:px-6">
          <div className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#f3c4c4] sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="font-[family-name:var(--font-kanit)] text-xl font-semibold text-[#9f1d1d]">กำลังต้องการความช่วยเหลือ?</p>
              <p className="mt-1 text-slate-600">มีคนบาดเจ็บหรือติดอยู่ โทรหาหน่วยแพทย์ฉุกเฉินได้ทันที</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="tel:1669" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-red-600 px-5 font-bold text-white hover:bg-red-700">
                <Phone className="h-5 w-5" aria-hidden="true" /> โทร 1669
              </a>
              <Link href="/public/report-incident" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-bold text-red-700 ring-2 ring-red-200 hover:bg-red-50">
                <LifeBuoy className="h-5 w-5" aria-hidden="true" /> ขอความช่วยเหลือ
              </Link>
            </div>
          </div>

          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {LINKS.map(({ href, label, note, Icon }) => (
              <li key={href}>
                <Link href={href} className="group flex h-full flex-col rounded-2xl bg-white p-5 ring-1 ring-[#d6e3ea] transition hover:ring-[#2a9db0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b4c86]">
                  <Icon className="h-6 w-6 text-[#2a9db0]" aria-hidden="true" />
                  <span className="mt-3 font-[family-name:var(--font-kanit)] text-lg font-semibold text-[#0c2f4a] group-hover:text-[#0b4c86]">{label}</span>
                  <span className="mt-1 text-sm text-slate-500">{note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PublicLayout>
  );
}
