"use client";

// ชวนรับแจ้งเตือนภัยตอนเข้าหน้าแรก (แผ่นล่างบนมือถือ / กล่องกลางจอบนคอม)
// เด้งเฉพาะเครื่องที่ยังไม่ได้รับ หลังหน้าโลโก้และ popup ประกาศปิดแล้ว · "ไว้ทีหลัง" = ถามใหม่ใน 3 วัน · "ไม่ต้องถามอีก" = 60 วัน
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellRing, CheckCircle2, ChevronDown, ExternalLink, X } from "lucide-react";
import { SATUN_DISTRICT_NAMES } from "@/lib/satunDistricts";
import { isAndroid, isInAppBrowser, isIos, isStandalone, pushStatus, subscribePush } from "@/lib/pwaClient";
import { promptMode, readPromptState, snooze } from "@/lib/alertPrompt";
import AlertGuide from "./AlertGuide";

const DELAY_MS = 3500;
const storage = () => { try { return window.localStorage; } catch { return null; } };

export default function AlertSubscribePrompt({ blocked = false, district = "" }) {
  const [mode, setMode] = useState(null);
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [android, setAndroid] = useState(false);
  const dialogRef = useRef(null);
  const myDistrict = SATUN_DISTRICT_NAMES.includes(district) ? district : "";

  // ตรวจสถานะเครื่องครั้งเดียวต่อการเปิดหน้า
  useEffect(() => {
    let active = true;
    const env = { ios: isIos(), standalone: isStandalone(), inApp: isInAppBrowser() };
    setAndroid(isAndroid());
    pushStatus()
      .catch(() => ({ supported: false }))
      .then((status) => { if (active) setMode(promptMode({ status, env, state: readPromptState(storage()) })); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!mode || blocked || open || done) return undefined;
    const timer = window.setTimeout(() => setOpen(true), DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [mode, blocked, open, done]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  const close = (reason = "later") => {
    if (!done) snooze(storage(), reason);
    setOpen(false);
    setMode(null);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === "Escape") close("later"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const subscribe = async () => {
    setBusy(true);
    setError("");
    try {
      await subscribePush(mine && myDistrict ? { scope: "areas", districts: [myDistrict], tambons: [] } : { scope: "all" });
      setDone(true);
    } catch (err) {
      setError(err.message || "เปิดรับแจ้งเตือนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  if (!open || !mode) return null;

  const title = done ? "รับแจ้งเตือนภัยแล้ว" : mode === "open-browser" ? "เปิดในเบราว์เซอร์เพื่อรับแจ้งเตือน" : "รับแจ้งเตือนภัยบนมือถือ";

  return (
    <div className="fixed inset-0 z-[2050] flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onClick={(event) => { if (event.target === event.currentTarget) close("later"); }}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-prompt-title"
        className="alert-prompt max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl outline-none sm:max-w-lg sm:rounded-3xl sm:p-6"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-start gap-3">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${done ? "bg-emerald-500 text-white" : "bg-[#fde68a] text-[#7c2d12]"}`}>
            {done ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> : <BellRing className="h-6 w-6" aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="alert-prompt-title" className="font-[family-name:var(--font-kanit)] text-xl font-semibold leading-snug text-[#0c2f4a]">{title}</h2>
            <p className="mt-1 text-[15px] leading-6 text-slate-600">
              {done
                ? "เมื่อมีน้ำล้นตลิ่ง ฝนตกหนักมาก หรือประกาศสำคัญ เครื่องนี้จะเด้งแจ้งเตือนทันที แม้ปิดเว็บอยู่"
                : "เด้งเตือนทันทีเมื่อมีน้ำล้นตลิ่ง ฝนตกหนักมาก หรือประกาศอพยพ ฟรี ไม่ต้องสมัครสมาชิก ไม่เก็บชื่อหรือเบอร์โทร"}
            </p>
          </div>
          <button type="button" onClick={() => close("later")} className="-mr-1 -mt-1 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="ปิด">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {done ? (
          <div className="mt-4">
            <p className="rounded-2xl bg-[#f3f8fa] p-4 text-[15px] leading-6 text-slate-700">
              ขั้นสุดท้าย: ตรวจว่าแจ้งเตือนของเว็บนี้ <b>มีเสียง</b> {android ? "(การตั้งค่า › แอป › Chrome › การแจ้งเตือน › ส่งเสียงเตือน)" : "(การตั้งค่า › การแจ้งเตือน › เปิดเสียง)"} และไม่ได้เปิดโหมดห้ามรบกวน
            </p>
            <button type="button" onClick={() => close("never")} className="mt-4 min-h-12 w-full rounded-xl bg-[#0b4c86] px-4 font-bold text-white hover:bg-[#083865]">เรียบร้อย</button>
          </div>
        ) : mode === "open-browser" ? (
          <div className="mt-4 space-y-3 text-[15px] leading-6 text-slate-700">
            <p className="rounded-2xl bg-amber-50 p-4 text-amber-950">คุณเปิดเว็บนี้จากในแอป (เช่น LINE หรือ Facebook) ซึ่งรับแจ้งเตือนไม่ได้</p>
            <ol className="space-y-1.5">
              <li className="flex gap-2"><b>1.</b><span>กดปุ่ม <b>⋯</b> หรือ <b>⋮</b> มุมขวาบน</span></li>
              <li className="flex gap-2"><b>2.</b><span>เลือก <b>เปิดในเบราว์เซอร์</b> (Chrome หรือ Safari)</span></li>
              <li className="flex gap-2"><b>3.</b><span>กด <b>รับแจ้งเตือนภัย</b> เมื่อหน้านี้ถามอีกครั้ง</span></li>
            </ol>
            <button type="button" onClick={() => close("later")} className="min-h-12 w-full rounded-xl bg-slate-100 px-4 font-semibold text-slate-700 hover:bg-slate-200">เข้าใจแล้ว</button>
          </div>
        ) : mode === "ios-install" ? (
          <div className="mt-4">
            <p className="text-[15px] leading-6 text-slate-700">iPhone รับแจ้งเตือนได้เมื่อเพิ่มเว็บนี้ไว้ที่หน้าจอโฮม ใช้เวลาไม่ถึง 1 นาที</p>
            <AlertGuide only="ios" compact className="mt-3" />
            <button type="button" onClick={() => close("later")} className="mt-4 min-h-12 w-full rounded-xl bg-[#0b4c86] px-4 font-bold text-white hover:bg-[#083865]">เข้าใจแล้ว</button>
          </div>
        ) : (
          <div className="mt-4">
            {myDistrict ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="รับเตือนของ">
                <button type="button" aria-pressed={!mine} onClick={() => setMine(false)} className={`min-h-10 rounded-full px-4 text-sm font-semibold ring-1 ${!mine ? "bg-[#0b4c86] text-white ring-[#0b4c86]" : "ring-slate-300 text-slate-700"}`}>ทั้งจังหวัด</button>
                <button type="button" aria-pressed={mine} onClick={() => setMine(true)} className={`min-h-10 rounded-full px-4 text-sm font-semibold ring-1 ${mine ? "bg-[#0b4c86] text-white ring-[#0b4c86]" : "ring-slate-300 text-slate-700"}`}>เฉพาะ อ.{myDistrict}</button>
              </div>
            ) : null}
            <button type="button" onClick={subscribe} disabled={busy} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0b4c86] px-4 text-[1.05rem] font-bold text-white hover:bg-[#083865] disabled:opacity-60">
              <BellRing className="h-5 w-5" aria-hidden="true" />{busy ? "กำลังเปิด…" : "รับแจ้งเตือนภัย"}
            </button>
            <p className="mt-2 text-center text-sm text-slate-500">เบราว์เซอร์จะถาม ให้กด <b>อนุญาต</b></p>
            {error ? <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}

            <button type="button" onClick={() => setShowGuide((value) => !value)} aria-expanded={showGuide} className="mt-4 inline-flex items-center gap-1 text-[15px] font-semibold text-[#0b4c86]">
              วิธีรับแจ้งเตือนและเปิดเสียง <ChevronDown className={`h-4 w-4 transition-transform ${showGuide ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {showGuide ? <AlertGuide only={android ? "android" : null} compact={false} className="mt-3" /> : null}

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm">
              <button type="button" onClick={() => close("later")} className="rounded-lg px-2 py-2 font-semibold text-slate-600 hover:bg-slate-100">ไว้ทีหลัง</button>
              <button type="button" onClick={() => close("never")} className="rounded-lg px-2 py-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">ไม่ต้องถามอีก</button>
            </div>
          </div>
        )}
        <p className="mt-3 text-center text-xs text-slate-400">
          <Link href="/public/alerts#how-to" className="inline-flex items-center gap-1 hover:underline">คู่มือรับแจ้งเตือนฉบับเต็ม <ExternalLink className="h-3 w-3" aria-hidden="true" /></Link>
        </p>
      </div>
      <style>{`
        .alert-prompt { animation: alert-prompt-in .32s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes alert-prompt-in { from { transform: translateY(24px); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .alert-prompt { animation: none; } }
      `}</style>
    </div>
  );
}
