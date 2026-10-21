"use client";

// แจ้งเตือนภัยถึงประชาชน (Web Push): ยอดผู้รับ เปิด/ปิดการส่งอัตโนมัติ ส่งข้อความเอง และประวัติการส่ง
import { useCallback, useEffect, useState } from "react";
import { BellRing, RefreshCw, Send, Smartphone, Trash2 } from "lucide-react";
import { Button, Field, StatusPill, inputClass, useNotice } from "@/components/admin/crud";
import AppDialog, { AppDialogActions, AppDialogCancel } from "@/components/ui/app-dialog";
import PaginationControls from "@/components/common/PaginationControls";
import { apiRequest, formatDateTime, formatNumber } from "@/lib/adminApi";
import { SATUN_DISTRICT_NAMES } from "@/lib/satunDistricts";
import { AUTO_LEVELS, PUSH_TEMPLATES, fillTemplate, unfilledPlaceholders } from "@/lib/pushTemplates";
import { pushStatus, subscribePush } from "@/lib/pwaClient";

const API = "/stn-eoc/api/admin/public-push";
const KIND = { auto: ["อัตโนมัติ", "blue"], manual: ["เจ้าหน้าที่ส่ง", "amber"], test: ["ทดสอบ", "gray"] };
const kindOf = (row) => (row.audience === "officer" ? ["ถึงเจ้าหน้าที่", "red"] : KIND[row.kind] || [row.kind, "gray"]);
const EMPTY = { title: "", body: "", url: "/stn-eoc/", districts: [], level: "info", audience: "public" };

