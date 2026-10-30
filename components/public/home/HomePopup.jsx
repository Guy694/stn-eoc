"use client";

import { useEffect, useRef } from "react";
import ShareLineButton from "@/components/public/ShareLineButton";
import Link from "next/link";
import { CloudRainWind, Car, Footprints, HousePlus, Map, MapPin, Megaphone, PackageCheck, Phone, Siren, Smartphone, TriangleAlert, Users, Waves, X, Zap } from "lucide-react";
import HelpRequestLink from "@/components/public/HelpRequestLink";
import { responsiveImage } from "@/lib/imageUrl";
import { alertDetail, alertHeadline, popupHazard } from "@/lib/homePopups";

// หัวภาพและคำแนะนำตามชนิดภัย: น้ำ = flood.png, ฝนตกหนัก = rainny.png (ภาพอยู่ใน public/img)
const HAZARD_VIEW = {
  flood: {
    image: "/stn-eoc/img/flood.png",
    title: "ระวังน้ำท่วมตอนนี้",
    Icon: Waves,
    head: "from-[#7f1d1d] via-[#991b1b]/90",
    accent: "text-[#b91c1c]",
    soft: "bg-red-50",
    ring: "ring-red-100",
    advice: [
      { Icon: Footprints, title: "อยู่ห่างคลองและทางน้ำไหล", sub: "ไม่ขับรถหรือเดินลุยน้ำที่ไหลเชี่ยว" },
      { Icon: PackageCheck, title: "ขนย้ายของสำคัญ ยา และเอกสารขึ้นที่สูง", sub: "ชาร์จโทรศัพท์ให้เต็ม" },
      { Icon: Users, title: "ดูแลผู้สูงอายุ เด็ก และผู้ป่วยติดเตียง", sub: "ให้พร้อมออกจากบ้านเมื่อมีประกาศ" }
    ]
  },
  // เตือนระดับน้ำที่ยังไม่ถึงตลิ่ง (เช่น ระดับน้ำอันตราย): ไม่ใช้คำว่าน้ำท่วมและภาพน้ำท่วม
  water: {
    image: "/stn-eoc/img/rainny.png",
    title: "ติดตามระดับน้ำตอนนี้",
    Icon: Waves,
    head: "from-[#7c2d12] via-[#9a3412]/90",
    accent: "text-[#c2410c]",
    soft: "bg-orange-50",
    ring: "ring-orange-100",
    advice: [
      { Icon: Footprints, title: "อยู่ห่างคลองและทางน้ำไหล", sub: "ไม่ขับรถหรือเดินลุยน้ำที่ไหลเชี่ยว" },
      { Icon: PackageCheck, title: "เตรียมของสำคัญ ยา และเอกสารให้พร้อมย้าย", sub: "ชาร์จโทรศัพท์ให้เต็ม" },
      { Icon: Smartphone, title: "ติดตามระดับน้ำและประกาศจากหน่วยงาน", sub: "หากน้ำล้นตลิ่งจะแจ้งเตือนอีกครั้ง" }
    ]
  },
  rain: {
    image: "/stn-eoc/img/rainny.png",
    title: "ระวังฝนตกหนักตอนนี้",
    Icon: CloudRainWind,
    head: "from-[#78350f] via-[#92400e]/90",
    accent: "text-[#b45309]",
    soft: "bg-amber-50",
    ring: "ring-amber-100",
    advice: [
      { Icon: Car, title: "ขับรถช้าลง ระวังถนนลื่น", sub: "เปิดไฟหน้า เว้นระยะรถคันหน้า" },
      { Icon: Zap, title: "อยู่ห่างต้นไม้ใหญ่ ป้าย และเสาไฟ", sub: "ไม่หลบฝนใต้ต้นไม้ใหญ่" },
      { Icon: Smartphone, title: "ติดตามประกาศจากหน่วยงาน", sub: "ชาร์จโทรศัพท์ให้เต็มไว้ก่อน" }
    ]
  }
};

function timeText(value) {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "" : `${date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`;
}

