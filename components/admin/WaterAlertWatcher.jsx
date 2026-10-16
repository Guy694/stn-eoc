"use client";

// เด้งแจ้งเตือนระดับน้ำบนหน้าจอเจ้าหน้าที่ พร้อมเสียง (ทุกหน้าที่ใช้ EOCLayout)
// - ดึงเรื่องใหม่จาก /api/eoc/water-alerts ทุก 60 วินาที
// - "รับทราบ" แล้วไม่เด้งซ้ำ (จำไว้ในเบราว์เซอร์ และซิงก์ทุกแท็บ)
// - น้ำล้นตลิ่ง: เสียงเตือนซ้ำทุก 2 นาทีจนกว่าจะกดรับทราบ (สูงสุด 5 ครั้ง)
// - เสียงสัญญาณตามด้วยเสียงพูดภาษาไทย เช่น "แจ้งเตือนระดับน้ำ น้ำล้นตลิ่ง สถานี..." (ปิดเสียงพูดแยกได้)
// - เบราว์เซอร์อนุญาตให้เล่นเสียงหลังผู้ใช้แตะหน้าเว็บอย่างน้อย 1 ครั้ง จึงปลดล็อกเสียงเมื่อมีการแตะครั้งแรก
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellRing, CheckCircle2, CloudRain, Siren, Speech, TriangleAlert, Volume2, VolumeX, Waves, X } from "lucide-react";
import { getAlertAudioContext, installAlertAudioUnlock, playPattern, showSystemAlert, unlockAlertAudio } from "@/lib/alertSound";
import { SPEAK_DELAY_MS, VOICE_KEY, setVoiceEnabled, speak, speechSupported, voiceEnabled, waterAlertSpeech } from "@/lib/alertSpeech";

const API = "/stn-eoc/api/eoc/water-alerts";
const SEEN_KEY = "stn-water-alert-seen";
const SOUND_KEY = "stn-water-alert-sound";
const POLL_MS = 60 * 1000;
const REPEAT_MS = 2 * 60 * 1000;
const MAX_REPEATS = 5;

const LEVEL_STYLE = {
  critical: { bar: "bg-red-600", ring: "ring-red-500", icon: Siren, label: "วิกฤต" },
  serious: { bar: "bg-amber-500", ring: "ring-amber-400", icon: TriangleAlert, label: "เฝ้าระวัง" },
  info: { bar: "bg-emerald-600", ring: "ring-emerald-400", icon: CheckCircle2, label: "คลี่คลาย" }
};

function readNumber(key) {
  try { return Number(window.localStorage.getItem(key)) || 0; } catch { return 0; }
}
function writeValue(key, value) {
  try { window.localStorage.setItem(key, String(value)); } catch { /* โหมดส่วนตัว: ใช้ค่าในหน่วยความจำต่อไป */ }
}
function readSound() {
  try { return window.localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; }
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " น.";
}

const RANK = { info: 0, serious: 1, critical: 2 };

