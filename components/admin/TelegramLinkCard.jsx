"use client";

// รับแจ้งเตือนทาง Telegram (หน้าโปรไฟล์): กด "เชื่อม Telegram" → เปิดบอท → กด Start → ระบบผูกบัญชีให้เอง ไม่ต้องกรอก Chat ID
import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, CheckCircle2, Link2, Link2Off, Loader2, Send } from "lucide-react";
import { StatusPill, inputClass } from "@/components/admin/crud";
import { notify } from "@/lib/notify";

const API = "/stn-eoc/api/officer/telegram";
const POLL_MS = 3000;
const POLL_LIMIT_MS = 3 * 60 * 1000;

async function call(method, body) {
  const response = await fetch(API, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.success) throw Object.assign(new Error(json.message || "ดำเนินการไม่สำเร็จ"), { code: json.code });
  return json;
}

export default function TelegramLinkCard({ className = "" }) {
  const [status, setStatus] = useState(null);
  const [link, setLink] = useState(null); // { url, expiresInMinutes }
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualChatId, setManualChatId] = useState("");
  const pollRef = useRef(null);
  const startedRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = null;
    setWaiting(false);
  }, []);

  useEffect(() => {
    call("GET").then((json) => setStatus(json.data)).catch(() => setStatus({ botReady: false, linked: false }));
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  const poll = useCallback(async () => {
    try {
      const json = await call("POST", { action: "check" });
      setStatus((current) => ({ ...current, ...json.data }));
      if (json.data.linked) {
        stopPolling();
        setLink(null);
        notify.success("เชื่อม Telegram สำเร็จ บอทส่งข้อความยืนยันไปให้แล้ว");
        return;
      }
    } catch (error) {
      if (error.code === "BOT_IN_USE") {
        stopPolling();
        notify.error(error.message);
        return;
      }
    }
    if (Date.now() - startedRef.current > POLL_LIMIT_MS) {
      stopPolling();
      notify.error("ยังไม่ได้รับการกด Start จาก Telegram — กด \"เปิด Telegram\" แล้วกด Start อีกครั้ง หรือขอลิงก์ใหม่");
      return;
    }
    pollRef.current = setTimeout(poll, POLL_MS);
  }, [stopPolling]);

  const startLink = async () => {
    setBusy(true);
    try {
      const json = await call("POST", { action: "link" });
      setLink(json.data);
      startedRef.current = Date.now();
      setWaiting(true);
      if (pollRef.current) clearTimeout(pollRef.current);
      pollRef.current = setTimeout(poll, POLL_MS);
    } catch (error) {
      notify.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const run = async (fn) => {
    setBusy(true);
    try {
      const json = await fn();
      if (json.data) setStatus((current) => ({ ...current, ...json.data }));
      if (json.message) notify.success(json.message);
    } catch (error) {
      notify.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const linked = Boolean(status?.linked);
  const on = linked && status?.telegramNotifyEnabled;
  const button = "inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold disabled:opacity-60";

  let body;
  if (!status) body = <p className="mt-3 text-sm text-slate-500">กำลังตรวจสอบ…</p>;
  else if (!status.botReady) body = <p className="mt-3 text-sm text-slate-600">ผู้ดูแลระบบยังไม่ได้ตั้งค่า Telegram Bot ของศูนย์</p>;
  else if (linked) body = (
    <div className="mt-4 space-y-3">
      <p className="flex items-center gap-2 text-sm text-slate-700"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />เชื่อมกับ Telegram แล้ว{status.botUsername ? <> ผ่านบอท <b>@{status.botUsername}</b></> : null}</p>
      <div className="flex flex-wrap gap-2">
        <label className={`${button} cursor-pointer border border-slate-300 bg-white text-slate-700`}>
          <input type="checkbox" className="h-4 w-4 accent-[#0b4c86]" checked={Boolean(status.telegramNotifyEnabled)} disabled={busy}
            onChange={(event) => run(() => call("PUT", { telegramNotifyEnabled: event.target.checked }))} />
          รับแจ้งเตือน
        </label>
        <button type="button" disabled={busy} onClick={() => run(() => call("POST", { action: "test" }))} className={`${button} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
          <Send className="h-4 w-4" aria-hidden="true" />ส่งข้อความทดสอบ
        </button>
        <button type="button" disabled={busy} onClick={() => run(() => call("POST", { action: "unlink" }))} className={`${button} border border-red-200 bg-white text-red-700 hover:bg-red-50`}>
          <Link2Off className="h-4 w-4" aria-hidden="true" />ยกเลิกการเชื่อม
        </button>
      </div>
    </div>
  );
  else body = (
    <div className="mt-4 space-y-3">
      {!link ? (
        <>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>กด &ldquo;เชื่อม Telegram&rdquo; แล้วกด &ldquo;เปิด Telegram&rdquo;</li>
            <li>ใน Telegram กดปุ่ม <b>Start</b> (เริ่ม) ที่หน้าบอท</li>
            <li>กลับมาหน้านี้ ระบบจะเชื่อมให้เองภายในไม่กี่วินาที</li>
          </ol>
          <button type="button" disabled={busy} onClick={startLink} className={`${button} bg-[#229ED9] text-white hover:bg-[#1c8bc0]`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}เชื่อม Telegram
          </button>
        </>
      ) : (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <a href={link.url} target="_blank" rel="noopener noreferrer" className={`${button} min-h-12 w-full justify-center bg-[#229ED9] text-base text-white hover:bg-[#1c8bc0] sm:w-auto`}>
            <Send className="h-5 w-5" aria-hidden="true" />เปิด Telegram แล้วกด Start
          </a>
          <p className="mt-3 flex items-center gap-2 text-sm text-sky-900" role="status">
            {waiting ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />รอการกด Start จาก Telegram… (ลิงก์ใช้ได้ {link.expiresInMinutes} นาที ใช้ได้ครั้งเดียว)</> : "หยุดรอแล้ว"}
          </p>
          {!waiting ? <button type="button" onClick={startLink} className="mt-2 text-sm font-bold text-[#0b4c86] underline-offset-4 hover:underline">ขอลิงก์ใหม่</button> : null}
        </div>
      )}
      <details className="text-sm text-slate-600">
        <summary className="cursor-pointer font-semibold">ขั้นสูง: ใส่ Chat ID เอง (เช่น ส่งเข้ากลุ่ม)</summary>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <input value={manualChatId} onChange={(event) => setManualChatId(event.target.value)} inputMode="numeric" placeholder="เช่น 123456789 หรือ -100…" className={`${inputClass} max-w-xs`} aria-label="Telegram Chat ID" />
          <button type="button" disabled={busy || !manualChatId.trim()} onClick={() => run(() => call("PUT", { telegramChatId: manualChatId.trim(), telegramNotifyEnabled: true }))} className={`${button} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>บันทึก</button>
        </div>
      </details>
    </div>
  );

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 ${className}`} aria-labelledby="tg-title">
      <h3 id="tg-title" className="flex flex-wrap items-center gap-2 font-black text-slate-900">
        <BellRing className="h-5 w-5 text-[#0b4c86]" aria-hidden="true" />รับแจ้งเตือนทาง Telegram
        {status ? (on ? <StatusPill tone="green">เปิดรับอยู่</StatusPill> : linked ? <StatusPill tone="amber">เชื่อมแล้ว ปิดรับอยู่</StatusPill> : <StatusPill tone="gray">ยังไม่เชื่อม</StatusPill>) : null}
      </h3>
      <p className="mt-1 text-sm text-slate-600">รับข้อความส่วนตัวเมื่อประชาชนส่งคำขอความช่วยเหลือ (แยกจากกลุ่มแจ้งเตือนของศูนย์)</p>
      {body}
    </section>
  );
}
