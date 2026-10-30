"use client";

// "รายงานน้ำจากประชาชน" บนหน้าแรก — แสดงเฉพาะรายงานที่เจ้าหน้าที่ตรวจและเผยแพร่แล้ว (จาก /api/public/verified-incidents)
// ไม่มีชื่อ เบอร์ หรือข้อความต้นฉบับของผู้แจ้ง: หัวข้อ/รายละเอียดเป็นข้อความที่เจ้าหน้าที่เขียน รูปเป็นสำเนาที่เลือกเผยแพร่
// layout="list" = แผงข้างบนจอใหญ่, layout="strip" = แถบเลื่อนแนวนอนบนมือถือ
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapPinned, ShieldCheck, Users, Waves, X } from "lucide-react";
import HelpRequestLink from "@/components/public/HelpRequestLink";

function ago(value) {
  const time = new Date(value || 0).getTime();
  if (!time) return "";
  const minutes = Math.max(1, Math.round((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} ชม.ที่แล้ว` : `${Math.round(hours / 24)} วันที่แล้ว`;
}

// ภาพแทนเมื่อไม่มีรูป: ความลึกของน้ำเทียบกับความสูงคน
function DepthPicture({ level, className = "" }) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-b from-[#e8f2f7] to-[#d4e6ef] ${className}`} aria-hidden="true">
      <svg viewBox="0 0 40 60" className="absolute bottom-0 left-1/2 h-[82%] -translate-x-1/2 text-[#0c2f4a]/55" fill="currentColor">
        <circle cx="20" cy="8" r="6" />
        <path d="M11 18h18l3 20h-6l-1 22h-10l-1-22H8z" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 opacity-80" style={{ height: `${Math.round(level.fill * 100)}%`, backgroundColor: level.color }}>
        <span className="absolute inset-x-0 top-0 h-1 bg-white/50" />
      </div>
    </div>
  );
}

