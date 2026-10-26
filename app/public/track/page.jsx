"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CircleCheck, Clock, MessageSquareText, Phone, RefreshCw, Search, X } from "lucide-react";
import PublicLayout from "@/components/layouts/PublicLayout";
import { forgetTrackingIdentity, loadTrackingIdentity, saveTrackingIdentity } from "@/lib/myReports";

const TONES = {
  amber: "bg-amber-100 text-amber-900 ring-amber-300",
  blue: "bg-sky-100 text-sky-900 ring-sky-300",
  green: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  red: "bg-red-100 text-red-900 ring-red-300"
};

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Stepper({ steps, step, rejected }) {
  return (
    <>
    <ol className="mt-4 grid grid-cols-4 gap-1" aria-label="ขั้นตอน">
      {steps.map((label, index) => {
        const reached = index + 1 <= step;
        const current = index + 1 === step;
        const color = rejected && current ? "bg-red-500" : "bg-[#0b4c86]";
        return (
          <li key={label} className="text-center" aria-current={current ? "step" : undefined}>
            <span className="block h-2 overflow-hidden rounded-full bg-slate-200">
              {reached ? <span className={`track-step__fill block h-full rounded-full ${color}`} style={{ animationDelay: `${index * 220}ms` }} /> : null}
            </span>
            <span className={`mt-1.5 block text-xs ${reached ? "font-bold text-slate-900" : "text-slate-500"}`}>
              {rejected && current ? "ปิดเรื่อง" : label}
            </span>
          </li>
        );
      })}
    </ol>
      <style>{`
        .track-step__fill { transform-origin: left; animation: track-step-fill .5s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes track-step-fill { from { transform: scaleX(0); } }
        @media (prefers-reduced-motion: reduce) { .track-step__fill { animation: none; } }
      `}</style>
    </>
  );
}

