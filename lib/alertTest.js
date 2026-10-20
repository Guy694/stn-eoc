// ทดสอบการแจ้งเตือน (แอดมิน): ตรวจว่าแต่ละช่องทางพร้อมไหม และสร้างแจ้งเตือนทดสอบ
// ไฟล์นี้ไม่แตะฐานข้อมูล/เครือข่าย — ใช้ทั้ง API และ unit test

export const TEST_LEVELS = ["critical", "serious", "info"];

/** แจ้งเตือนทดสอบที่จะใส่ใน water_alert_log (หน้าจอเจ้าหน้าที่ทุกเครื่องเด้งในรอบถัดไป) */
export function buildTestAlert({ kind = "water", level = "critical", by = "" } = {}) {
  const lv = TEST_LEVELS.includes(level) ? level : "critical";
  const rain = kind === "rain";
  const title = rain
    ? (lv === "critical" ? "⛈️ [ทดสอบ] ฝนหนักมาก — สถานีวัดฝนตัวอย่าง" : "🌧️ [ทดสอบ] ฝนหนัก — สถานีวัดฝนตัวอย่าง")
    : lv === "critical" ? "🚨 [ทดสอบ] น้ำล้นตลิ่ง — สถานีตัวอย่าง"
      : lv === "serious" ? "⚠️ [ทดสอบ] น้ำใกล้ล้นตลิ่ง — สถานีตัวอย่าง" : "✅ [ทดสอบ] น้ำลดลงต่ำกว่าตลิ่งแล้ว — สถานีตัวอย่าง";
  const lines = [
    "นี่คือการทดสอบระบบแจ้งเตือน ไม่ใช่เหตุการณ์จริง",
    rain ? "ฝน 24 ชม. 95.0 มม. (ตัวอย่าง)" : "สูงกว่าตลิ่ง 0.15 ม. (ตัวอย่าง)",
    by ? `สั่งทดสอบโดย ${by}` : ""
  ].filter(Boolean);
  return {
    kind: rain ? "rain" : "water",
    stationId: "test",
    stationName: "[ทดสอบ] สถานีตัวอย่าง",
    level: rain && lv === "info" ? "serious" : lv,
    state: rain ? (lv === "critical" ? "severe" : "watch") : lv === "critical" ? "overflow" : lv === "serious" ? "near" : "normal",
    previousState: "normal",
    title,
    message: lines.join("\n")
  };
}

/** รายการตรวจความพร้อมฝั่งเซิร์ฟเวอร์ → [{ key, label, ok, detail, fix }] */
export function serverChecklist(info) {
  const lastAlertAge = info.lastAlert ? (info.now - new Date(info.lastAlert.created_at).getTime()) / 3600000 : null;
  return [
    {
      key: "scheduler", label: "ตัวตรวจน้ำ/ฝนอัตโนมัติ (ทุก 10 นาที)", ok: info.scheduler !== "off",
      detail: info.scheduler === "off" ? "ปิดอยู่" : `ตรวจทุก ${info.scheduler} นาที`,
      fix: "ทำงานเฉพาะ production — ตรวจว่าใน .env ไม่ได้ตั้ง WATER_ALERTS_INTERVAL_MIN=off"
    },
    {
      key: "log", label: "ตารางบันทึกแจ้งเตือน (ใช้เด้งบนหน้าจอเจ้าหน้าที่)", ok: info.logReady,
      detail: info.logReady
        ? (info.lastAlert ? `ล่าสุด: ${info.lastAlert.title} (${lastAlertAge < 1 ? "ไม่ถึง 1 ชม." : `${Math.round(lastAlertAge)} ชม.`}ที่แล้ว) · 24 ชม. ${info.alerts24h} เรื่อง` : "ยังไม่เคยมีแจ้งเตือน")
        : "ยังไม่มีตาราง",
      fix: "รัน ./scripts/docker-migrate.sh up"
    },
    {
      key: "telegram", label: "Telegram", ok: info.telegramReady && info.sendingEnabled,
      detail: !info.telegramReady ? "ยังไม่ตั้ง TELEGRAM_BOT_TOKEN / TELEGRAM_HELP_NOTIFY_CHAT_IDS" : info.sendingEnabled ? "พร้อมส่ง" : "ปิดด้วย EOC_ALERTS_TELEGRAM=off",
      fix: "ตั้งค่าใน .env แล้ว restart"
    },
    {
      key: "vapid", label: "แจ้งเตือนเข้ามือถือ (Web Push / VAPID)", ok: info.vapidReady,
      detail: info.vapidReady ? "ตั้งกุญแจแล้ว" : "ยังไม่ตั้ง VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY",
      fix: "สร้างกุญแจด้วย npm run push:vapid แล้วใส่ใน .env และ restart"
    },
    {
      key: "auto", label: "ส่งเตือนภัยถึงประชาชนอัตโนมัติ", ok: info.pushAuto,
      detail: info.pushAuto ? "เปิด" : "ปิดอยู่ — ประชาชนที่กดรับแจ้งเตือนจะไม่ได้รับเตือนภัยอัตโนมัติ",
      fix: "เปิดที่ ตั้งค่าระบบ → แจ้งเตือนประชาชน → เปิดการส่งอัตโนมัติ"
    },
    {
      key: "subs", label: "เครื่องที่สมัครรับแจ้งเตือน", ok: info.subscriptions > 0,
      detail: `ทั้งหมด ${info.subscriptions} เครื่อง (เจ้าหน้าที่ ${info.officerDevices} เครื่อง)`,
      fix: "ให้ประชาชนกด \"รับการแจ้งเตือน\" บนหน้าเว็บ / เจ้าหน้าที่เปิดที่หน้าโปรไฟล์"
    }
  ];
}
