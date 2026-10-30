"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import HelpRequestLink from "@/components/public/HelpRequestLink";
import useHelpAvailability from "@/components/public/useHelpAvailability";
import PublicBottomBar from "@/components/public/PublicBottomBar";
import LanguageSwitch from "@/components/public/LanguageSwitch";
import {
  Bell,
  Bot,
  Building2,
  Home,
  HousePlus,
  Map,
  Menu,
  SearchCheck,
  Siren,
  Tent,
  Waves,
  X
} from "lucide-react";

// เมนูสำหรับประชาชน: เรียงตามสิ่งที่ประชาชนต้องการรู้ก่อน
// (ลิงก์เข้าสู่ระบบเจ้าหน้าที่และหน่วยงานย้ายไปอยู่ใน footer)
// (prop showWeatherMenu เดิมไม่มีผลแล้ว — เมนูสภาพอากาศแสดงตลอด)
// ชื่อเมนูเต็มแสดงที่จอ 2xl ขึ้นไป (จอ 1280–1535 ชื่อยาวทำให้แถบเมนูล้น) · มือถือ: ปุ่มรายงานระดับน้ำ/ขอความช่วยเหลืออยู่ที่แถบล่าง (แสดงตลอด) และอยู่ในเมนูด้วย
// bottomBar="off" ปิดแถบล่าง (หน้าแผนที่ weather-watch เปิดแถบไว้ และเว้นที่ใต้แผนที่เอง) · หน้าใน BOTTOM_BAR_ROUTES ไฮไลต์ปุ่มของตัวเอง
// showBottomBar: หน้าที่เว้นที่ท้ายหน้าไว้เองแล้ว (PublicOpsScaffold)
export const BOTTOM_BAR_ROUTES = {
  "/public/report-water": "water",
  "/public/my-risk": "myrisk",
  "/public/report-incident": "help",
  "/public/track": "track",
  "/public/shelters": "shelters"
};

export function bottomBarKey(pathname) {
  const path = String(pathname || "").replace(/^\/stn-eoc/, "").replace(/\/+$/, "");
  return BOTTOM_BAR_ROUTES[path] || null;
}

