/* Service worker ของ Satun Geo-EOC (ขอบเขต /stn-eoc/)
 * 1) ใช้งานตอนไม่มีอินเทอร์เน็ต: เปิดหน้าใดไม่ได้ → แสดง offline.html พร้อมข้อมูลสำคัญที่เก็บไว้ล่าสุด
 *    (เบอร์ฉุกเฉิน ศูนย์พักพิง ประกาศเตือน) — ไม่เก็บหน้า/ข้อมูลของเจ้าหน้าที่ไว้ในเครื่อง
 * 2) ไฟล์ static ของ Next (/_next/static/ มีชื่อแบบ hash) เก็บไว้ใช้ซ้ำ ทำให้เปิดเร็วขึ้น
 * 3) รับแจ้งเตือนภัย (Web Push) และเปิดหน้าที่เกี่ยวข้องเมื่อกด
 */
const VERSION = "v1";
const SHELL_CACHE = `stn-shell-${VERSION}`;
const STATIC_CACHE = `stn-static-${VERSION}`;
const BASE = "/stn-eoc/";
const OFFLINE_URL = `${BASE}offline.html`;
const PACK_URL = `${BASE}api/public/offline-pack/`;
const PACK_MAX_AGE_MS = 30 * 60 * 1000;
const DEV = new URL(self.location.href).searchParams.get("dev") === "1";
const SHELL = [OFFLINE_URL, `${BASE}pwa/icon-192.png`, `${BASE}pwa/badge-96.png`];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL);
    await refreshPack(true).catch(() => {});
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, STATIC_CACHE]);
    for (const key of await caches.keys()) if (key.startsWith("stn-") && !keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function refreshPack(force = false) {
  const cache = await caches.open(SHELL_CACHE);
  if (!force) {
    const cached = await cache.match(PACK_URL);
    const at = cached ? Date.parse(cached.headers.get("x-cached-at") || "") : 0;
    if (cached && Date.now() - at < PACK_MAX_AGE_MS) return;
  }
  const response = await fetch(PACK_URL, { cache: "no-store", credentials: "omit" });
  if (!response.ok) return;
  const body = await response.blob();
  const headers = new Headers(response.headers);
  headers.set("x-cached-at", new Date().toISOString());
  await cache.put(PACK_URL, new Response(body, { status: 200, headers }));
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "refresh-pack") event.waitUntil(refreshPack(Boolean(event.data.force)).catch(() => {}));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  // เปิดหน้าเว็บ: ใช้เครือข่ายเสมอ (ข้อมูลสดเท่านั้น) — ไม่มีเน็ต → หน้าออฟไลน์
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        return (await caches.match(OFFLINE_URL)) || new Response("ออฟไลน์", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  // ชุดข้อมูลออฟไลน์: เครือข่ายก่อน ถ้าไม่ได้ใช้ของที่เก็บไว้
  if (url.pathname === PACK_URL) {
    event.respondWith((async () => {
      try {
        await refreshPack(true);
      } catch {
        // ออฟไลน์
      }
      return (await caches.match(PACK_URL)) || new Response(JSON.stringify({ success: false }), { status: 503, headers: { "Content-Type": "application/json" } });
    })());
    return;
  }

  // ไฟล์ static ที่ชื่อมี hash: เก็บไว้ใช้ซ้ำ (ตอนพัฒนาชื่อไฟล์ไม่เปลี่ยน จึงไม่เก็บ)
  if (!DEV && url.pathname.startsWith(`${BASE}_next/static/`)) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })());
  }
});

// ---------- แจ้งเตือนภัย (Web Push) ----------
// นับผู้รับ: แจ้งเตือนขึ้นบนเครื่องแล้ว (shown) / กดเปิด (opened) — ส่งเฉพาะรหัสรายการส่งกับปลายทางของเครื่องนี้ ไม่มีข้อมูลส่วนตัว
const RECEIPT_URL = `${BASE}api/public/push/receipt/`;
const receiptIds = (value) => (Array.isArray(value) ? value : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 10);

