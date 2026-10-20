// ชวนรับแจ้งเตือนภัยตอนเข้าหน้าแรก: ถามเฉพาะเครื่องที่ยังไม่ได้รับ และไม่ถามถี่ (ไม่มีการเรียกเครือข่าย ทดสอบได้)
export const PROMPT_KEY = "stn-push-prompt";
export const SNOOZE_DAYS = { later: 3, never: 60 };

export function readPromptState(storage) {
  try {
    const value = JSON.parse(storage?.getItem(PROMPT_KEY) || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

export function snooze(storage, reason = "later", now = Date.now()) {
  const days = SNOOZE_DAYS[reason] || SNOOZE_DAYS.later;
  try {
    storage?.setItem(PROMPT_KEY, JSON.stringify({ until: now + days * 86400000, reason }));
  } catch { /* โหมดส่วนตัว: ถามใหม่ครั้งหน้า */ }
}

/**
 * ควรเด้งชวนไหม และให้แสดงขั้นตอนแบบไหน
 * env = { ios, standalone, inApp, android }, status = ผลจาก pushStatus()
 * คืน null = ไม่ต้องชวน, หรือ "subscribe" | "ios-install" | "open-browser"
 */
export function promptMode({ status, env = {}, state = null, now = Date.now() }) {
  if (state?.until && now < state.until) return null;
  if (env.inApp) return "open-browser";
  if (env.ios && !env.standalone) return "ios-install";
  if (!status?.supported || !status.enabled) return null;
  if (status.subscribed || status.permission === "denied") return null;
  return "subscribe";
}