export default function PublicTopNavigation({ activeMenu, showBottomBar = false, bottomBar = "on" }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const navRef = useRef(null);
  const { sheltersOpen, floodOpen } = useHelpAvailability();
  const barKey = bottomBarKey(pathname);
  const barEnabled = bottomBar !== "off";

  useEffect(() => setIsOpen(false), [pathname]);



  const openAssistant = () => {
    window.dispatchEvent(new CustomEvent("eoc-assistant:open"));
    setIsOpen(false);
  };

  const items = [
    { href: "/", label: "หน้าหลัก", shortLabel: "หน้าแรก", icon: Home, key: "home" },
    // แผนที่หลักของประชาชน: สถานการณ์ตอนนี้ + ความเสี่ยง/พยากรณ์ (/public/disaster-map เดิม redirect มาที่หน้านี้)
    { href: "/public/weather-watch", label: "แผนที่สถานการณ์และความเสี่ยง", shortLabel: "แผนที่", icon: Map, key: "weather" },
    { href: "/public/my-risk", label: "บ้านฉันเสี่ยงไหม", shortLabel: "เสี่ยงไหม", icon: HousePlus, key: "myrisk" },
    // ศูนย์พักพิงแสดงเฉพาะช่วงที่เปิดศูนย์ปฏิบัติการ (EOC)
    ...(sheltersOpen ? [{ href: "/public/shelters", label: "ศูนย์พักพิง", shortLabel: "พักพิง", icon: Tent, key: "shelters" }] : []),
    { href: "/public/announcements", label: "ประกาศ", icon: Bell, key: "announce" },
    { label: "ถามน้องสจ๊วต", shortLabel: "ผู้ช่วย", icon: Bot, key: "assistant", action: openAssistant },
    { href: "/public/track", label: "ติดตามคำขอความช่วยเหลือ", shortLabel: "ติดตาม", icon: SearchCheck, key: "track" },
    // รายงานระดับน้ำ: แสดงเมื่อเปิดรับ (ตาม EOC อุทกภัย หรือผู้ดูแลระบบตั้งเปิด/ปิดในตั้งค่าระบบ › เมนูประชาชน)
    ...(floodOpen ? [{ href: "/public/report-water", label: "รายงานระดับน้ำ", shortLabel: "ระดับน้ำ", icon: Waves, key: "water", emphasis: "water" }] : []),
    { href: "/public/report-incident", label: "ขอความช่วยเหลือ", icon: Siren, key: "help", emphasis: "help" }
  ];

  const isActive = (item) => {
    if (activeMenu) return item.key === activeMenu;
    if (item.key === "home") return pathname === "/";
    return item.href && pathname.startsWith(item.href);
  };

  const renderItem = (item, mobile = false) => {
    const Icon = item.icon;
    const active = isActive(item);
    const className = `flex items-center gap-1.5 xl:gap-2 rounded-lg font-bold transition-colors ${mobile
      ? "w-full px-3 py-3 text-sm"
      : `shrink-0 px-2 py-2.5 text-sm xl:px-4${item.wide ? " max-xl:hidden" : ""}`
    } ${active
      ? "bg-white text-[#083865] shadow-sm"
      : item.emphasis === "water"
        ? "bg-sky-500 text-white shadow-sm ring-1 ring-white/30 hover:bg-sky-400"
        : item.emphasis
        ? "bg-red-600 text-white shadow-sm ring-1 ring-white/30 hover:bg-red-500"
        : "text-blue-50 hover:bg-white/10 hover:text-white"
    }`;
    const content = (
      <>
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {item.shortLabel && !mobile ? (
          <>
            <span className="2xl:hidden">{item.shortLabel}</span>
            <span className="hidden 2xl:inline">{item.label}</span>
          </>
        ) : <span>{item.label}</span>}
      </>
    );

    if (item.action) {
      return <button key={item.key} type="button" onClick={item.action} className={className}>{content}</button>;
    }

    // ปุ่มขอความช่วยเหลือ: ใช้ได้เฉพาะเมื่อมี EOC เปิดอยู่ / รายงานระดับน้ำ: เฉพาะเมื่อเปิด EOC ด้านอุทกภัย
    if (item.emphasis) return <ActionButton key={item.key} item={item} active={active} mobile={mobile} onClick={() => setIsOpen(false)} />;

    return <Link key={item.key} href={item.href} onClick={() => setIsOpen(false)} className={className}>{content}</Link>;
  };

  return (
    <>
    <nav ref={navRef} className="relative z-[900] border-b border-blue-950/20 bg-[#0b4c86] text-white shadow-md" aria-label="เมนูข้อมูลสาธารณะ">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-5">
        <div className="hidden min-h-14 items-center gap-1 overflow-x-auto py-1.5 lg:flex">
          {items.filter(item => !item.emphasis).map(item => renderItem(item))}
          <div className="ml-auto flex items-center gap-1.5">
            <LanguageSwitch />
            {items.filter(item => item.emphasis).map(item => renderItem(item))}
          </div>
        </div>

        {/* มือถือ/แท็บเล็ต: ชื่อหน้า + สวิตช์ TH/EN + ปุ่มเมนู (ปุ่มรายงานระดับน้ำ/ขอความช่วยเหลืออยู่ที่แถบล่างและในเมนู) */}
        <div className="flex min-h-14 items-center gap-2 py-2 lg:hidden">
          <Building2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="hidden text-sm font-black md:inline">ข้อมูลสาธารณะ</span>
          <span className="min-w-0 flex-1 truncate text-sm font-black md:hidden">ข้อมูลสาธารณะ จ.สตูล</span>
          <LanguageSwitch className="md:ml-auto" />
          <button
            type="button"
            onClick={() => setIsOpen(value => !value)}
            className="flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-bold hover:bg-white/20 sm:w-auto sm:px-3"
            aria-expanded={isOpen}
            aria-controls="public-mobile-menu"
            aria-label={isOpen ? "ปิดเมนู" : "เปิดเมนู"}
          >
            {isOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            <span className="hidden sm:inline">{isOpen ? "ปิด" : "เมนู"}</span>
          </button>
        </div>

        {isOpen && (
          <div id="public-mobile-menu" className="grid gap-1 border-t border-white/10 py-3 sm:grid-cols-2 lg:hidden">
            {items.filter(item => item.emphasis).map(item => renderItem(item, true))}
            {items.filter(item => !item.emphasis).map(item => renderItem(item, true))}
            <Link href="/public/agencies" onClick={() => setIsOpen(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-sm font-bold text-blue-50 hover:bg-white/10">
              <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" /> ติดต่อหน่วยงาน
            </Link>
          </div>
        )}
      </div>
    </nav>
    {barEnabled ? <PublicBottomBar visible={!isOpen} activeMenu={barKey || activeMenu} reserveSpace={!showBottomBar} /> : null}
    </>
  );
}

// ปุ่มเด่นบนแถบเมนู: รายงานระดับน้ำ / ขอความช่วยเหลือ — บนจอใหญ่สูง h-9 เท่าสวิตช์ภาษา (คำอธิบายบรรทัดล่างแสดงเฉพาะเมนูมือถือ)
// แคปซูลไล่สี + วงไอคอนสีขาว + เงาเรืองแสง · ปุ่มขอความช่วยเหลือมีวงกระเพื่อมดึงสายตา · ชี้แล้วยกขึ้นพร้อมแสงวิ่งผ่าน
// ปิดรับ: เป็นแคปซูลโปร่งสีจาง ไม่มีแอนิเมชัน (HelpRequestLink แสดงคำอธิบายเมื่อชี้) · ผู้ที่ตั้งลดการเคลื่อนไหวจะไม่เห็นแอนิเมชัน
const ACTION_STYLES = {
  water: {
    sub: "ช่วยกันเฝ้าระวัง",
    surface: "bg-gradient-to-br from-sky-400 via-sky-500 to-cyan-600 shadow-[0_8px_22px_-8px_rgba(56,189,248,.95)] hover:shadow-[0_12px_28px_-8px_rgba(56,189,248,1)]",
    icon: "text-sky-600",
    motion: "pa-bob"
  },
  help: {
    sub: "ด้านยา · กลุ่มเปราะบาง",
    surface: "bg-gradient-to-br from-rose-500 via-red-600 to-red-700 shadow-[0_8px_22px_-8px_rgba(239,68,68,.95)] hover:shadow-[0_12px_28px_-8px_rgba(239,68,68,1)]",
    icon: "text-red-600",
    motion: "pa-ring"
  }
};

const ACTION_CSS = `
  @media (prefers-reduced-motion: no-preference) {
    .pa-btn { transition: transform .2s cubic-bezier(.22,1.2,.36,1), box-shadow .2s ease, filter .2s ease; }
    .pa-btn:hover { transform: translateY(-2px); filter: brightness(1.06); }
    .pa-btn:active { transform: translateY(0) scale(.97); }
    .pa-btn .pa-shine { transform: translateX(-130%) skewX(-20deg); }
    .pa-btn:hover .pa-shine { transform: translateX(260%) skewX(-20deg); transition: transform .75s ease; }
    .pa-ring::after { content: ""; position: absolute; inset: -3px; border-radius: 9999px; border: 2px solid rgba(255,255,255,.85); animation: pa-ring 2s ease-out infinite; }
    .pa-bob svg { animation: pa-bob 2.6s ease-in-out infinite; }
  }
  @keyframes pa-ring { 0% { transform: scale(.9); opacity: .9; } 80%, 100% { transform: scale(1.55); opacity: 0; } }
  @keyframes pa-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
`;

function ActionButton({ item, active, mobile, onClick }) {
  const Icon = item.icon;
  const tone = ACTION_STYLES[item.emphasis] || ACTION_STYLES.help;
  const shape = mobile
    ? "flex w-full gap-3 rounded-2xl py-2.5 pl-2.5 pr-4"
    : "inline-flex h-9 shrink-0 gap-2 rounded-full pl-1 pr-3.5 xl:pr-4";
  const badge = mobile ? "h-10 w-10" : "h-7 w-7";
  return (
    <>
      <style>{ACTION_CSS}</style>
      <HelpRequestLink
        kind={item.emphasis}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={`pa-btn group relative isolate items-center text-left text-white ${active ? "ring-2 ring-white" : "ring-1 ring-white/40"} ${shape} ${tone.surface}`}
        disabledClassName="cursor-not-allowed bg-none! bg-white/10! text-white/60! shadow-none! ring-white/20! filter-none! hover:translate-y-0!"
      >
        {({ helpOpen }) => (
          <>
            {/* แสงด้านบน (ให้ดูนูนแบบกระจก) และแสงวิ่งเมื่อชี้ */}
            {helpOpen ? (
              <span className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]" aria-hidden="true">
                <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
                <span className="pa-shine absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent" />
              </span>
            ) : null}
            <span className={`relative grid shrink-0 place-items-center rounded-full ${badge} ${helpOpen ? `bg-white shadow-[inset_0_-2px_0_rgba(0,0,0,.08)] ${tone.icon} ${tone.motion}` : "bg-white/15 text-white/60"}`}>
              <Icon className={mobile ? "h-5 w-5" : "h-4 w-4"} strokeWidth={2.4} aria-hidden="true" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block whitespace-nowrap text-sm font-black tracking-[0.01em] [text-shadow:0_1px_1px_rgba(0,0,0,.18)]">
                {item.shortLabel && !mobile ? <><span className="xl:hidden">{item.shortLabel}</span><span className="hidden xl:inline">{item.label}</span></> : item.label}
              </span>
              <span className={`${mobile ? "block" : "hidden"} whitespace-nowrap text-[11px] font-semibold ${helpOpen ? "text-white/85" : "text-white/50"}`}>
                {helpOpen ? tone.sub : "ยังไม่เปิดรับ"}
              </span>
            </span>
          </>
        )}
      </HelpRequestLink>
    </>
  );
}
