"use client";

// เฝ้าระวังความปลอดภัย: เกณฑ์แจ้งเตือน แจ้งเตือนผิดปกติล่าสุด ประวัติเปลี่ยนสิทธิ์ และสรุปรายสัปดาห์ (Telegram กลุ่มผู้ดูแลระบบ)
import { useCallback, useEffect, useState } from "react";
import { Eye, RefreshCw, Send, ShieldAlert } from "lucide-react";
import { Button, StatusPill, useNotice } from "@/components/admin/crud";
import { SECURITY_AUDIT_LABELS } from "@/lib/securityAuditLabels";

const API = "/stn-eoc/api/admin/security-monitor";
const DAY_NAMES = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const KIND_LABELS = {
  traffic_spike: "ผู้เข้าชมพุ่ง",
  ip_flood: "IP เข้าถี่",
  staff_foreign_access: "เจ้าหน้าที่เข้าจากต่างประเทศ",
  failed_login_burst: "รหัสผิดจำนวนมาก"
};

const when = (value) => (value ? new Date(value).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-");
// ข้อความ Telegram (HTML) → ข้อความธรรมดาสำหรับแสดงตัวอย่าง
const plain = (html) => String(html || "").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function Section({ title, children, right }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h3 className="text-base font-black text-slate-900">{title}</h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function SecurityMonitorPanel() {
  const { success, fail } = useNotice();
  const [data, setData] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(API, { cache: "no-store" });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || "โหลดไม่สำเร็จ");
      setData(json);
    } catch (error) {
      fail(error.message);
    }
  }, [fail]);
  useEffect(() => { load(); }, [load]);

  const act = async (action) => {
    setBusy(action);
    try {
      const response = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || "ทำรายการไม่สำเร็จ");
      if (action === "preview") setPreview(plain(json.text));
      if (action === "send_weekly") {
        setPreview(plain(json.text));
        if (json.delivered) success(`ส่งสรุปเข้า Telegram แล้ว ${json.delivered} ปลายทาง`);
        else fail("ยังส่งไม่ถึงใคร ตรวจ TELEGRAM_BOT_TOKEN และ TELEGRAM_SECURITY_CHAT_IDS");
      }
      if (action === "check") {
        success(json.alerts.length ? `พบความผิดปกติ ${json.alerts.length} รายการ (ยังไม่ได้ส่ง)` : `ไม่พบความผิดปกติ · 10 นาทีล่าสุดเปิดหน้าเว็บ ${json.window.total.toLocaleString("th-TH")} ครั้ง`);
      }
    } catch (error) {
      fail(error.message);
    } finally {
      setBusy("");
    }
  };

  if (!data) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  const c = data.config;

  return (
    <div className="grid grid-cols-1 gap-4">
      {!data.ready ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">ยังไม่มีตารางเฝ้าระวัง ให้ผู้ดูแลระบบรัน migration บนเซิร์ฟเวอร์</p> : null}
      {!data.telegramReady ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">ยังไม่ได้ตั้งกลุ่ม Telegram ผู้ดูแลระบบ (TELEGRAM_SECURITY_CHAT_IDS) แจ้งเตือนจะยังไม่ถูกส่ง</p> : null}
      {!c.enabled ? <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">ปิดการเฝ้าระวังอยู่ (SECURITY_MONITOR=off)</p> : null}

      <Section
        title="แจ้งเตือนเมื่อพบความผิดปกติ (ตรวจทุก 10 นาที)"
        right={<Button variant="secondary" onClick={() => act("check")} disabled={Boolean(busy)}><ShieldAlert className="h-4 w-4" aria-hidden="true" />{busy === "check" ? "กำลังตรวจ…" : "ตรวจตอนนี้"}</Button>}
      >
        <ul className="grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <li>• ผู้เข้าชมพุ่ง: ≥ {c.spikeMinVisits.toLocaleString("th-TH")} ครั้งใน 10 นาที และมากกว่าปกติ {c.spikeRatio} เท่า</li>
          <li>• IP เดียวเปิดหน้าเว็บ ≥ {c.ipMaxVisits.toLocaleString("th-TH")} ครั้งใน 10 นาที</li>
          <li>• ใส่รหัสผ่านผิดรวม ≥ {c.failedLoginBurst} ครั้งใน 10 นาที</li>
          <li>• บัญชีเจ้าหน้าที่ถูกใช้จากนอกประเทศ ({c.homeCountry})</li>
        </ul>
        <p className="mt-2 text-xs text-slate-500">เรื่องเดิมไม่แจ้งซ้ำภายใน {c.cooldownMinutes} นาที (เจ้าหน้าที่เข้าจากต่างประเทศ: วันละครั้ง) · ปรับเกณฑ์ได้ใน .env หัวข้อ SECURITY_*</p>
        <h4 className="mt-4 text-sm font-bold text-slate-800">แจ้งเตือนล่าสุด</h4>
        {data.alerts.length ? (
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {data.alerts.map((row) => (
              <li key={row.id} className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="red">{KIND_LABELS[row.kind] || row.kind}</StatusPill>
                  <span className="text-xs text-slate-500">{when(row.created_at)} · ส่งถึง {row.delivered} ปลายทาง</span>
                </div>
                <p className="mt-1 whitespace-pre-line break-words text-slate-700">{row.detail}</p>
              </li>
            ))}
          </ul>
        ) : <p className="mt-1 text-sm text-slate-500">ยังไม่มี</p>}
      </Section>

      <Section
        title={`สรุปรายสัปดาห์ (ทุกวัน${DAY_NAMES[c.weeklyDay]} ${String(c.weeklyHour).padStart(2, "0")}:00 น.)`}
        right={(
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => act("preview")} disabled={Boolean(busy)}><Eye className="h-4 w-4" aria-hidden="true" />{busy === "preview" ? "กำลังสรุป…" : "ดูตัวอย่าง"}</Button>
            <Button onClick={() => act("send_weekly")} disabled={Boolean(busy) || !data.telegramReady}><Send className="h-4 w-4" aria-hidden="true" />{busy === "send_weekly" ? "กำลังส่ง…" : "ส่งเข้า Telegram ตอนนี้"}</Button>
          </div>
        )}
      >
        <p className="text-sm text-slate-600">การเข้าสู่ระบบ บัญชีที่ไม่ได้ใช้เกิน {c.inactiveDays} วัน การเปลี่ยนสิทธิ์ ผู้เข้าชม และแจ้งเตือนผิดปกติของ 7 วันที่ผ่านมา ส่งเข้ากลุ่มผู้ดูแลระบบ</p>
        {preview ? <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 font-[inherit] text-sm leading-6 text-slate-800">{preview}</pre> : null}
      </Section>

      <Section title="ประวัติเปลี่ยนสิทธิ์/สถานะบัญชี" right={<Button variant="ghost" onClick={load}><RefreshCw className="h-4 w-4" aria-hidden="true" />รีเฟรช</Button>}>
        {data.audit.length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {data.audit.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <StatusPill tone={row.action === "role_change" || row.action === "account_deleted" ? "amber" : "gray"}>{SECURITY_AUDIT_LABELS[row.action] || row.action}</StatusPill>
                <span className="basis-full break-words font-semibold text-slate-800 sm:basis-auto">{row.target_username || "-"}{row.detail ? <span className="font-normal text-slate-600"> ({row.detail})</span> : null}</span>
                <span className="text-xs text-slate-500">โดย {row.actor_username || "-"} · {when(row.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-500">ยังไม่มี (เริ่มบันทึกหลังติดตั้งเวอร์ชันนี้)</p>}
      </Section>
    </div>
  );
}
