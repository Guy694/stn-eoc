"use client";

import Link from "next/link";
import { HousePlus, SearchCheck, Siren, Tent, Waves } from "lucide-react";
import HelpRequestLink from "@/components/public/HelpRequestLink";
import useHelpAvailability from "@/components/public/useHelpAvailability";

const SLOT = "bb-slot flex min-w-0 flex-1 flex-col items-center justify-end gap-1 px-0.5 pb-1.5 pt-2 text-center font-[family-name:var(--font-kanit)] text-[11.5px] font-medium leading-[1.15] tracking-[0.01em]";
const ICON = "bb-icon h-[22px] w-[22px]";
const OFF = "cursor-not-allowed text-slate-400!";
// ชื่อปุ่มสองบรรทัด (จอมือถือแคบ ปุ่มละ ~75px)
const Label = ({ top, bottom, className = "" }) => <span className={`block w-full ${className}`}>{top}<br />{bottom}</span>;

/**
 * แถบล่างบนมือถือ — แสดงเมื่อเลื่อนพ้น navbar แล้ว (visible) ปุ่มขอความช่วยเหลืออยู่กลางและยกสูงกว่าปุ่มอื่น
 * ปุ่มขอความช่วยเหลือ/รายงานระดับน้ำ/ศูนย์พักพิง เป็นสีเทากดไม่ได้เมื่อยังไม่เปิดศูนย์ (ไม่ซ่อน เพื่อให้ตำแหน่งปุ่มคงที่)
 */
export default function PublicBottomBar({ visible, activeMenu }) {
  const { sheltersOpen } = useHelpAvailability();
  const tone = (key) => (activeMenu === key ? "text-[#0b4c86]" : "text-slate-600 hover:text-[#0b4c86]");
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
        @media (prefers-reduced-motion: reduce) {
          .bottom-bar, .bottom-bar .bb-slot, .bottom-bar .bb-icon, .bottom-bar .bb-help { transition: none; }
          .bottom-bar .bb-slot { transform: none; }
          .bottom-bar .bb-help-ring { animation: none; opacity: 0; }
        }
      `}</style>
      <div className="mx-auto flex max-w-lg items-end">
        <HelpRequestLink kind="water" className={`${SLOT} text-[#0b5fa5]`} disabledClassName={OFF}>
          <Waves className={ICON} aria-hidden="true" />
          <Label top="รายงาน" bottom="ระดับน้ำ" />
        </HelpRequestLink>
        <Link href="/public/my-risk" className={`${SLOT} ${tone("myrisk")}`}>
          <HousePlus className={ICON} aria-hidden="true" />
          <Label top="บ้านฉัน" bottom="เสี่ยงไหม" />
        </Link>
        <HelpRequestLink className={`${SLOT} text-[#c81e1e]`} disabledClassName={OFF}>
          {({ helpOpen }) => (
            <>
              <span className="relative -mt-7 flex h-14 w-14 items-center justify-center">
                {helpOpen ? <span className="bb-help-ring absolute inset-0 rounded-full bg-[#c81e1e]" aria-hidden="true" /> : null}
                <span className={`bb-help relative flex h-14 w-14 items-center justify-center rounded-full text-white ring-4 ring-white ${helpOpen ? "bg-[#c81e1e] shadow-[0_8px_18px_-6px_rgba(200,30,30,.7)]" : "bg-slate-300"}`}>
                  <Siren className="h-7 w-7" aria-hidden="true" />
                </span>
              </span>
              <Label top="ขอความ" bottom="ช่วยเหลือ" className="font-semibold" />
            </>
          )}
        </HelpRequestLink>
        <Link href="/public/track" className={`${SLOT} ${tone("track")}`}>
          <SearchCheck className={ICON} aria-hidden="true" />
          <Label top="ติดตาม" bottom="คำขอ" />
        </Link>
        {sheltersOpen ? (
          <Link href="/public/shelters?near=1" className={`${SLOT} ${activeMenu === "shelters" ? "text-[#6d3fc4]" : "text-slate-600 hover:text-[#6d3fc4]"}`}>
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