function LevelChip({ level, trend, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white shadow-sm ${className}`} style={{ backgroundColor: level.color }}>
      {level.short}
      {trend ? <span aria-label={trend.label} title={trend.label}>{trend.arrow}</span> : null}
    </span>
  );
}

function Photo({ report, className, sizes }) {
  if (!report.photo) return <DepthPicture level={report.level} className={className} />;
  return (
    // รูปจาก API ของระบบ (สำเนาที่เจ้าหน้าที่เลือกเผยแพร่) — ใช้ <img> เพราะเป็นเส้นทาง API ไม่ใช่ไฟล์ static
    // eslint-disable-next-line @next/next/no-img-element
    <img src={report.photo} alt={`ภาพจากผู้แจ้ง: ${report.title}`} loading="lazy" decoding="async" sizes={sizes} className={`object-cover ${className}`} />
  );
}

function ReportDialog({ report, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (!report) return undefined;
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [report, onClose]);
  if (!report) return null;
  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-slate-950/70 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="water-report-title" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
        <div className="relative">
          <Photo report={report} className="block aspect-[4/3] w-full" sizes="(min-width: 640px) 512px, 100vw" />
          <button ref={closeRef} type="button" onClick={onClose} className="absolute right-3 top-3 rounded-full bg-black/55 p-2 text-white hover:bg-black/75" aria-label="ปิด">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <LevelChip level={report.level} trend={report.trend} className="absolute bottom-3 left-3 px-3 py-1 text-sm" />
        </div>
        <div className="space-y-2 p-5">
          <h3 id="water-report-title" className="font-[family-name:var(--font-kanit)] text-xl font-semibold leading-snug text-[#0c2f4a]">{report.title}</h3>
          <p className="text-sm text-slate-600">{[report.area, ago(report.at)].filter(Boolean).join(" • ")}</p>
          <p className="text-[15px] text-slate-800">ระดับน้ำ <b>{report.level.label}</b> ({report.level.range}){report.trend ? ` • ${report.trend.label}` : ""}</p>
          {report.detail ? <p className="text-[15px] leading-7 text-slate-700">{report.detail}</p> : null}
          {report.stillCount > 0 || report.reportCount > 1 ? (
            <p className="flex items-center gap-1.5 text-sm text-slate-600">
              <Users className="h-4 w-4" aria-hidden="true" />
              {report.reportCount > 1 ? `มีผู้แจ้งจุดนี้ ${report.reportCount} ราย` : ""}
              {report.reportCount > 1 && report.stillCount > 0 ? " • " : ""}
              {report.stillCount > 0 ? `ยืนยันว่ายังท่วม ${report.stillCount} ครั้ง` : ""}
            </p>
          ) : null}
          <p className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> เจ้าหน้าที่ตรวจสอบก่อนเผยแพร่ ตำแหน่งบนแผนที่เป็นพิกัดโดยประมาณ
          </p>
          <Link href="/public/weather-watch" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#11466e] underline-offset-4 hover:underline">
            <MapPinned className="h-4 w-4" aria-hidden="true" /> ดูบนแผนที่สถานการณ์
          </Link>
        </div>
      </div>
    </div>
  );
}

function ListCard({ report, onOpen }) {
  return (
    <li>
      <button type="button" onClick={() => onOpen(report)} className="group flex w-full gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-[#f3f7f8] focus-visible:outline-2 focus-visible:outline-[#0b4c86]">
        <span className="relative block h-20 w-24 shrink-0 overflow-hidden rounded-xl">
          <Photo report={report} className="absolute inset-0 h-full w-full transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none" sizes="96px" />
          <LevelChip level={report.level} trend={report.trend} className="absolute bottom-1 left-1" />
        </span>
        <span className="min-w-0 flex-1 py-0.5">
          <span className="line-clamp-2 font-semibold leading-snug text-slate-900">{report.title}</span>
          <span className="mt-0.5 block truncate text-sm text-slate-500">{report.area || "สตูล"}</span>
          <span className="mt-0.5 block text-xs text-slate-400">{ago(report.at)}{report.stillCount > 0 ? ` • ยืนยันว่ายังท่วม ${report.stillCount}` : ""}</span>
        </span>
      </button>
    </li>
  );
}

function StripCard({ report, onOpen }) {
  return (
    <li className="w-[15.5rem] shrink-0 snap-start">
      <button type="button" onClick={() => onOpen(report)} className="block w-full overflow-hidden rounded-2xl bg-white text-left shadow-[0_10px_30px_-18px_rgba(12,47,74,.6)] ring-1 ring-slate-200/70 focus-visible:outline-2 focus-visible:outline-[#0b4c86]">
        <span className="relative block h-32">
          <Photo report={report} className="absolute inset-0 h-full w-full" sizes="248px" />
          <LevelChip level={report.level} trend={report.trend} className="absolute bottom-2 left-2" />
        </span>
        <span className="block p-3">
          <span className="line-clamp-2 min-h-[2.75rem] font-semibold leading-snug text-slate-900">{report.title}</span>
          <span className="mt-1 block truncate text-sm text-slate-500">{report.area || "สตูล"}</span>
          <span className="block text-xs text-slate-400">{ago(report.at)}</span>
        </span>
      </button>
    </li>
  );
}

export default function CitizenWaterReports({ reports = [], layout = "list", className = "" }) {
  const [open, setOpen] = useState(null);
  if (reports.length === 0) return null;
  const titleId = `citizen-water-${layout}`;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h2 id={titleId} className="flex items-center gap-2 font-[family-name:var(--font-kanit)] text-lg font-semibold text-[#0c2f4a] sm:text-xl">
        <Waves className="h-5 w-5 text-[#2a9db0]" aria-hidden="true" /> รายงานน้ำจากประชาชน
      </h2>
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> เจ้าหน้าที่ตรวจแล้ว
      </span>
    </div>
  );

  const footer = (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[15px]">
      <Link href="/public/weather-watch" className="inline-flex items-center gap-1 font-semibold text-[#11466e] underline-offset-4 hover:underline">
        <MapPinned className="h-4 w-4" aria-hidden="true" /> ดูทั้งหมดบนแผนที่
      </Link>
      <HelpRequestLink kind="water" className="inline-flex items-center gap-1 rounded-full bg-[#0b5fa5] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#084a82]" disabledClassName="hidden">
        <Waves className="h-4 w-4" aria-hidden="true" /> แจ้งระดับน้ำที่บ้านคุณ
      </HelpRequestLink>
    </div>
  );

  return (
    <section aria-labelledby={titleId} className={className}>
      {layout === "strip" ? (
        <>
          {header}
          <ul className="-mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {reports.map((report) => <StripCard key={report.id} report={report} onOpen={setOpen} />)}
          </ul>
          {footer}
        </>
      ) : (
        <div className="rounded-3xl bg-white p-4 sm:p-5">
          {header}
          <ul className="mt-2 space-y-1">
            {reports.map((report) => <ListCard key={report.id} report={report} onOpen={setOpen} />)}
          </ul>
          {footer}
        </div>
      )}
      <ReportDialog report={open} onClose={() => setOpen(null)} />
    </section>
  );
}
