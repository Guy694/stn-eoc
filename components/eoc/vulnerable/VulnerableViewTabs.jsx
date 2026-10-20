"use client";

import Link from "next/link";

// สองมุมมองของกลุ่มเปราะบาง: ยอดรายหมู่บ้าน ↔ รายบุคคลบนแผนที่
// registry = ทะเบียนกลาง (ข้อมูลช่วงปกติ ที่นำเข้ารายชื่อ) · ไม่ระบุ = เมนูของเหตุการณ์ EOC
export default function VulnerableViewTabs({ eocType = "flood", current, registry = false }) {
  const tabs = registry
    ? [
      { key: "villages", label: "จำนวนรายหมู่บ้าน", href: "/eoc/vulnerable-groups" },
      { key: "persons", label: "รายบุคคลและแผนที่", href: "/eoc/vulnerable-groups/persons" }
    ]
    : [
      { key: "villages", label: "ยอดรายหมู่บ้าน", href: `/eoc/${eocType}/vulnerable-groups` },
      { key: "persons", label: "รายบุคคลและแผนที่", href: `/eoc/${eocType}/vulnerable-persons` }
    ];
  return (
    <nav aria-label="มุมมองกลุ่มเปราะบาง" className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white px-2">
      {tabs.map((tab) => {
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
