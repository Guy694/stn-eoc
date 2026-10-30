"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HousePlus, SearchCheck, Siren, Tent, Waves, X } from "lucide-react";
import useHelpAvailability from "@/components/public/useHelpAvailability";

const SLOT = "bb-slot relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1 px-0.5 pb-1.5 pt-2 text-center font-[family-name:var(--font-kanit)] text-[11.5px] font-medium leading-[1.15] tracking-[0.01em]";
const ICON = "bb-icon h-[22px] w-[22px]";
const OFF = "cursor-not-allowed text-slate-400!";
// ชื่อปุ่มสองบรรทัด (จอมือถือแคบ ปุ่มละ ~75px)
const Label = ({ top, bottom, className = "" }) => <span className={`block w-full ${className}`}>{top}<br />{bottom}</span>;
// ขีดบอกหน้าปัจจุบันเหนือปุ่ม
const Current = ({ on }) => (on ? <span className="bb-current absolute left-1/2 top-0 h-[3px] w-8 -translate-x-1/2 rounded-b-full bg-current" aria-hidden="true" /> : null);

/**
 * แถบล่างบนมือถือ — แสดงตลอด (ซ่อนเฉพาะตอนเปิดเมนูด้านบน: visible=false) ปุ่มแจ้ง/รายงานอยู่กลางและยกสูงกว่าปุ่มอื่น
 * รวมถึงหน้าแผนที่ /public/weather-watch (หน้านั้นเว้นที่ใต้แผนที่ให้แถบเอง)
 * เมนูแจ้ง/รายงานคงรายการทั้งสองไว้ และแสดงสถานะปิดรับเมื่อบริการยังไม่เปิด
 */
