"use client";

import Link from "next/link";
import { Construction, Headset, MapPinned } from "lucide-react";

function formatNumber(value) {
  return Number(value || 0).toLocaleString("th-TH");
}

function ago(value) {
  const time = new Date(value || 0).getTime();
  if (!time) return "";
  const minutes = Math.max(1, Math.round((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} ชม.ที่แล้ว` : `${Math.round(hours / 24)} วันที่แล้ว`;
}

/** งานของศูนย์วันนี้: บอกประชาชนว่าเรื่องที่แจ้งมีคนรับจริง (นับจำนวนอย่างเดียว) */
export function OpsTodayCard({ ops }) {
  if (!ops) return null;
  const items = [
    { label: "รับคำขอวันนี้", value: ops.received_today, tone: "text-[#0c2f4a]" },
    { label: "รอเจ้าหน้าที่รับเรื่อง", value: ops.waiting, tone: ops.waiting > 0 ? "text-[#b45309]" : "text-[#0c2f4a]" },
    { label: "กำลังช่วยเหลือ", value: ops.in_progress, tone: "text-[#11466e]" },
    { label: "ช่วยเหลือแล้ววันนี้", value: ops.resolved_today, tone: "text-[#2e6b4e]" }
  ];
  return (
    <div className="mt-8 rounded-3xl bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 font-[family-name:var(--font-kanit)] text-lg font-semibold text-[#0c2f4a]">
          <Headset className="h-5 w-5 text-[#2a9db0]" aria-hidden="true" /> งานของศูนย์วันนี้
        </h3>
        {ops.last_received_at ? <span className="text-sm text-slate-500">คำขอล่าสุด {ago(ops.last_received_at)}</span> : null}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="border-l-2 border-[#d6e3ea] pl-3">
            <dt className="text-sm text-slate-500">{item.label}</dt>
            <dd className={`font-[family-name:var(--font-kanit)] text-3xl font-bold leading-tight ${item.tone}`}>{formatNumber(item.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-slate-600">
        แจ้งแล้วติดตามได้ที่ <Link href="/public/track" className="font-semibold text-[#11466e] underline underline-offset-4">ติดตามคำขอ</Link> ด้วยชื่อ นามสกุล และเบอร์โทร 4 ตัวท้าย
      </p>
    </div>
  );
}

/** ถนนที่ควรเลี่ยง: จุดที่เจ้าหน้าที่ยืนยันและเผยแพร่แล้ว */
export function RoadAlerts({ roads = [] }) {
  if (roads.length === 0) return null;
  return (
    <div className="mt-8 rounded-3xl bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 font-[family-name:var(--font-kanit)] text-lg font-semibold text-[#0c2f4a]">
          <Construction className="h-5 w-5 text-[#c2410c]" aria-hidden="true" /> ถนนที่ควรเลี่ยง
        </h3>
        <Link href="/public/disaster-map" className="inline-flex items-center gap-1 text-[15px] font-semibold text-[#11466e] underline-offset-4 hover:underline">
          <MapPinned className="h-4 w-4" aria-hidden="true" /> ดูเส้นทางบนแผนที่
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-slate-100">
        {roads.map((road) => (
          <li key={road.id} className="flex items-start gap-3 py-3">
            <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${road.blocked ? "bg-[#dc2626]" : "bg-[#f59e0b]"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">{road.title}</p>
              <p className="text-sm text-slate-500">{[road.area, road.at ? ago(road.at) : null].filter(Boolean).join(" • ")}</p>
              {road.detail ? <p className="mt-0.5 text-sm text-slate-700">{road.detail}</p> : null}
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${road.blocked ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>
              {road.blocked ? "ผ่านไม่ได้" : "ผ่านยาก"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
