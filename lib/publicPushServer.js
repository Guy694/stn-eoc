// แจ้งเตือนภัยถึงประชาชน — ฝั่งเซิร์ฟเวอร์: เก็บ/ลบการสมัคร ส่งตามพื้นที่ และตรวจประกาศเตือนอัตโนมัติ
import { getPool, query } from "@/lib/db";
import {
  PUSH_SETTINGS_KEY, attachReceipts, buildWarningPayload, deviceKind, endpointHash, normalizePushSettings, receiptIds, receiptTotals,
  resolvedCandidates, subscriptionWants, warningCandidates
} from "@/lib/publicPush";
import { sendWebPush, vapidConfig } from "@/lib/webPush";

const CONCURRENCY = 8;
const parse = (value) => {
  if (value == null) return null;
  try {
    return typeof value === "string" ? JSON.parse(value) : Buffer.isBuffer(value) ? JSON.parse(value.toString("utf8")) : value;
  } catch {
    return null;
  }
};

export async function saveSubscription(value, userAgent = "") {
  await query(
    `INSERT INTO push_subscriptions (endpoint_hash, endpoint, p256dh, auth_secret, scope, districts, tambons, user_agent, is_active, fail_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
     ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth_secret = VALUES(auth_secret), scope = VALUES(scope),
       districts = VALUES(districts), tambons = VALUES(tambons), user_agent = VALUES(user_agent), is_active = 1, fail_count = 0`,
    [endpointHash(value.endpoint), value.endpoint, value.p256dh, value.auth, value.scope, JSON.stringify(value.districts), JSON.stringify(value.tambons), String(userAgent || "").slice(0, 120)]
  );
}

/** ผู้ให้บริการเปลี่ยน subscription: ย้ายพื้นที่เดิมไปยังปลายทางใหม่ */
export async function replaceSubscription(oldEndpoint, value, userAgent = "") {
  let areas = { scope: "all", districts: [], tambons: [] };
  if (oldEndpoint) {
    const rows = await query("SELECT scope, districts, tambons FROM push_subscriptions WHERE endpoint_hash = ? LIMIT 1", [endpointHash(oldEndpoint)]);
    if (rows[0]) areas = { scope: rows[0].scope, districts: parse(rows[0].districts) || [], tambons: parse(rows[0].tambons) || [] };
    await query("DELETE FROM push_subscriptions WHERE endpoint_hash = ?", [endpointHash(oldEndpoint)]);
  }
  await saveSubscription({ ...value, ...areas }, userAgent);
}

export async function removeSubscription(endpoint) {
  const result = await query("DELETE FROM push_subscriptions WHERE endpoint_hash = ?", [endpointHash(endpoint)]);
  return result?.affectedRows || 0;
}

export async function findSubscription(endpoint) {
  const rows = await query("SELECT scope, districts, tambons, created_at FROM push_subscriptions WHERE endpoint_hash = ? AND is_active = 1 LIMIT 1", [endpointHash(endpoint)]);
  return rows[0] ? { scope: rows[0].scope, districts: parse(rows[0].districts) || [], tambons: parse(rows[0].tambons) || [], created_at: rows[0].created_at } : null;
}

/** audience: null = ทุกเครื่อง (เตือนภัยประชาชน), "officer" = เฉพาะเครื่องของเจ้าหน้าที่ */
async function activeSubscriptions(audience = null) {
  const rows = await query(
    `SELECT id, endpoint, p256dh, auth_secret, scope, districts, tambons FROM push_subscriptions WHERE is_active = 1${audience ? " AND audience = ?" : ""}`,
    audience ? [audience] : []
  );
  return rows.map((r) => ({ id: r.id, endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth_secret }, scope: r.scope, districts: parse(r.districts) || [], tambons: parse(r.tambons) || [] }));
}

