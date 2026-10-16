"use client";

// เด้งเตือนคำขอความช่วยเหลือจากประชาชนบนหน้าจอเจ้าหน้าที่ พร้อมเสียง (ทุกหน้าที่ใช้ EOCLayout)
// - ดึงคำขอที่ยังไม่มีผู้รับเรื่องจาก /api/eoc/help-alerts ทุก 45 วินาที
// - เรื่องใหม่: เด้ง + ไซเรน / ค้างเกิน 30 นาที: เด้งเตือนซ้ำทุก 30 นาที (สูงสุด 3 ชม.) จนกว่าจะมีคนรับเรื่อง
// - "รับทราบ" ซ่อนเฉพาะเครื่องนี้ (ไม่เปลี่ยนสถานะ) — การรับเรื่องจริงทำในหน้า "คำขอจากประชาชน"
// - เปิด "แจ้งเตือนเข้ามือถือ" ได้จากการ์ด (Web Push) เพื่อรู้แม้ไม่ได้เปิดเว็บ
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Clock, LifeBuoy, Smartphone, X } from "lucide-react";
import { installAlertAudioUnlock, playAlert, showSystemAlert } from "@/lib/alertSound";
import { SPEAK_DELAY_MS, helpRequestSpeech, speak } from "@/lib/alertSpeech";
import { waitedText } from "@/lib/helpAlerts";
import { officerPushStatus, subscribeOfficerPush } from "@/lib/pwaClient";

const API = "/stn-eoc/api/eoc/help-alerts";
const SEEN_KEY = "stn-help-alert-seen";
const ESC_KEY = "stn-help-alert-esc";
const SOUND_KEY = "stn-water-alert-sound"; // ใช้สวิตช์เสียงเดียวกับเตือนระดับน้ำ
const POLL_MS = 45 * 1000;
const URGENCY = { critical: "วิกฤต", high: "สูง", medium: "ปานกลาง", low: "ต่ำ" };

