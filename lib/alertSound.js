// เสียงแจ้งเตือนบนหน้าเว็บเจ้าหน้าที่ (ใช้ร่วมกัน: เตือนระดับน้ำ/ฝน และคำขอความช่วยเหลือ)
// เสียงสังเคราะห์ (ไม่ต้องโหลดไฟล์เสียง): วิกฤต = ไซเรนสองเสียง 3 รอบ, เฝ้าระวัง = บี๊บ 2 ครั้ง, คลี่คลาย = เสียงกริ๊งเบา ๆ
export function playPattern(ctx, level) {
  const now = ctx.currentTime + 0.02;
  const tone = (freq, start, duration, gain = 0.22, type = "square") => {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + start);
    amp.gain.setValueAtTime(0.0001, now + start);
    amp.gain.exponentialRampToValueAtTime(gain, now + start + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + duration + 0.05);
  };
  if (level === "critical") {
    for (let i = 0; i < 3; i += 1) {
      tone(960, i * 0.9, 0.4);
      tone(720, i * 0.9 + 0.42, 0.4);
    }
  } else if (level === "serious") {
    tone(880, 0, 0.22, 0.2, "triangle");
    tone(880, 0.32, 0.22, 0.2, "triangle");
  } else {
    tone(660, 0, 0.18, 0.12, "sine");
    tone(990, 0.16, 0.3, 0.12, "sine");
  }
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
  if (typeof window === "undefined" || window.__stnAlertAudioUnlock) return;
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
