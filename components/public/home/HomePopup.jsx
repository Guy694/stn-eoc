"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { HousePlus, Megaphone, Siren, TriangleAlert, X } from "lucide-react";
import HelpRequestLink from "@/components/public/HelpRequestLink";
import { responsiveImage } from "@/lib/imageUrl";

const URGENT_ADVICE = [
  "อยู่ห่างคลองและทางน้ำไหล ไม่ขับรถหรือเดินลุยน้ำที่ไหลเชี่ยว",
  "ขนย้ายของสำคัญ ยา และเอกสารขึ้นที่สูง ชาร์จโทรศัพท์ให้เต็ม",
  "ดูแลผู้สูงอายุ เด็ก และผู้ป่วยติดเตียง ให้พร้อมออกจากบ้านเมื่อมีประกาศ"
];

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
  const announcement = popup.announcement;
  const titleId = "home-popup-title";

  return (
    <div className="home-popup fixed inset-0 z-[1900] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="ปิด" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-[#06192a]/70 backdrop-blur-[2px]" />
      <div
        role={urgent ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        className="home-popup__panel relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-white text-[#15232e] shadow-2xl sm:max-w-lg sm:rounded-[1.75rem]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={`absolute right-3 top-3 z-10 rounded-full p-2 ${urgent || announcement?.image_path ? "bg-black/25 text-white hover:bg-black/40" : "text-slate-500 hover:bg-slate-100"}`}
          aria-label="ปิดหน้าต่างนี้"
        >
          <X className="h-5 w-5" />
        </button>

        {urgent ? (
          <>
            <div className="bg-[#b91c1c] px-6 pb-5 pt-6 text-white">
              <p className="flex items-center gap-2 text-sm font-bold text-red-100">
                <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                </span>
                เตือนด่วน จ.สตูล
              </p>
              <h2 id={titleId} className="mt-2 flex items-start gap-2 pr-8 font-[family-name:var(--font-kanit)] text-2xl font-bold leading-snug">
                <TriangleAlert className="mt-1 h-7 w-7 shrink-0" aria-hidden="true" />
                {popup.items.length > 1 ? `มีเหตุที่ต้องระวัง ${popup.items.length} จุด` : "มีเหตุที่ต้องระวังตอนนี้"}
              </h2>
            </div>
            <div className="px-6 py-5">
              <ul className="space-y-3">
                {popup.items.slice(0, 3).map((item) => (
                  <li key={item.id} className="border-l-4 border-[#dc2626] pl-3">
                    <p className="font-semibold leading-snug">{item.message}</p>
                    <p className="text-xs text-slate-500">{[timeText(item.issued_at), item.source].filter(Boolean).join(" • ")}</p>
                  </li>
                ))}
              </ul>
              {popup.items.length > 3 ? <p className="mt-2 text-sm text-slate-500">และอีก {popup.items.length - 3} จุด</p> : null}

              <h3 className="mt-5 font-[family-name:var(--font-kanit)] text-lg font-semibold text-[#0c2f4a]">ควรทำตอนนี้</h3>
              <ul className="mt-2 space-y-1.5 text-[15px] leading-7">
                {URGENT_ADVICE.map((item) => (
                  <li key={item} className="flex gap-2"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#dc2626]" aria-hidden="true" />{item}</li>
                ))}
              </ul>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Link href="/public/my-risk" onClick={onClose} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0b4c86] px-4 font-bold text-white hover:bg-[#083865]">
                  <HousePlus className="h-5 w-5" aria-hidden="true" /> บ้านฉันเสี่ยงไหม
                </Link>
                <HelpRequestLink className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#c81e1e] px-4 font-bold text-white hover:bg-[#a51818]" disabledClassName="cursor-not-allowed opacity-50">
                  <Siren className="h-5 w-5" aria-hidden="true" /> ขอความช่วยเหลือ
                </HelpRequestLink>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                <a href="tel:1784" className="font-semibold text-[#b91c1c] underline-offset-4 hover:underline">เหตุด่วนโทร 1784 / 1669</a>
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