/** popup กลางจอ: เตือนด่วน หรือประกาศจากหน่วยงาน (ปิดด้วยปุ่ม Esc หรือแตะพื้นหลัง) */
export default function HomePopup({ popup, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!popup) return undefined;
    const previous = document.activeElement;
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [popup, onClose]);

  if (!popup) return null;
  const urgent = popup.kind === "urgent";
  const view = urgent ? HAZARD_VIEW[popupHazard(popup.items)] : null;
  const [first, ...others] = urgent ? popup.items : [];
  const announcement = popup.announcement;
  const titleId = "home-popup-title";

  return (
    <div className="home-popup fixed inset-0 z-[1900] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="ปิด" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-[#06192a]/70 backdrop-blur-[2px]" />
      <div
        role={urgent ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        className="home-popup__panel relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-white text-[#15232e] shadow-2xl sm:max-w-2xl sm:rounded-[1.75rem]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={`absolute right-2 top-2 z-20 rounded-full p-1.5 sm:right-3 sm:top-3 sm:p-2 ${urgent || announcement?.image_path ? "bg-black/25 text-white hover:bg-black/40" : "text-slate-500 hover:bg-slate-100"}`}
          aria-label="ปิดหน้าต่างนี้"
        >
          <X className="h-5 w-5" />
        </button>

        {urgent ? (
          <>
            <div className="relative isolate overflow-hidden bg-[#7f1d1d] text-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img {...responsiveImage(view.image, [640, 1080], "(min-width: 672px) 42rem, 100vw")} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
              <div className={`absolute inset-0 -z-10 bg-gradient-to-r ${view.head} to-transparent`} aria-hidden="true" />
              <div className="flex items-center gap-4 px-4 pb-9 pt-4 sm:gap-5 sm:px-7 sm:pb-14 sm:pt-7">
                <span className="hidden h-20 w-20 shrink-0 place-items-center rounded-3xl bg-white/10 ring-1 ring-white/30 backdrop-blur-sm sm:grid" aria-hidden="true">
                  <TriangleAlert className="h-11 w-11 text-white drop-shadow-[0_0_10px_rgba(255,255,255,.7)]" />
                </span>
                <div className="min-w-0 pr-10">
                  <p className="inline-flex items-center gap-2 rounded-full bg-black/25 px-2.5 py-0.5 text-xs font-bold sm:px-3 sm:py-1 sm:text-sm ring-1 ring-white/25">
                    <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:animate-none" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                    </span>
                    เตือนด่วน จ.สตูล
                  </p>
                  <h2 id={titleId} className="mt-2 font-[family-name:var(--font-kanit)] text-[1.35rem] font-bold leading-tight sm:text-4xl">
                    {popup.items.length > 1 ? `มีเหตุที่ต้องระวัง ${popup.items.length} จุด` : view.title}
                  </h2>
                  <p className="mt-0.5 hidden text-sm text-white/90 min-[400px]:block sm:mt-1 sm:text-base">โปรดติดตามสถานการณ์และดำเนินการตามคำแนะนำ</p>
                </div>
              </div>
            </div>

            <div className="relative -mt-5 rounded-t-[1.5rem] bg-white px-4 pb-4 pt-4 sm:-mt-6 sm:rounded-t-[1.75rem] sm:px-7 sm:pb-5 sm:pt-5">
              <div className="flex items-start gap-3 sm:gap-4">
                <span className={`grid h-11 w-11 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-full ${view.soft} ${view.accent}`} aria-hidden="true"><view.Icon className="h-5 w-5 sm:h-7 sm:w-7" /></span>
                <div className="min-w-0">
                  <p className="font-[family-name:var(--font-kanit)] text-lg font-bold leading-snug text-[#15232e] sm:text-2xl">{alertHeadline(first)}</p>
                  <p className="mt-0.5 line-clamp-2 break-words text-[15px] font-semibold leading-snug text-slate-800 sm:line-clamp-none sm:text-base">{alertDetail(first)}</p>
                  {first.details?.length ? <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-slate-600 sm:line-clamp-none">{first.details.join(" · ")}</p> : null}
                  <p className="mt-0.5 text-sm text-slate-500">{[timeText(first.issued_at), first.source].filter(Boolean).join(" • ")}</p>
                </div>
              </div>
              {others.length > 0 ? (
                <ul className={`mt-2.5 space-y-1 rounded-xl ${view.soft} px-3 py-2 sm:mt-3 sm:space-y-2 sm:rounded-2xl sm:px-4 sm:py-3`} aria-label="เหตุอื่นที่ต้องระวัง">
                  {others.slice(0, 2).map((item) => (
                    <li key={item.id} className="line-clamp-1 text-sm leading-6 sm:line-clamp-none"><span className={`font-bold ${view.accent}`}>{alertHeadline(item)}</span> · {alertDetail(item)}</li>
                  ))}
                  {others.length > 2 ? <li className="text-sm text-slate-500">และอีก {others.length - 2} จุด</li> : null}
                </ul>
              ) : null}

              <h3 className="mt-3 font-[family-name:var(--font-kanit)] text-base font-bold text-[#0c2f4a] sm:mt-5 sm:text-lg">ควรทำตอนนี้</h3>
              <ul className={`mt-1.5 grid gap-2 rounded-xl ${view.soft} p-3 sm:mt-2 sm:grid-cols-3 sm:gap-4 sm:rounded-2xl sm:p-4`}>
                {view.advice.map(({ Icon, title, sub }) => (
                  <li key={title} className="flex items-center gap-2.5 sm:items-start sm:gap-3">
                    <span className={`grid h-8 w-8 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-full bg-white ${view.accent} ring-1 ${view.ring}`} aria-hidden="true"><Icon className="h-4 w-4 sm:h-5 sm:w-5" /></span>
                    <span className="min-w-0 text-sm leading-5 sm:text-[15px] sm:leading-6"><span className="block font-semibold text-[#15232e]">{title}</span><span className="hidden text-sm text-slate-500 sm:block">{sub}</span></span>
                  </li>
                ))}
              </ul>

              <Link href="/public/weather-watch" onClick={onClose} className="mt-2.5 flex min-h-10 items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 text-sm sm:mt-3 sm:min-h-12 sm:rounded-2xl sm:px-4 sm:text-[15px] font-semibold text-[#0b4c86] ring-1 ring-slate-200 hover:bg-white">
                <span className="flex min-w-0 items-center gap-2"><MapPin className={`h-5 w-5 shrink-0 ${view.accent}`} aria-hidden="true" /><span className="truncate">ดูพื้นที่ที่ได้รับผลกระทบบนแผนที่</span></span>
                <Map className="h-5 w-5 shrink-0" aria-hidden="true" />
              </Link>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3">
                <Link href="/public/my-risk" onClick={onClose} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-[#0b4c86] px-2 text-[15px] sm:min-h-14 sm:gap-2 sm:rounded-2xl sm:px-4 sm:text-lg font-bold text-white shadow-[0_10px_20px_-12px_rgba(11,76,134,.9)] hover:bg-[#083865]">
                  <HousePlus className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden="true" /> บ้านฉันเสี่ยงไหม
                </Link>
                <HelpRequestLink className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-[#c81e1e] px-2 text-[15px] sm:min-h-14 sm:gap-2 sm:rounded-2xl sm:px-4 sm:text-lg font-bold text-white shadow-[0_10px_20px_-12px_rgba(200,30,30,.9)] hover:bg-[#a51818]" disabledClassName="cursor-not-allowed opacity-50">
                  <Siren className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden="true" /> ขอความช่วยเหลือ
                </HelpRequestLink>
              </div>
              <div className="mt-3 flex items-center justify-between gap-x-3 text-[13px] sm:mt-4 sm:text-sm">
                <a href="tel:1784" className="inline-flex items-center gap-1.5 font-semibold text-[#b91c1c] underline-offset-4 hover:underline"><Phone className="h-4 w-4" aria-hidden="true" /><span className="sm:hidden">โทร 1784 / 1669</span><span className="hidden sm:inline">เหตุฉุกเฉินโทร 1784 / 1669</span></a>
                <ShareLineButton
                  text={`⚠️ เตือนภัย จ.สตูล\n${popup.items.slice(0, 3).map((item) => `• ${item.message}`).join("\n")}\nติดตามสถานการณ์:`}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#06a644] hover:text-[#04833a]"
                />
                <button type="button" onClick={onClose} className="font-semibold text-slate-500 hover:text-slate-800">รับทราบ</button>
              </div>
            </div>
          </>
        ) : (
          <>
            {announcement.image_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img {...responsiveImage(`/stn-eoc${announcement.image_path}`, [640, 1080], "(min-width: 640px) 32rem, 100vw")} alt="" className="max-h-[50dvh] w-full bg-[#e3f1f4] object-contain" />
            ) : (
              <div className="flex items-center gap-2 bg-[#0c2f4a] px-6 pb-4 pt-6 text-white">
                <Megaphone className="h-6 w-6" aria-hidden="true" />
                <span className="font-[family-name:var(--font-kanit)] text-lg font-semibold">ประกาศจากหน่วยงาน</span>
              </div>
            )}
            <div className="px-6 py-5">
              <h2 id={titleId} className="pr-6 font-[family-name:var(--font-kanit)] text-xl font-bold leading-snug text-[#0c2f4a]">{announcement.title}</h2>
              {announcement.description ? (
                <p className="mt-2 line-clamp-5 whitespace-pre-line text-[15px] leading-7 text-slate-700">{announcement.description}</p>
              ) : null}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link href={`/public/announcements/${announcement.id}`} onClick={onClose} className="inline-flex min-h-11 items-center rounded-xl bg-[#0b4c86] px-5 font-bold text-white hover:bg-[#083865]">
                  อ่านต่อ
                </Link>
                <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center rounded-xl px-4 font-semibold text-slate-600 hover:bg-slate-100">
                  ปิด
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        .home-popup__panel { animation: home-popup-in .28s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes home-popup-in { from { transform: translateY(24px); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .home-popup__panel { animation: none; } }
      `}</style>
    </div>
  );
}