function ReportCard({ data }) {
  const isHelpRequest = data.type === "คำขอความช่วยเหลือ";
  const reportStatus = {
    pending: ["รับรายงานแล้ว", "ระบบได้รับรายงานแล้ว รอเจ้าหน้าที่ตรวจสอบข้อมูล"],
    reviewing: ["กำลังตรวจสอบ", "เจ้าหน้าที่กำลังตรวจสอบข้อมูลรายงาน"],
    verified: ["ตรวจสอบแล้ว", "เจ้าหน้าที่ตรวจสอบข้อมูลแล้ว และนำไปประกอบการติดตามสถานการณ์"],
    resolved: ["ตรวจสอบเสร็จแล้ว", "เจ้าหน้าที่ดำเนินการตรวจสอบรายงานนี้แล้ว"],
    rejected: ["ปิดรายงาน", "เจ้าหน้าที่ปิดรายงานนี้ เช่น ข้อมูลซ้ำหรือไม่สามารถตรวจสอบได้"]
  }[data.status] || [data.status_label, data.status_detail];
  const statusLabel = isHelpRequest ? data.status_label : reportStatus[0];
  const statusDetail = isHelpRequest ? data.status_detail : reportStatus[1];
  const steps = isHelpRequest ? data.steps : ["รับรายงาน", "ตรวจสอบ", "ยืนยันข้อมูล", "เสร็จสิ้น"];
  const accent = isHelpRequest
    ? "border-l-4 border-l-red-500"
    : "border-l-4 border-l-sky-500";
  const cardTitle = isHelpRequest ? "ติดตามคำขอช่วยเหลือ" : "ติดตามผลรายงาน";
  const cardDescription = isHelpRequest
    ? "เจ้าหน้าที่กำลังตรวจสอบและประสานความช่วยเหลือตามข้อมูลที่แจ้ง"
    : "รายงานนี้ใช้ประกอบการตรวจสอบสถานการณ์และปรับปรุงข้อมูลบนแผนที่";

  return (
    <section className={`rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5 ${accent}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={`mb-1 text-xs font-black uppercase tracking-wide ${isHelpRequest ? "text-red-700" : "text-sky-800"}`}>{cardTitle}</p>
          <h2 className="text-lg font-black text-slate-900">{data.type}{data.category ? `: ${data.category}` : ""}</h2>
          <p className="text-sm text-slate-600">
            แจ้งเมื่อ {formatDateTime(data.reported_at)}{data.area ? ` • ${data.area}` : ""}
          </p>
          {data.code && <p className="font-mono text-xs font-bold text-slate-400">อ้างอิง {data.code}</p>}
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-black ring-1 ${TONES[data.status_tone] || TONES.amber}`}>{statusLabel}</span>
      </div>

      <Stepper steps={steps} step={data.step} rejected={data.status === "rejected"} />
      <p className="mt-3 text-slate-700">{statusDetail}</p>
      <p className="mt-1 text-sm text-slate-500">{cardDescription}</p>

      {data.citizen_message && (
        <div className="mt-3 flex gap-2 rounded-xl bg-sky-50 p-3 text-slate-800">
          <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0 text-[#0b4c86]" aria-hidden="true" />
          <div>
            <p className="text-xs font-bold text-slate-500">ข้อความจากเจ้าหน้าที่</p>
            <p className="font-semibold">{data.citizen_message}</p>
          </div>
        </div>
      )}

      <details className="mt-4" open={data.timeline.length > 1}>
        <summary className="cursor-pointer text-sm font-black text-slate-700">ลำดับเหตุการณ์</summary>
        <ol className="mt-2 space-y-3 border-l-2 border-slate-200 pl-4">
          {data.timeline.map((item, index) => (
            <li key={`${item.status}-${item.at}-${index}`} className="relative">
              <span className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full bg-[#0b4c86] ring-4 ring-white" aria-hidden="true" />
              <p className="font-bold text-slate-900">{item.label}</p>
              <p className="flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3 w-3" aria-hidden="true" /> {formatDateTime(item.at)}</p>
              {item.message && <p className="mt-0.5 text-sm text-slate-700">“{item.message}”</p>}
            </li>
          ))}
        </ol>
      </details>
      {data.status === "resolved" ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700"><CircleCheck className="h-4 w-4" aria-hidden="true" /> {isHelpRequest ? "ปิดเรื่องแล้ว" : "ตรวจสอบรายงานแล้ว"}</p>
      ) : null}
    </section>
  );
}

const inputClass = "min-h-12 w-full rounded-xl border border-slate-300 px-3 text-lg font-semibold text-slate-900 outline-none focus:border-[#0b4c86] focus:ring-2 focus:ring-sky-200";

function TrackContent() {
  const [form, setForm] = useState({ firstName: "", lastName: "", phone4: "" });
  const [remembered, setRemembered] = useState(false);
  const [state, setState] = useState({ status: "idle", data: [], error: "" });

  const check = useCallback(async (identity) => {
    const firstName = identity.firstName.trim();
    const lastName = identity.lastName.trim();
    const phone4 = identity.phone4.replace(/\D/g, "");
    if (!firstName || !lastName) {
      setState({ status: "error", data: [], error: "กรอกชื่อและนามสกุลของผู้แจ้ง" });
      return;
    }
    if (phone4.length !== 4) {
      setState({ status: "error", data: [], error: "กรอกเบอร์โทร 4 ตัวท้ายที่ใช้ตอนแจ้ง" });
      return;
    }
    setState((current) => ({ ...current, status: "loading", error: "" }));
    try {
      const response = await fetch("/stn-eoc/api/public/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone4 })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.success) {
        setState({ status: "error", data: [], error: json.message || "ตรวจสอบไม่สำเร็จ กรุณาลองใหม่" });
        return;
      }
      saveTrackingIdentity({ firstName, lastName, phone4 });
      setRemembered(true);
      setState({ status: "done", data: json.data || [], error: "" });
    } catch {
      setState({ status: "error", data: [], error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่" });
    }
  }, []);

  // เคยแจ้งหรือเคยตรวจจากเครื่องนี้ → เติมให้และตรวจทันที
  useEffect(() => {
    const saved = loadTrackingIdentity();
    if (!saved) return;
    setForm(saved);
    setRemembered(true);
    check(saved);
  }, [check]);

  const set = (name) => (event) => {
    const value = name === "phone4" ? event.target.value.replace(/\D/g, "").slice(0, 4) : event.target.value;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const forget = () => {
    forgetTrackingIdentity();
    setRemembered(false);
    setForm({ firstName: "", lastName: "", phone4: "" });
    setState({ status: "idle", data: [], error: "" });
  };

  return (
    <div className="min-h-full bg-[#f4f8fc]">
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-5 md:py-8">
        <header>
          <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-4 md:p-5">
            <p className="text-sm font-black text-red-700">บริการประชาชน · ขอความช่วยเหลือ</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 md:text-3xl">ติดตามคำขอช่วยเหลือ</h1>
            <p className="mt-1 text-slate-700">ตรวจสอบว่าเจ้าหน้าที่รับเรื่อง ติดต่อกลับ หรือประสานทีมช่วยเหลือถึงขั้นไหนแล้ว</p>
          </div>
          <p className="mt-2 text-sm text-slate-500">ค้นหาได้ทั้งคำขอช่วยเหลือและรายงานสถานการณ์ที่ส่งผ่านเว็บไซต์ภายใน 90 วัน</p>
        </header>

        <form onSubmit={(event) => { event.preventDefault(); check(form); }} className="rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">ชื่อผู้แจ้ง</span>
              <input value={form.firstName} onChange={set("firstName")} autoComplete="given-name" className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">นามสกุล</span>
              <input value={form.lastName} onChange={set("lastName")} autoComplete="family-name" className={inputClass} />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">เบอร์โทร 4 ตัวท้าย</span>
              <input
                value={form.phone4}
                onChange={set("phone4")}
                inputMode="numeric"
                placeholder="1234"
                autoComplete="off"
                className={`${inputClass} max-w-[10rem] tracking-widest`}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">ใช้ชื่อ นามสกุล และเบอร์โทรเดียวกับที่กรอกตอนแจ้ง ข้อมูลนี้ใช้ค้นหาเรื่องของคุณเท่านั้น ศูนย์ไม่ได้บันทึกเก็บไว้ (<Link href="/privacy-policy" target="_blank" className="font-bold text-[#0b4c86] underline">นโยบายความเป็นส่วนตัว</Link>)</p>
          <button
            type="submit"
            disabled={state.status === "loading"}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0b4c86] px-4 font-bold text-white hover:bg-[#083865] disabled:opacity-60"
          >
            <Search className="h-5 w-5" aria-hidden="true" /> {state.status === "loading" ? "กำลังตรวจสอบ…" : "ดูสถานะ"}
          </button>
          {state.status === "error" && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="alert">{state.error}</p>}
          {remembered && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              เครื่องนี้จำข้อมูลสำหรับติดตามไว้
              <button type="button" onClick={forget} className="inline-flex items-center gap-0.5 font-bold text-slate-600 hover:text-slate-900">
                <X className="h-3.5 w-3.5" aria-hidden="true" /> ลบออกจากเครื่องนี้
              </button>
            </p>
          )}
        </form>

        {state.status === "done" && (
          <div className="space-y-3" aria-live="polite">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-slate-700">พบ {state.data.length} รายการ{state.data.some((item) => item.type === "คำขอความช่วยเหลือ") ? " · คำขอช่วยเหลือแสดงแยกให้เห็นชัดเจน" : ""}</p>
              <button
                type="button"
                onClick={() => check(form)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> ตรวจอีกครั้ง
              </button>
            </div>
            {state.data.map((item, index) => <ReportCard key={`${item.code || index}-${item.reported_at}`} data={item} />)}
          </div>
        )}

        <aside className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-bold">ถ้าสถานการณ์แย่ลง ไม่ต้องรอ โทรได้ทันที</p>
          <div className="mt-2 flex flex-wrap gap-2 font-bold">
            <a href="tel:1669" className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-white hover:bg-red-700"><Phone className="h-4 w-4" aria-hidden="true" /> 1669 เจ็บป่วยฉุกเฉิน</a>
            <a href="tel:1784" className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-red-800 hover:bg-red-100"><Phone className="h-4 w-4" aria-hidden="true" /> 1784 สาธารณภัย</a>
          </div>
        </aside>

        <p className="text-center text-sm text-slate-500">
          ยังไม่ได้แจ้งเรื่อง? <Link href="/public/report-incident" className="font-bold text-[#0b4c86] underline">ขอความช่วยเหลือ</Link>
        </p>
      </div>
    </div>
  );
}

export default function TrackPage() {
  return (
    <PublicLayout>
      <TrackContent />
    </PublicLayout>
  );
}
