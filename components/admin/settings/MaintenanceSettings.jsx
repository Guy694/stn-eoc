"use client";

// ปิดปรับปรุงระบบ: เปิดแล้วทุกหน้าแสดง "ปิดปรับปรุงชั่วคราว" และทุก API ตอบ 503
// ยกเว้นหน้าเข้าสู่ระบบ และผู้ดูแลระบบ (หรือเจ้าหน้าที่ทุกคน ถ้าเลือกไว้)
import { useCallback, useEffect, useState } from "react";
import { Construction, ExternalLink, Power } from "lucide-react";
import { Button, Field, inputClass, useNotice } from "@/components/admin/crud";
import AppDialog, { AppDialogActions, AppDialogCancel } from "@/components/ui/app-dialog";
import { apiRequest, formatDateTime } from "@/lib/adminApi";
import { DEFAULT_MESSAGE } from "@/lib/maintenanceRules";

const API = "/stn-eoc/api/admin/maintenance";

// ISO → ค่าใน <input type="datetime-local"> (เวลาไทย)
function toLocalInput(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const local = new Date(date.getTime() + 7 * 3600e3);
  return local.toISOString().slice(0, 16);
}
function fromLocalInput(value) {
  return value ? new Date(`${value}:00+07:00`).toISOString() : null;
}

export default function MaintenanceSettings() {
  const { notice, success, fail } = useNotice();
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [form, setForm] = useState({ message: DEFAULT_MESSAGE, until: "", allow_officers: false });
  const [confirm, setConfirm] = useState(null); // "on" | "off"
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const json = await apiRequest(API);
      setState({ loading: false, data: json.data, error: "" });
      setForm({ message: json.data.message || DEFAULT_MESSAGE, until: toLocalInput(json.data.until), allow_officers: Boolean(json.data.allow_officers) });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (enabled) => {
    setBusy(true);
    try {
      const json = await apiRequest(API, { method: "PUT", body: { enabled, message: form.message, until: fromLocalInput(form.until), allow_officers: form.allow_officers } });
      setState({ loading: false, data: json.data, error: "" });
      success(json.message);
      setConfirm(null);
    } catch (error) {
      fail(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (state.error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}</p>;
  if (state.loading) return <p className="rounded-xl border border-[#c9dcee] bg-white p-10 text-center text-sm text-slate-500">กำลังโหลด…</p>;
  const enabled = Boolean(state.data?.enabled);

  return (
    <div className="space-y-4">
      {notice}
      <section className={`rounded-xl border p-5 ${enabled ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-full ${enabled ? "bg-amber-500 text-white" : "bg-emerald-600 text-white"}`}>
              {enabled ? <Construction className="h-6 w-6" aria-hidden="true" /> : <Power className="h-6 w-6" aria-hidden="true" />}
            </span>
            <div>
              <p className={`text-lg font-black ${enabled ? "text-amber-900" : "text-emerald-900"}`}>{enabled ? "ระบบกำลังปิดปรับปรุง" : "ระบบเปิดใช้งานตามปกติ"}</p>
              <p className="text-xs text-slate-600">
                {state.data?.updated_at ? `เปลี่ยนล่าสุด ${formatDateTime(state.data.updated_at)}${state.data.updated_by_name ? ` โดย ${state.data.updated_by_name}` : ""}` : "ยังไม่เคยปิดปรับปรุง"}
              </p>
            </div>
          </div>
          {enabled
            ? <Button onClick={() => setConfirm("off")} disabled={busy}><Power className="h-4 w-4" aria-hidden="true" />เปิดระบบให้ใช้งาน</Button>
            : <Button onClick={() => setConfirm("on")} disabled={busy} className="bg-amber-600 hover:bg-amber-700"><Construction className="h-4 w-4" aria-hidden="true" />ปิดปรับปรุงระบบ</Button>}
        </div>
        {enabled ? (
          <p className="mt-3 text-sm text-amber-900">
            ผู้ใช้ทั่วไปเห็นหน้าแจ้งปิดปรับปรุงทุกหน้า และดึงข้อมูลผ่าน API ไม่ได้ • คุณยังใช้งานได้เพราะเป็นผู้ดูแลระบบ
            {state.data.allow_officers ? " • เจ้าหน้าที่ที่เข้าสู่ระบบยังใช้งานได้" : " • เจ้าหน้าที่อื่นใช้งานไม่ได้"}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-black text-slate-900">ข้อความบนหน้าปิดปรับปรุง</h3>
        <div className="mt-3 grid gap-4">
          <Field label="ข้อความถึงผู้ใช้" hint="เช่น ปรับปรุงฐานข้อมูล คาดว่าจะใช้เวลาประมาณ 1 ชั่วโมง">
            <textarea rows={3} maxLength={500} className={inputClass} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} />
          </Field>
          <Field label="คาดว่าจะเปิดใช้งานได้ (ไม่บังคับ)" hint="แสดงบนหน้าปิดปรับปรุง ระบบไม่เปิดเองอัตโนมัติ ต้องกด “เปิดระบบให้ใช้งาน”">
            <input type="datetime-local" className={inputClass} value={form.until} onChange={(event) => setForm((current) => ({ ...current, until: event.target.value }))} />
          </Field>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={form.allow_officers} onChange={(event) => setForm((current) => ({ ...current, allow_officers: event.target.checked }))} />
            <span>ให้เจ้าหน้าที่ที่เข้าสู่ระบบใช้งานได้ระหว่างปิดปรับปรุง <span className="block text-xs text-slate-500">ไม่เลือก = เฉพาะผู้ดูแลระบบเท่านั้น (เหมาะกับการปรับฐานข้อมูล)</span></span>
          </label>
          <div className="flex flex-wrap gap-2">
            {enabled ? <Button variant="secondary" disabled={busy} onClick={() => save(true)}>บันทึกข้อความ</Button> : null}
            <a href="/stn-eoc/maintenance/?preview=1" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              ดูตัวอย่างหน้าปิดปรับปรุง <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <p className="text-xs leading-5 text-slate-500">
        ระหว่างปิดปรับปรุง: หน้าเข้าสู่ระบบยังเปิดได้ เพื่อให้ผู้ดูแลระบบเข้ามาเปิดระบบคืน • ทุกการเปิด/ปิดถูกบันทึกในประวัติการแก้ไข • หน้าปิดปรับปรุงแสดงเบอร์ฉุกเฉิน 1669/1784/191/199 ให้ประชาชนเสมอ
      </p>

      <AppDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === "on" ? "ยืนยันปิดปรับปรุงระบบ" : "ยืนยันเปิดระบบให้ใช้งาน"}
        description={confirm === "on"
          ? `ประชาชนและ${form.allow_officers ? "" : "เจ้าหน้าที่ (ยกเว้นผู้ดูแลระบบ) "}จะเข้าดูข้อมูลไม่ได้ ทั้งหน้าเว็บ แบบฟอร์มขอความช่วยเหลือ และ API จนกว่าจะเปิดระบบคืน`
          : "ทุกคนจะกลับมาใช้งานระบบได้ตามปกติภายใน 10 วินาที"}
        busy={busy}
      >
        <AppDialogActions className="mt-4">
          <AppDialogCancel disabled={busy} />
          <Button disabled={busy} onClick={() => save(confirm === "on")} className={confirm === "on" ? "bg-amber-600 hover:bg-amber-700" : ""}>
            {busy ? "กำลังบันทึก…" : confirm === "on" ? "ปิดปรับปรุงระบบ" : "เปิดระบบให้ใช้งาน"}
          </Button>
        </AppDialogActions>
      </AppDialog>
    </div>
  );
}
