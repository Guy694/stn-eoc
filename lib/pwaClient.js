// ตัวช่วยฝั่งหน้าเว็บ: service worker, ติดตั้งแอป, สมัคร/ยกเลิกแจ้งเตือนภัย (Web Push)
const BASE = "/stn-eoc/";
const PUSH_API = `${BASE}api/public/push/`;
let installPrompt = null;

export const isBrowser = () => typeof window !== "undefined";
export const isStandalone = () => isBrowser() && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
export const isIos = () => isBrowser() && /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
export const pushSupported = () => isBrowser() && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export function registerServiceWorker({ dev = false } = {}) {
  if (!isBrowser() || !("serviceWorker" in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register(`${BASE}sw.js${dev ? "?dev=1" : ""}`, { scope: BASE }).catch(() => null);
}

async function registration() {
  if (!("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration(BASE);
  if (existing) return existing;
  await registerServiceWorker({ dev: process.env.NODE_ENV !== "production" });
  return Promise.race([navigator.serviceWorker.ready, new Promise((resolve) => setTimeout(() => resolve(null), 8000))]);
}

// ---- ติดตั้งแอป (Android/Chrome) ----
export function captureInstallPrompt() {
  if (!isBrowser()) return () => {};
  const onPrompt = (event) => {
    event.preventDefault();
    installPrompt = event;
    window.dispatchEvent(new Event("stn-install-available"));
  };
  const onInstalled = () => {
    installPrompt = null;
    window.dispatchEvent(new Event("stn-install-available"));
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}
export const canPromptInstall = () => Boolean(installPrompt);
export async function promptInstall() {
  if (!installPrompt) return false;
  const event = installPrompt;
  installPrompt = null;
  await event.prompt();
  const choice = await event.userChoice.catch(() => null);
  window.dispatchEvent(new Event("stn-install-available"));
  return choice?.outcome === "accepted";
}

// ---- แจ้งเตือนภัย ----
function keyBytes(base64url) {
  const padded = `${base64url}${"=".repeat((4 - (base64url.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const sameKey = (buffer, bytes) => {
  if (!buffer) return false;
  const a = new Uint8Array(buffer);
  return a.length === bytes.length && a.every((v, i) => v === bytes[i]);
};

async function sendJson(method, body) {
  const response = await fetch(PUSH_API, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) throw new Error(json.message || `ไม่สำเร็จ (รหัส ${response.status})`);
  return json;
}

/** สถานะปัจจุบันของเครื่องนี้ → { supported, enabled, permission, subscribed, areas } */
export async function pushStatus() {
  if (!pushSupported()) return { supported: false };
  const reg = await registration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  const query = sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : "";
  const json = await fetch(`${PUSH_API}${query}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
  return {
    supported: true,
    enabled: Boolean(json.enabled),
    permission: Notification.permission,
    subscribed: Boolean(sub && json.subscription),
    areas: json.subscription || null,
    endpoint: sub?.endpoint || null
  };
}

/** สมัคร/เปลี่ยนพื้นที่: areas = { scope: 'all' } หรือ { scope: 'areas', districts, tambons } */
export async function subscribePush(areas) {
  const info = await fetch(PUSH_API, { cache: "no-store" }).then((r) => r.json());
  if (!info.enabled || !info.public_key) throw new Error("ระบบแจ้งเตือนยังไม่เปิดใช้งาน");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(permission === "denied" ? "เครื่องนี้ปิดการแจ้งเตือนของเว็บไว้ — เปิดได้ที่การตั้งค่าเบราว์เซอร์" : "ยังไม่ได้อนุญาตการแจ้งเตือน");
  const reg = await registration();
  if (!reg) throw new Error("เบราว์เซอร์นี้ยังเปิดใช้งานแบบแอปไม่ได้");
  const key = keyBytes(info.public_key);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options?.applicationServerKey, key)) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await sendJson("POST", { subscription: sub.toJSON(), ...areas });
  return sub.endpoint;
}

export async function unsubscribePush() {
  const reg = await registration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  await sendJson("DELETE", { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** ขอให้ service worker ดึงข้อมูลออฟไลน์ล่าสุด (ไม่บ่อยกว่า 30 นาที) */
export async function refreshOfflinePack() {
  const reg = await navigator.serviceWorker?.getRegistration(BASE).catch(() => null);
  (reg?.active || reg?.waiting || reg?.installing)?.postMessage({ type: "refresh-pack" });
}
