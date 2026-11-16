"use client";

// แผนที่กลุ่มเปราะบางรายหมู่บ้าน (เลือกระบายสีทีละประเภทได้) — โหลดขอบเขตหมู่บ้านเมื่อเปิดดูเท่านั้น
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import AppIcon from "@/components/icons/AppIcon";

const VulnerableGroupsVillageMap = dynamic(() => import("@/components/VulnerableGroupsVillageMap"), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-xl bg-slate-100" aria-label="กำลังโหลดแผนที่" />
});

export default function VillageMapPanel({ session }) {
  const [open, setOpen] = useState(false);
  const [polygons, setPolygons] = useState(null);

  useEffect(() => {
    if (!open || polygons) return;
    let cancelled = false;
    fetch("/stn-eoc/api/common/village-polygons")
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => { if (!cancelled) setPolygons(Array.isArray(json) ? json : json?.data || []); })
      .catch(() => { if (!cancelled) setPolygons([]); });
    return () => { cancelled = true; };
  }, [open, polygons]);

  if (!session) return null;
  return (
    <details className="group rounded-2xl border border-slate-200 bg-white font-[family-name:var(--font-kanit)]" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#0b4c86] ring-1 ring-sky-100"><AppIcon icon="map" className="h-4 w-4" /></span>
          <span className="min-w-0">
            <span className="block font-semibold text-slate-900">แผนที่รายหมู่บ้าน</span>
            <span className="block text-xs text-slate-500">ระบายสีตามจำนวนกลุ่มเปราะบาง เลือกดูทีละประเภทได้ เช่น เฉพาะผู้ป่วยฟอกไตหรือติดเตียง</span>
          </span>
        </span>
        <span className="shrink-0 text-sm font-bold text-[#0b4c86] group-open:hidden">แสดงแผนที่</span>
        <span className="hidden shrink-0 text-sm font-bold text-[#0b4c86] group-open:inline">ซ่อน</span>
      </summary>
      {open ? (
        <div className="border-t border-slate-100 p-3">
          {polygons === null ? <div className="h-[420px] animate-pulse rounded-xl bg-slate-100" aria-label="กำลังโหลดขอบเขตหมู่บ้าน" /> : <VulnerableGroupsVillageMap session={session} polygons={polygons} />}
        </div>
      ) : null}
    </details>
  );
}
