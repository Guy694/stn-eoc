"use client";

// เปิด/ปิดแจ้งเตือนคำขอความช่วยเหลือเข้ามือถือ "เครื่องนี้" (Web Push) — ใช้ในหน้าโปรไฟล์
import { useCallback, useEffect, useState } from "react";
import { BellOff, BellRing, Smartphone, Volume2 } from "lucide-react";
import { playAlert, showSystemAlert, unlockAlertAudio } from "@/lib/alertSound";
import { StatusPill } from "@/components/admin/crud";
import { notify } from "@/lib/notify";
import { isIos, isStandalone, officerPushStatus, subscribeOfficerPush, unsubscribeOfficerPush } from "@/lib/pwaClient";

export default function OfficerPushCard({ className = "" }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);

  const refresh = useCallback(() => officerPushStatus().then(setStatus).catch(() => setStatus({ supported: false })), []);
  useEffect(() => {
    setIosNeedsInstall(isIos() && !isStandalone());
    refresh();
  }, [refresh]);

  const run = async (fn, done) => {
    setBusy(true);
    try {
      await fn();
      notify.success(done);
      await refresh();
    } catch (error) {
      notify.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  // ทดสอบบนเครื่องนี้: สัญญาณเสียงในหน้าเว็บ + แจ้งเตือนของระบบ (เสียง/สั่นตามการตั้งค่าเครื่อง)
  const testAlert = async () => {
    await unlockAlertAudio();
    const sounded = await playAlert("critical");
    const shown = await showSystemAlert("🔔 ทดสอบแจ้งเตือน Satun Geo-EOC", {
      body: "ถ้าได้ยินเสียงและเห็นข้อความนี้ แปลว่าเครื่องนี้พร้อมรับแจ้งเตือนคำขอความช่วยเหลือ",
      tag: "stn-test-alert", renotify: true, data: { url: "/stn-eoc/profile/" }
    });
    if (sounded) notify.success("เล่นเสียงในหน้าเว็บแล้ว");
    else notify.warning("เครื่องยังไม่อนุญาตให้เล่นเสียง ลองเปิดเสียงเครื่องแล้วกดอีกครั้ง");
    if (shown) notify.info("ส่งแจ้งเตือนของระบบแล้ว ถ้าเด้งแต่ไม่มีเสียง ให้เปิดเสียงของแอปในการตั้งค่าการแจ้งเตือนของเครื่อง");
    else notify.warning("ยังแสดงแจ้งเตือนของระบบไม่ได้ (ต้องเปิดแจ้งเตือนบนเครื่องนี้ก่อน)");
  };

  const on = Boolean(status?.subscribed);
  let body;
  if (!status) body = <p className="mt-3 text-sm text-slate-500">กำลังตรวจเครื่องนี้…</p>;
  else if (iosNeedsInstall) body = <p className="mt-3 text-sm text-slate-600">iPhone/iPad: กดปุ่มแชร์ใน Safari › &ldquo;เพิ่มไปยังหน้าจอโฮม&rdquo; แล้วเปิดระบบจากไอคอน จึงจะเปิดแจ้งเตือนได้</p>;
  else if (!status.supported) body = <p className="mt-3 text-sm text-slate-600">เบราว์เซอร์นี้รับแจ้งเตือนไม่ได้ ลองใช้ Chrome หรือ Safari รุ่นใหม่</p>;
  else if (!status.enabled) body = <p className="mt-3 text-sm text-slate-600">ผู้ดูแลระบบยังไม่ได้ตั้งค่าระบบแจ้งเตือน (VAPID)</p>;
  else if (status.permission === "denied") body = <p className="mt-3 text-sm text-slate-600">เครื่องนี้ปิดการแจ้งเตือนของเว็บไว้ เปิดได้ที่การตั้งค่าเบราว์เซอร์ › การแจ้งเตือน แล้วกลับมากดอีกครั้ง</p>;
  else body = (
    <div className="mt-4 flex flex-wrap gap-2">
      {on
        ? <button type="button" disabled={busy} onClick={() => run(unsubscribeOfficerPush, "ปิดแจ้งเตือนงานบนเครื่องนี้แล้ว")} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><BellOff className="h-4 w-4" aria-hidden="true" />ปิดบนเครื่องนี้</button>
        : <button type="button" disabled={busy} onClick={() => run(subscribeOfficerPush, "เปิดแล้ว เครื่องนี้จะเด้งเตือนเมื่อมีคำขอความช่วยเหลือ")} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0b4c86] px-4 text-sm font-bold text-white hover:bg-[#083865] disabled:opacity-60"><BellRing className="h-4 w-4" aria-hidden="true" />{busy ? "กำลังเปิด…" : "เปิดบนเครื่องนี้"}</button>}
      <button type="button" onClick={testAlert} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"><Volume2 className="h-4 w-4" aria-hidden="true" />ทดสอบเสียงแจ้งเตือน</button>
    </div>
  );

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 ${className}`} aria-labelledby="officer-push-title">
      <h3 id="officer-push-title" className="flex flex-wrap items-center gap-2 font-black text-slate-900">
        <Smartphone className="h-5 w-5 text-[#0b4c86]" aria-hidden="true" />แจ้งเตือนเข้ามือถือ (ไม่ต้องใช้ Telegram)
        {status ? (on ? <StatusPill tone="green">เครื่องนี้เปิดอยู่</StatusPill> : <StatusPill tone="gray">เครื่องนี้ยังไม่เปิด</StatusPill>) : null}
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        เด้งเตือนทันทีเมื่อประชาชนส่งคำขอความช่วยเหลือ และเตือนซ้ำทุก 30 นาทีถ้ายังไม่มีใครรับเรื่อง — ตั้งค่าแยกแต่ละเครื่อง (มือถือ/คอมพิวเตอร์)
      </p>
      {body}
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        เสียงของแจ้งเตือนที่เด้งตอนปิดแอปมาจากการตั้งค่าเครื่อง: iPhone ต้องติดตั้งจากปุ่มแชร์ › เพิ่มไปยังหน้าจอโฮม (iOS 16.4 ขึ้นไป) แล้วเปิด การตั้งค่า › การแจ้งเตือน › สตูล EOC › เสียง · Android เปิดเสียงที่ การตั้งค่า › แอป › Chrome (หรือแอปที่ติดตั้ง) › การแจ้งเตือน · ปิดโหมดเงียบ/โฟกัส
      </p>
    </section>
  );
}
