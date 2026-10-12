"use client";

// ข้อมูลทดสอบ: แสดงจำนวนแถวที่ติดป้าย "[ทดสอบ]" ในแต่ละส่วน และลบทั้งหมดในครั้งเดียวก่อนใช้งานจริง
import { useCallback, useEffect, useState } from "react";
import { FlaskConical, RefreshCw, Trash2 } from "lucide-react";
import { Button, Field, inputClass, useNotice } from "@/components/admin/crud";
import AppDialog, { AppDialogActions, AppDialogCancel } from "@/components/ui/app-dialog";
import { apiRequest, formatNumber } from "@/lib/adminApi";

const API = "/stn-eoc/api/admin/test-data";

export default function TestDataSettings() {
  const { notice, success, fail } = useNotice();
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      setState({ loading: false, data: await apiRequest(API), error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const data = state.data;
  const rows = (data?.results || []).filter((row) => row.count > 0);

  const remove = async () => {
    setBusy(true);
    try {
      const result = await apiRequest(API, { method: "POST", body: { confirm: typed } });
      success(result.message);
      setOpen(false);
      setTyped("");
      await load();
    } catch (error) {
      fail(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {notice}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><FlaskConical className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <h2 className="font-black text-slate-900">ข้อมูลทดสอบในระบบ</h2>
            <p className="text-sm text-slate-600">ข้อมูลที่ติดป้าย [ทดสอบ] จากการทดลองระบบ ควรลบก่อนเปิดใช้งานจริง เพื่อไม่ให้ตัวเลขในภาพรวม รายงาน และไฟล์ Excel ปนกับข้อมูลจริง</p>
          </div>
        </div>
        <Button variant="secondary" onClick={load} disabled={state.loading}><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} />นับใหม่</Button>
      </div>

      {state.error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}
      {data ? (
        data.total ? (
          <div className="rounded-xl border border-amber-200 bg-white">
            <p className="border-b border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">พบข้อมูลทดสอบ {formatNumber(data.total)} แถว</p>
            <ul className="divide-y divide-slate-100">
              {rows.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span className="text-slate-700">{row.label}</span>
                  <span className="font-bold tabular-nums text-slate-900">{formatNumber(row.count)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 p-4">
              <Button variant="danger" onClick={() => setOpen(true)}><Trash2 className="h-4 w-4" />ลบข้อมูลทดสอบทั้งหมด</Button>
              <p className="mt-2 text-xs text-slate-500">ลบในครั้งเดียว ถ้าขั้นใดล้มเหลวจะไม่มีการลบเลย • ข้อมูลรายบุคคลของกลุ่มเปราะบางเข้ารหัสไว้ ค้นหาป้ายไม่ได้ ต้องลบจากหน้าแผนที่รายบุคคล</p>
            </div>
          </div>
        ) : <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">ไม่มีข้อมูลทดสอบในระบบแล้ว</p>
      ) : null}

      <AppDialog open={open} onOpenChange={(value) => { if (!value) { setOpen(false); setTyped(""); } }} title="ยืนยันลบข้อมูลทดสอบ"
        description={`จะลบ ${formatNumber(data?.total || 0)} แถวที่ติดป้าย [ทดสอบ] ออกถาวร (ไม่ผ่านถังขยะ)`} busy={busy}>
        <Field label={`พิมพ์ "${data?.confirm_text || "ลบข้อมูลทดสอบ"}" เพื่อยืนยัน`}>
          <input className={inputClass} value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
        </Field>
        <AppDialogActions className="mt-4">
          <AppDialogCancel disabled={busy} />
          <Button variant="danger" disabled={busy || typed.trim() !== (data?.confirm_text || "ลบข้อมูลทดสอบ")} onClick={remove}>{busy ? "กำลังลบ…" : "ลบข้อมูลทดสอบ"}</Button>
        </AppDialogActions>
      </AppDialog>
    </div>
  );
}