export default function PublicBottomBar({ visible, activeMenu, reserveSpace = false }) {
  const { sheltersOpen, helpOpen, floodOpen } = useHelpAvailability();
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const tone = (key) => (activeMenu === key ? "text-[#0b4c86] font-semibold" : "text-slate-600 hover:text-[#0b4c86]");
  const current = (key) => (activeMenu === key ? { "aria-current": "page" } : {});

  // บอกหน้าเว็บว่าแถบล่างแสดงอยู่: เว้นที่ท้ายหน้า (หน้าที่แสดงแถบตลอด) และยกปุ่มผู้ช่วย AI ให้พ้นแถบ
  useEffect(() => {
    const root = document.documentElement;
    if (visible) root.dataset.bottomBar = "on"; else delete root.dataset.bottomBar;
    if (reserveSpace) root.dataset.bottomBarSpace = "on";
    return () => { delete root.dataset.bottomBar; delete root.dataset.bottomBarSpace; };
  }, [visible, reserveSpace]);
  useEffect(() => {
    if (!visible) setReportMenuOpen(false);
  }, [visible]);
  useEffect(() => {
    if (!reportMenuOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") setReportMenuOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reportMenuOpen]);
  return (
    <nav
      aria-label="ทางลัดด้านล่าง"
      aria-hidden={!visible}
      inert={!visible}
      className={`bottom-bar fixed inset-x-0 bottom-0 z-[950] border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_-12px_rgba(12,47,74,.45)] backdrop-blur lg:hidden ${visible ? "is-on" : ""}`}
    >
      <style>{`
        .bottom-bar { transform: translateY(110%); transition: transform .38s cubic-bezier(.22,1.2,.36,1); }
        .bottom-bar.is-on { transform: translateY(0); }
        .bottom-bar .bb-slot { opacity: 0; transform: translateY(10px); transition: opacity .25s ease, transform .35s cubic-bezier(.22,1.2,.36,1); }
        .bottom-bar.is-on .bb-slot { opacity: 1; transform: none; }
        .bottom-bar.is-on .bb-slot:nth-child(1) { transition-delay: .04s; }
        .bottom-bar.is-on .bb-slot:nth-child(2) { transition-delay: .08s; }
        .bottom-bar.is-on .bb-slot:nth-child(3) { transition-delay: 0s; }
        .bottom-bar.is-on .bb-slot:nth-child(4) { transition-delay: .08s; }
        .bottom-bar.is-on .bb-slot:nth-child(5) { transition-delay: .12s; }
        .bottom-bar .bb-icon { transition: transform .18s ease; }
        .bottom-bar .bb-slot:active .bb-icon { transform: scale(.86); }
        .bottom-bar .bb-help-ring { animation: bb-ring 2.4s ease-out infinite; }
        @keyframes bb-ring { 0% { transform: scale(1); opacity: .55; } 70%, 100% { transform: scale(1.55); opacity: 0; } }
        .bottom-bar .bb-slot:active .bb-help { transform: scale(.92); }
        .bottom-bar .bb-help { transition: transform .18s ease; }
        @media (max-width: 1023.98px) {
          html[data-bottom-bar-space="on"] body { padding-bottom: calc(4.5rem + env(safe-area-inset-bottom)); }
          html[data-bottom-bar="on"] .eoc-assistant-launcher { bottom: calc(5.5rem + env(safe-area-inset-bottom)); transition: bottom .3s ease; }
        }
        @media (prefers-reduced-motion: reduce) {
          .bottom-bar, .bottom-bar .bb-slot, .bottom-bar .bb-icon, .bottom-bar .bb-help { transition: none; }
          .bottom-bar .bb-slot { transform: none; }
          .bottom-bar .bb-help-ring { animation: none; opacity: 0; }
        }
      `}</style>
      <div className="mx-auto flex max-w-lg items-end">
        <Link href="/public/weather-watch" className={`${SLOT} ${tone("weather")}`} {...current("weather")}>
          <Current on={activeMenu === "weather"} />
          <Waves className={ICON} aria-hidden="true" />
          <Label top="แผนที่" bottom="สถานการณ์" />
        </Link>
        <Link href="/public/my-risk" className={`${SLOT} ${tone("myrisk")}`} {...current("myrisk")}>
          <Current on={activeMenu === "myrisk"} />
          <HousePlus className={ICON} aria-hidden="true" />
          <Label top="บ้านฉัน" bottom="เสี่ยงไหม" />
        </Link>
        <div className="relative flex min-w-0 flex-1 justify-center">
          {reportMenuOpen ? (
            <>
              <button type="button" aria-label="ปิดเมนูแจ้ง/รายงาน" onClick={() => setReportMenuOpen(false)} className="fixed inset-0 z-[951] cursor-default" />
              <div role="menu" aria-label="เลือกแจ้งหรือรายงาน" className="absolute bottom-[calc(100%+0.7rem)] left-1/2 z-[952] w-56 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-[0_12px_40px_-12px_rgba(15,23,42,.45)]">
                <p className="px-3 py-2 text-xs font-bold text-slate-500">เลือกบริการที่ต้องการ</p>
                {floodOpen ? (
                  <Link role="menuitem" href="/public/report-water" onClick={() => setReportMenuOpen(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 font-bold text-slate-800 hover:bg-sky-50"><Waves className="h-5 w-5 text-sky-700" aria-hidden="true" /><span>รายงานระดับน้ำ</span></Link>
                ) : <span role="menuitem" aria-disabled="true" title="ขณะนี้ยังไม่เปิดรับรายงานระดับน้ำ" className="flex min-h-12 cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 font-semibold text-slate-400"><Waves className="h-5 w-5" aria-hidden="true" /><span>รายงานระดับน้ำ<span className="mt-0.5 block text-[10px] font-medium text-slate-400">ยังไม่เปิดรับรายงาน</span></span></span>}
                {helpOpen ? (
                  <Link role="menuitem" href="/public/report-incident" onClick={() => setReportMenuOpen(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 font-bold text-red-800 hover:bg-red-50"><Siren className="h-5 w-5" aria-hidden="true" /><span>ขอความช่วยเหลือ</span></Link>
                ) : <span role="menuitem" aria-disabled="true" title="ปุ่มขอความช่วยเหลือจะเปิดเมื่อศูนย์เริ่มดำเนินการ" className="flex min-h-12 cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 font-semibold text-slate-400"><Siren className="h-5 w-5 text-slate-300" aria-hidden="true" /><span>ขอความช่วยเหลือ<span className="mt-0.5 block text-[10px] font-medium text-slate-400">ยังไม่เปิดให้บริการ</span></span></span>}
              </div>
            </>
          ) : null}
          <button type="button" aria-haspopup="menu" aria-expanded={reportMenuOpen} onClick={() => setReportMenuOpen((open) => !open)} className={`${SLOT} text-[#c81e1e]`} aria-current={activeMenu === "help" || activeMenu === "water" ? "page" : undefined}>
            <Current on={activeMenu === "help" || activeMenu === "water"} />
            <span className="relative -mt-7 flex h-14 w-14 items-center justify-center">
              <span className={`bb-help relative flex h-14 w-14 items-center justify-center rounded-full text-white ring-4 ring-white ${helpOpen || floodOpen ? "bg-[#c81e1e] shadow-[0_8px_18px_-6px_rgba(200,30,30,.7)]" : "bg-slate-300"}`}>
                {reportMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Siren className="h-7 w-7" aria-hidden="true" />}
              </span>
            </span>
            <Label top="แจ้ง/" bottom="รายงาน" className="font-semibold" />
          </button>
        </div>
        <Link href="/public/track" className={`${SLOT} ${tone("track")}`} {...current("track")}>
          <Current on={activeMenu === "track"} />
          <SearchCheck className={ICON} aria-hidden="true" />
          <Label top="ติดตาม" bottom="คำขอ" />
        </Link>
        {sheltersOpen ? (
          <Link href="/public/shelters?near=1" className={`${SLOT} ${activeMenu === "shelters" ? "font-semibold text-[#6d3fc4]" : "text-slate-600 hover:text-[#6d3fc4]"}`} {...current("shelters")}>
            <Current on={activeMenu === "shelters"} />
            <Tent className={ICON} aria-hidden="true" />
            <Label top="ศูนย์" bottom="พักพิง" />
          </Link>
        ) : (
          <span role="link" aria-disabled="true" title="เปิดให้ดูเมื่อมีการเปิดศูนย์พักพิง" className={`${SLOT} ${OFF}`}>
            <Tent className={ICON} aria-hidden="true" />
            <Label top="ศูนย์" bottom="พักพิง" />
          </span>
        )}
      </div>
    </nav>
  );
}
