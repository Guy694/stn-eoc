"use client";

// รับแจ้งเตือน (Web Push) ขณะเปิดหน้าเว็บอยู่: service worker ส่งข้อความมา → เด้งหน้าต่างแสดงข้อความเต็ม พร้อมเสียงเตือนและเสียงพูด
// (แจ้งเตือนของเครื่องเล่นเสียงตามการตั้งค่าเครื่อง ซึ่งมักเงียบหรือสั้นมาก จึงเล่นเสียงของระบบเองเมื่อเปิดหน้าเว็บอยู่)
import { useCallback, useEffect, useState } from "react";
import { BellRing, ExternalLink, Siren, X } from "lucide-react";
import { installAlertAudioUnlock, playAlert } from "@/lib/alertSound";
import { speak, speechText } from "@/lib/alertSpeech";

const HIGH = new Set(["high", "critical"]);

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " น.";
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

export default function PushMessageHost() {
  const [items, setItems] = useState([]);

  const receive = useCallback((payload) => {
    if (!payload?.title) return;
    const high = HIGH.has(payload.level);
    setItems((current) => [{ ...payload, key: `${Date.now()}-${Math.random()}` }, ...current.filter((item) => !(payload.tag && item.tag === payload.tag))].slice(0, 3));
    playAlert(high ? "critical" : "serious").catch(() => {});
    speak(speechText(`${payload.title} ${payload.body || ""}`), { delayMs: high ? 2900 : 750 }).catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return undefined;
    installAlertAudioUnlock();
    const onMessage = (event) => {
      if (event.data?.type === "stn-push") receive(event.data.payload);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [receive]);

  const close = (key) => setItems((current) => current.filter((item) => item.key !== key));

  if (!items.length) return null;
  return (
    <section aria-label="แจ้งเตือนที่เพิ่งได้รับ" className="pointer-events-none fixed inset-x-3 bottom-24 z-[2100] flex flex-col items-center gap-2 sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-20 sm:w-[28rem] sm:-translate-x-1/2 print:hidden">
      {items.map((item) => {
        const high = HIGH.has(item.level);
        const Icon = high ? Siren : BellRing;
        const related = relatedPath(item.url);
        return (
          <article key={item.key} role={high ? "alertdialog" : "status"} aria-live={high ? "assertive" : "polite"} aria-labelledby={`push-${item.key}`} className={`pointer-events-auto w-full overflow-hidden rounded-2xl bg-white shadow-2xl ring-2 ${high ? "ring-red-500" : "ring-[#2a9db0]"}`}>
            <header className={`flex items-center gap-2 px-4 py-2 text-white ${high ? "bg-red-600" : "bg-[#0b4c86]"}`}>
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-sm font-bold">{high ? "แจ้งเตือนภัย" : "ข่าวจากศูนย์ฯ"} · {formatTime(item.at)}</span>
              <button type="button" onClick={() => close(item.key)} className="rounded-full p-1 hover:bg-white/20" aria-label="ปิด"><X className="h-4 w-4" aria-hidden="true" /></button>
            </header>
            <div className="px-4 py-3">
              <h2 id={`push-${item.key}`} className="font-[family-name:var(--font-kanit)] text-lg font-semibold leading-snug text-slate-900">{item.title}</h2>
              {item.body ? <p className="mt-1 whitespace-pre-line text-[15px] leading-7 text-slate-700">{item.body}</p> : null}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => close(item.key)} className="flex-1 rounded-lg bg-[#0b4c86] px-3 py-2 text-sm font-bold text-white hover:bg-[#083865]">รับทราบ</button>
                {related ? (
                  <a href={related} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" /> เปิดหน้าที่เกี่ยวข้อง
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
