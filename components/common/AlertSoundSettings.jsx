"use client";

// ตั้งค่าเสียงแจ้งเตือนบนเครื่องนี้: แบบเสียงต่อระดับ ความดัง และเสียงพูดภาษาไทย (จำไว้ในเบราว์เซอร์)
// ใช้ได้ทั้งหน้าประชาชน (tone="public") และหน้าเจ้าหน้าที่ (tone="admin")
import { useEffect, useState } from "react";
import { Play, Speech, Volume1, Volume2 } from "lucide-react";
import {
  DEFAULT_SOUND_PREFS, SOUND_LEVELS, SOUND_PREFS_EVENT, SOUND_STYLES,
  getAlertAudioContext, playStyle, readSoundPrefs, saveSoundPrefs, unlockAlertAudio
} from "@/lib/alertSound";
import { setVoiceEnabled, speak, speechSupported, thaiVoice, voiceEnabled, waitForVoices } from "@/lib/alertSpeech";

const LEVEL_DOT = { critical: "bg-red-600", serious: "bg-amber-500", info: "bg-[#2a9db0]" };

export default function AlertSoundSettings({ className = "", tone = "public", showDeviceNote = true }) {
  const [prefs, setPrefs] = useState(DEFAULT_SOUND_PREFS);
  const [voiceOn, setVoiceOn] = useState(true);
  const [thai, setThai] = useState(null);

  useEffect(() => {
    setPrefs(readSoundPrefs());
    setVoiceOn(voiceEnabled());
    waitForVoices().then((voice) => setThai(voice || thaiVoice())).catch(() => {});
    const sync = (event) => setPrefs(event.detail || readSoundPrefs());
    window.addEventListener(SOUND_PREFS_EVENT, sync);
    return () => window.removeEventListener(SOUND_PREFS_EVENT, sync);
  }, []);

  const preview = async (style, volume = prefs.volume) => {
    await unlockAlertAudio().catch(() => false);
    playStyle(getAlertAudioContext(), style, { volume });
  };
  const choose = (level, style) => {
    setPrefs(saveSoundPrefs({ ...prefs, [level]: style }));
    preview(style);
  };
  const setVolume = (volume) => setPrefs(saveSoundPrefs({ ...prefs, volume }));
  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    setVoiceEnabled(next);
    if (next) speak("เปิดเสียงพูดแจ้งเตือนแล้ว", { force: true });
    else if (speechSupported()) window.speechSynthesis.cancel();
  };
  const reset = () => setPrefs(saveSoundPrefs(DEFAULT_SOUND_PREFS));

  const admin = tone === "admin";
  const heading = admin ? "font-black text-slate-900" : "font-[family-name:var(--font-kanit)] text-lg font-semibold text-[#0c2f4a]";

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 ${className}`} aria-labelledby="alert-sound-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="alert-sound-title" className={`flex items-center gap-2 ${heading}`}><Volume2 className="h-5 w-5 text-[#0b4c86]" aria-hidden="true" />เสียงแจ้งเตือนบนเครื่องนี้</h3>
          <p className="mt-0.5 text-sm text-slate-600">ใช้ตอนเปิดหน้าเว็บอยู่ แตะแบบเสียงเพื่อเลือกและลองฟัง</p>
        </div>
        <button type="button" onClick={reset} className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800">คืนค่าเริ่มต้น</button>
      </div>

      <div className="mt-4 space-y-4">
        {Object.entries(SOUND_LEVELS).map(([level, meta]) => (
          <fieldset key={level}>
            <legend className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <span className={`h-2.5 w-2.5 rounded-full ${LEVEL_DOT[level]}`} aria-hidden="true" />{meta.label}
            </legend>
            <p className="ml-[1.1rem] text-xs text-slate-500">{meta.detail}</p>
            <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`เสียงสำหรับ${meta.label}`}>
              {Object.entries(SOUND_STYLES).map(([style, item]) => {
                const on = prefs[level] === style;
                return (
                  <button key={style} type="button" role="radio" aria-checked={on} title={item.detail} onClick={() => choose(level, style)}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition ${on ? "bg-[#0b4c86] text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                    {on && style !== "none" ? <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> : null}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div>
          <label htmlFor="alert-volume" className="text-[15px] font-semibold text-slate-900">ความดัง</label>
          <div className="mt-1 flex items-center gap-3">
            <Volume1 className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            <input id="alert-volume" type="range" min="0.1" max="1" step="0.1" value={prefs.volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              onPointerUp={() => preview(prefs.critical === "none" ? "beep" : prefs.critical)}
              onKeyUp={() => preview(prefs.critical === "none" ? "beep" : prefs.critical)}
              className="h-2 w-full cursor-pointer accent-[#0b4c86]" aria-valuetext={`${Math.round(prefs.volume * 100)}%`} />
            <span className="w-11 shrink-0 text-right text-sm tabular-nums text-slate-600">{Math.round(prefs.volume * 100)}%</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
          <div className="flex items-start gap-2">
            <Speech className="mt-0.5 h-5 w-5 shrink-0 text-[#0b4c86]" aria-hidden="true" />
            <div>
              <p className="text-[15px] font-semibold text-slate-900">เสียงพูดอ่านแจ้งเตือน</p>
              <p className="text-xs text-slate-500">{!speechSupported() ? "เบราว์เซอร์นี้ไม่รองรับ" : thai ? `ภาษาไทย (${thai.name})` : "เครื่องนี้ไม่มีเสียงภาษาไทย จะไม่พูด"}</p>
            </div>
          </div>
          <button type="button" role="switch" aria-checked={voiceOn} disabled={!speechSupported()} onClick={toggleVoice}
            className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${voiceOn ? "bg-[#0b4c86]" : "bg-slate-300"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${voiceOn ? "left-6" : "left-1"}`} />
            <span className="sr-only">เสียงพูด {voiceOn ? "เปิด" : "ปิด"}</span>
          </button>
        </div>
      </div>

      {showDeviceNote ? (
        <p className="mt-4 text-xs leading-5 text-slate-500">
          ตอนปิดเว็บหรือล็อกจอ แจ้งเตือนใช้เสียงของมือถือ เปลี่ยนได้ที่ — Android: การตั้งค่า › แอป › Chrome › การแจ้งเตือน › เลือกหัวข้อของเว็บนี้ › เสียง · iPhone: การตั้งค่า › การแจ้งเตือน › สตูล EOC › เสียง
        </p>
      ) : null}
    </section>
  );
}
