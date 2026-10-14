"use client";

// รายงานเวชภัณฑ์ประจำวันของหน่วยบริการ: เลือกวันที่ + หน่วยบริการ → กรอกรับเข้า/ใช้ไป/นับได้จริง ทุกรายการ
// ระบบคำนวณคงเหลือให้เห็นทันที (ยกมา + รับเข้า − ใช้ไป) และเตือนเมื่อยอดนับไม่ตรง
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download } from "lucide-react";
import { Button, Field, ReadOnlyNotice, StatusPill, inputClass } from "@/components/admin/crud";
import { formatNumber } from "@/lib/adminApi";
import { sendOrQueue } from "@/lib/offlineQueue";
import { shortThaiDate, todayKey } from "@/lib/medicalDaily";

const blankRow = { received_qty: "", used_qty: "", counted_qty: "", note: "" };
const toInput = (value) => (value === null || value === undefined ? "" : String(Number(value)));
const parse = (value) => {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return String(value ?? "").trim() === "" || !Number.isFinite(n) ? null : n;
};

export default function SuppliesDailyReport({ eocType = "flood", sessionId, facilities = [], facilityId, onFacilityChange, onSaved, success, fail, openImport }) {
  const [date, setDate] = useState(todayKey());
  const [state, setState] = useState({ loading: false, data: null, error: "" });
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams({ eoc: eocType, date });
    if (sessionId) params.set("session_id", String(sessionId));
    if (facilityId) params.set("facility_id", String(facilityId));
    return params.toString();
  }, [eocType, sessionId, date, facilityId]);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await fetch(`/stn-eoc/api/eoc/supplies/daily?${query}`, { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.success) throw new Error(json.message || "โหลดรายงานไม่สำเร็จ");
      setState({ loading: false, data: json, error: "" });
      setValues(Object.fromEntries(json.rows.map((row) => [row.stock_id, row.report
        ? { received_qty: row.report.received_qty ? toInput(row.report.received_qty) : "", used_qty: toInput(row.report.used_qty), counted_qty: toInput(row.report.counted_qty), note: row.report.note || "" }
        : { ...blankRow }])));
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [query]);
  useEffect(() => { load(); }, [load]);

  const data = state.data;
  const rows = useMemo(() => data?.rows || [], [data]);
  const canReport = Boolean(data?.can_report);
  const setValue = (stockId, key, value) => setValues((current) => ({ ...current, [stockId]: { ...(current[stockId] || blankRow), [key]: value } }));

  const computed = useMemo(() => Object.fromEntries(rows.map((row) => {
    const v = values[row.stock_id] || blankRow;
    const used = parse(v.used_qty);
    const end = row.start_qty + (parse(v.received_qty) || 0) - (used || 0);
    const counted = parse(v.counted_qty);
    return [row.stock_id, { end, filled: used !== null, negative: end < 0, diff: counted === null || used === null ? null : counted - end }];
  })), [rows, values]);

  const filled = rows.filter((row) => computed[row.stock_id]?.filled).length;
  const reportedBefore = rows.filter((row) => row.report).length;
  const statusOf = (id) => data?.status?.facilities?.find((facility) => String(facility.facility_id) === String(id))?.status;

  const fillZero = () => setValues((current) => Object.fromEntries(rows.map((row) => {
    const v = current[row.stock_id] || blankRow;
    return [row.stock_id, String(v.used_qty).trim() === "" ? { ...v, used_qty: "0" } : v];
  })));

  const save = async () => {
    setFormError("");
    const missing = rows.filter((row) => !computed[row.stock_id]?.filled);
    if (missing.length) { setFormError(`ยังไม่กรอก "ใช้ไป" ${missing.length} รายการ (ไม่ได้ใช้ใส่ 0 หรือกด "ไม่ได้ใช้ = 0")`); return; }
    const negative = rows.find((row) => computed[row.stock_id]?.negative);
    if (negative) { setFormError(`${negative.item_name}: ใช้ไปเกินยอดที่มี`); return; }
    setBusy(true);
    try {
      const facilityName = facilities.find((facility) => String(facility.id) === String(facilityId))?.name || "";
      const result = await sendOrQueue(`/stn-eoc/api/eoc/supplies/daily?${query}`, {
        method: "POST",
        label: `รายงานเวชภัณฑ์ ${facilityName} ${shortThaiDate(date)}`,
        body: { facility_id: facilityId, date, rows: rows.map((row) => ({ stock_id: row.stock_id, ...values[row.stock_id] })) }
      });
      success?.(result.message || "บันทึกแล้ว");
      if (!result.queued) { await load(); onSaved?.(); }
    } catch (error) {
      setFormError(error.message);
      fail?.(error.message);
    } finally {
      setBusy(false);
    }
  };

  const templateHref = `/stn-eoc/api/eoc/import/supplies-daily/?${new URLSearchParams({ eoc: eocType, ...(sessionId ? { session_id: String(sessionId) } : {}), ...(facilityId ? { facility_id: String(facilityId) } : {}) })}`;
  const today = data?.today || todayKey();

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#c9dcee] bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
          <Field label="วันที่รายงาน">
            <input type="date" className={inputClass} value={date} max={today} onChange={(event) => setDate(event.target.value || today)} />
          </Field>
          <Field label="หน่วยบริการ/คลัง">
            <select className={inputClass} value={facilityId || ""} onChange={(event) => onFacilityChange(event.target.value)}>
              <option value="">เลือกหน่วยบริการ</option>
              {facilities.map((facility) => {
                const status = statusOf(facility.id);
                const mark = status === "complete" ? " ✓ รายงานแล้ว" : status === "partial" ? " · รายงานไม่ครบ" : "";
                return <option key={facility.id} value={facility.id}>{facility.name}{facility.district ? ` (อ.${facility.district})` : ""}{mark}</option>;
              })}
            </select>
          </Field>
          <div className="flex flex-wrap gap-2">
            <a href={templateHref} download className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <Download className="h-4 w-4" aria-hidden="true" />แบบรายงาน Excel
            </a>
            {canReport && openImport ? <Button variant="secondary" onClick={openImport}>นำเข้าไฟล์</Button> : null}
          </div>
        </div>
        {data?.status ? (
          <p className="mt-3 text-sm text-slate-600">
            วันที่ {shortThaiDate(date)}: รายงานครบ <b className="text-emerald-700">{formatNumber(data.status.complete)}</b> · ไม่ครบ <b className="text-amber-700">{formatNumber(data.status.partial)}</b> · ยังไม่รายงาน <b className="text-red-700">{formatNumber(data.status.missing)}</b> จาก {formatNumber(data.status.total)} หน่วยบริการ
          </p>
        ) : null}
      </div>

      <ReadOnlyNotice message={data?.read_only_message} />
      {state.error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}

      {!facilityId ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">เลือกหน่วยบริการเพื่อกรอกรายงานของวันนี้ หรือดาวน์โหลดแบบรายงาน Excel ของทุกหน่วยบริการแล้วนำเข้าครั้งเดียว</p>
      ) : state.loading && !rows.length ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />
      ) : !rows.length ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">หน่วยบริการนี้ยังไม่มีรายการในคลัง — เพิ่มรายการหรือนำเข้ายอดตั้งต้นก่อน</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#c9dcee] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <p className="text-sm text-slate-700">
              กรอกแล้ว <b>{filled}/{rows.length}</b> รายการ
              {reportedBefore ? <span className="ml-2 inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />เคยรายงานวันนี้ {reportedBefore} รายการ (แก้ไขได้)</span> : null}
            </p>
            {canReport ? <Button variant="ghost" className="min-h-9 px-3" onClick={fillZero}>ไม่ได้ใช้ = 0 (ช่องที่ว่าง)</Button> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left">รายการ</th>
                  <th scope="col" className="px-3 py-2 text-right">ยกมา</th>
                  <th scope="col" className="px-3 py-2 text-right">รับเข้า</th>
                  <th scope="col" className="px-3 py-2 text-right">ใช้ไป/จ่ายออก *</th>
                  <th scope="col" className="px-3 py-2 text-right">คงเหลือ (ระบบคำนวณ)</th>
                  <th scope="col" className="px-3 py-2 text-right">นับได้จริง</th>
                  <th scope="col" className="px-3 py-2 text-left">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const v = values[row.stock_id] || blankRow;
                  const c = computed[row.stock_id] || {};
                  const input = (key, extra = {}) => (
                    <input type="number" min="0" step="any" inputMode="decimal" disabled={!canReport}
                      aria-label={`${extra.label} ${row.item_name}`}
                      className={`${inputClass} w-24 text-right ${extra.className || ""}`}
                      value={v[key]} onChange={(event) => setValue(row.stock_id, key, event.target.value)} />
                  );
                  return (
                    <tr key={row.stock_id} className={c.negative ? "bg-red-50/60" : ""}>
                      <td className="px-3 py-2">
                        <span className="font-bold text-slate-900">{row.item_name}</span>
                        <span className="block text-xs text-slate-500">{row.unit || "-"}{row.report ? " · รายงานแล้ว" : ""}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">{formatNumber(row.start_qty)}</td>
                      <td className="px-3 py-2 text-right">{input("received_qty", { label: "รับเข้า" })}</td>
                      <td className="px-3 py-2 text-right">{input("used_qty", { label: "ใช้ไป", className: c.filled ? "" : "border-amber-300 bg-amber-50/50" })}</td>
                      <td className={`px-3 py-2 text-right font-black tabular-nums ${c.negative ? "text-red-700" : "text-slate-900"}`}>{c.filled ? formatNumber(c.end) : <span className="font-normal text-slate-400">—</span>}</td>
                      <td className="px-3 py-2 text-right">
                        {input("counted_qty", { label: "นับได้จริง" })}
                        {c.diff !== null && c.diff !== 0 ? <span className={`mt-1 block text-xs font-bold ${c.diff < 0 ? "text-red-700" : "text-amber-700"}`}>ต่าง {c.diff > 0 ? "+" : ""}{formatNumber(c.diff)}</span> : null}
                        {c.diff === 0 ? <span className="mt-1 block"><StatusPill tone="green">ตรง</StatusPill></span> : null}
                      </td>
                      <td className="px-3 py-2">
                        <input className={`${inputClass} min-w-[10rem]`} disabled={!canReport} aria-label={`หมายเหตุ ${row.item_name}`} value={v.note} maxLength={500}
                          onChange={(event) => setValue(row.stock_id, "note", event.target.value)} placeholder="รับจาก/จ่ายให้ใคร" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {canReport ? (
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-4 py-3">
              {formError ? <p className="mr-auto text-sm font-semibold text-red-700" role="alert">{formError}</p> : null}
              <Button disabled={busy} onClick={save}>{busy ? "กำลังบันทึก…" : `บันทึกรายงานวันที่ ${shortThaiDate(date)}`}</Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
