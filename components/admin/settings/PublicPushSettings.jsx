"use client";

// แจ้งเตือนภัยถึงประชาชน (Web Push): ยอดผู้รับ เปิด/ปิดการส่งอัตโนมัติ ส่งข้อความเอง และประวัติการส่ง
import { useCallback, useEffect, useState } from "react";
import { BellRing, RefreshCw, Send, Smartphone } from "lucide-react";
import { Button, Field, StatusPill, inputClass, useNotice } from "@/components/admin/crud";
import AppDialog, { AppDialogActions, AppDialogCancel } from "@/components/ui/app-dialog";
import { apiRequest, formatDateTime, formatNumber } from "@/lib/adminApi";
import { SATUN_DISTRICT_NAMES } from "@/lib/satunDistricts";
import { pushStatus, subscribePush } from "@/lib/pwaClient";

const API = "/stn-eoc/api/admin/public-push";
const KIND = { auto: ["อัตโนมัติ", "blue"], manual: ["เจ้าหน้าที่ส่ง", "amber"], test: ["ทดสอบ", "gray"] };
const kindOf = (row) => (row.audience === "officer" ? ["ถึงเจ้าหน้าที่", "red"] : KIND[row.kind] || [row.kind, "gray"]);
const EMPTY = { title: "", body: "", url: "/stn-eoc/", districts: [], level: "info" };

