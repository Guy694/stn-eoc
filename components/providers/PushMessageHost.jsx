"use client";

// รับแจ้งเตือน (Web Push) ขณะเปิดหน้าเว็บอยู่: service worker ส่งข้อความมา → แสดงบนหน้าเว็บ พร้อมเสียงเตือนและเสียงพูด
// - เตือนภัย (high/critical): หน้าต่างกลางจอแบบเตือนภัยฉุกเฉิน ต้องกด "รับทราบ" + ทางลัด โทร/ศูนย์พักพิง/ขอความช่วยเหลือ
// - ข่าวทั่วไป: แถบเลื่อนลงจากด้านบน ปิดเองใน 12 วินาที (แตะค้าง/เอาเมาส์ชี้ = หยุดนับ)
// แจ้งเตือนของเครื่องเล่นเสียงตามการตั้งค่าเครื่อง (มักเงียบ/สั้น) จึงเล่นเสียงของระบบเองเมื่อเปิดหน้าเว็บอยู่
import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, ChevronRight, House, Phone, Siren, Volume2, X } from "lucide-react";
import { installAlertAudioUnlock, playAlert, unlockAlertAudio } from "@/lib/alertSound";
import { speak, speechText } from "@/lib/alertSpeech";
import HelpRequestLink from "@/components/public/HelpRequestLink";

