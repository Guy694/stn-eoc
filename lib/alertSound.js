// เสียงแจ้งเตือนบนหน้าเว็บ (ใช้ร่วมกัน: เตือนระดับน้ำ/ฝน คำขอความช่วยเหลือ และแจ้งเตือนภัยประชาชน)
// เสียงสังเคราะห์ (ไม่ต้องโหลดไฟล์เสียง) แอดมินเลือกแบบเสียงต่อระดับ ความดัง และเสียงพูด ใช้ทั้งระบบ
// หมายเหตุ: ตอนปิดเว็บ แจ้งเตือนของมือถือใช้เสียงของเครื่องเสมอ (เว็บเลือกเองไม่ได้)
export const SOUND_STYLES = {
  siren: { label: "ไซเรน", detail: "สองเสียงสลับ ดังชัด" },
  emergency: { label: "เตือนภัยฉุกเฉิน", detail: "โทนคู่ต่อเนื่อง แบบสัญญาณเตือนภัย" },
  bell: { label: "ระฆัง", detail: "นุ่มกว่า เหมาะกับห้องประชุม/โรงพยาบาล" },
  beep: { label: "บี๊บสั้น", detail: "เบา ไม่รบกวน" },
  chime: { label: "กริ๊ง", detail: "เสียงแจ้งเบา ๆ" },
  none: { label: "ไม่มีเสียงสัญญาณ", detail: "เหลือเสียงพูดอย่างเดียว (ถ้าเปิดไว้)" }
};
export const SOUND_LEVELS = {
  critical: { label: "เตือนภัย / วิกฤต", detail: "น้ำล้นตลิ่ง ฝนหนักมาก อพยพ คำขอความช่วยเหลือเร่งด่วน" },
  serious: { label: "เฝ้าระวัง", detail: "น้ำใกล้ตลิ่ง ฝนหนัก คำขอความช่วยเหลือใหม่" },
  info: { label: "ข่าวทั่วไป / คลี่คลาย", detail: "ข่าวจากศูนย์ฯ น้ำลดแล้ว" }
};
export const DEFAULT_SOUND_PREFS = { critical: "siren", serious: "beep", info: "chime", volume: 1, voice: true };
export const SOUND_SETTINGS_KEY = "alert_sounds"; // system_settings.setting_key
export const SOUND_PREFS_EVENT = "stn-alert-sound-prefs";
const SOUND_API = "/stn-eoc/api/public/alert-sounds";

export function normalizeSoundPrefs(value) {
  const v = value && typeof value === "object" ? value : {};
  const pick = (level) => (SOUND_STYLES[v[level]] ? v[level] : DEFAULT_SOUND_PREFS[level]);
  const volume = Number(v.volume);
  return {
    critical: pick("critical"), serious: pick("serious"), info: pick("info"),
    volume: Number.isFinite(volume) ? Math.min(1, Math.max(0.1, Math.round(volume * 10) / 10)) : 1,
    voice: v.voice !== false
  };
}

// แอดมินตั้งค่าเสียงเดียวใช้ทั้งระบบ (ตั้งค่าระบบ › เสียงแจ้งเตือน) — หน้าเว็บโหลดครั้งเดียวต่อการเปิดหน้า แล้วเก็บไว้ในหน่วยความจำ
let systemPrefs = null;
let loading = null;

export function readSoundPrefs() {
  return systemPrefs || { ...DEFAULT_SOUND_PREFS };
}

/** ใช้ค่าใหม่ทันที (หลังแอดมินบันทึก หรือโหลดจากเซิร์ฟเวอร์) */
export function setSystemSoundPrefs(value) {
  systemPrefs = normalizeSoundPrefs(value);
  try { window.dispatchEvent(new CustomEvent(SOUND_PREFS_EVENT, { detail: systemPrefs })); } catch { /* ไม่มี window */ }
  return systemPrefs;
}

export function loadSystemSoundPrefs({ fresh = false, fetchImpl } = {}) {
  if (typeof window === "undefined") return Promise.resolve(readSoundPrefs());
  if (loading && !fresh) return loading;
  const doFetch = fetchImpl || window.fetch?.bind(window);
  if (!doFetch) return Promise.resolve(readSoundPrefs());
  loading = doFetch(SOUND_API, { cache: "no-store" })
    .then((response) => response.json())
    .then((json) => (json?.success ? setSystemSoundPrefs(json.data) : readSoundPrefs()))
    .catch(() => readSoundPrefs());
  return loading;
}