/** แนบรหัสรายการส่งไปกับแจ้งเตือน เพื่อให้เครื่องผู้รับส่งสัญญาณ "แสดงแล้ว/เปิดอ่าน" กลับมา (ไม่มีรหัส = ไม่แนบ) */
const withReceipt = (payload, ids) => {
  const rid = receiptIds(ids);
  return payload && rid.length ? { ...payload, rid } : payload;
};

/** ทำเครื่องหมายว่ารายการเหล่านี้นับผู้รับได้ (แยกคำสั่ง: ถ้ายังไม่ได้รัน migration 20261024_push_receipts ยอดส่งยังบันทึกได้ตามเดิม) */
async function markReceiptTracked(ids) {
  const rid = receiptIds(ids);
  if (!rid.length) return;
  await query(`UPDATE public_push_log SET receipt_tracked = 1 WHERE id IN (${rid.map(() => "?").join(",")})`, rid).catch(() => {});
}

/** ส่งแบบขนานจำกัดจำนวน — payloadFor(sub) คืน null = ไม่ส่งให้เครื่องนี้ */
async function deliver(subs, payloadFor, { vapid, topic, ttl }) {
  const stats = { recipients: 0, delivered: 0, failed: 0, removed: 0 };
  const queue = subs.map((sub) => ({ sub, payload: payloadFor(sub) })).filter((item) => item.payload);
  stats.recipients = queue.length;
  const worker = async () => {
    while (queue.length) {
      const { sub, payload } = queue.shift();
      const result = await sendWebPush(sub, payload, { vapid, topic, ttl, urgency: payload.level === "high" ? "high" : "normal" });
      if (result.ok) {
        stats.delivered += 1;
        await query("UPDATE push_subscriptions SET last_sent_at = NOW(), last_status = ?, fail_count = 0 WHERE id = ?", [result.status, sub.id]).catch(() => {});
      } else if (result.gone) {
        stats.removed += 1;
        await query("DELETE FROM push_subscriptions WHERE id = ?", [sub.id]).catch(() => {});
      } else {
        stats.failed += 1;
        const host = (() => { try { return new URL(sub.endpoint).hostname.replace(/^[^.]+\.(?=push\.apple\.com$)/, ""); } catch { return "?"; } })();
        const label = `${host} ${result.status || "เชื่อมต่อไม่ได้"}${result.reason ? ` ${result.reason}` : ""}`;
        stats.errors = stats.errors || {};
        stats.errors[label] = (stats.errors[label] || 0) + 1;
        await query("UPDATE push_subscriptions SET last_status = ?, fail_count = fail_count + 1, is_active = IF(fail_count >= 20, 0, 1) WHERE id = ?", [result.status || null, sub.id]).catch(() => {});
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (stats.errors) console.warn(`[push] ส่งไม่สำเร็จ ${stats.failed} เครื่อง: ${Object.entries(stats.errors).map(([k, n]) => `${k} ×${n}`).join(", ")}${vapid.subjectOk === false ? " — VAPID_SUBJECT ใช้ไม่ได้ (Apple จะปฏิเสธ)" : ""}`);
  return stats;
}

/** เครื่องของเจ้าหน้าที่: ผูกกับบัญชี เพื่อส่งงานของเจ้าหน้าที่ (คำขอช่วยเหลือ) — ยังได้รับเตือนภัยทั้งจังหวัดเหมือนประชาชน */
export async function saveOfficerSubscription(value, officerId, userAgent = "") {
  await query(
    `INSERT INTO push_subscriptions (endpoint_hash, endpoint, p256dh, auth_secret, audience, officer_id, scope, districts, tambons, user_agent, is_active, fail_count)
     VALUES (?, ?, ?, ?, 'officer', ?, 'all', '[]', '[]', ?, 1, 0)
     ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth_secret = VALUES(auth_secret), audience = 'officer',
       officer_id = VALUES(officer_id), user_agent = VALUES(user_agent), is_active = 1, fail_count = 0`,
    [endpointHash(value.endpoint), value.endpoint, value.p256dh, value.auth, officerId, String(userAgent || "").slice(0, 120)]
  );
}

/** เลิกรับงานเจ้าหน้าที่บนเครื่องนี้ (ยังรับเตือนภัยประชาชนต่อ) */
export async function releaseOfficerSubscription(endpoint, officerId) {
  await query("UPDATE push_subscriptions SET audience = 'public', officer_id = NULL WHERE endpoint_hash = ? AND officer_id = ?", [endpointHash(endpoint), officerId]);
}

export async function findOfficerSubscription(endpoint, officerId) {
  const rows = await query("SELECT id FROM push_subscriptions WHERE endpoint_hash = ? AND audience = 'officer' AND officer_id = ? AND is_active = 1 LIMIT 1", [endpointHash(endpoint), officerId]);
  return Boolean(rows[0]);
}

export async function countOfficerDevices() {
  const rows = await query("SELECT COUNT(*) AS n, COUNT(DISTINCT officer_id) AS officers FROM push_subscriptions WHERE audience = 'officer' AND is_active = 1");
  return { devices: Number(rows[0]?.n || 0), officers: Number(rows[0]?.officers || 0) };
}

/**
 * ส่งงานถึงเครื่องเจ้าหน้าที่ทุกเครื่อง โดยจองกุญแจกันส่งซ้ำก่อน (หลายเซิร์ฟเวอร์ก็ส่งครั้งเดียว)
 * คืน null ถ้าเคยส่งกุญแจนี้แล้ว
 */
export async function sendOfficerAlert(key, payload, { kind = "auto" } = {}) {
  const vapid = vapidConfig();
  if (!vapid) return null;
  const reserved = await query(
    `INSERT IGNORE INTO public_push_log (alert_key, kind, level, title, body, url, target) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [key, kind, payload.level || "high", String(payload.title).slice(0, 160), String(payload.body).slice(0, 500), payload.url || null, JSON.stringify({ audience: "officer" })]
  );
  if (reserved?.affectedRows !== 1) return null;
  const subs = await activeSubscriptions("officer");
  const stamped = withReceipt(payload, [reserved.insertId]);
  const stats = await deliver(subs, () => stamped, { vapid, topic: payload.tag, ttl: 3 * 3600 });
  await markReceiptTracked([reserved.insertId]);
  await query("UPDATE public_push_log SET recipients = ?, delivered = ?, failed = ?, removed = ?, finished_at = NOW() WHERE alert_key = ?",
    [stats.recipients, stats.delivered, stats.failed, stats.removed, key]).catch(() => {});
  return stats;
}

export async function getPushSettings() {
  try {
    const [rows] = await getPool().execute("SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1", [PUSH_SETTINGS_KEY]);
    return normalizePushSettings(parse(rows[0]?.setting_value));
  } catch {
    return normalizePushSettings(null);
  }
}

export async function savePushSettings(value, user) {
  const stored = { auto_enabled: value.auto_enabled === true, auto_level: value.auto_level === "watch" ? "watch" : "high", updated_at: new Date().toISOString(), updated_by_name: [user?.givenName || user?.given_name, user?.familyName || user?.family_name].filter(Boolean).join(" ") || user?.username || null };
  await query(
    `INSERT INTO system_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
    [PUSH_SETTINGS_KEY, JSON.stringify(stored), user?.id ?? null]
  );
  return normalizePushSettings(stored);
}

/** ส่งข้อความที่เจ้าหน้าที่เขียนเอง (หรือทดสอบถึงเครื่องเดียว) */
export async function broadcast({ title, body, url, districts = [], level = "info", audience = "public" }, { user = null, testEndpoint = null } = {}) {
  const vapid = vapidConfig();
  if (!vapid) throw Object.assign(new Error("ยังไม่ได้ตั้งค่า VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY"), { code: "NO_VAPID" });
  const now = Date.now();
  const kind = testEndpoint ? "test" : "manual";
  const key = `${kind}:${now}:${Math.random().toString(36).slice(2, 8)}`;
  const officersOnly = audience === "officers" && !testEndpoint;
  // บันทึกรายการก่อนส่ง เพื่อได้รหัสไปแนบกับแจ้งเตือน (ใช้นับเครื่องที่แจ้งเตือนขึ้น/เปิดอ่าน)
  const logged = await query(
    `INSERT INTO public_push_log (alert_key, kind, level, title, body, url, target, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [key, kind, level, title, body, url, JSON.stringify(officersOnly ? { audience: "officer" } : { districts }), user?.id ?? null]
  ).catch((error) => { console.warn("[public-push] cannot write log:", error.message); return null; });
  const logId = logged?.insertId || null;
  const payload = withReceipt({ title, body, url, level, tag: kind === "test" ? "test" : `manual-${now}`, at: new Date(now).toISOString() }, [logId]);
  let subs = await activeSubscriptions(officersOnly ? "officer" : null);
  if (testEndpoint) subs = subs.filter((s) => s.endpoint === testEndpoint);
  const stats = await deliver(subs, (sub) => (testEndpoint || subscriptionWants(sub, districts) ? payload : null), { vapid, ttl: 12 * 3600 });
  if (logId) {
    await query("UPDATE public_push_log SET recipients = ?, delivered = ?, failed = ?, removed = ?, finished_at = NOW() WHERE id = ?",
      [stats.recipients, stats.delivered, stats.failed, stats.removed, logId]).catch((error) => console.warn("[public-push] cannot update log:", error.message));
    await markReceiptTracked([logId]);
  }
  return stats;
}

/** ตรวจประกาศเตือนระดับสูงที่ยังไม่เคยส่ง แล้วส่งถึงผู้ที่สมัครในพื้นที่นั้น */
export async function runPublicPushAlerts({ force = false } = {}) {
  const vapid = vapidConfig();
  if (!vapid) return { skipped: "no_vapid" };
  const settings = await getPushSettings();
  if (!settings.auto_enabled && !force) return { skipped: "disabled" };
  const { getWeatherWatchPayload } = await import("@/lib/weatherWatch");
  const weather = await getWeatherWatchPayload();
  const now = Date.now();
  const candidates = warningCandidates(weather?.weather_warnings || [], now, { level: settings.auto_level });
  const fresh = [];
  for (const item of candidates) {
    // จองกุญแจก่อนส่ง (กันส่งซ้ำแม้มีหลายเซิร์ฟเวอร์)
    const result = await query(
      `INSERT IGNORE INTO public_push_log (alert_key, kind, level, title, body, target) VALUES (?, 'auto', ?, ?, ?, ?)`,
      [item.key, item.level === "watch" ? "info" : "high", item.level === "watch" ? "เฝ้าระวังอัตโนมัติ" : "เตือนภัยอัตโนมัติ", item.message, JSON.stringify({ districts: item.districts, source: item.source })]
    );
    if (result?.affectedRows === 1) fresh.push({ ...item, logId: result.insertId });
  }
  if (!fresh.length) return { sent: 0, candidates: candidates.length };
  const subs = await activeSubscriptions();
  const stats = await deliver(subs, (sub) => {
    const mine = fresh.filter((item) => subscriptionWants(sub, item.districts));
    return mine.length ? withReceipt(buildWarningPayload(mine, now), mine.map((item) => item.logId)) : null;
  }, { vapid, topic: `warn${new Date(now + 7 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "")}`, ttl: 6 * 3600 });
  await query(
    `UPDATE public_push_log SET recipients = ?, delivered = ?, failed = ?, removed = ?, finished_at = NOW() WHERE alert_key IN (${fresh.map(() => "?").join(",")})`,
    [stats.recipients, stats.delivered, stats.failed, stats.removed, ...fresh.map((i) => i.key)]
  ).catch(() => {});
  await markReceiptTracked(fresh.map((item) => item.logId));
  return { sent: fresh.length, ...stats };
}

/** อ่านประวัติการส่งเฉพาะรายการที่ไม่ได้ถูกลบ (ถ้ายังไม่ได้รัน migration 20261021_push_log_hidden ให้อ่านทั้งหมดเหมือนเดิม) */
async function queryVisibleLog(sql, params = []) {
  try {
    return await query(sql.replace("{{visible}}", " AND hidden_at IS NULL"), params);
  } catch (error) {
    if (error?.code !== "ER_BAD_FIELD_ERROR") throw error;
    return query(sql.replace("{{visible}}", ""), params);
  }
}

/** ลบรายการออกจากประวัติการส่ง (ซ่อน ไม่ลบแถว เพราะ alert_key ใช้กันส่งเตือนภัยอัตโนมัติซ้ำ) — คืนรายการที่ลบ */
export async function hidePushLog(ids = [], user = null) {
  const list = [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 100);
  if (!list.length) return [];
  const marks = list.map(() => "?").join(",");
  const rows = await query(`SELECT id, kind, title FROM public_push_log WHERE id IN (${marks}) AND hidden_at IS NULL`, list);
  if (!rows.length) return [];
  await query(`UPDATE public_push_log SET hidden_at = NOW(), hidden_by = ? WHERE id IN (${rows.map(() => "?").join(",")})`, [user?.id || null, ...rows.map((row) => row.id)]);
  return rows;
}

/** แจ้งเตือนที่ส่งถึงประชาชน (อัตโนมัติ + เจ้าหน้าที่ส่ง) 30 วันล่าสุด — ไม่รวมข้อความทดสอบและงานของเจ้าหน้าที่ */
export async function publicAlertHistory({ days = 30, limit = 30 } = {}) {
  const rows = await queryVisibleLog(
    `SELECT id, kind, level, title, body, url, target, created_at FROM public_push_log
     WHERE kind IN ('auto', 'manual') AND created_at >= NOW() - INTERVAL ? DAY{{visible}} ORDER BY id DESC LIMIT ?`,
    [Number(days), Number(limit) * 2]
  );
  return rows
    .filter((row) => parse(row.target)?.audience !== "officer")
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      level: row.level,
      title: row.kind === "auto" ? "⚠️ เตือนภัย จ.สตูล" : row.title,
      body: row.body,
      url: typeof row.url === "string" && row.url.startsWith("/stn-eoc/") ? row.url : null,
      districts: parse(row.target)?.districts || [],
      created_at: row.created_at
    }));
}

/** แจ้งประชาชนว่า "น้ำลดแล้ว" (เรียกจากตัวตรวจระดับน้ำ เมื่อสถานีพ้นล้นตลิ่ง) — ส่งเฉพาะเมื่อเปิดการส่งอัตโนมัติ */
export async function sendResolvedAlerts(alerts = []) {
  const items = resolvedCandidates(alerts);
  if (!items.length) return { sent: 0 };
  const vapid = vapidConfig();
  if (!vapid) return { skipped: "no_vapid" };
  const settings = await getPushSettings();
  if (!settings.auto_enabled) return { skipped: "disabled" };
  const now = Date.now();
  const fresh = [];
  for (const item of items) {
    const result = await query(
      `INSERT IGNORE INTO public_push_log (alert_key, kind, level, title, body, url, target) VALUES (?, 'auto', 'info', ?, ?, ?, ?)`,
      [item.key, item.title, item.message, "/stn-eoc/public/weather-watch/", JSON.stringify({ districts: item.districts, source: "resolved" })]
    );
    if (result?.affectedRows === 1) fresh.push({ ...item, logId: result.insertId });
  }
  if (!fresh.length) return { sent: 0 };
  const subs = await activeSubscriptions();
  const stats = await deliver(subs, (sub) => {
    const mine = fresh.filter((item) => subscriptionWants(sub, item.districts));
    if (!mine.length) return null;
    return withReceipt({
      title: mine.length > 1 ? `✅ น้ำลดลงต่ำกว่าตลิ่งแล้ว ${mine.length} สถานี` : mine[0].title,
      body: mine.slice(0, 3).map((item) => (mine.length > 1 ? `• ${item.message}` : item.message)).join("\n").slice(0, 400),
      url: "/stn-eoc/public/weather-watch/",
      tag: `resolved-${new Date(now + 7 * 3600e3).toISOString().slice(0, 10)}`,
      level: "info",
      at: new Date(now).toISOString()
    }, mine.map((item) => item.logId));
  }, { vapid, ttl: 6 * 3600 });
  await query(
    `UPDATE public_push_log SET recipients = ?, delivered = ?, failed = ?, removed = ?, finished_at = NOW() WHERE alert_key IN (${fresh.map(() => "?").join(",")})`,
    [stats.recipients, stats.delivered, stats.failed, stats.removed, ...fresh.map((i) => i.key)]
  ).catch(() => {});
  await markReceiptTracked(fresh.map((item) => item.logId));
  return { sent: fresh.length, ...stats };
}

// ---------- นับผู้รับแจ้งเตือน ----------
const missingSchema = (error) => error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_FIELD_ERROR";

/**
 * บันทึกสัญญาณจากเครื่องผู้รับ — รับเฉพาะเครื่องที่สมัครไว้จริง และรายการส่งไม่เกิน 14 วัน
 * "เปิดอ่าน" นับเป็น "แสดงแล้ว" ด้วยเสมอ (กรณีสัญญาณแรกส่งไม่ถึงตอนเครื่องไม่มีเน็ต)
 */
export async function recordReceipt({ ids, event, endpoint }) {
  const hash = endpointHash(endpoint);
  const known = await query("SELECT id FROM push_subscriptions WHERE endpoint_hash = ? LIMIT 1", [hash]);
  if (!known[0]) return 0;
  const list = receiptIds(ids);
  if (!list.length) return 0;
  const logs = await query(`SELECT id FROM public_push_log WHERE id IN (${list.map(() => "?").join(",")}) AND created_at >= NOW() - INTERVAL 14 DAY`, list);
  if (!logs.length) return 0;
  const events = event === "opened" ? ["shown", "opened"] : ["shown"];
  const values = logs.flatMap((row) => events.map((name) => [row.id, name, hash]));
  const result = await query(`INSERT IGNORE INTO push_receipts (log_id, event, sub_hash) VALUES ${values.map(() => "(?, ?, ?)").join(",")}`, values.flat());
  return result?.affectedRows || 0;
}

/** เติม shown/opened ให้รายการส่ง (ยังไม่ได้รัน migration → ทุกรายการเป็น "ยังไม่นับ") */
async function withReceiptCounts(rows) {
  const ids = rows.map((row) => Number(row.id)).filter(Boolean);
  if (!ids.length) return attachReceipts(rows, []);
  const marks = ids.map(() => "?").join(",");
  try {
    const [flags, counts] = await Promise.all([
      query(`SELECT id, receipt_tracked FROM public_push_log WHERE id IN (${marks})`, ids),
      query(`SELECT log_id, event, COUNT(*) AS n FROM push_receipts WHERE log_id IN (${marks}) GROUP BY log_id, event`, ids)
    ]);
    const tracked = new Map(flags.map((row) => [Number(row.id), row.receipt_tracked]));
    return attachReceipts(rows.map((row) => ({ ...row, receipt_tracked: tracked.get(Number(row.id)) || 0 })), counts);
  } catch (error) {
    if (!missingSchema(error)) throw error;
    return attachReceipts(rows.map((row) => ({ ...row, receipt_tracked: 0 })), []);
  }
}

/**
 * ภาพรวมผู้รับแจ้งเตือนสำหรับเมนู "ผู้เข้าชม" (ผู้ดูแลระบบ)
 * - เครื่องที่รับอยู่ แยกขอบเขต อำเภอ และประเภทอุปกรณ์ · สมัครใหม่รายวัน
 * - แจ้งเตือนถึงประชาชนในช่วงที่เลือก: ส่ง → ถึงเครื่อง → แสดงแล้ว → เปิดอ่าน
 */
export async function pushAudienceStats({ days = 30 } = {}) {
  const span = [7, 30, 90, 365].includes(Number(days)) ? Number(days) : 30;
  const [subs, areas, newRows, logRows] = await Promise.all([
    query("SELECT scope, user_agent, audience FROM push_subscriptions WHERE is_active = 1").catch(async (error) => {
      if (error?.code !== "ER_BAD_FIELD_ERROR") throw error; // ยังไม่ได้รัน migration push_officer
      return (await query("SELECT scope, user_agent FROM push_subscriptions WHERE is_active = 1")).map((row) => ({ ...row, audience: "public" }));
    }),
    query("SELECT districts, tambons FROM push_subscriptions WHERE is_active = 1 AND scope = 'areas'"),
    query("SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS n FROM push_subscriptions WHERE is_active = 1 AND created_at >= CURDATE() - INTERVAL ? DAY GROUP BY day ORDER BY day", [span - 1]),
    queryVisibleLog(
      `SELECT id, kind, level, title, body, target, recipients, delivered, failed, removed, created_at FROM public_push_log
       WHERE kind IN ('auto', 'manual') AND created_at >= NOW() - INTERVAL ? DAY{{visible}} ORDER BY id DESC LIMIT 200`, [span])
  ]);
  const devices = {};
  let wholeProvince = 0;
  let officers = 0;
  for (const row of subs) {
    if (row.scope === "all") wholeProvince += 1;
    if (row.audience === "officer") officers += 1;
    const kind = deviceKind(row.user_agent);
    devices[kind] = (devices[kind] || 0) + 1;
  }
  const byDistrict = {};
  for (const row of areas) {
    const set = new Set([...(parse(row.districts) || []), ...(parse(row.tambons) || []).map((t) => String(t).split("|")[0])]);
    for (const d of set) byDistrict[d] = (byDistrict[d] || 0) + 1;
  }
  const publicRows = logRows.filter((row) => parse(row.target)?.audience !== "officer").map(({ target, ...row }) => ({ ...row, districts: parse(target)?.districts || [] }));
  const alerts = await withReceiptCounts(publicRows);
  let reached = null;
  try {
    const rows = await query("SELECT COUNT(DISTINCT sub_hash) AS n FROM push_receipts WHERE event = 'shown' AND created_at >= NOW() - INTERVAL ? DAY", [span]);
    reached = Number(rows[0]?.n || 0);
  } catch (error) {
    if (!missingSchema(error)) throw error;
  }
  return {
    days: span,
    total: subs.length,
    whole_province: wholeProvince,
    areas: subs.length - wholeProvince,
    officers,
    by_district: byDistrict,
    by_device: devices,
    new_by_day: newRows.map((row) => ({ day: row.day, n: Number(row.n) || 0 })),
    new_total: newRows.reduce((sum, row) => sum + (Number(row.n) || 0), 0),
    reached_devices: reached,
    receipts_ready: reached !== null,
    totals: receiptTotals(alerts),
    alerts: alerts.slice(0, 100)
  };
}

export async function pushStats({ logPage = 1, logSize = 20 } = {}) {
  const size = [10, 20, 50].includes(Number(logSize)) ? Number(logSize) : 20;
  const page = Math.max(1, Math.floor(Number(logPage)) || 1);
  const [subs, byArea, log, logCount] = await Promise.all([
    query("SELECT COUNT(*) AS total, SUM(scope = 'all') AS whole_province FROM push_subscriptions WHERE is_active = 1"),
    query("SELECT scope, districts, tambons FROM push_subscriptions WHERE is_active = 1 AND scope = 'areas'"),
    queryVisibleLog("SELECT id, kind, level, title, body, target, recipients, delivered, failed, removed, created_at FROM public_push_log WHERE 1 = 1{{visible}} ORDER BY id DESC LIMIT ? OFFSET ?", [size, (page - 1) * size]),
    queryVisibleLog("SELECT COUNT(*) AS total FROM public_push_log WHERE 1 = 1{{visible}}")
  ]);
  const districts = {};
  for (const row of byArea) {
    const set = new Set([...(parse(row.districts) || []), ...(parse(row.tambons) || []).map((t) => String(t).split("|")[0])]);
    for (const d of set) districts[d] = (districts[d] || 0) + 1;
  }
  const officers = await countOfficerDevices().catch(() => null); // ยังไม่ได้รัน migration push_officer → null
  const rows = await withReceiptCounts(log.map(({ target, ...row }) => ({ ...row, audience: parse(target)?.audience === "officer" ? "officer" : "public" })));
  return {
    total: Number(subs[0]?.total || 0), whole_province: Number(subs[0]?.whole_province || 0), by_district: districts, officers,
    log: rows, log_total: Number(logCount[0]?.total || 0), log_page: page, log_size: size
  };
}

// ตั้งเวลาตรวจอัตโนมัติ (เรียกจาก instrumentation.js) — production ทุก 5 นาที; ปิดด้วย PUBLIC_PUSH_INTERVAL_MIN=off, เปิดตอน dev ด้วย PUBLIC_PUSH_SCHEDULER=on
export function startPublicPushScheduler() {
  const setting = String(process.env.PUBLIC_PUSH_INTERVAL_MIN || "5").trim().toLowerCase();
  const forced = String(process.env.PUBLIC_PUSH_SCHEDULER || "").trim().toLowerCase() === "on";
  if (["off", "0", "false", "no"].includes(setting)) return false;
  if (process.env.NODE_ENV !== "production" && !forced) return false;
  if (!vapidConfig()) {
    console.info("[public-push] ยังไม่ได้ตั้งค่า VAPID — ปิดการแจ้งเตือนประชาชนอัตโนมัติ");
    return false;
  }
  if (globalThis.__publicPushTimer) return true;
  const minutes = Math.min(60, Math.max(2, Number(setting) || 5));
  const tick = () => {
    import("@/lib/schedulerLock").then(({ withSchedulerLock }) => withSchedulerLock("public-push", runPublicPushAlerts)).then((result) => {
      if (result?.skipped) return;
      if (result.sent) console.info(`[public-push] เตือนภัย ${result.sent} เรื่อง ถึง ${result.delivered}/${result.recipients} เครื่อง`);
    }).catch((error) => console.error("[public-push] ตรวจไม่สำเร็จ:", error.message));
    // คำขอความช่วยเหลือที่ยังไม่มีผู้รับเรื่อง: เตือนเจ้าหน้าที่ซ้ำทุก 30 นาที (ไม่ขึ้นกับสวิตช์เตือนภัยประชาชน)
    Promise.all([import("@/lib/helpAlertsServer"), import("@/lib/schedulerLock")]).then(([{ runHelpEscalations }, { withSchedulerLock }]) => withSchedulerLock("help-escalations", runHelpEscalations)).then((result) => {
      if (result?.sent) console.info(`[help-alerts] เตือนคำขอค้าง ${result.sent} เรื่อง`);
    }).catch((error) => console.error("[help-alerts] ตรวจไม่สำเร็จ:", error.message));
  };
  globalThis.__publicPushTimer = setInterval(tick, minutes * 60 * 1000);
  setTimeout(tick, 45 * 1000);
  console.info(`[public-push] ตรวจประกาศเตือนเพื่อแจ้งประชาชนทุก ${minutes} นาที`);
  return true;
}