const HIGH = new Set(["high", "critical"]);
const INFO_MS = 12000;
const OFFICER_PATH = /^\/stn-eoc\/(eoc|admin|dashboard|commander|officer)(\/|$)/;

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`;
}

function relatedPath(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin || parsed.pathname === "/stn-eoc/" || !parsed.pathname.startsWith("/stn-eoc/")) return null;
    return parsed.pathname + parsed.search;
  } catch {
    return null;
  }
}

function UrgentAlert({ item, count, onAck, soundBlocked, onSound }) {
  const ackRef = useRef(null);
  const related = relatedPath(item.url);
  const officer = related && OFFICER_PATH.test(related);
  useEffect(() => { ackRef.current?.focus(); }, [item.key]);

  return (
    <div className="push-urgent fixed inset-0 z-[2100] flex items-end justify-center sm:items-center sm:p-4 print:hidden">
      <div className="absolute inset-0 bg-[#2a0707]/75 backdrop-blur-sm" aria-hidden="true" />
      <div role="alertdialog" aria-modal="true" aria-labelledby={`push-title-${item.key}`} aria-describedby={`push-body-${item.key}`}
        className="push-urgent__card relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white shadow-[0_30px_80px_-20px_rgba(80,0,0,.65)] sm:max-w-md sm:rounded-[2rem]">
        {/* แถบเตือนภัย: ลายเทปกั้นเขตจาง ๆ + ไอคอนไซเรนมีคลื่นกระจาย (จังหวะเดียว ไม่วนตลอด) */}
        <div className="push-urgent__band relative overflow-hidden bg-[#b4231b] px-6 pb-6 pt-7 text-white">
          <div className="flex items-center gap-4">
            <span className="push-urgent__siren relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-[#b4231b]">
              <Siren className="h-7 w-7" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-100">{officer ? "งานด่วนสำหรับเจ้าหน้าที่" : "เตือนภัย จ.สตูล"}</p>
              <p className="text-sm text-red-100/80">{formatTime(item.at)}{count > 1 ? ` · อีก ${count - 1} เรื่อง` : ""}</p>
            </div>
          </div>
          <h2 id={`push-title-${item.key}`} className="mt-4 font-[family-name:var(--font-kanit)] text-[1.65rem] font-bold leading-tight">{item.title.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, "") || item.title}</h2>
        </div>

        <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
          {item.body ? <p id={`push-body-${item.key}`} className="whitespace-pre-line text-[1.08rem] leading-8 text-slate-800">{item.body}</p> : <p id={`push-body-${item.key}`} className="sr-only">{item.title}</p>}

          {soundBlocked ? (
            <button type="button" onClick={onSound} className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-200">
              <Volume2 className="h-4 w-4" aria-hidden="true" /> แตะเพื่อฟังเสียงเตือน
            </button>
          ) : null}

          {officer ? null : (
            <div className="mt-5 grid grid-cols-3 gap-2">
              <a href="tel:1784" className="flex flex-col items-center gap-1.5 rounded-2xl bg-[#fdf1f0] px-2 py-3 text-center text-sm font-semibold text-[#8f1c15] hover:bg-[#fbe2df]">
                <Phone className="h-5 w-5" aria-hidden="true" />โทร 1784
              </a>
              <a href="/stn-eoc/public/shelters/" className="flex flex-col items-center gap-1.5 rounded-2xl bg-[#eef6f8] px-2 py-3 text-center text-sm font-semibold text-[#11466e] hover:bg-[#e0eff3]">
                <House className="h-5 w-5" aria-hidden="true" />ศูนย์พักพิง
              </a>
              <HelpRequestLink className="flex flex-col items-center gap-1.5 rounded-2xl bg-[#eef6f8] px-2 py-3 text-center text-sm font-semibold text-[#11466e] hover:bg-[#e0eff3]" disabledClassName="pointer-events-none opacity-50">
                <Siren className="h-5 w-5" aria-hidden="true" />ขอความช่วยเหลือ
              </HelpRequestLink>
            </div>
          )}

          <button ref={ackRef} type="button" onClick={onAck} className="mt-5 min-h-[3.25rem] w-full rounded-2xl bg-[#0c2f4a] px-4 text-[1.05rem] font-bold text-white hover:bg-[#081f31] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2a9db0]/50">
            {count > 1 ? "รับทราบ แล้วดูเรื่องถัดไป" : "รับทราบ"}
          </button>
          {related ? (
            <a href={related} className="mt-2 flex min-h-11 items-center justify-center gap-1 rounded-2xl text-[15px] font-semibold text-[#0b4c86] hover:bg-slate-50">
              {officer ? "เปิดงานนี้" : "ดูรายละเอียด"} <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoBanner({ item, onClose }) {
  const [paused, setPaused] = useState(false);
  const related = relatedPath(item.url);
  useEffect(() => {
    if (paused) return undefined;
    const timer = window.setTimeout(onClose, INFO_MS);
    return () => window.clearTimeout(timer);
  }, [paused, onClose]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[2100] flex justify-center p-3 pt-[max(.75rem,env(safe-area-inset-top))] print:hidden">
      <article role="status" aria-live="polite" aria-labelledby={`push-title-${item.key}`}
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)} onFocus={() => setPaused(true)}
        className="push-info pointer-events-auto relative w-full max-w-md overflow-hidden rounded-[1.4rem] bg-[#0c2f4a]/95 text-white shadow-[0_20px_50px_-18px_rgba(6,25,42,.8)] ring-1 ring-white/10 backdrop-blur">
        <div className="flex gap-3 p-4 pr-11">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2a9db0] text-white"><BellRing className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="text-xs text-[#9fc9d6]">ข่าวจากศูนย์ฯ · {formatTime(item.at)}</p>
            <h2 id={`push-title-${item.key}`} className="mt-0.5 font-[family-name:var(--font-kanit)] text-[1.05rem] font-semibold leading-snug">{item.title}</h2>
            {item.body ? <p className="mt-1 whitespace-pre-line text-[15px] leading-6 text-[#d5e7ec]">{item.body}</p> : null}
            {related ? <a href={related} className="mt-2 inline-flex items-center gap-0.5 text-sm font-semibold text-[#7fd3df] hover:text-white">ดูรายละเอียด <ChevronRight className="h-4 w-4" aria-hidden="true" /></a> : null}
          </div>
        </div>
        <button type="button" onClick={onClose} className="absolute right-2.5 top-2.5 rounded-full p-1.5 text-[#9fc9d6] hover:bg-white/10 hover:text-white" aria-label="ปิด"><X className="h-4 w-4" aria-hidden="true" /></button>
        <span className={`push-info__timer absolute bottom-0 left-0 h-[3px] bg-[#2a9db0] ${paused ? "[animation-play-state:paused]" : ""}`} style={{ animationDuration: `${INFO_MS}ms` }} aria-hidden="true" />
      </article>
    </div>
  );
}

