// อ่านข้อความแจ้งเตือนเป็นเสียงพูดภาษาไทย (Web Speech API ของเบราว์เซอร์ ไม่ต้องใช้บริการภายนอก)
// ใช้ต่อจากเสียงสัญญาณเดิม: สัญญาณดังก่อน แล้วพูดหัวข้อ เช่น "แจ้งเตือนระดับน้ำ น้ำล้นตลิ่ง สถานี..."
// เครื่องที่ไม่มีเสียงภาษาไทยในระบบจะไม่พูด (เหลือเสียงสัญญาณอย่างเดียว) เพื่อไม่ให้อ่านผิดภาษา

export const VOICE_KEY = "stn-alert-voice";
const MAX_CHARS = 220;

export function speechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
}

export function voiceEnabled() {
  try { return window.localStorage.getItem(VOICE_KEY) !== "off"; } catch { return true; }
}

export function setVoiceEnabled(on) {
  try { window.localStorage.setItem(VOICE_KEY, on ? "on" : "off"); } catch { /* โหมดส่วนตัว */ }
}

export function thaiVoice() {
  if (!speechSupported()) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const thai = voices.filter((voice) => String(voice.lang || "").toLowerCase().replace("_", "-").startsWith("th"));
  return thai.find((voice) => voice.localService) || thai[0] || null;
}

// รายชื่อเสียงของเบราว์เซอร์โหลดแบบไม่พร้อมกัน — รอได้ไม่เกิน 1.5 วินาที
export function waitForVoices(timeoutMs = 1500) {
  if (!speechSupported()) return Promise.resolve(null);
  if (window.speechSynthesis.getVoices().length) return Promise.resolve(thaiVoice());
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", done);
      resolve(thaiVoice());
    };
    window.speechSynthesis.addEventListener?.("voiceschanged", done);
    setTimeout(done, timeoutMs);
  });
}

/** ทำข้อความให้พูดได้เป็นธรรมชาติ: ตัดอีโมจิ/สัญลักษณ์ ขยายคำย่อ หน่วย และเวลา */
export function speechText(text) {
  return String(text || "")
    .replace(/\[ทดสอบ\]/g, "ทดสอบ ")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, " ")
    .replace(/(\d+(?:\.\d+)?)\s*มม\./g, "$1 มิลลิเมตร")
    .replace(/(\d+(?:\.\d+)?)\s*ซม\./g, "$1 เซนติเมตร")
    .replace(/(\d+(?:\.\d+)?)\s*ม\.(?!\S)/g, "$1 เมตร")
    .replace(/(\d{1,2})[.:](\d{2})\s*น\./g, "$1 นาฬิกา $2 นาที")
    .replace(/(^|\s|\()อ\.\s*/g, "$1อำเภอ")
    .replace(/(^|\s|\()ต\.\s*/g, "$1ตำบล")
    .replace(/รพ\.สต\./g, "โรงพยาบาลส่งเสริมสุขภาพตำบล")
    .replace(/รพ\./g, "โรงพยาบาล")
    .replace(/ชม\./g, "ชั่วโมง")
    .replace(/#(\d+)/g, "หมายเลข $1")
    .replace(/\s*[—–|•·]\s*/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CHARS);
}

/** ข้อความพูดของแจ้งเตือนระดับน้ำ/ฝน: หัวข้อ + เรื่อง + บรรทัดตัวเลขสำคัญ */
export function waterAlertSpeech(alerts = []) {
  const list = Array.isArray(alerts) ? alerts : [alerts];
  if (!list.length) return "";
  const first = list[0];
  const topic = first.kind === "rain" ? "แจ้งเตือนปริมาณฝนตก" : first.level === "info" ? "แจ้งระดับน้ำ" : "แจ้งเตือนระดับน้ำ";
  const lines = String(first.message || "").split("\n").map((line) => line.trim()).filter(Boolean);
  const usable = lines.filter((line) => !/ทดสอบ|ไม่มีการส่ง/.test(line));
  const place = usable[0] && !/\d/.test(usable[0]) ? usable[0] : "";
  // บรรทัดตัวเลขแรก เช่น "สูงกว่าตลิ่ง 0.30 ม." หรือ "ฝน 24 ชม. 95.0 มม." (ตัดข้อความในวงเล็บที่ซ้ำกับหัวข้อ)
  const detail = (usable.find((line) => /\d/.test(line)) || "").replace(/\([^)]*\)/g, "");
  const more = list.length > 1 ? ` และอีก ${list.length - 1} เรื่อง` : "";
  return speechText(`${topic} ${first.title || ""} ${place} ${detail}${more}`);
}

/** ข้อความพูดของคำขอความช่วยเหลือ */
export function helpRequestSpeech(items = []) {
  if (!items.length) return "";
  const fresh = items.filter((item) => item.kind === "new");
  if (fresh.length) {
    const first = fresh[0];
    return speechText(`แจ้งเตือนคำขอความช่วยเหลือใหม่ ${fresh.length > 1 ? `${fresh.length} เรื่อง ` : ""}${first.place ? `ที่ ${first.place}` : ""}`);
  }
  const first = items[0];
  return speechText(`คำขอความช่วยเหลือ #${first.id} ยังไม่มีผู้รับเรื่อง รอมาแล้ว ${Math.round(Number(first.waited_min) || 0)} นาที`);
}

// สัญญาณแต่ละระดับยาวไม่เท่ากัน — เริ่มพูดหลังสัญญาณจบ
export const SPEAK_DELAY_MS = { critical: 2900, serious: 750, info: 600 };

/**
 * พูดข้อความ (ยกเลิกข้อความที่ค้างอยู่ก่อน) — คืน true ถ้าส่งให้เบราว์เซอร์พูดได้
 * ไม่พูดถ้าปิดเสียงพูดไว้ หรือเครื่องไม่มีเสียงภาษาไทย
 */
export async function speak(text, { delayMs = 0, force = false } = {}) {
  if (!text || !speechSupported() || (!force && !voiceEnabled())) return false;
  const voice = await waitForVoices();
  if (!voice) return false;
  if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
  try {
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang || "th-TH";
    utterance.rate = 0.95;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}