export default function PublicPushSettings() {
  const { notice, success, fail } = useNotice();
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [form, setForm] = useState(EMPTY);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState(null);
  const [removing, setRemoving] = useState(null); // { ids, label }

  const [logPage, setLogPage] = useState({ page: 1, size: 20 });

  const load = useCallback(async () => {
    try {
      const json = await apiRequest(`${API}?log_page=${logPage.page}&log_size=${logPage.size}`);
      // ลบรายการหมดหน้าสุดท้ายแล้ว → ถอยไปหน้าที่ยังมีข้อมูล
      const lastPage = Math.max(1, Math.ceil((json.data?.stats?.log_total || 0) / logPage.size));
      if (logPage.page > lastPage) {
        setLogPage((value) => ({ ...value, page: lastPage }));
        return;
      }
      setState({ loading: false, data: json.data, error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [logPage]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    pushStatus().then(setDevice).catch(() => setDevice({ supported: false }));
  }, []);

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
  const setLevel = (level) => run(async () => {
    if (level === state.data.settings.auto_level) return;
    const json = await apiRequest(API, { method: "PUT", body: { auto_level: level } });
    success(`ส่งอัตโนมัติ: ${AUTO_LEVELS[json.data.auto_level].label}`);
    await load();
  });
  const applyTemplate = (template) => setForm((f) => ({ ...fillTemplate(template, f.districts), districts: f.districts, audience: f.audience }));
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
  const removeLog = () => run(async () => {
    const json = await apiRequest(API, { method: "DELETE", body: { ids: removing.ids } });
    success(json.message);
    setRemoving(null);
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
  const pending = unfilledPlaceholders(`${form.title} ${form.body}`);
  const toOfficers = form.audience === "officers";
  const testIds = (stats?.log || []).filter((row) => row.kind === "test" || /\[ทดสอบ\]|^ทดสอบ/.test(row.title || "")).map((row) => row.id);
  const target = toOfficers ? "เจ้าหน้าที่เท่านั้น" : form.districts.length ? form.districts.map((d) => `อ.${d}`).join(", ") : "ทุกคนที่สมัครไว้";
  const recipients = !stats ? 0 : toOfficers ? (stats.officers?.devices || 0) : form.districts.length
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
              <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="ระดับที่ส่งอัตโนมัติ">
                {Object.entries(AUTO_LEVELS).map(([key, item]) => {
                  const on = (settings.auto_level || "high") === key;
                  return (
                    <button key={key} type="button" role="radio" aria-checked={on} disabled={busy || !ready} onClick={() => setLevel(key)}
                      className={`max-w-xs rounded-xl px-3 py-2 text-left ring-1 transition disabled:opacity-60 ${on ? "bg-white ring-2 ring-[#0b4c86]" : "bg-white/60 ring-slate-200 hover:ring-slate-300"}`}>
                      <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><span className={`h-3 w-3 rounded-full ring-2 ${on ? "bg-[#0b4c86] ring-[#0b4c86]/30" : "bg-white ring-slate-300"}`} aria-hidden="true" />{item.label}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-600">{item.detail}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-600">เมื่อน้ำลดลงต่ำกว่าตลิ่ง ระบบแจ้ง &quot;น้ำลดแล้ว&quot; ถึงผู้ที่สมัครในอำเภอนั้นอัตโนมัติ (แบบไม่เร่งด่วน)</p>
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
        <h3 className="text-base font-black text-slate-900">ส่งข้อความแจ้งเตือน</h3>
        <p className="mt-0.5 text-xs text-slate-500">ใช้กับเรื่องสำคัญเท่านั้น เช่น ประกาศอพยพ เปิดศูนย์พักพิง — ส่งบ่อยเกินไปคนจะปิดการแจ้งเตือน</p>
        <div className="mt-3">
          <p className="text-sm font-bold text-slate-800">ข้อความสำเร็จรูป</p>
          <p className="text-xs text-slate-500">เลือกอำเภอใน &quot;ส่งถึง&quot; ก่อน ระบบจะใส่ชื่ออำเภอให้ แล้วแก้ส่วนในวงเล็บ [ ] ให้ตรงพื้นที่จริง</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PUSH_TEMPLATES.map((template) => (
              <button key={template.key} type="button" onClick={() => applyTemplate(template)}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold ring-1 ${template.tone}`}>
                <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />{template.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
            <div className="mb-2 inline-flex rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="กลุ่มผู้รับ">
              {[["public", "ประชาชน"], ["officers", "เจ้าหน้าที่เท่านั้น"]].map(([key, label]) => {
                const on = form.audience === key;
                return <button key={key} type="button" role="radio" aria-checked={on} onClick={() => setForm((f) => ({ ...f, audience: key }))} className={`min-h-9 rounded-lg px-4 text-sm font-semibold transition ${on ? "bg-white text-[#0b4c86] shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>{label}</button>;
              })}
            </div>
            {toOfficers ? (
              <p className="text-xs text-slate-500">ส่งถึงเครื่องของเจ้าหน้าที่ที่เปิด “แจ้งเตือนเข้ามือถือ” ในหน้าโปรไฟล์ ({formatNumber(stats?.officers?.devices || 0)} เครื่อง จาก {formatNumber(stats?.officers?.officers || 0)} คน) — ประชาชนไม่เห็น และไม่แสดงในหน้าแจ้งเตือนย้อนหลังของประชาชน</p>
            ) : (
            <>
            <div className="flex flex-wrap gap-1.5">
              {SATUN_DISTRICT_NAMES.map((d) => {
                const on = form.districts.includes(d);
                return <button key={d} type="button" aria-pressed={on} onClick={() => setForm((f) => ({ ...f, districts: on ? f.districts.filter((x) => x !== d) : [...f.districts, d] }))} className={`min-h-9 rounded-full px-3 text-sm ${on ? "bg-[#0b4c86] font-semibold text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>อ.{d}</button>;
              })}
            </div>
            <p className="mt-1 text-xs text-slate-500">ไม่เลือก = ทุกคน • ผู้ที่สมัครรับ &quot;ทั้งจังหวัด&quot; ได้รับทุกข้อความ</p>
            </>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" checked={form.level === "high"} onChange={(e) => setForm((f) => ({ ...f, level: e.target.checked ? "high" : "info" }))} />
            เรื่องเร่งด่วน (แจ้งเตือนค้างบนจอจนกว่าจะกด และสั่นแรง)
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {pending.length ? <p className="w-full rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" role="status">ยังมีส่วนที่ต้องแก้: {pending.join(" ")} — แก้ให้เป็นข้อมูลจริงก่อนส่ง</p> : null}
          <Button disabled={busy || !ready || pending.length > 0 || form.title.trim().length < 4 || form.body.trim().length < 8} onClick={() => setConfirm(true)}><Send className="h-4 w-4" aria-hidden="true" />{toOfficers ? "ส่งถึงเจ้าหน้าที่" : "ส่งถึงประชาชน"}</Button>
          <Button variant="secondary" disabled={busy || !ready || !device?.supported || device?.permission === "denied"} onClick={sendTest}><Smartphone className="h-4 w-4" aria-hidden="true" />ทดสอบส่งถึงเครื่องนี้</Button>
          {device && !device.supported ? <span className="text-xs text-slate-500">เบราว์เซอร์นี้รับแจ้งเตือนไม่ได้</span> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <h3 className="text-base font-black text-slate-900">ประวัติการส่ง{stats?.log_total ? <span className="ml-1.5 text-sm font-semibold text-slate-500">ทั้งหมด {formatNumber(stats.log_total)} ครั้ง</span> : null}</h3>
          {testIds.length ? (
            <button type="button" disabled={busy} onClick={() => setRemoving({ ids: testIds, label: `รายการทดสอบในหน้านี้ ${testIds.length} รายการ` })}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              <Trash2 className="h-4 w-4" aria-hidden="true" />ลบรายการทดสอบ ({testIds.length})
            </button>
          ) : null}
        </div>
        {stats?.log?.length ? (
          <ul className="divide-y divide-slate-100">
            {stats.log.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                <StatusPill tone={kindOf(row)[1]}>{kindOf(row)[0]}</StatusPill>
                <span className="min-w-0 flex-1"><b>{row.title}</b> <span className="text-slate-600">— {row.body}</span></span>
                <span className="shrink-0 text-xs text-slate-500">{formatDateTime(row.created_at)} • ถึง {formatNumber(row.delivered)}/{formatNumber(row.recipients)} เครื่อง{row.removed ? ` • ลบเครื่องที่เลิกใช้ ${row.removed}` : ""}</span>
                <button type="button" disabled={busy} onClick={() => setRemoving({ ids: [row.id], label: `"${row.title}"` })} aria-label={`ลบ "${row.title}" ออกจากประวัติ`} title="ลบออกจากประวัติ"
                  className="-my-1 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-4 text-sm text-slate-500">ยังไม่เคยส่ง</p>}
        <PaginationControls
          page={stats?.log_page || logPage.page}
          pageSize={logPage.size}
          totalItems={stats?.log_total || 0}
          pageSizeOptions={[10, 20, 50]}
          itemLabel="ครั้ง"
          className="rounded-b-2xl border-t border-slate-100 bg-slate-50"
          onPageChange={(page) => setLogPage((value) => ({ ...value, page }))}
          onPageSizeChange={(size) => setLogPage({ page: 1, size })}
        />
      </section>

      <AppDialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)} title="ลบออกจากประวัติการส่ง"
        description={`ลบ ${removing?.label || ""} ออกจากประวัติ และจะไม่แสดงในหน้าประกาศของประชาชนอีก ข้อความที่เด้งถึงมือถือไปแล้วเรียกคืนไม่ได้`} busy={busy}>
        <AppDialogActions className="mt-4">
          <AppDialogCancel disabled={busy} />
          <Button variant="danger" disabled={busy} onClick={removeLog}><Trash2 className="h-4 w-4" aria-hidden="true" />ลบ</Button>
        </AppDialogActions>
      </AppDialog>

      <AppDialog open={confirm} onOpenChange={(open) => !open && setConfirm(false)} title={toOfficers ? "ยืนยันส่งแจ้งเตือนถึงเจ้าหน้าที่" : "ยืนยันส่งแจ้งเตือนถึงประชาชน"}
        description={`"${form.title}" จะเด้งบนมือถือของ${target} (ประมาณ ${formatNumber(recipients)} เครื่อง) ทันที และยกเลิกไม่ได้`} busy={busy}>
        <AppDialogActions className="mt-4">
          <AppDialogCancel disabled={busy} />
          <Button disabled={busy} onClick={broadcast}>{busy ? "กำลังส่ง…" : "ส่งเลย"}</Button>
        </AppDialogActions>
      </AppDialog>
    </div>
  );
}