export default function PublicPushSettings() {
  const { notice, success, fail } = useNotice();
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [form, setForm] = useState(EMPTY);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState(null);

  const load = useCallback(async () => {
    try {
      const json = await apiRequest(API);
      setState({ loading: false, data: json.data, error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, []);
  useEffect(() => {
    load();
    pushStatus().then(setDevice).catch(() => setDevice({ supported: false }));
  }, [load]);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      fail(error.message);
    } finally {
      setBusy(false);
    }
  };
  const toggleAuto = () => run(async () => {
    const json = await apiRequest(API, { method: "PUT", body: { auto_enabled: !state.data.settings.auto_enabled } });
    success(json.data.auto_enabled ? "เปิดส่งเตือนภัยอัตโนมัติแล้ว" : "ปิดส่งเตือนภัยอัตโนมัติแล้ว");
    await load();
  });
  const checkNow = () => run(async () => {
    const json = await apiRequest(API, { method: "POST", body: { action: "run" } });
    success(json.message);
    await load();
  });
  const sendTest = () => run(async () => {
    let endpoint = device?.endpoint;
    if (!device?.subscribed) endpoint = await subscribePush({ scope: "all" });
    setDevice(await pushStatus());
    const body = form.title && form.body ? form : { ...EMPTY, title: "ทดสอบแจ้งเตือน", body: "ข้อความทดสอบจากระบบ Satun Geo-EOC ถึงเครื่องนี้เท่านั้น" };
    const json = await apiRequest(API, { method: "POST", body: { ...body, action: "test", endpoint } });
    success(json.message);
    await load();
  });
  const broadcast = () => run(async () => {
    const json = await apiRequest(API, { method: "POST", body: { ...form, action: "broadcast" } });
    success(json.message);
    setConfirm(false);
    setForm(EMPTY);
    await load();
  });

  if (state.error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}</p>;
  if (state.loading) return <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">กำลังโหลด…</p>;
  const { vapid_ready: vapidReady, table_ready: tableReady, settings, stats } = state.data;
  const ready = vapidReady && tableReady;
  const target = form.districts.length ? form.districts.map((d) => `อ.${d}`).join(", ") : "ทุกคนที่สมัครไว้";
  const recipients = !stats ? 0 : form.districts.length
    ? stats.whole_province + form.districts.reduce((s, d) => s + (stats.by_district[d] || 0), 0)
    : stats.total;

  return (
    <div className="space-y-4">
      {notice}
      {!ready ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-black">ยังส่งแจ้งเตือนไม่ได้</p>
          <ul className="mt-1 list-disc pl-5">
            {!vapidReady ? <li>ใส่ VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT ใน .env ของเซิร์ฟเวอร์ (สร้างด้วย <code>npm run push:vapid</code>) แล้วเริ่มระบบใหม่</li> : null}
            {!tableReady ? <li>รัน migration <code>20261010_public_push.sql</code></li> : null}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">เครื่องที่รับแจ้งเตือน</p>
          <p className="text-3xl font-black tabular-nums text-slate-900">{formatNumber(stats?.total || 0)}</p>
          <p className="text-xs text-slate-500">ทั้งจังหวัด {formatNumber(stats?.whole_province || 0)} เครื่อง</p>
          {stats?.officers ? <p className="mt-1 text-xs text-slate-500">เจ้าหน้าที่รับแจ้งคำขอช่วยเหลือ {formatNumber(stats.officers.officers)} คน ({formatNumber(stats.officers.devices)} เครื่อง)</p> : null}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2">
          <p className="text-xs text-slate-500">เลือกเฉพาะพื้นที่ (รายอำเภอ)</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SATUN_DISTRICT_NAMES.map((d) => <span key={d} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">อ.{d} <b className="tabular-nums">{formatNumber(stats?.by_district?.[d] || 0)}</b></span>)}
          </div>
        </div>
      </section>

      <section className={`rounded-xl border p-5 ${settings.auto_enabled ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${settings.auto_enabled ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}><BellRing className="h-6 w-6" aria-hidden="true" /></span>
            <div>
              <p className="text-base font-black text-slate-900">ส่งเตือนภัยอัตโนมัติ: {settings.auto_enabled ? "เปิด" : "ปิด"}</p>
              <p className="text-xs leading-5 text-slate-600">
                ตรวจทุก 5 นาที เมื่อมีประกาศเตือนระดับสูง (น้ำล้นตลิ่ง ฝนตกหนักมาก ประกาศ สสน.) จะส่งถึงผู้ที่สมัครในอำเภอนั้น
                เรื่องเดียวกันส่งวันละครั้ง ถ้ามีหลายเรื่องพร้อมกันรวมเป็นแจ้งเตือนเดียว
              </p>
              {settings.updated_at ? <p className="text-xs text-slate-500">เปลี่ยนล่าสุด {formatDateTime(settings.updated_at)}{settings.updated_by_name ? ` โดย ${settings.updated_by_name}` : ""}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy || !ready} onClick={checkNow}><RefreshCw className="h-4 w-4" aria-hidden="true" />ตรวจและส่งตอนนี้</Button>
            <Button disabled={busy || !ready} onClick={toggleAuto} className={settings.auto_enabled ? "bg-slate-600 hover:bg-slate-700" : ""}>{settings.auto_enabled ? "ปิดการส่งอัตโนมัติ" : "เปิดการส่งอัตโนมัติ"}</Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-black text-slate-900">ส่งข้อความถึงประชาชน</h3>
        <p className="mt-0.5 text-xs text-slate-500">ใช้กับเรื่องสำคัญเท่านั้น เช่น ประกาศอพยพ เปิดศูนย์พักพิง — ส่งบ่อยเกินไปคนจะปิดการแจ้งเตือน</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="หัวข้อ" required hint="ไม่เกิน 100 ตัวอักษร เห็นเป็นตัวหนาบนจอมือถือ">
            <input className={inputClass} maxLength={100} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="เช่น ประกาศอพยพ ต.ฉลุง" />
          </Field>
          <Field label="เปิดหน้า (เมื่อกดแจ้งเตือน)" hint="หน้าในระบบนี้ เช่น /stn-eoc/public/shelters/">
            <input className={inputClass} value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
          </Field>
          <Field label="ข้อความ" required wide hint="ไม่เกิน 400 ตัวอักษร บอกว่าเกิดอะไร ที่ไหน และต้องทำอะไร">
            <textarea rows={3} maxLength={400} className={inputClass} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-1 text-sm font-bold text-slate-800">ส่งถึง</p>
            <div className="flex flex-wrap gap-1.5">
              {SATUN_DISTRICT_NAMES.map((d) => {
                const on = form.districts.includes(d);
                return <button key={d} type="button" aria-pressed={on} onClick={() => setForm((f) => ({ ...f, districts: on ? f.districts.filter((x) => x !== d) : [...f.districts, d] }))} className={`min-h-9 rounded-full px-3 text-sm ${on ? "bg-[#0b4c86] font-semibold text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>อ.{d}</button>;
              })}
            </div>
            <p className="mt-1 text-xs text-slate-500">ไม่เลือก = ทุกคน • ผู้ที่สมัครรับ &quot;ทั้งจังหวัด&quot; ได้รับทุกข้อความ</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" checked={form.level === "high"} onChange={(e) => setForm((f) => ({ ...f, level: e.target.checked ? "high" : "info" }))} />
            เรื่องเร่งด่วน (แจ้งเตือนค้างบนจอจนกว่าจะกด และสั่นแรง)
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button disabled={busy || !ready || form.title.trim().length < 4 || form.body.trim().length < 8} onClick={() => setConfirm(true)}><Send className="h-4 w-4" aria-hidden="true" />ส่งถึงประชาชน</Button>
          <Button variant="secondary" disabled={busy || !ready || !device?.supported || device?.permission === "denied"} onClick={sendTest}><Smartphone className="h-4 w-4" aria-hidden="true" />ทดสอบส่งถึงเครื่องนี้</Button>
          {device && !device.supported ? <span className="text-xs text-slate-500">เบราว์เซอร์นี้รับแจ้งเตือนไม่ได้</span> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <h3 className="border-b border-slate-100 px-5 py-3 text-base font-black text-slate-900">ประวัติการส่ง (20 ครั้งล่าสุด)</h3>
        {stats?.log?.length ? (
          <ul className="divide-y divide-slate-100">
            {stats.log.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                <StatusPill tone={kindOf(row)[1]}>{kindOf(row)[0]}</StatusPill>
                <span className="min-w-0 flex-1"><b>{row.title}</b> <span className="text-slate-600">— {row.body}</span></span>
                <span className="shrink-0 text-xs text-slate-500">{formatDateTime(row.created_at)} • ถึง {formatNumber(row.delivered)}/{formatNumber(row.recipients)} เครื่อง{row.removed ? ` • ลบเครื่องที่เลิกใช้ ${row.removed}` : ""}</span>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-4 text-sm text-slate-500">ยังไม่เคยส่ง</p>}
      </section>

      <AppDialog open={confirm} onOpenChange={(open) => !open && setConfirm(false)} title="ยืนยันส่งแจ้งเตือนถึงประชาชน"
        description={`"${form.title}" จะเด้งบนมือถือของ${target} (ประมาณ ${formatNumber(recipients)} เครื่อง) ทันที และยกเลิกไม่ได้`} busy={busy}>
        <AppDialogActions className="mt-4">
          <AppDialogCancel disabled={busy} />
          <Button disabled={busy} onClick={broadcast}>{busy ? "กำลังส่ง…" : "ส่งเลย"}</Button>
        </AppDialogActions>
      </AppDialog>
    </div>
  );
}