export default function PushMessageHost() {
  const [urgent, setUrgent] = useState([]);
  const [info, setInfo] = useState(null);
  const [soundBlocked, setSoundBlocked] = useState(false);

  const announce = useCallback((payload, high) => {
    playAlert(high ? "critical" : "serious").then((ok) => setSoundBlocked(!ok)).catch(() => setSoundBlocked(true));
    speak(speechText(`${payload.title} ${payload.body || ""}`), { delayMs: high ? 2900 : 750 }).catch(() => {});
  }, []);

  const receive = useCallback((payload) => {
    if (!payload?.title) return;
    const high = HIGH.has(payload.level);
    const item = { ...payload, key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
    if (high) setUrgent((current) => [item, ...current.filter((other) => !(payload.tag && other.tag === payload.tag))].slice(0, 5));
    else setInfo(item);
    announce(payload, high);
  }, [announce]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return undefined;
    installAlertAudioUnlock();
    const onMessage = (event) => {
      if (event.data?.type === "stn-push") receive(event.data.payload);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [receive]);

  const acknowledge = useCallback(() => setUrgent((current) => current.slice(1)), []);
  const closeInfo = useCallback(() => setInfo(null), []);
  const replaySound = () => unlockAlertAudio().then(() => playAlert("critical")).then((ok) => setSoundBlocked(!ok)).catch(() => {});

  useEffect(() => {
    if (!urgent.length) return undefined;
    const onKey = (event) => { if (event.key === "Escape") acknowledge(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [urgent.length, acknowledge]);

  if (!urgent.length && !info) return null;
  return (
    <>
      {urgent.length ? <UrgentAlert item={urgent[0]} count={urgent.length} onAck={acknowledge} soundBlocked={soundBlocked} onSound={replaySound} /> : null}
      {info && !urgent.length ? <InfoBanner key={info.key} item={info} onClose={closeInfo} /> : null}
      <style>{`
        .push-urgent__card { animation: push-rise .38s cubic-bezier(.2,.9,.25,1) both; }
        .push-urgent__band::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .09;
          background: repeating-linear-gradient(-45deg, #fff 0 14px, transparent 14px 28px); }
        .push-urgent__siren::before, .push-urgent__siren::after { content: ""; position: absolute; inset: 0; border-radius: 9999px;
          border: 2px solid rgba(255,255,255,.85); animation: push-wave 1.4s ease-out 3 both; }
        .push-urgent__siren::after { animation-delay: .45s; }
        .push-info { animation: push-drop .34s cubic-bezier(.2,.9,.25,1) both; }
        .push-info__timer { width: 100%; transform-origin: left; animation-name: push-timer; animation-timing-function: linear; animation-fill-mode: both; }
        @keyframes push-rise { from { transform: translateY(40px); opacity: 0; } }
        @keyframes push-drop { from { transform: translateY(-24px); opacity: 0; } }
        @keyframes push-wave { from { transform: scale(1); opacity: .9; } to { transform: scale(1.9); opacity: 0; } }
        @keyframes push-timer { to { transform: scaleX(0); } }
        @media (prefers-reduced-motion: reduce) {
          .push-urgent__card, .push-info, .push-urgent__siren::before, .push-urgent__siren::after { animation: none; }
          .push-urgent__siren::before, .push-urgent__siren::after { opacity: 0; }
        }
      `}</style>
    </>
  );
}
