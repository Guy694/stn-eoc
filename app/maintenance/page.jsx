import Link from "next/link";
import { getMaintenanceState } from "@/lib/maintenance";

// หน้าแจ้งปิดปรับปรุงระบบ — proxy rewrite ทุกหน้ามาที่นี่ระหว่างปิดปรับปรุง
// เป็น server component ไม่เรียก API (API ถูกปิดอยู่) และไม่โหลด context ของระบบ
export const dynamic = "force-dynamic";
export const metadata = {
  title: "ปิดปรับปรุงระบบชั่วคราว | ศูนย์ข้อมูลสถานการณ์ฉุกเฉิน จังหวัดสตูล",
  robots: { index: false, follow: false }
};

const EMERGENCY = [["1669", "เจ็บป่วยฉุกเฉิน"], ["1784", "สาธารณภัย (ปภ.)"], ["191", "เหตุด่วนเหตุร้าย"], ["199", "ดับเพลิง"]];

function untilText(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function MaintenancePage({ searchParams }) {
  const params = await searchParams;
  const preview = params?.preview === "1";
  const state = await getMaintenanceState({ fresh: true });
  const showing = state.enabled || preview;
  const until = untilText(state.until);

  return (
    <main data-maintenance-page="" className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-[#071d33] px-4 py-10 text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/stn-eoc/img/darkfooter-2172.webp" alt="" aria-hidden="true" className="absolute inset-0 -z-20 h-full w-full object-cover object-[70%_center] opacity-70" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_30%_20%,rgba(11,76,134,.35),transparent_60%),linear-gradient(180deg,rgba(7,29,51,.55),rgba(7,29,51,.92))]" />

      {preview && !state.enabled ? (
        <p className="absolute inset-x-0 top-0 bg-amber-400 px-4 py-2 text-center text-sm font-bold text-slate-900">ตัวอย่างหน้าปิดปรับปรุง — ตอนนี้ระบบยังเปิดใช้งานตามปกติ</p>
      ) : null}

      <div className="w-full max-w-xl">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/stn-eoc/img/eoc-icon.png" alt="" width={56} height={56} className="h-14 w-14 rounded-full bg-white/90 p-1" />
          <p className="text-sm leading-snug text-[#c9dcee]">
            ศูนย์ข้อมูลสถานการณ์ฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล
            <span className="block text-xs text-[#9fc0d8]">Satun Medical and Public Health Emergency Situation Information Center</span>
          </p>
        </div>

        {showing ? (
          <>
            <h1 className="mt-8 font-[family-name:var(--font-kanit)] text-4xl font-semibold leading-tight sm:text-5xl">ปิดปรับปรุงระบบชั่วคราว</h1>
            <p className="mt-4 whitespace-pre-line text-lg leading-8 text-[#dbe8f2]">{state.message}</p>
            {until ? (
              <p className="mt-5 inline-flex flex-wrap items-baseline gap-x-2 rounded-2xl bg-white/10 px-4 py-2.5 ring-1 ring-white/15">
                <span className="text-sm text-[#9fc0d8]">คาดว่าจะกลับมาใช้งานได้</span>
                <span className="font-[family-name:var(--font-kanit)] text-xl font-semibold">{until} น.</span>
              </p>
            ) : null}

            <section className="mt-10" aria-labelledby="emergency-title">
              <h2 id="emergency-title" className="text-sm font-bold text-[#c9dcee]">ระหว่างนี้ ถ้ามีเหตุฉุกเฉิน โทรได้ทันที (ฟรี 24 ชม.)</h2>
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {EMERGENCY.map(([number, label]) => (
                  <li key={number}>
                    <a href={`tel:${number}`} className="block rounded-2xl bg-white/10 px-3 py-3 ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20">
                      <span className="block font-[family-name:var(--font-kanit)] text-3xl font-bold">{number}</span>
                      <span className="block text-xs text-[#c9dcee]">{label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <>
            <h1 className="mt-8 font-[family-name:var(--font-kanit)] text-3xl font-semibold">ระบบเปิดใช้งานตามปกติ</h1>
            <Link href="/" className="mt-4 inline-flex rounded-full bg-white px-5 py-2.5 font-bold text-[#0c2f4a] hover:bg-[#e6f0f8]">ไปหน้าแรก</Link>
          </>
        )}

        <p className="mt-10 text-xs text-[#9fc0d8]">
          สำนักงานสาธารณสุขจังหวัดสตูล •{" "}
          <Link href="/login/" className="underline underline-offset-4 hover:text-white">เข้าสู่ระบบสำหรับผู้ดูแลระบบ</Link>
        </p>
      </div>
    </main>
  );
}
