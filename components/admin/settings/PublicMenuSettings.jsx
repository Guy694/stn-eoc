"use client";

// เมนูประชาชน: เปิด/ปิด "รายงานระดับน้ำ" (เดิมเปิดเฉพาะเมื่อเปิด EOC อุทกภัย)
import { useCallback, useEffect, useState } from "react";
import { Waves } from "lucide-react";
import { Button, StatusPill, useNotice } from "@/components/admin/crud";
import { apiRequest, formatDateTime } from "@/lib/adminApi";
import { WATER_REPORT_MODES } from "@/lib/waterReportSetting";

const API = "/stn-eoc/api/admin/water-report-setting";

export default function PublicMenuSettings() {
  const { notice, success, fail } = useNotice();
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [mode, setMode] = useState("auto");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const json = await apiRequest(API);
      setState({ loading: false, data: json.data, error: "" });
      setMode(json.data.mode);
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      const json = await apiRequest(API, { method: "PUT", body: { mode } });
      setState({ loading: false, data: json.data, error: "" });
      success(json.message);
    } catch (error) {
      fail(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (state.error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}</p>;
  if (state.loading) return <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">กำลังโหลด…</p>;
  const data = state.data;

  return (
    <section className="space-y-4">
      {notice}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-[#0b4c86]"><Waves className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <h3 className="text-base font-black text-slate-900">รายงานระดับน้ำ (ประชาชน)</h3>
              <p className="text-sm text-slate-600">เมนูให้ประชาชนส่งรูปและระดับน้ำที่บ้าน/ถนน แสดงในเมนูด้านบน แถบล่างบนมือถือ และหน้าบ้านฉันเสี่ยงไหม</p>
            </div>
          </div>
          <StatusPill tone={data.status.open ? "green" : "gray"}>{data.status.open ? "ตอนนี้เปิดรับรายงาน" : "ตอนนี้ปิดรับรายงาน"}</StatusPill>
        </div>

        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">การเปิดเมนูรายงานระดับน้ำ</legend>
          {Object.entries(WATER_REPORT_MODES).map(([key, item]) => (
            <label key={key} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${mode === key ? "border-[#0b4c86] bg-sky-50/60" : "border-slate-200 hover:bg-slate-50"}`}>
              <input type="radio" name="water-report-mode" value={key} checked={mode === key} onChange={() => setMode(key)} className="mt-1 h-4 w-4 accent-[#0b4c86]" />
              <span>
                <span className="block font-bold text-slate-900">{item.label}</span>
                <span className="block text-sm text-slate-600">{item.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={busy || mode === data.mode}>{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
          <span className="text-xs text-slate-500">
            EOC อุทกภัย: {data.flood_eoc_open ? "เปิดอยู่" : "ปิดอยู่"}
            {data.updated_at ? ` • ตั้งล่าสุด ${formatDateTime(data.updated_at)}${data.updated_by_name ? ` โดย ${data.updated_by_name}` : ""}` : ""}
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-500">ระบบตรวจซ้ำตอนรับรายงานทุกครั้ง ปิดแล้วประชาชนส่งรายงานไม่ได้แม้เปิดหน้าค้างไว้ หน้าประชาชนเปลี่ยนตามภายใน 1 นาที</p>
    </section>
  );
}
