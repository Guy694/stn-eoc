"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Bot,
  Building2,
  CloudSun,
  Home,
  LogIn,
  Map,
  Menu,
  Tent,
  X
} from "lucide-react";

export default function PublicTopNavigation({ activeMenu, showWeatherMenu = true }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => setIsOpen(false), [pathname]);

  const openAssistant = () => {
    window.dispatchEvent(new CustomEvent("eoc-assistant:open"));
    setIsOpen(false);
  };

  const items = [
    { href: "/", label: "หน้าหลัก", icon: Home, key: "home" },
    { href: "/public/disaster-map", label: "แผนที่สถานการณ์", icon: Map, key: "map" },
    ...(showWeatherMenu || activeMenu === "weather"
      ? [{ href: "/public/weather-watch", label: "อากาศและฝน", icon: CloudSun, key: "weather" }]
      : []),
    { href: "/public/announcements", label: "ประกาศ", icon: Bell, key: "announce" },
    { href: "/public/shelters", label: "ศูนย์พักพิง", icon: Tent, key: "shelters" },
    { href: "/public/agencies", label: "หน่วยงานช่วยเหลือ", icon: Building2, key: "agencies" },
    { label: "EOC Assistant", icon: Bot, key: "assistant", action: openAssistant },
    { href: "/login", label: "เข้าสู่ระบบเจ้าหน้าที่", icon: LogIn, key: "staff" }
  ];

  const isActive = (item) => {
    if (activeMenu) return item.key === activeMenu;
    if (item.key === "home") return pathname === "/";
    return item.href && pathname.startsWith(item.href);
  };

  const renderItem = (item, mobile = false) => {
    const Icon = item.icon;
    const active = isActive(item);
    const className = `flex items-center gap-2 rounded-lg font-bold transition-colors ${mobile
      ? "w-full px-3 py-3 text-sm"
      : "shrink-0 px-3 py-2.5 text-sm xl:px-4"
    } ${active
      ? "bg-white text-[#083865] shadow-sm"
      : item.key === "staff"
        ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
        : "text-blue-50 hover:bg-white/10 hover:text-white"
    }`;
    const content = (
      <>
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{item.label}</span>
      </>
    );

    if (item.action) {
      return <button key={item.key} type="button" onClick={item.action} className={className}>{content}</button>;
    }

    return <Link key={item.key} href={item.href} onClick={() => setIsOpen(false)} className={className}>{content}</Link>;
  };

  return (
    <nav className="relative z-[900] border-b border-blue-950/20 bg-[#0b4c86] text-white shadow-md" aria-label="เมนูข้อมูลสาธารณะ">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-5">
        <div className="hidden min-h-14 items-center gap-1 overflow-x-auto py-1.5 lg:flex">
          {items.map(item => renderItem(item))}
        </div>

        <div className="flex min-h-14 items-center justify-between lg:hidden">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-black">ข้อมูลสาธารณะ</span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(value => !value)}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20"
            aria-expanded={isOpen}
            aria-controls="public-mobile-menu"
          >
            {isOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            {isOpen ? "ปิด" : "เมนู"}
          </button>
        </div>

        {isOpen && (
          <div id="public-mobile-menu" className="grid gap-1 border-t border-white/10 py-3 sm:grid-cols-2 lg:hidden">
            {items.map(item => renderItem(item, true))}
          </div>
        )}
      </div>
    </nav>
  );
}