export default function WaterAlertWatcher() {
  const [alerts, setAlerts] = useState([]);
  const [soundOn, setSoundOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const [audioLocked, setAudioLocked] = useState(false);
  const [notifyPermission, setNotifyPermission] = useState("unsupported");
  const cursorRef = useRef(0);
  const disabledRef = useRef(false);
  const repeatsRef = useRef(0);

  // AudioContext ร่วมกับเตือนคำขอความช่วยเหลือ — ปลดล็อกเมื่อผู้ใช้แตะหน้าจอครั้งแรก (มือถือ)
  const ensureContext = useCallback(() => getAlertAudioContext(), []);
  useEffect(() => {
    installAlertAudioUnlock();
    const ready = () => setAudioLocked(false);
    window.addEventListener("stn-alert-audio-ready", ready);
    return () => window.removeEventListener("stn-alert-audio-ready", ready);
  }, []);

  const play = useCallback((level, items = null) => {
    if (!readSound()) return;
    // เสียงพูดตามหลังสัญญาณ (เครื่องที่ไม่มีเสียงภาษาไทยจะข้ามเอง)
    if (items?.length) speak(waterAlertSpeech(items), { delayMs: SPEAK_DELAY_MS[level] || 800 });
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().then(() => { setAudioLocked(false); playPattern(ctx, level); }).catch(() => setAudioLocked(true));
      if (ctx.state === "suspended") setAudioLocked(true);
      return;
    }
    playPattern(ctx, level);
  }, [ensureContext]);

  const showSystemNotification = useCallback((items) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || !document.hidden) return;
    for (const item of items) {
      try {
        showSystemAlert(item.title, { body: String(item.message || "").split("\n").slice(0, 2).join(" · "), tag: `water-alert-${item.id}`, requireInteraction: item.level === "critical" });
      } catch { /* บางเบราว์เซอร์ต้องใช้ service worker — ข้ามได้ */ }
    }
  }, []);

  const receive = useCallback((items) => {
    if (!items.length) return;
    setAlerts((current) => {
      const known = new Set(current.map((item) => item.id));
      return [...items.filter((item) => !known.has(item.id)), ...current].slice(0, 6);
    });
    const top = items.reduce((worst, item) => (RANK[item.level] > RANK[worst] ? item.level : worst), "info");
    repeatsRef.current = 0;
    const ordered = [...items].sort((a, b) => RANK[b.level] - RANK[a.level]);
    play(top, ordered);
    showSystemNotification(items);
  }, [play, showSystemNotification]);

  const poll = useCallback(async () => {
    if (disabledRef.current) return;
    try {
      const seen = readNumber(SEEN_KEY);
      const after = Math.max(seen, cursorRef.current);
      const response = await fetch(`${API}?after=${after}`, { cache: "no-store" });
      if (response.status === 401 || response.status === 403) { disabledRef.current = true; return; }
      const json = await response.json().catch(() => null);
      if (!json?.success) return;
      if (!json.ready) { disabledRef.current = true; return; }
      cursorRef.current = Math.max(cursorRef.current, Number(json.latest_id) || 0);
      receive((json.alerts || []).filter((item) => item.id > seen));
    } catch {
      /* เครือข่ายหลุดชั่วคราว: รอบหน้าลองใหม่ */
    }
  }, [receive]);

  useEffect(() => {
    setSoundOn(readSound());
    setVoiceOn(voiceEnabled());
    setNotifyPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    const unlock = () => {
      const ctx = ensureContext();
      if (ctx?.state === "suspended") ctx.resume().then(() => setAudioLocked(false)).catch(() => {});
    };
    const onStorage = (event) => {
      if (event.key === SEEN_KEY) setAlerts((current) => current.filter((item) => item.id < 0 || item.id > (Number(event.newValue) || 0)));
      if (event.key === SOUND_KEY) setSoundOn(event.newValue !== "off");
      if (event.key === VOICE_KEY) setVoiceOn(event.newValue !== "off");
    };
    const onTest = (event) => {
      const level = event.detail?.level || "critical";
      if (event.detail?.kind === "rain") {
        receive([{
          id: -Date.now(),
          kind: "rain",
          level,
          title: "⛈️ [ทดสอบ] ฝนหนักมาก — สถานีวัดฝนตัวอย่าง",
          message: "ต.ตัวอย่าง อ.ตัวอย่าง\nฝน 24 ชม. 95.0 มม. (ฝนหนักมาก)\nนี่คือการทดสอบบนเครื่องนี้เท่านั้น ไม่มีการส่งข้อความหาใคร",
          created_at: new Date().toISOString(),
          test: true
        }]);
        return;
      }
      receive([{
        id: -Date.now(),
        kind: "water",
        level,
        title: level === "critical" ? "🚨 [ทดสอบ] น้ำล้นตลิ่ง — สถานีตัวอย่าง" : level === "serious" ? "⚠️ [ทดสอบ] น้ำใกล้ล้นตลิ่ง — สถานีตัวอย่าง" : "✅ [ทดสอบ] น้ำลดลงต่ำกว่าตลิ่งแล้ว — สถานีตัวอย่าง",
        message: "นี่คือการทดสอบเสียงและหน้าต่างแจ้งเตือนบนเครื่องนี้เท่านั้น\nไม่มีการส่งข้อความหาใคร",
        created_at: new Date().toISOString(),
        test: true
      }]);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("storage", onStorage);
    window.addEventListener("water-alert:test", onTest);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("water-alert:test", onTest);
    };
  }, [ensureContext, poll, receive]);

  // วิกฤตที่ยังไม่รับทราบ: เตือนซ้ำเป็นระยะ
  const hasCritical = alerts.some((item) => item.level === "critical");
  const alertsRef = useRef(alerts);
  useEffect(() => { alertsRef.current = alerts; }, [alerts]);
  useEffect(() => {
    if (!hasCritical) return undefined;
    const timer = window.setInterval(() => {
      if (repeatsRef.current >= MAX_REPEATS) return;
      repeatsRef.current += 1;
      play("critical", alertsRef.current.filter((item) => item.level === "critical"));
    }, REPEAT_MS);
    return () => window.clearInterval(timer);
  }, [hasCritical, play]);

  // รับทราบเรื่องหนึ่ง = รับทราบเรื่องที่เก่ากว่าด้วย (เรื่องทดสอบ id ติดลบ ปิดเฉพาะเรื่องนั้น)
  const acknowledge = (id) => {
    if (id > 0) writeValue(SEEN_KEY, Math.max(readNumber(SEEN_KEY), id));
    setAlerts((current) => current.filter((item) => (id > 0 ? item.id < 0 || item.id > id : item.id !== id)));
  };
  const acknowledgeAll = () => {
    const maxId = Math.max(0, ...alerts.map((item) => item.id));
    if (maxId) writeValue(SEEN_KEY, Math.max(readNumber(SEEN_KEY), maxId));
    setAlerts([]);
  };
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    writeValue(SOUND_KEY, next ? "on" : "off");
    if (next) play("info");
  };
  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    setVoiceEnabled(next);
    if (next) speak(waterAlertSpeech(alerts), { force: true });
    else if (speechSupported()) window.speechSynthesis.cancel();
  };
  const enableAudio = () => {
    const ctx = ensureContext();
    unlockAlertAudio().then(() => {
      setAudioLocked(false);
      playPattern(ctx, alerts[0]?.level || "info");
      speak(waterAlertSpeech(alerts), { delayMs: SPEAK_DELAY_MS[alerts[0]?.level] || 800 });
    }).catch(() => {});
  };
  const askNotification = () => {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then(setNotifyPermission).catch(() => {});
  };

  if (!alerts.length) return null;

  return (
    <section aria-label="แจ้งเตือนระดับน้ำและฝนหนัก" className="pointer-events-none fixed inset-x-3 top-3 z-[2000] flex flex-col items-end gap-2 sm:left-auto sm:right-4 sm:top-4 sm:w-[24rem] print:hidden">
      {alerts.length > 1 ? (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
          <BellRing className="h-3.5 w-3.5" aria-hidden="true" /> แจ้งเตือนน้ำและฝน {alerts.length} เรื่อง
          <button type="button" onClick={acknowledgeAll} className="rounded-full bg-white/15 px-2 py-0.5 hover:bg-white/25">รับทราบทั้งหมด</button>
        </div>
      ) : null}
      {alerts.map((alert) => {
        const style = LEVEL_STYLE[alert.level] || LEVEL_STYLE.serious;
        const Icon = alert.kind === "rain" ? CloudRain : style.icon;
        const topic = alert.kind === "rain" ? "แจ้งเตือนฝนหนัก" : "แจ้งเตือนระดับน้ำ";
        const lines = String(alert.message || "").split("\n").filter(Boolean);
        return (
          <article
            key={alert.id}
            role={alert.level === "critical" ? "alertdialog" : "status"}
            aria-live={alert.level === "critical" ? "assertive" : "polite"}
            aria-labelledby={`water-alert-${alert.id}`}
            className={`pointer-events-auto w-full overflow-hidden rounded-2xl bg-white shadow-2xl ring-2 ${style.ring} ${alert.level === "critical" ? "motion-safe:animate-[pulse_1.6s_ease-in-out_3]" : ""}`}
          >
            <header className={`flex items-center gap-2 px-4 py-2 text-white ${style.bar}`}>
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-sm font-black">{topic} · {style.label}</span>
              {speechSupported() ? (
                <button type="button" onClick={toggleVoice} className={`rounded-full p-1 hover:bg-white/20 ${voiceOn && soundOn ? "" : "opacity-50"}`} aria-pressed={voiceOn} aria-label={voiceOn ? "ปิดเสียงพูด" : "เปิดเสียงพูด"} title={voiceOn ? "ปิดเสียงพูด (เหลือเสียงสัญญาณ)" : "เปิดเสียงพูดอ่านแจ้งเตือน"}>
                  <Speech className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
              <button type="button" onClick={toggleSound} className="rounded-full p-1 hover:bg-white/20" aria-label={soundOn ? "ปิดเสียงแจ้งเตือน" : "เปิดเสียงแจ้งเตือน"} title={soundOn ? "ปิดเสียง" : "เปิดเสียง"}>
                {soundOn ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
              </button>
              <button type="button" onClick={() => setAlerts((current) => current.filter((item) => item.id !== alert.id))} className="rounded-full p-1 hover:bg-white/20" aria-label="ซ่อนชั่วคราว" title="ซ่อนชั่วคราว (ยังไม่นับว่ารับทราบ)">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>
            <div className="px-4 py-3">
              <h2 id={`water-alert-${alert.id}`} className="text-base font-black leading-snug text-slate-900">{alert.title.replace(/^[^\p{L}[]+/u, "")}</h2>
              <div className="mt-1 space-y-0.5 text-sm text-slate-700">
                {lines.map((line, index) => <div key={index} className={index === 1 ? "font-bold text-slate-900" : ""}>{line}</div>)}
              </div>
              <div className="mt-1.5 text-xs text-slate-500">
                {alert.observed_at ? `วัดเมื่อ ${formatTime(alert.observed_at)} · ` : ""}แจ้งเมื่อ {formatTime(alert.created_at)} · ThaiWater สสน.
              </div>
              {audioLocked && soundOn ? (
                <button type="button" onClick={enableAudio} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-200">
                  <Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> แตะเพื่อเปิดเสียงแจ้งเตือน
                </button>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => acknowledge(alert.id)} className="flex-1 rounded-lg bg-[#0b4c86] px-3 py-2 text-sm font-bold text-white hover:bg-[#083865]">รับทราบ</button>
                <Link href="/public/disaster-map" target="_blank" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50">
                  <Waves className="h-4 w-4" aria-hidden="true" /> ดูแผนที่
                </Link>
              </div>
              {notifyPermission === "default" ? (
                <button type="button" onClick={askNotification} className="mt-2 text-xs font-semibold text-[#0b4c86] underline">ให้แจ้งเตือนแม้ย่อหน้าต่างนี้ไว้</button>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}
