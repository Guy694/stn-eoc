"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import HelpRequestLink from "@/components/public/HelpRequestLink";
import useHelpAvailability from "@/components/public/useHelpAvailability";
import {
  Bell,
  Bot,
  Building2,
  CloudSun,
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
export default function PublicTopNavigation({ activeMenu }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { sheltersOpen } = useHelpAvailability();

  useEffect(() => setIsOpen(false), [pathname]);

  const openAssistant = () => {
    window.dispatchEvent(new CustomEvent("eoc-assistant:open"));
    setIsOpen(false);
  };

  const items = [
    { href: "/", label: "หน้าหลัก", shortLabel: "หน้าแรก", icon: Home, key: "home" },
    // แผนที่ 2 หน้าแบ่งตามคำถาม: "ตอนนี้เกิดอะไรขึ้น" (สถานการณ์) กับ "จะเกิดอะไรขึ้น" (พยากรณ์และความเสี่ยง)
    { href: "/public/disaster-map", label: "แผนที่สถานการณ์", shortLabel: "สถานการณ์", icon: Map, key: "map" },
    { href: "/public/weather-watch", label: "พยากรณ์และความเสี่ยง", shortLabel: "พยากรณ์", icon: CloudSun, key: "weather" },
    { href: "/public/my-risk", label: "บ้านฉันเสี่ยงไหม", shortLabel: "เสี่ยงไหม", icon: HousePlus, key: "myrisk" },
    // ศูนย์พักพิงแสดงเฉพาะช่วงที่เปิดศูนย์ปฏิบัติการ (EOC)
    ...(sheltersOpen ? [{ href: "/public/shelters", label: "ศูนย์พักพิง", shortLabel: "พักพิง", icon: Tent, key: "shelters" }] : []),
    { href: "/public/announcements", label: "ประกาศ", icon: Bell, key: "announce" },
    { label: "ถามผู้ช่วย", shortLabel: "ผู้ช่วย", icon: Bot, key: "assistant", action: openAssistant },
    { href: "/public/track", label: "ติดตามคำขอความช่วยเหลือ", shortLabel: "ติดตาม", icon: SearchCheck, key: "track" },
    { href: "/public/report-water", label: "รายงานระดับน้ำ", shortLabel: "ระดับน้ำ", icon: Waves, key: "water", emphasis: "water" },
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
            <span className="xl:hidden">{item.shortLabel}</span>
            <span className="hidden xl:inline">{item.label}</span>
          </>
        ) : <span>{item.label}</span>}
      </>
    );

    if (item.action) {
      return <button key={item.key} type="button" onClick={item.action} className={className}>{content}</button>;
    }

    // ปุ่มขอความช่วยเหลือ: ใช้ได้เฉพาะเมื่อมี EOC เปิดอยู่ / รายงานระดับน้ำ: เฉพาะเมื่อเปิด EOC ด้านอุทกภัย
    if (item.emphasis) {
      return (
        <HelpRequestLink key={item.key} kind={item.emphasis} onClick={() => setIsOpen(false)} className={className} disabledClassName="cursor-not-allowed bg-white/15! text-white/60! ring-0! shadow-none! hover:bg-white/15!">
          {content}
        </HelpRequestLink>
      );
    }

    return <Link key={item.key} href={item.href} onClick={() => setIsOpen(false)} className={className}>{content}</Link>;
  };

  return (
    <nav className="relative z-[900] border-b border-blue-950/20 bg-[#0b4c86] text-white shadow-md" aria-label="เมนูข้อมูลสาธารณะ">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-5">
        <div className="hidden min-h-14 items-center gap-1 overflow-x-auto py-1.5 lg:flex">
          {items.filter(item => !item.emphasis).map(item => renderItem(item))}
          <div className="ml-auto flex items-center gap-1.5">
            <Link href="/public/en" lang="en" className="flex h-10 shrink-0 items-center rounded-lg px-2.5 text-sm font-bold text-blue-50 hover:bg-white/10" title="Emergency information in English">EN</Link>
            {items.filter(item => item.emphasis).map(item => renderItem(item))}
          </div>
        </div>

        {/* มือถือ/แท็บเล็ต: ปุ่มหลัก 2 ปุ่มกว้างเท่ากัน สูงเท่ากัน + ปุ่มเมนูเป็นไอคอนจัตุรัส */}
        <div className="flex min-h-14 items-center gap-2 py-2 lg:hidden">
          <Building2 className="hidden h-5 w-5 shrink-0 sm:block" aria-hidden="true" />
          <span className="hidden text-sm font-black md:inline">ข้อมูลสาธารณะ</span>
          <div className="flex min-w-0 flex-1 items-stretch gap-2 sm:ml-auto sm:max-w-md sm:flex-none">
            <HelpRequestLink kind="water" className="flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-2 text-[13px] font-black leading-none text-white shadow-sm hover:bg-sky-400 sm:px-4 sm:text-sm" disabledClassName="cursor-not-allowed bg-white/15! text-white/60! shadow-none! hover:bg-white/15!">
              <Waves className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">รายงานระดับน้ำ</span>
            </HelpRequestLink>
            <HelpRequestLink className="flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-2 text-[13px] font-black leading-none text-white shadow-sm hover:bg-red-500 sm:px-4 sm:text-sm" disabledClassName="cursor-not-allowed bg-white/15! text-white/60! shadow-none! hover:bg-white/15!">
              <Siren className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">ขอความช่วยเหลือ</span>
            </HelpRequestLink>
          </div>
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
            {items.filter(item => !item.emphasis).map(item => renderItem(item, true))}
            <Link href="/public/agencies" onClick={() => setIsOpen(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-sm font-bold text-blue-50 hover:bg-white/10">
              <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" /> ติดต่อหน่วยงาน
            </Link>
            <Link href="/public/en" lang="en" onClick={() => setIsOpen(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-sm font-bold text-blue-50 hover:bg-white/10">
              <span className="flex h-4 w-6 items-center justify-center rounded bg-white/20 text-[10px]">EN</span> Emergency info in English
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
