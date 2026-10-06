// คิวบันทึกตอนไม่มีอินเทอร์เน็ต (ฝั่งเบราว์เซอร์)
// ใช้กับแบบฟอร์มภาคสนามที่สำคัญ: ถ้าส่งไม่ได้เพราะเครือข่าย → เก็บไว้ในเครื่อง แล้วส่งให้เองเมื่อกลับมาออนไลน์
// เก็บใน localStorage ของเครื่องนั้น (ไม่ข้ามเครื่อง) — ข้อผิดพลาดจากเซิร์ฟเวอร์ (เช่น ข้อมูลไม่ถูกต้อง) ไม่เข้าคิว

const KEY = "stn-eoc:offline-queue:v1";
const EVENT = "stn:offline-queue";

function read() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // พื้นที่เต็มหรือถูกปิดการใช้งาน — ไม่มีอะไรทำได้มากกว่านี้
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: items }));
}

export function getQueue() {
  return typeof window === "undefined" ? [] : read();
}

export function onQueueChange(listener) {
  const handler = () => listener(read());
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => { window.removeEventListener(EVENT, handler); window.removeEventListener("storage", handler); };
}

export function removeFromQueue(id) {
  write(read().filter((item) => item.id !== id));
}

export function isNetworkError(error) {
  return error instanceof TypeError || error?.name === "TypeError" || error?.offline === true;
}

async function send(item) {
  const response = await fetch(item.url, {
    method: item.method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item.body)
  });
  let json = null;
  try { json = await response.json(); } catch { json = null; }
  if (!response.ok || json?.success === false) {
    const error = new Error(json?.message || `ส่งไม่สำเร็จ (รหัส ${response.status})`);
    error.status = response.status;
    throw error;
  }
  return json || {};
}

/**
 * ส่งข้อมูล ถ้าเครือข่ายใช้ไม่ได้จะเข้าคิว
 * คืนค่า { queued: true } เมื่อเก็บไว้ส่งทีหลัง หรือผลจากเซิร์ฟเวอร์เมื่อส่งสำเร็จ
 */
export async function sendOrQueue(url, { method = "POST", body, label }) {
  const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, url, method, body, label: label || "ข้อมูล", createdAt: new Date().toISOString(), attempts: 0, lastError: null };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    write([...read(), item]);
    return { queued: true, message: `ไม่มีอินเทอร์เน็ต — เก็บ "${item.label}" ไว้ในเครื่อง จะส่งให้อัตโนมัติเมื่อออนไลน์` };
  }
  try {
    return await send(item);
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    write([...read(), item]);
    return { queued: true, message: `เชื่อมต่อไม่ได้ — เก็บ "${item.label}" ไว้ในเครื่อง จะส่งให้อัตโนมัติเมื่อออนไลน์` };
  }
}

/** ส่งทุกรายการในคิวตามลำดับ (หยุดเมื่อเครือข่ายยังใช้ไม่ได้) */
export async function flushQueue() {
  const items = read();
  let sent = 0;
  const remaining = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    try {
      await send(item);
      sent += 1;
    } catch (error) {
      if (isNetworkError(error)) { remaining.push(...items.slice(index)); break; }
      remaining.push({ ...item, attempts: item.attempts + 1, lastError: error.message });
    }
  }
  write(remaining);
  return { sent, remaining: remaining.length, failed: remaining.filter((item) => item.lastError).length };
}
