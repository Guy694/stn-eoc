// อ่านออกเสียงข้อความยาว (เช่น ผลประเมิน "บ้านฉันเสี่ยงไหม") ด้วยเสียงภาษาไทยของเครื่อง
// แบ่งเป็นประโยคสั้น ๆ ต่อคิว (บางเบราว์เซอร์ตัดเสียงเมื่อข้อความยาวเกิน ~200 ตัวอักษร)
import { speechSupported, speechText, waitForVoices } from "@/lib/alertSpeech";

const CHUNK = 180;
let primed = false;

/** แบ่งข้อความเป็นช่วงสั้น ๆ ตามประโยค/เว้นวรรค */
export function speechChunks(text, size = CHUNK) {
  const clean = speechText(text, { max: 4000 });
  const parts = clean.split(/(?<=[.!?。])\s+|\s{2,}|\n+/).map((part) => part.trim()).filter(Boolean);
  const out = [];
  for (const part of parts.length ? parts : [clean]) {
    let rest = part;
    while (rest.length > size) {
      const cut = rest.lastIndexOf(" ", size);
      const at = cut > size * 0.5 ? cut : size;
      out.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

/**
 * iOS/Safari อนุญาตให้พูดเฉพาะหลังผู้ใช้แตะจอ — เรียกตอนผู้ใช้กดปุ่ม (ก่อนรอข้อมูล)
 * เพื่อให้พูดผลได้เองเมื่อประเมินเสร็จ
 */
export function primeSpeech() {
  if (primed || !speechSupported()) return;
  try {
    const silent = new window.SpeechSynthesisUtterance(" ");
    silent.volume = 0;
    window.speechSynthesis.speak(silent);
    primed = true;
  } catch { /* ไม่รองรับ */ }
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}

/** มีเสียงภาษาไทยในเครื่องไหม (null = ยังไม่รู้/ไม่รองรับ) */
export async function hasThaiVoice() {
  if (!speechSupported()) return false;
  return Boolean(await waitForVoices());
}

/**
 * อ่านข้อความยาวออกเสียง · คืน false ถ้าเครื่องไม่มีเสียงภาษาไทย
 * onStart/onEnd ใช้เปลี่ยนสถานะปุ่ม "หยุดอ่าน"
 */
export async function readAloud(text, { onStart, onEnd, rate = 0.95 } = {}) {
  if (!text || !speechSupported()) return false;
  const voice = await waitForVoices();
  if (!voice) return false;
  const chunks = speechChunks(text);
  if (!chunks.length) return false;
  window.speechSynthesis.cancel();
  chunks.forEach((chunk, index) => {
    const utterance = new window.SpeechSynthesisUtterance(chunk);
    utterance.voice = voice;
    utterance.lang = voice.lang || "th-TH";
    utterance.rate = rate;
    if (index === 0 && onStart) utterance.onstart = onStart;
    if (index === chunks.length - 1 && onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }
    window.speechSynthesis.speak(utterance);
  });
  return true;
}
