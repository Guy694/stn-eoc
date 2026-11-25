"use client";

// แท็บที่เป็นลิงก์ไปหน้าอื่น — ใช้รวมหลายหน้าไว้ใต้เมนูเดียว (เช่น เหตุการณ์ EOC: เปิด/ปิด | ประวัติ)
// items: [{ key, label, href }] · current = key ของหน้านี้
import Link from "next/link";

export default function LinkTabs({ items = [], current, label, className = "" }) {
  return (
    <nav aria-label={label} className={`flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white px-2 ${className}`}>
      {items.map((tab) => {
        const active = tab.key === current;
        return (
          <Link key={tab.key} href={tab.href} aria-current={active ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-bold transition ${active ? "border-[#0b4c86] text-[#0b4c86]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const EOC_ADMIN_TABS = [
  { key: "control", label: "เปิด/ปิด EOC", href: "/admin/eoc-management" },
  { key: "history", label: "ประวัติเหตุการณ์", href: "/admin/eoc-sessions" }
];

export const USER_ADMIN_TABS = [
  { key: "officers", label: "เจ้าหน้าที่และสิทธิ์", href: "/admin/officers" },
  { key: "citizens", label: "ผู้ใช้ประชาชน", href: "/admin/citizens" }
];

export const ANNOUNCEMENT_TABS = [
  { key: "announcements", label: "ประกาศ", href: "/announcements" },
  { key: "infographics", label: "คลังอินโฟกราฟิก", href: "/admin/upload-infographics", adminOnly: true }
];