/** เล่นเสียงแบบที่ระบุ (ใช้ทั้งตอนเตือนจริงและปุ่ม "ลองฟัง") */
export function playStyle(ctx, style, { volume = 1 } = {}) {
  if (!ctx || style === "none" || !SOUND_STYLES[style]) return;
  const now = ctx.currentTime + 0.02;
  const tone = (freq, start, duration, gain = 0.22, type = "square", { decay = false, hold = false } = {}) => {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + start);
    const peak = Math.max(0.0002, gain * volume);
    amp.gain.setValueAtTime(0.0001, now + start);
    amp.gain.exponentialRampToValueAtTime(peak, now + start + (decay ? 0.008 : 0.02));
    if (hold) amp.gain.setValueAtTime(peak, now + start + Math.max(0.03, duration - 0.06));
    amp.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + duration + 0.05);
  };
  if (style === "siren") {
    for (let i = 0; i < 3; i += 1) {
      tone(960, i * 0.9, 0.4);
      tone(720, i * 0.9 + 0.42, 0.4);
    }
  } else if (style === "emergency") {
    // โทนคู่ 853 + 960 Hz (สัญญาณเตือนภัยสากล) ดัง 3 ช่วง
    for (let i = 0; i < 3; i += 1) {
      tone(853, i * 0.75, 0.6, 0.16, "sine", { hold: true });
      tone(960, i * 0.75, 0.6, 0.16, "sine", { hold: true });
    }
  } else if (style === "bell") {
    for (const start of [0, 0.75]) {
      tone(880, start, 1.3, 0.22, "sine", { decay: true });
      tone(1760, start, 0.8, 0.07, "sine", { decay: true });
      tone(2640, start, 0.4, 0.03, "sine", { decay: true });
    }
  } else if (style === "beep") {
    tone(880, 0, 0.22, 0.2, "triangle");
    tone(880, 0.32, 0.22, 0.2, "triangle");
  } else if (style === "chime") {
    tone(660, 0, 0.18, 0.12, "sine");
    tone(990, 0.16, 0.3, 0.12, "sine");
  }
}

/** เสียงตามระดับ (critical/serious/info) ตามที่แอดมินตั้งไว้ */
export function playPattern(ctx, level, prefs = readSoundPrefs()) {
  const key = SOUND_LEVELS[level] ? level : "info";
  playStyle(ctx, prefs[key], { volume: prefs.volume });
}

// ---------------------------------------------------------------------------
// มือถือ (iOS Safari/แอปบนหน้าจอโฮม, Chrome Android) เล่นเสียงจากหน้าเว็บได้ก็ต่อเมื่อผู้ใช้เคยแตะหน้าจอแล้ว
// เดิมแต่ละหน้าสร้าง AudioContext เองตอนมีเตือน (ไม่มีการแตะ) → ถูกระงับไว้ ไม่มีเสียง
// จึงใช้ AudioContext ร่วมกันหนึ่งตัว และ "ปลดล็อก" ตั้งแต่การแตะครั้งแรกในหน้า
let sharedContext = null;
const UNLOCK_EVENTS = ["pointerdown", "touchend", "keydown", "click"];

export function getAlertAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedContext || sharedContext.state === "closed") sharedContext = new AudioCtx();
  return sharedContext;
}

export function alertAudioReady() {
  return sharedContext?.state === "running";
}

/** เรียกจากเหตุการณ์ที่ผู้ใช้แตะ/กด: ปลุก AudioContext + เล่นเสียงเงียบ 1 sample (iOS) + ปลุกเสียงพูด */
export function unlockAlertAudio() {
  const ctx = getAlertAudioContext();
  if (!ctx) return Promise.resolve(false);
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch { /* เครื่องเก่า */ }
  try {
    if (window.speechSynthesis && !window.speechSynthesis.speaking) {
      const utterance = new window.SpeechSynthesisUtterance(" ");
      utterance.volume = 0;
      window.speechSynthesis.speak(utterance);
    }
  } catch { /* ไม่มีเสียงพูด */ }
  return (ctx.state === "suspended" ? ctx.resume() : Promise.resolve()).then(() => ctx.state === "running").catch(() => false);
}

/** ติดตั้งครั้งเดียวต่อหน้า: แตะครั้งแรกที่ไหนก็ได้ = เปิดเสียงเตือน */
export function installAlertAudioUnlock() {
  if (typeof window === "undefined") return;
  loadSystemSoundPrefs();
  if (window.__stnAlertAudioUnlock) return;
  window.__stnAlertAudioUnlock = true;
  const handler = () => {
    unlockAlertAudio().then((ok) => {
      if (!ok) return;
      UNLOCK_EVENTS.forEach((name) => window.removeEventListener(name, handler, true));
      window.__stnAlertAudioUnlock = false;
      window.dispatchEvent(new Event("stn-alert-audio-ready"));
    });
  };
  UNLOCK_EVENTS.forEach((name) => window.addEventListener(name, handler, { capture: true, passive: true }));
}

/** เล่นสัญญาณเตือน — คืน false ถ้าเครื่องยังไม่อนุญาตให้เล่นเสียง (ยังไม่เคยแตะหน้าจอ) */
export async function playAlert(level) {
  const ctx = getAlertAudioContext();
  if (!ctx) return false;
  if (ctx.state !== "running") {
    try { await ctx.resume(); } catch { return false; }
    if (ctx.state !== "running") return false;
  }
  playPattern(ctx, level);
  return true;
}

/**
 * แจ้งเตือนของระบบ (เสียง/สั่นตามการตั้งค่าเครื่อง) ผ่าน service worker
 * Chrome Android และแอปบนหน้าจอโฮมของ iPhone ไม่รองรับ new Notification() จากหน้าเว็บ
 */
export async function showSystemAlert(title, options = {}) {
  if (typeof window === "undefined" || typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  const merged = { lang: "th", icon: "/stn-eoc/pwa/icon-192.png", badge: "/stn-eoc/pwa/badge-96.png", vibrate: [300, 150, 300, 150, 600], ...options };
  try {
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration("/stn-eoc/") : null;
    if (registration?.showNotification) {
      await registration.showNotification(title, merged);
      return true;
    }
  } catch { /* ใช้วิธีเดิมด้านล่าง */ }
  try {
    new Notification(title, merged);
    return true;
  } catch {
    return false;
  }
}
