"use client";

// เสียงแจ้งเตือนบนหน้าเว็บ (ผู้ดูแลระบบตั้ง ใช้ทุกเครื่อง): แบบเสียงต่อระดับ ความดัง และเสียงพูดภาษาไทย
// ใช้กับ popup เตือนภัยประชาชน แจ้งเตือนน้ำ/ฝนบนจอเจ้าหน้าที่ และคำขอความช่วยเหลือ — บันทึกทันทีที่เลือก
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Speech, Volume1, Volume2 } from "lucide-react";
import { useNotice } from "@/components/admin/crud";
import { apiRequest, formatDateTime } from "@/lib/adminApi";
import {
  DEFAULT_SOUND_PREFS, SOUND_LEVELS, SOUND_STYLES,
  getAlertAudioContext, normalizeSoundPrefs, playStyle, setSystemSoundPrefs, unlockAlertAudio
} from "@/lib/alertSound";
import { speak, speechSupported, thaiVoice, waitForVoices } from "@/lib/alertSpeech";

const API = "/stn-eoc/api/admin/alert-sounds";
const LEVEL_DOT = { critical: "bg-red-600", serious: "bg-amber-500", info: "bg-[#2a9db0]" };

export default function AlertSoundSettings({ className = "" }) {
  const { success, fail } = useNotice();
  const [prefs, setPrefs] = useState(null);
  const [meta, setMeta] = useState({});
  const [saving, setSaving] = useState(false);
  const [thai, setThai] = useState(null);
  const volumeTimer = useRef(null);

  useEffect(() => {
    apiRequest(API)
      .then((json) => { setPrefs(normalizeSoundPrefs(json.data)); setMeta(json.data); })
      .catch((error) => { fail(error.message || "โหลดการตั้งค่าเสียงไม่สำเร็จ"); setPrefs({ ...DEFAULT_SOUND_PREFS }); });
    waitForVoices().then((voice) => setThai(voice || thaiVoice())).catch(() => {});
  }, [fail]);

  const preview = async (style, volume) => {
    await unlockAlertAudio().catch(() => false);
    playStyle(getAlertAudioContext(), style, { volume });
  };

  const save = useCallback(async (next, message) => {
    setPrefs(next);
    setSaving(true);
    try {
      const json = await apiRequest(API, { method: "PUT", body: next });
      setMeta(json.data);
      setSystemSoundPrefs(json.data); // เครื่องนี้ใช้ค่าใหม่ทันที เครื่องอื่นได้ค่าใหม่เมื่อเปิด/รีเฟรชหน้า
      if (message) success(message);
    } catch (error) {
      fail(error.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }, [fail, success]);

  if (!prefs) return <section className={`h-64 animate-pulse rounded-2xl border border-slate-200 bg-white ${className}`} aria-hidden="true" />;

  const choose = (level, style) => {
    preview(style, prefs.volume);
    if (prefs[level] !== style) save({ ...prefs, [level]: style }, `${SOUND_LEVELS[level].label}: ${SOUND_STYLES[style].label}`);
  };
  const changeVolume = (volume) => {
    const next = { ...prefs, volume };
    setPrefs(next);
    window.clearTimeout(volumeTimer.current);
    volumeTimer.current = window.setTimeout(() => {
      save(next);
      preview(next.critical === "none" ? "beep" : next.critical, volume);
    }, 350);
  };
  const toggleVoice = () => {
    const next = { ...prefs, voice: !prefs.voice };
    save(next, next.voice ? "เปิดเสียงพูดอ่านแจ้งเตือน" : "ปิดเสียงพูดอ่านแจ้งเตือน");
    if (next.voice) speak("ทดสอบเสียงพูดแจ้งเตือน ศูนย์ปฏิบัติการภาวะฉุกเฉิน จังหวัดสตูล", { force: true });
  };

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 ${className}`} aria-labelledby="alert-sound-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="alert-sound-title" className="flex items-center gap-2 font-black text-slate-900"><Volume2 className="h-5 w-5 text-[#0b4c86]" aria-hidden="true" />เสียงแจ้งเตือน (ใช้ทุกเครื่อง)</h3>
          <p className="mt-0.5 text-sm text-slate-600">เสียงที่ดังบนหน้าเว็บเมื่อมีแจ้งเตือน ทั้งหน้าประชาชนและหน้าเจ้าหน้าที่ แตะเพื่อเลือกและลองฟัง บันทึกทันที</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {saving ? "กำลังบันทึก…" : meta.updated_at ? `เปลี่ยนล่าสุด ${formatDateTime(meta.updated_at)}${meta.updated_by_name ? ` โดย ${meta.updated_by_name}` : ""}` : "ยังใช้ค่าเริ่มต้น"}
          </p>
        </div>
        <button type="button" disabled={saving} onClick={() => save({ ...DEFAULT_SOUND_PREFS }, "คืนค่าเสียงเริ่มต้นแล้ว")} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />คืนค่าเริ่มต้น
        </button>
      </div>

      <div className="mt-5 space-y-5">
        {Object.entries(SOUND_LEVELS).map(([level, info]) => (
          <fieldset key={level}>
            <legend className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
              <span className={`h-2.5 w-2.5 rounded-full ${LEVEL_DOT[level]}`} aria-hidden="true" />{info.label}
            </legend>
            <p className="ml-[1.1rem] text-xs text-slate-500">{info.detail}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" role="radiogroup" aria-label={`เสียงสำหรับ${info.label}`}>
              {Object.entries(SOUND_STYLES).map(([style, item]) => {
                const on = prefs[level] === style;
                return (
                  <button key={style} type="button" role="radio" aria-checked={on} disabled={saving} onClick={() => choose(level, style)}
                    className={`flex min-h-14 flex-col items-start justify-center rounded-xl px-3 py-2 text-left ring-1 transition disabled:cursor-wait ${on ? "bg-[#0b4c86] text-white ring-[#0b4c86]" : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300"}`}>
                    <span className="flex items-center gap-1.5 text-sm font-bold">
                      {style !== "none" ? <Play className={`h-3.5 w-3.5 ${on ? "fill-current" : ""}`} aria-hidden="true" /> : null}{item.label}
                    </span>
                    <span className={`mt-0.5 text-[11px] leading-4 ${on ? "text-blue-100" : "text-slate-500"}`}>{item.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div>
          <label htmlFor="alert-volume" className="text-[15px] font-bold text-slate-900">ความดัง</label>
          <div className="mt-1 flex max-w-xl items-center gap-3">
            <Volume1 className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            <input id="alert-volume" type="range" min="0.1" max="1" step="0.1" value={prefs.volume} onChange={(event) => changeVolume(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-[#0b4c86]" aria-valuetext={`${Math.round(prefs.volume * 100)}%`} />
            <span className="w-11 shrink-0 text-right text-sm tabular-nums text-slate-600">{Math.round(prefs.volume * 100)}%</span>
          </div>
        </div>

        <div className="flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
          <div className="flex items-start gap-2">
            <Speech className="mt-0.5 h-5 w-5 shrink-0 text-[#0b4c86]" aria-hidden="true" />
            <div>
              <p className="text-[15px] font-bold text-slate-900">เสียงพูดอ่านแจ้งเตือน (ภาษาไทย)</p>
              <p className="text-xs text-slate-500">พูดต่อจากเสียงสัญญาณ เครื่องที่ไม่มีเสียงภาษาไทยจะข้ามไป{speechSupported() ? (thai ? ` · เครื่องนี้: ${thai.name}` : " · เครื่องนี้ไม่มีเสียงภาษาไทย") : ""}</p>
            </div>
          </div>
          <button type="button" role="switch" aria-checked={prefs.voice} disabled={saving} onClick={toggleVoice}
            className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60 ${prefs.voice ? "bg-[#0b4c86]" : "bg-slate-300"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${prefs.voice ? "left-6" : "left-1"}`} />
            <span className="sr-only">เสียงพูด {prefs.voice ? "เปิด" : "ปิด"}</span>
          </button>
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        เครื่องอื่นจะได้เสียงใหม่เมื่อเปิดหรือรีเฟรชหน้าเว็บ · เจ้าหน้าที่ยังกดปิดเสียงบนเครื่องตัวเองได้จากไอคอนลำโพงใน popup
        · ตอนปิดเว็บหรือล็อกจอ แจ้งเตือนใช้เสียงของมือถือ (ตั้งที่เครื่องเอง ระบบเลือกให้ไม่ได้)
      </p>
    </section>
  );
}
