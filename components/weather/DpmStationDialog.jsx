"use client";

// รายละเอียดสถานีวัดระดับน้ำ + กล้อง CCTV ของ ปภ. (ใช้ทั้งหน้าแรก "น้ำในคลองตอนนี้" และไอคอนกล้องบนแผนที่)
// ข้อมูลชุดเดียวกับหน้าสถานีของ ปภ./อบจ.สตูล แต่ใช้หน้าตาของระบบเรา
import { useEffect, useRef, useState } from "react";
import { Building2, Clock, MapPin, Phone, RefreshCw, Waves, Camera, Expand, Minimize2 } from "lucide-react";
import AppDialog from "@/components/ui/app-dialog";
import { DDPM_CCTV_CREDIT, DDPM_CCTV_ORIGIN, cameraCodes, frameUrl } from "@/lib/ddpmCctv";
import { DPM_STATUS, dpmStatus, nextThreshold, thresholdBar } from "@/lib/dpmCanals";
import { bankText, situationMeta } from "@/lib/thaiWater";

const REFRESH_MS = 60 * 1000;
const m2 = (value) => (typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "–");
const when = (iso) => {
  const date = new Date(iso || "");
  return Number.isNaN(date.getTime()) ? "–" : date.toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " น.";
};

function CameraFrame({ cam, label, stamp }) {
  const [state, setState] = useState("loading");
  const [fullscreen, setFullscreen] = useState(false);
  const frameRef = useRef(null);
  useEffect(() => { setState((current) => (current === "ok" ? "ok" : "loading")); }, [stamp]);
  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === frameRef.current || document.webkitFullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
    };
  }, []);
  const toggleFullscreen = async () => {
    if (fullscreen) {
      await (document.exitFullscreen?.() || document.webkitExitFullscreen?.());
      return;
    }
    const frame = frameRef.current;
    if (frame?.requestFullscreen) await frame.requestFullscreen();
    else if (frame?.webkitRequestFullscreen) frame.webkitRequestFullscreen();
  };
  return (
    <figure className="m-0">
      <div ref={frameRef} className={`group relative aspect-video overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-slate-900/10 ${fullscreen ? "flex h-screen w-screen items-center justify-center rounded-none ring-0" : ""}`}>
        {state !== "error" ? (
          // eslint-disable-next-line @next/next/no-img-element -- ภาพนิ่งจากกล้อง เปลี่ยนทุกนาที
          <img src={frameUrl(cam, stamp)} alt={`ภาพล่าสุดจาก${label}`} onLoad={() => setState("ok")} onError={() => setState("error")}
            className={`h-full w-full transition-opacity duration-300 ${fullscreen ? "object-contain" : "object-cover"} ${state === "ok" ? "opacity-100" : "opacity-0"}`} />
        ) : null}
        {state === "loading" ? <span className="absolute inset-0 grid place-items-center text-xs text-white/70">กำลังโหลดภาพ…</span> : null}
        {state === "error" ? <span className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-white/70">กล้องนี้ไม่มีภาพขณะนี้</span> : null}
        {state === "ok" ? <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-950/65 px-2.5 py-1 text-[11px] font-semibold text-white shadow backdrop-blur"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />ภาพล่าสุด</span> : null}
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-950/60 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur"><Camera className="h-3.5 w-3.5" />{label}</span>
        {state === "ok" ? <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? `ย่อภาพ${label}` : `ขยายภาพ${label}เต็มจอ`} title={fullscreen ? "ออกจากเต็มจอ" : "ดูภาพเต็มจอ"} className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-slate-950/65 text-white shadow backdrop-blur transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{fullscreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}</button> : null}
      </div>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

function ThresholdBar({ station }) {
  const bar = thresholdBar(station);
  if (!bar) return null;
  return (
    <div className="mt-6" aria-label={`ระดับน้ำ ${m2(station.level)} ม. เทียบเกณฑ์ของ ปภ.`}>
      <div className="relative">
        {bar.marker !== null ? (
          <div className="absolute -top-6 flex -translate-x-1/2 flex-col items-center" style={{ left: `${bar.marker}%` }}>
            <span className="whitespace-nowrap text-[11px] font-bold text-slate-900">{m2(station.level)} ม.</span>
            <span className="h-4 w-0.5 rounded bg-slate-900" />
          </div>
        ) : null}
        <div className="flex h-3 overflow-hidden rounded-full">
          {bar.segments.map((segment) => <span key={segment.code} style={{ width: `${segment.width}%`, backgroundColor: DPM_STATUS[segment.code].tone }} />)}
        </div>
      </div>
      <div className="relative mt-1 h-4 text-[10px] text-slate-500">
        {bar.ticks.map((tick, index) => (
          <span key={tick.label} className={`absolute whitespace-nowrap ${index === 0 ? "" : index === bar.ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"} hidden sm:block`} style={{ left: `${tick.at}%` }}>{tick.label}</span>
        ))}
        <span className="sm:hidden">เกณฑ์ ปภ.: {bar.ticks.slice(1).map((tick) => tick.label).join(" • ")}</span>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }) {
  if (!children) return null;
  return (
    <div className="flex gap-3 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <span className="w-20 shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 flex-1 break-words text-slate-800">{children}</span>
    </div>
  );
}

function WaterTrendChart({ station, history = [] }) {
  const points = (history || []).map((point) => {
    const rawTime = String(point.t || "");
    const time = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(rawTime) ? rawTime : `${rawTime.replace(" ", "T")}+07:00`).getTime();
    const level = Number(point.level);
    return { time, level };
  }).filter((point) => Number.isFinite(point.time) && Number.isFinite(point.level)).sort((a, b) => a.time - b.time);
  if (typeof station.level === "number" && station.observedAt) {
    const time = new Date(station.observedAt).getTime();
    if (Number.isFinite(time) && !points.some((point) => Math.abs(point.time - time) < 10 * 60 * 1000)) points.push({ time, level: station.level });
  }
  points.sort((a, b) => a.time - b.time);
  if (points.length < 2) return <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4" aria-label="แนวโน้มระดับน้ำ 24 ชั่วโมง"><h3 className="font-[family-name:var(--font-kanit)] font-semibold text-[#0c2f4a]">แนวโน้มระดับน้ำ 24 ชั่วโมง</h3><p className="mt-2 text-sm text-slate-500">กำลังสะสมข้อมูลรายชั่วโมงเพื่อแสดงกราฟแนวโน้ม</p></section>;

  const width = 640;
  const height = 180;
  const pad = { top: 14, right: 16, bottom: 26, left: 46 };
  const values = points.map((point) => point.level);
  const danger = Number(station.thresholds?.danger);
  const includeDanger = Number.isFinite(danger);
  const min = Math.min(...values) - 0.08;
  const max = Math.max(...values, ...(includeDanger ? [danger] : [])) + 0.08;
  const span = Math.max(max - min, 0.12);
  const x = (time) => pad.left + ((time - points[0].time) / Math.max(points.at(-1).time - points[0].time, 1)) * (width - pad.left - pad.right);
  const y = (value) => pad.top + ((max - value) / span) * (height - pad.top - pad.bottom);
  const line = points.map((point) => `${x(point.time).toFixed(1)},${y(point.level).toFixed(1)}`).join(" ");
  const delta = points.at(-1).level - points[0].level;
  const trendTone = delta > 0.02 ? "#dc2626" : delta < -0.02 ? "#0f766e" : "#64748b";
  const fmtTime = (time) => new Date(time).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
  const grid = [0, 1, 2, 3].map((index) => min + (span * index) / 3);

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="dpm-trend-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h3 id="dpm-trend-title" className="font-[family-name:var(--font-kanit)] font-semibold text-[#0c2f4a]">แนวโน้มระดับน้ำ 24 ชั่วโมง</h3><p className="text-xs text-slate-500">ข้อมูลรายชั่วโมงจากสถานี ปภ.</p></div>
        <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: `${trendTone}18`, color: trendTone }}>{delta > 0.02 ? "น้ำขึ้น" : delta < -0.02 ? "น้ำลด" : "ทรงตัว"} {delta > 0 ? "+" : ""}{delta.toFixed(2)} ม.</span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-40 min-w-[480px] w-full" role="img" aria-label={`ระดับน้ำเปลี่ยนแปลง ${delta > 0 ? "เพิ่มขึ้น" : "ลดลง"} ${Math.abs(delta).toFixed(2)} เมตรในช่วง ${fmtTime(points[0].time)} ถึง ${fmtTime(points.at(-1).time)}`}>
          {grid.map((value, index) => <g key={index}><line x1={pad.left} x2={width - pad.right} y1={y(value)} y2={y(value)} stroke="#e2e8f0" strokeDasharray="3 5"/><text x={pad.left - 8} y={y(value) + 4} textAnchor="end" fill="#64748b" fontSize="11">{value.toFixed(1)}</text></g>)}
          {includeDanger && danger >= min && danger <= max ? <g><line x1={pad.left} x2={width - pad.right} y1={y(danger)} y2={y(danger)} stroke="#dc2626" strokeDasharray="6 4"/><text x={width - pad.right} y={y(danger) - 5} textAnchor="end" fill="#b91c1c" fontSize="10">เกณฑ์อันตราย {danger.toFixed(2)} ม.</text></g> : null}
          <polyline points={line} fill="none" stroke={trendTone} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((point, index) => <circle key={`${point.time}-${index}`} cx={x(point.time)} cy={y(point.level)} r={index === points.length - 1 ? 4 : 2} fill={trendTone} stroke="white" strokeWidth="1.5"><title>{fmtTime(point.time)} น. • {point.level.toFixed(2)} ม.</title></circle>)}
          <text x={pad.left} y={height - 5} fill="#64748b" fontSize="11">{fmtTime(points[0].time)} น.</text>
          <text x={width - pad.right} y={height - 5} textAnchor="end" fill="#64748b" fontSize="11">{fmtTime(points.at(-1).time)} น.</text>
        </svg>
      </div>
    </section>
  );
}

