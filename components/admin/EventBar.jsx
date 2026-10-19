"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { useEOC } from "@/context/EOCContext";
import { EVENT_MODULES, groupMenuItems, isMenuItemActive } from "@/src/config/navigation/admin-navigation";
import { MENU_ICONS } from "@/components/Sidebar";
import { formatDateTime } from "@/lib/adminApi";

// แถบเหตุการณ์ด้านบนทุกหน้าของ EOC ที่เปิดอยู่: บอกว่ากำลังอยู่ในเหตุการณ์ไหน เปิด/ปิดอยู่ และสลับหน้างานได้ทันที
// ใช้ชุดเมนูเดียวกับแถบด้านข้าง (EVENT_MODULES) จึงเหมือนกันทุกประเภท EOC
export function detectEventType(pathname) {
  return Object.entries(EVENT_MODULES).find(([, definition]) => definition.pathPrefixes.some((prefix) => pathname.startsWith(prefix)))?.[0] || null;
}

export default function EventBar() {
  const pathname = usePathname() || "";
  const { eocStatus } = useEOC();
  const [search, setSearch] = useState("");
  useEffect(() => { setSearch(window.location.search); }, [pathname]);

  const type = detectEventType(pathname);
  if (!type) return null;
  const definition = EVENT_MODULES[type];
  const status = eocStatus?.[type];
  const open = Boolean(status?.is_active);
  const name = type === "disease" && status?.disease_name ? status.disease_name : definition.label;
  const title = status?.session_number ? `${name} ครั้งที่ ${status.session_number}` : name;
  const items = definition.items({ sessionId: status?.session_id || null });

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="event-bar">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-[#0b4c86] px-4 py-2.5 text-white">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${open ? "bg-emerald-400/90 text-emerald-950" : "bg-white/20 text-white"}`}>
          <span className={`h-2 w-2 rounded-full ${open ? "bg-emerald-900" : "bg-slate-300"}`} aria-hidden="true" />
          {open ? "เปิดอยู่" : "ปิดแล้ว"}
        </span>
        <h2 className="text-base font-black sm:text-lg">{title}</h2>
        {status?.activated_at && open ? <span className="text-xs text-blue-100">เปิดเมื่อ {formatDateTime(status.activated_at)}</span> : null}
        {!open ? <span className="text-xs text-blue-100">ดูข้อมูลย้อนหลังได้ แต่ไม่ควรบันทึกเพิ่มเมื่อ EOC ปิดแล้ว</span> : null}
      </div>
      <nav aria-label={`เมนูงาน${definition.label}`} className="flex items-stretch gap-1 overflow-x-auto px-2 py-2 lg:hidden">
        {groupMenuItems(items).map((group, index) => (
          <div key={group.title || "main"} className={`flex shrink-0 items-center gap-1 ${index ? "border-l border-slate-200 pl-2" : ""}`}>
            {group.title ? <span className="hidden shrink-0 px-1 text-[11px] font-bold text-slate-400 xl:inline">{group.title}</span> : null}
            {group.items.map((item) => {
              const Icon = MENU_ICONS[item.iconKey] || ClipboardList;
              const active = isMenuItemActive(item, pathname, search);
              return (
                <Link key={item.key} href={item.path} title={item.description} aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${active ? "bg-[#0b4c86] text-white" : "text-slate-700 hover:bg-[#edf5fc] hover:text-[#0b4c86]"}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" strokeWidth={2.2} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}
