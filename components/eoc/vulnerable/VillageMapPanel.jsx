"use client";

// แผนที่กลุ่มเปราะบางรายหมู่บ้าน (เลือกระบายสีทีละประเภทได้) — โหลดขอบเขตหมู่บ้านเมื่อเปิดดูเท่านั้น
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

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
    <details className="group rounded-xl border border-[#c9dcee] bg-white" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-black text-slate-900">แผนที่รายหมู่บ้าน</span>
          <span className="block text-sm text-slate-600">ระบายสีตามจำนวนกลุ่มเปราะบาง เลือกดูทีละประเภทได้ เช่น เฉพาะผู้ป่วยฟอกไตหรือติดเตียง</span>
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