export default function DpmStationDialog({ station, history = [], open, onClose }) {
  const [stamp, setStamp] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return undefined;
    setStamp(Date.now());
    const timer = window.setInterval(() => setStamp(Date.now()), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [open]);
  if (!station) return null;
  const status = dpmStatus(station);
  const toBank = typeof station.belowBank === "number" ? station.belowBank : null;
  const next = nextThreshold(station);
  const [one, two] = cameraCodes(station);
  const nearbyThaiWater = station.nearbyThaiWater;
  const thaiWaterStatus = nearbyThaiWater ? situationMeta(nearbyThaiWater.situationLevel) : null;

  return (
    <AppDialog
      open={open}
      onOpenChange={(value) => { if (!value) onClose?.(); }}
      size="lg"
      className="border border-white/70 shadow-[0_24px_80px_-24px_rgba(15,42,68,.55)]"
      contentClassName="bg-white p-4 sm:p-6"
      title={(
        <span className="flex flex-wrap items-center gap-2">
          <span className="min-w-0">{station.name}</span>
          <span className="rounded-full px-2.5 py-0.5 text-sm font-bold" style={{ backgroundColor: status.soft, color: status.tone }}>{status.label}</span>
        </span>
      )}
      description={`สถานี ${station.code}${station.amphoe ? ` • อ.${station.amphoe}` : ""} • กล้อง CCTV และระดับน้ำจาก ${DDPM_CCTV_CREDIT}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-sky-700">สถานการณ์น้ำ • CCTV</p><p className="mt-0.5 text-xs text-slate-500">ภาพและระดับน้ำล่าสุดจากสถานี</p></div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>อัปเดตอัตโนมัติ</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CameraFrame cam={one} label="กล้อง 1" stamp={stamp} />
        <CameraFrame cam={two} label="กล้อง 2" stamp={stamp} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>ภาพนิ่งอัปเดตทุก 1 นาที</span>
        <button type="button" onClick={() => setStamp(Date.now())} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 font-bold text-[#0b4c86] transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> โหลดภาพใหม่
        </button>
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-4 shadow-sm sm:p-5" aria-labelledby="dpm-analysis">
        <h3 id="dpm-analysis" className="flex items-center gap-2 font-[family-name:var(--font-kanit)] text-base font-semibold text-[#0c2f4a]">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-100"><Waves className="h-4 w-4 text-[#0b4c86]" aria-hidden="true" /></span><span><span className="block">ระดับน้ำเทียบตลิ่งและเกณฑ์</span><span className="mt-0.5 block font-sans text-[11px] font-medium text-slate-500">ข้อมูลจากสถานีตรวจวัด ปภ.</span></span>
        </h3>
        {station.level === null ? (
          <p className="mt-2 text-sm text-slate-600">สถานีไม่ได้ส่งค่าระดับน้ำขณะนี้ ดูสภาพคลองจากภาพกล้องด้านบนได้</p>
        ) : (
          <>
            <dl className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              <div>
                <dt className="text-xs text-slate-500">ระดับน้ำตอนนี้</dt>
                <dd className="mt-1 font-[family-name:var(--font-kanit)] text-2xl font-bold leading-tight" style={{ color: status.tone }}>{m2(station.level)} <span className="text-sm font-medium text-slate-500">ม.</span></dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">ระดับตลิ่ง</dt>
                <dd className="mt-1 font-[family-name:var(--font-kanit)] text-2xl font-bold leading-tight text-slate-900">{m2(station.bank)} <span className="text-sm font-medium text-slate-500">ม.</span></dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{toBank !== null && toBank < 0 ? "เกินตลิ่ง" : "ระยะถึงตลิ่ง"}</dt>
                <dd className={`mt-1 font-[family-name:var(--font-kanit)] text-2xl font-bold leading-tight ${toBank !== null && toBank < 0.5 ? "text-red-600" : "text-emerald-600"}`}>
                  {toBank === null ? "–" : m2(Math.abs(toBank))} <span className="text-sm font-medium text-slate-500">ม.</span>
                </dd>
              </div>
            </dl>
            <ThresholdBar station={station} />
            {next ? <p className="mt-3 text-sm text-slate-600">อีก {m2(next.gap)} ม. ถึงเกณฑ์{next.label} ({m2(next.level)} ม.)</p> : null}
          </>
        )}
      </section>

      <WaterTrendChart station={station} history={history} />

      {nearbyThaiWater ? <section className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4" aria-labelledby="nearby-thaiwater-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h3 id="nearby-thaiwater-title" className="font-[family-name:var(--font-kanit)] text-sm font-bold text-[#0c2f4a]">ข้อมูลความจุน้ำจากสถานีใกล้เคียง</h3><p className="mt-0.5 text-xs text-slate-500">ThaiWater (สสน.) • สถานีในอำเภอเดียวกันและห่างไม่เกิน 3 กม.</p></div>
          {nearbyThaiWater ? <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-cyan-800 ring-1 ring-cyan-200">ห่าง {nearbyThaiWater.distanceKm} กม.</span> : null}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div><p className="text-xs text-slate-500">สถานีที่จับคู่</p><p className="mt-0.5 text-sm font-semibold text-slate-800">{nearbyThaiWater.name}</p></div>
            <div><p className="text-xs text-slate-500">ความจุลำน้ำ</p><p className="mt-0.5 font-[family-name:var(--font-kanit)] text-xl font-bold text-cyan-800">{nearbyThaiWater.storagePercent === null ? "–" : `${Number(nearbyThaiWater.storagePercent).toFixed(0)}%`}{thaiWaterStatus ? <span className="ml-2 rounded-full px-2 py-0.5 align-middle font-sans text-xs" style={{ backgroundColor: thaiWaterStatus.color, color: thaiWaterStatus.text }}>{thaiWaterStatus.label}</span> : null}</p></div>
            <div><p className="text-xs text-slate-500">ระดับน้ำเทียบตลิ่ง</p><p className="mt-0.5 text-sm font-semibold text-slate-800">{nearbyThaiWater.bankDiff === null ? "–" : bankText(nearbyThaiWater.bankDiff)}</p></div>
            <div className="sm:col-span-3 text-xs text-slate-500">สถานี {nearbyThaiWater.agency || "ThaiWater (สสน.)"} · วัดเมื่อ {nearbyThaiWater.observedAt ? when(nearbyThaiWater.observedAt) : "–"}</div>
        </div>
      </section> : null}

      <div className="mt-4 grid gap-1 sm:grid-cols-2">
        <InfoRow icon={MapPin} label="ที่ตั้ง">{station.location || station.name}</InfoRow>
        <InfoRow icon={Waves} label="ลุ่มน้ำ">{station.river}</InfoRow>
        <InfoRow icon={Building2} label="หน่วยงาน">{station.agency}</InfoRow>
        <InfoRow icon={Phone} label="ติดต่อ">{station.telephone ? <a href={`tel:${station.telephone}`} className="font-semibold text-[#0b4c86] hover:underline">{station.telephone}</a> : null}</InfoRow>
        <InfoRow icon={Clock} label="วัดเมื่อ">{station.observedAt ? when(station.observedAt) : null}</InfoRow>
      </div>
      <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
        สถานะคิดจากระดับน้ำเทียบเกณฑ์ของ ปภ. ประจำสถานี • <a href={DDPM_CCTV_ORIGIN} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0b4c86] hover:underline">ดูภาพสดที่เว็บ ปภ.</a>
      </p>
    </AppDialog>
  );
}