async function sendReceipt(ids, event) {
  const list = receiptIds(ids);
  if (!list.length) return;
  const sub = await self.registration.pushManager.getSubscription();
  if (!sub) return;
  await fetch(RECEIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    keepalive: true,
    body: JSON.stringify({ ids: list, event, endpoint: sub.endpoint })
  });
}

function safeUrl(value) {
  try {
    const url = new URL(value || BASE, self.location.origin);
    return url.origin === self.location.origin && url.pathname.startsWith(BASE) ? url.href : new URL(BASE, self.location.origin).href;
  } catch {
    return new URL(BASE, self.location.origin).href;
  }
}

// กดแจ้งเตือนแล้วเปิดหน้า "แจ้งเตือนที่ได้รับ" ซึ่งแสดงข้อความเต็ม (บนมือถือ/Windows ข้อความในแถบแจ้งเตือนมักถูกตัด)
// ยกเว้นงานของเจ้าหน้าที่ (หน้า /eoc, /admin, /dashboard) ให้เปิดหน้านั้นตรง ๆ
function readerUrl(info) {
  const target = safeUrl(info.url);
  const path = new URL(target).pathname;
  if (/^\/stn-eoc\/(eoc|admin|dashboard|commander|officer)(\/|$)/.test(path)) return target;
  const url = new URL(`${BASE}public/alerts/`, self.location.origin);
  if (info.title) url.searchParams.set("t", String(info.title).slice(0, 120));
  if (info.body) url.searchParams.set("b", String(info.body).slice(0, 600));
  if (info.at) url.searchParams.set("at", String(info.at).slice(0, 40));
  if (info.level) url.searchParams.set("l", String(info.level).slice(0, 12));
  if (path !== BASE) url.searchParams.set("go", path + new URL(target).search);
  return url.href;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const high = data.level === "high" || data.level === "critical";
  const title = data.title || "แจ้งเตือนภัย จ.สตูล";
  const body = data.body || "มีประกาศใหม่จากศูนย์ปฏิบัติการภาวะฉุกเฉิน จ.สตูล";
  const at = data.at || new Date().toISOString();
  const rid = receiptIds(data.rid);
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body,
      icon: `${BASE}pwa/icon-192.png`,
      badge: `${BASE}pwa/badge-96.png`,
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      requireInteraction: high,
      silent: false, // ใช้เสียงแจ้งเตือนของเครื่อง (ถ้าเครื่องไม่ได้ปิดเสียงของเบราว์เซอร์ไว้)
      vibrate: high ? [300, 150, 300, 150, 600] : [200],
      lang: "th",
      timestamp: Date.parse(at) || Date.now(),
      data: { url: safeUrl(data.url), title, body, at, level: data.level || "info", rid }
    }).then(() => sendReceipt(rid, "shown").catch(() => {})),
    // หน้าเว็บของระบบที่เปิดอยู่: ส่งให้หน้าเว็บเด้งหน้าต่างพร้อมเสียงเตือน (service worker เล่นเสียงเองไม่ได้)
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => windows.forEach((client) => client.postMessage({ type: "stn-push", payload: { title, body, at, level: data.level || "info", url: safeUrl(data.url), tag: data.tag || null } })))
      .catch(() => {}),
    refreshPack(true).catch(() => {})
  ]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const info = event.notification.data || {};
  const target = readerUrl(info.title ? info : { url: info.url, title: event.notification.title, body: event.notification.body });
  event.waitUntil(sendReceipt(info.rid, "opened").catch(() => {}));
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(new URL(BASE, self.location.origin).href) && "focus" in client) {
        await client.focus();
        if ("navigate" in client) return client.navigate(target).catch(() => null);
        return null;
      }
    }
    return self.clients.openWindow(target);
  })());
});

// ผู้ให้บริการ push เปลี่ยน subscription เอง (เช่น หมดอายุ) → สมัครใหม่โดยคงตำบลเดิม
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    const old = event.oldSubscription;
    const options = old?.options || { userVisibleOnly: true };
    const fresh = event.newSubscription || await self.registration.pushManager.subscribe(options);
    await fetch(`${BASE}api/public/push/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({ old_endpoint: old?.endpoint || null, subscription: fresh.toJSON() })
    });
  })().catch(() => {}));
});
