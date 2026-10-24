"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatEocDisplayName } from "@/lib/eocDisplay";

// แถบหัวของหน้าประชาชนทุกหน้า (ใช้ทั้งใน PublicOpsScaffold และ PublicLayout)
// - ป้ายสถานะดึงสถานะ EOC เองถ้าหน้าไม่ได้ส่งมา ทุกหน้าจึงบอกสถานะตรงกัน
// - นาฬิกาเดินทุก 30 วินาที (เดิมคำนวณครั้งเดียวตอนเปิดหน้า)

let statusRequest = null;
let statusCache = null;
const STATUS_TTL_MS = 60 * 1000;

function loadEocStatus() {
  if (statusCache && Date.now() - statusCache.at < STATUS_TTL_MS) return Promise.resolve(statusCache.value);
  if (!statusRequest) {
    statusRequest = fetch("/stn-eoc/api/eoc/status/")
      .then((response) => response.json())
      .then((result) => {
        const active = result?.success ? (result.data || []).filter((item) => item.is_active) : [];
        const value = {
          open: active.length > 0,
          label: active.length > 0 ? [...new Set(active.map((item) => formatEocDisplayName(item)))].join(" • ") : "ไม่มีเหตุการณ์ฉุกเฉิน"
        };
        statusCache = { at: Date.now(), value };
        return value;
      })
      .catch(() => null)
      .finally(() => { statusRequest = null; });
  }
  return statusRequest;
}

const STATUS_META = {
  // ใช้ภาษาที่ประชาชนเข้าใจแทนคำว่า "เปิด/ปิด EOC"
  open: { title: "มีเหตุการณ์ที่ต้องติดตาม", dot: "#f6b73c", ring: "ring-[#f6b73c]/45", wash: "from-[#f6b73c]/25", live: true, href: "/public/disaster-map" },
  closed: { title: "สถานการณ์ปกติ", dot: "#4fd18b", ring: "ring-white/15", wash: "from-[#4fd18b]/15", live: false },
  watch: { title: "เฝ้าระวัง", dot: "#5cc8db", ring: "ring-[#5cc8db]/35", wash: "from-[#5cc8db]/20", live: false },
  loading: { title: "สถานะศูนย์", dot: "#9fb4c7", ring: "ring-white/10", wash: "from-white/5", live: false }
};

function useNow(intervalMs = 30 * 1000) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function HeaderClock() {
  const now = useNow();
  const date = now ? now.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : "";
  const time = now ? now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div className="hidden min-w-[9.5rem] text-sm text-blue-50 lg:block" aria-live="off">
      <div className="font-bold text-white">{date ? `วัน${now.toLocaleDateString("th-TH", { weekday: "long" })}ที่ ${date}` : " "}</div>
      <div>{time ? `เวลา ${time} น.` : " "}</div>
    </div>
  );
}

export function EocStatusBadge({ eocStatus, eocLabel, eocIsOpen }) {
  const provided = Boolean(eocStatus) || typeof eocIsOpen === "boolean";
  const [live, setLive] = useState(null);

  useEffect(() => {
    if (provided) return undefined;
    let active = true;
    loadEocStatus().then((value) => { if (active) setLive(value); });
    return () => { active = false; };
  }, [provided]);

  const statusKey = provided
    ? eocStatus || (eocIsOpen ? "open" : "closed")
    : live ? (live.open ? "open" : "closed") : "loading";
  const meta = STATUS_META[statusKey] || STATUS_META.watch;
  const label = (provided ? eocLabel : live?.label) || (statusKey === "loading" ? "กำลังตรวจสอบ…" : "สถานะศูนย์");
  const Tag = meta.href ? Link : "div";

  return (
    <>
      <Tag
        {...(meta.href ? { href: meta.href, "aria-label": `${meta.title}: ${label} ดูแผนที่สถานการณ์` } : { role: "status" })}
        className={`eoc-status group ml-auto flex shrink-0 items-center gap-2.5 rounded-2xl bg-gradient-to-r ${meta.wash} to-white/[0.04] px-3 py-2 ring-1 ${meta.ring} backdrop-blur-sm transition sm:gap-3 sm:px-4 lg:py-2.5 lg:pl-4 lg:pr-5 ${meta.href ? "hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" : ""}`}
      >
        <span className="relative grid h-3.5 w-3.5 shrink-0 place-items-center lg:h-4 lg:w-4" aria-hidden="true">
          {meta.live ? <span className="eoc-status__pulse absolute inset-0 rounded-full" style={{ backgroundColor: meta.dot }} /> : null}
          <span className="relative h-full w-full rounded-full ring-2 ring-[#083865]" style={{ backgroundColor: meta.dot, boxShadow: `0 0 12px ${meta.dot}` }} />
        </span>
        <span className="min-w-0 text-left">
          <span className="block font-[family-name:var(--font-kanit)] text-[13px] font-semibold leading-tight text-white sm:text-[15px] lg:text-lg">{meta.title}</span>
          <span className="mt-0.5 flex items-center gap-1 text-[10px] leading-tight sm:text-[11px] lg:text-[13px]" style={{ color: meta.dot }}>
            <span className="max-w-[9rem] truncate sm:max-w-[14rem]">{label}</span>
            {meta.href ? <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /> : null}
          </span>
        </span>
      </Tag>
      <style>{`
        .eoc-status__pulse { animation: eoc-status-pulse 1.8s cubic-bezier(.2,.6,.3,1) infinite; }
        @keyframes eoc-status-pulse { 0% { transform: scale(1); opacity: .75; } 100% { transform: scale(2.8); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .eoc-status__pulse { animation: none; opacity: .35; transform: scale(1.8); } }
      `}</style>
    </>
  );
}

export default function PublicHeader({ eocStatus, eocLabel, eocIsOpen }) {
  return (
    <header className="border-b border-blue-950/20 bg-[#083865] text-white shadow-lg">
      <div className="flex min-h-[70px] items-center gap-3 px-3 py-2 sm:min-h-[78px] sm:px-4 lg:min-h-[86px] lg:gap-5 lg:px-5 lg:py-0">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white lg:gap-4" aria-label="กลับหน้าแรก">
          <Image src="/stn-eoc/img/logo.png" alt="" width={62} height={62} className="h-10 w-10 shrink-0 rounded-full bg-white p-1 shadow-md sm:h-12 sm:w-12 lg:h-[62px] lg:w-[62px] lg:p-1.5" priority />
          <span className="min-w-0">
            <span className="block truncate text-sm font-black leading-5 sm:text-base lg:text-2xl lg:leading-7">ศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข จังหวัดสตูล</span>
            <span className="block truncate text-[11px] font-semibold text-blue-100 sm:text-xs lg:text-base">Satun Provincial Emergency Operations Center (Satun Geo-EOC)</span>
          </span>
        </Link>
        <HeaderClock />
        <EocStatusBadge eocStatus={eocStatus} eocLabel={eocLabel} eocIsOpen={eocIsOpen} />
      </div>
    </header>
  );
}