const readJson = (key, fallback) => {
  try { return JSON.parse(window.localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
};
const writeJson = (key, value) => {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* โหมดส่วนตัว */ }
};
const soundOn = () => {
  try { return window.localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; }
};
const linkFor = (id) => `/admin/incident-reports/?status=pending&id=${id}`;

/** การ์ดที่ต้องแสดง: เรื่องใหม่ที่ยังไม่รับทราบ หรือเรื่องค้างที่ถึงรอบเตือนซ้ำใหม่ */
export function visibleHelpAlerts(pending = [], seenMax = 0, escAck = {}) {
  return pending
    .map((item) => {
      // "ใหม่" เฉพาะเรื่องที่ยังไม่ถึง 30 นาที — เรื่องเก่ากว่านั้นแสดงเป็น "ค้าง" แม้เพิ่งเปิดเว็บครั้งแรก
      const isNew = item.id > seenMax && item.escalation === 0;
      const overdue = !isNew && item.escalation > 0 && item.escalation > (Number(escAck[item.id]) || 0);
      return isNew || overdue ? { ...item, kind: isNew ? "new" : "overdue" } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.kind === b.kind ? b.waited_min - a.waited_min : a.kind === "new" ? -1 : 1));
}

export default function HelpRequestWatcher() {
  const [pending, setPending] = useState([]);
  const [visible, setVisible] = useState([]);
  const [hidden, setHidden] = useState(() => new Set());
  const [push, setPush] = useState(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const disabledRef = useRef(false);
  const shownRef = useRef(new Map()); // id → "new" | step ที่เคยส่งเสียงแล้วในแท็บนี้
  const pendingRef = useRef([]);

  const play = useCallback((level) => {
    if (!soundOn()) return;
    playAlert(level).catch(() => {});
  }, []);

  // มือถือ: เสียงเล่นได้หลังผู้ใช้แตะหน้าจอครั้งแรก — ปลดล็อกไว้ล่วงหน้า
  useEffect(() => { installAlertAudioUnlock(); }, []);

  const recompute = useCallback((list) => {
    const next = visibleHelpAlerts(list, Number(readJson(SEEN_KEY, 0)) || 0, readJson(ESC_KEY, {}));
    // เสียงเฉพาะการ์ดที่เพิ่งเกิด (ไม่ดังซ้ำทุกครั้งที่ดึงข้อมูล)
    const fresh = next.filter((item) => shownRef.current.get(item.id) !== (item.kind === "new" ? "new" : item.escalation));
    for (const item of fresh) shownRef.current.set(item.id, item.kind === "new" ? "new" : item.escalation);
    if (fresh.length) {
      const level = fresh.some((item) => item.kind === "new") ? "critical" : "serious";
      play(level);
      if (soundOn()) speak(helpRequestSpeech(fresh), { delayMs: SPEAK_DELAY_MS[level] });
      if (document.hidden) {
        for (const item of fresh.slice(0, 3)) {
          showSystemAlert(item.kind === "new" ? `🆘 คำขอความช่วยเหลือใหม่ #${item.id}` : `⏰ คำขอ #${item.id} รอ ${waitedText(item.waited_min)}`, {
            body: `${item.place}\n${item.summary || ""}`, tag: `help-${item.id}`, renotify: true, requireInteraction: true, data: { url: `/stn-eoc${linkFor(item.id)}` }
          });
        }
      }
    }
    setVisible(next);
  }, [play]);

  const poll = useCallback(async () => {
    if (disabledRef.current) return;
    try {
      const response = await fetch(API, { cache: "no-store" });
      if (response.status === 401 || response.status === 403) { disabledRef.current = true; return; }
      const json = await response.json().catch(() => null);
      if (!json?.success) return;
      pendingRef.current = json.pending || [];
      setPending(pendingRef.current);
      recompute(pendingRef.current);
    } catch {
      /* เครือข่ายหลุดชั่วคราว: รอบหน้าลองใหม่ */
    }
  }, [recompute]);

  useEffect(() => {
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    const onVisible = () => { if (!document.hidden) poll(); };
    const onStorage = (event) => { if (event.key === SEEN_KEY || event.key === ESC_KEY) recompute(pendingRef.current); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("storage", onStorage);
    };
  }, [poll, recompute]);
  // สถานะแจ้งเตือนเข้ามือถือของเครื่องนี้ (ตรวจครั้งเดียวเมื่อมีการ์ดแสดง)
  const hasCards = visible.length > 0;
  useEffect(() => {
    if (!hasCards || push) return;
    officerPushStatus().then(setPush).catch(() => setPush({ supported: false }));
  }, [hasCards, push]);

  const acknowledge = (item) => {
    if (item.kind === "new") writeJson(SEEN_KEY, Math.max(Number(readJson(SEEN_KEY, 0)) || 0, item.id));
    const esc = readJson(ESC_KEY, {});
    esc[item.id] = item.escalation;
    // เก็บเฉพาะเรื่องที่ยังค้าง ไม่ให้ข้อมูลในเครื่องโตไม่หยุด
    const keep = new Set(pending.map((p) => String(p.id)));
    writeJson(ESC_KEY, Object.fromEntries(Object.entries(esc).filter(([id]) => keep.has(id))));
    recompute(pending);
  };
  const acknowledgeAll = () => {
    const maxId = Math.max(0, ...visible.map((item) => item.id));
    writeJson(SEEN_KEY, Math.max(Number(readJson(SEEN_KEY, 0)) || 0, maxId));
    writeJson(ESC_KEY, Object.fromEntries(pending.map((item) => [item.id, item.escalation])));
    recompute(pending);
  };
  const enablePush = async () => {
    setPushBusy(true);
    setPushMessage("");
    try {
      await subscribeOfficerPush();
      setPush(await officerPushStatus());
      setPushMessage("เปิดแล้ว เครื่องนี้จะเด้งเตือนแม้ปิดหน้าเว็บ");
    } catch (error) {
      setPushMessage(error.message);
    } finally {
      setPushBusy(false);
    }
  };

  const cards = visible.filter((item) => !hidden.has(`${item.id}:${item.kind}:${item.escalation}`));
  if (!cards.length) return null;
  const shown = cards.slice(0, 3);

  return (
    <section aria-label="คำขอความช่วยเหลือที่รอรับเรื่อง" className="pointer-events-none fixed inset-x-3 bottom-3 z-[1990] flex flex-col gap-2 sm:left-4 sm:right-auto sm:bottom-4 sm:w-[24rem] print:hidden">
      {cards.length > 1 ? (
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 self-start rounded-full bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
          <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" /> คำขอรอรับเรื่อง {pending.length} เรื่อง
          <Link href="/admin/incident-reports/?status=pending" className="rounded-full bg-white/15 px-2 py-0.5 hover:bg-white/25">ดูทั้งหมด</Link>
          <button type="button" onClick={acknowledgeAll} className="rounded-full bg-white/15 px-2 py-0.5 hover:bg-white/25">รับทราบทั้งหมด</button>
        </div>
      ) : null}
      {shown.map((item) => {
        const isNew = item.kind === "new";
        const key = `${item.id}:${item.kind}:${item.escalation}`;
        return (
          <article key={key} role={isNew ? "alertdialog" : "status"} aria-live={isNew ? "assertive" : "polite"} aria-labelledby={`help-alert-${item.id}`}
            className={`pointer-events-auto w-full overflow-hidden rounded-2xl bg-white shadow-2xl ring-2 ${isNew ? "ring-red-500" : "ring-amber-400"}`}>
            <header className={`flex items-center gap-2 px-4 py-2 text-white ${isNew ? "bg-red-600" : "bg-amber-600"}`}>
              {isNew ? <LifeBuoy className="h-5 w-5 shrink-0" aria-hidden="true" /> : <Clock className="h-5 w-5 shrink-0" aria-hidden="true" />}
              <span id={`help-alert-${item.id}`} className="flex-1 text-sm font-black">
                {isNew ? `คำขอความช่วยเหลือใหม่ #${item.id}` : `ยังไม่มีผู้รับเรื่อง #${item.id} · รอ ${waitedText(item.waited_min)}`}
              </span>
              <button type="button" onClick={() => setHidden((current) => new Set([...current, key]))} className="rounded-full p-1 hover:bg-white/20" aria-label="ซ่อนชั่วคราว" title="ซ่อนชั่วคราว (จะเด้งอีกเมื่อโหลดหน้าใหม่)">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>
            <div className="px-4 py-3 text-sm">
              <p className="font-bold text-slate-900">{item.place}{URGENCY[item.urgency] ? <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">เร่งด่วน{URGENCY[item.urgency]}</span> : null}</p>
              {item.category ? <p className="mt-0.5 text-xs font-semibold text-slate-600">{item.category}</p> : null}
              {item.summary ? <p className="mt-1 leading-6 text-slate-700">{item.summary}</p> : null}
              <p className="mt-1 text-xs text-slate-500">{isNew ? `ส่งมาเมื่อ ${waitedText(item.waited_min)}ที่แล้ว` : "เตือนซ้ำทุก 30 นาทีจนกว่าจะมีผู้รับเรื่อง"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={linkFor(item.id)} onClick={() => acknowledge(item)} className="inline-flex min-h-10 items-center rounded-lg bg-[#0b4c86] px-3 font-bold text-white hover:bg-[#083865]">เปิดดูและรับเรื่อง</Link>
                <button type="button" onClick={() => acknowledge(item)} className="inline-flex min-h-10 items-center rounded-lg px-3 font-semibold text-slate-600 hover:bg-slate-100">รับทราบ</button>
              </div>
            </div>
          </article>
        );
      })}
      {push?.supported && push.enabled && !push.subscribed && push.permission !== "denied" ? (
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200">
          <Smartphone className="h-4 w-4 text-[#0b4c86]" aria-hidden="true" />
          <span className="flex-1 text-slate-700">ให้เครื่องนี้เด้งเตือนแม้ไม่ได้เปิดเว็บ</span>
          <button type="button" disabled={pushBusy} onClick={enablePush} className="inline-flex items-center gap-1 rounded-lg bg-[#0b4c86] px-2.5 py-1.5 font-bold text-white disabled:opacity-60"><BellRing className="h-3.5 w-3.5" aria-hidden="true" />{pushBusy ? "กำลังเปิด…" : "เปิดแจ้งเตือน"}</button>
        </div>
      ) : null}
      {pushMessage ? <p className="pointer-events-auto rounded-xl bg-slate-900/90 px-3 py-2 text-xs text-white" role="status">{pushMessage}</p> : null}
    </section>
  );
}
