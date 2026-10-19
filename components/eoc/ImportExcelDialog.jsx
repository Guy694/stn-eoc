"use client";

// หน้าต่างนำเข้า Excel ใช้ร่วมทุกหน้า: 1) ดาวน์โหลดไฟล์ตัวอย่าง + อ่านวิธีกรอก 2) เลือกไฟล์ → ระบบตรวจทุกแถว 3) ยืนยันนำเข้า
// ยังไม่บันทึกอะไรจนกว่าจะกดยืนยัน และไฟล์ที่มีปัญหาจะบอกแถว/คอลัมน์ที่ต้องแก้
import { useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import AppDialog, { AppDialogActions } from "@/components/ui/app-dialog";
import { Button } from "@/components/admin/crud";
import { importSpec } from "@/lib/imports/specs";
import { MAX_IMPORT_ROWS } from "@/lib/imports/core";

const ENDPOINT = (kind) => `/stn-eoc/api/eoc/import/${kind}/`;
const n = (value) => Number(value || 0).toLocaleString("th-TH");

export function ImportExcelButton({ onClick, disabled }) {
  return (
    <Button variant="secondary" onClick={onClick} disabled={disabled}>
      <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> นำเข้า Excel
    </Button>
  );
}

function ColumnGuide({ spec }) {
  return (
    <details className="rounded-2xl border border-slate-200 bg-white">
      <summary className="cursor-pointer px-4 py-2.5 text-sm font-bold text-[#0b4c86]">ดูคอลัมน์และวิธีกรอก ({spec.columns.length} คอลัมน์)</summary>
      <div className="max-h-72 overflow-auto border-t border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs text-slate-600">
            <tr><th className="px-3 py-2">คอลัมน์</th><th className="px-3 py-2">วิธีกรอก</th><th className="px-3 py-2">ตัวอย่าง</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {spec.columns.map((column) => (
              <tr key={column.key} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-900">
                  {column.header}{column.required ? <span className="ml-1 text-xs font-bold text-amber-700">ต้องกรอก</span> : null}
                </td>
                <td className="px-3 py-2 text-slate-600">{column.help || "—"}</td>
                <td className="px-3 py-2 text-slate-500">{column.example === "" || column.example === undefined ? "—" : String(column.example)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function CheckResult({ result }) {
  const { check, plan } = result;
  const items = [
    { label: "เพิ่มใหม่", value: plan.create, tone: "text-[#0b4c86]" },
    { label: "แก้ไขของเดิม", value: plan.update, tone: "text-[#0b4c86]" },
    { label: "ข้าม", value: plan.skip, tone: "text-slate-600" },
    { label: "มีปัญหา", value: check.invalid, tone: check.invalid ? "text-red-700" : "text-slate-600" }
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700">
        ตรวจแล้ว {n(check.total)} แถว จากแผ่นงาน “{result.sheet}”{result.session ? ` · เหตุการณ์ครั้งที่ ${result.session.session_number}` : ""}
      </p>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <dt className="text-xs text-slate-500">{item.label}</dt>
            <dd className={`text-xl font-black tabular-nums ${item.tone}`}>{n(item.value)}</dd>
          </div>
        ))}
      </dl>
      {check.problems.length ? (
        <div className="rounded-lg border border-red-200">
          <p className="border-b border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-800">
            แถวที่ต้องแก้ในไฟล์ (เลขแถวตรงกับใน Excel)
          </p>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs text-slate-500"><tr><th className="px-3 py-1.5">แถว</th><th className="px-3 py-1.5">คอลัมน์</th><th className="px-3 py-1.5">ปัญหา</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {check.problems.map((problem, index) => (
                  <tr key={`${problem.row}-${index}`}><td className="px-3 py-1.5 font-bold tabular-nums">{problem.row}</td><td className="px-3 py-1.5">{problem.column}</td><td className="px-3 py-1.5 text-red-800">{problem.message}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {check.more_problems ? <p className="px-3 py-2 text-xs text-slate-500">และอีก {n(check.more_problems)} ปัญหา — แก้ชุดนี้แล้วตรวจใหม่</p> : null}
        </div>
      ) : null}
      {plan.skipped?.length ? (
        <details className="rounded-2xl border border-slate-200 bg-white text-sm">
          <summary className="cursor-pointer px-3 py-2 font-semibold text-slate-700">แถวที่ระบบจะข้าม ({n(plan.skip)})</summary>
          <ul className="max-h-40 overflow-auto border-t border-slate-100 px-3 py-2 text-slate-600">
            {plan.skipped.map((item) => <li key={item.row}>แถว {item.row}: {item.reason}</li>)}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/**
 * kind: vulnerable | flood-records | supplies | supplies-daily
 * context: { eoc, session_id } ส่งไปกับไฟล์เพื่อให้ข้อมูลเข้าเหตุการณ์ที่เลือกอยู่
 */
export default function ImportExcelDialog({ open, onOpenChange, kind, context = {}, onImported }) {
  const spec = importSpec(kind);
  // ไฟล์ตัวอย่างบางชนิดเติมข้อมูลของเหตุการณ์ไว้ให้ (เช่น แบบรายงานเวชภัณฑ์ประจำวัน) จึงส่งบริบทไปด้วย
  const templateQuery = new URLSearchParams(
    Object.entries(context).filter(([, value]) => value !== undefined && value !== null && value !== "").map(([key, value]) => [key, String(value)])
  ).toString();
  const templateHref = `${ENDPOINT(kind)}${templateQuery ? `?${templateQuery}` : ""}`;
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [state, setState] = useState({ busy: false, error: "", result: null, done: null });

  const reset = () => {
    setFile(null);
    setState({ busy: false, error: "", result: null, done: null });
    if (inputRef.current) inputRef.current.value = "";
  };
  const close = (next) => {
    if (state.busy) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const send = async (selected, mode, onlyValid = false) => {
    const body = new FormData();
    body.append("file", selected);
    body.append("mode", mode);
    if (onlyValid) body.append("only_valid", "1");
    Object.entries(context).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== "") body.append(key, String(value)); });
    const response = await fetch(ENDPOINT(kind), { method: "POST", body, cache: "no-store" });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.success) throw new Error(json?.message || `ดำเนินการไม่สำเร็จ (รหัส ${response.status})`);
    return json;
  };

  const choose = async (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setState({ busy: true, error: "", result: null, done: null });
    try {
      setState({ busy: false, error: "", result: await send(selected, "check"), done: null });
    } catch (error) {
      setState({ busy: false, error: error.message, result: null, done: null });
    }
  };

  const commit = async (onlyValid) => {
    setState((current) => ({ ...current, busy: true, error: "" }));
    try {
      const json = await send(file, "commit", onlyValid);
      setState({ busy: false, error: "", result: null, done: json.result });
      onImported?.(json.result);
    } catch (error) {
      setState((current) => ({ ...current, busy: false, error: error.message }));
    }
  };

  if (!spec) return null;
  const { result, done, busy, error } = state;
  const writable = result ? result.plan.create + result.plan.update : 0;
  const invalid = result?.check.invalid || 0;

  const footer = done ? (
    <AppDialogActions><Button onClick={() => close(false)}>เสร็จ</Button></AppDialogActions>
  ) : result ? (
    <AppDialogActions>
      <Button variant="secondary" disabled={busy} onClick={reset}>เลือกไฟล์ใหม่</Button>
      {invalid && writable ? (
        <Button variant="secondary" disabled={busy} onClick={() => commit(true)}>นำเข้าเฉพาะแถวที่ถูกต้อง ({n(writable)})</Button>
      ) : null}
      <Button disabled={busy || invalid > 0 || !writable} onClick={() => commit(false)}>
        {busy ? "กำลังนำเข้า…" : writable ? `ยืนยันนำเข้า ${n(writable)} แถว` : "ไม่มีข้อมูลใหม่"}
      </Button>
    </AppDialogActions>
  ) : null;

  return (
    <AppDialog open={open} onOpenChange={close} title={spec.title} description={spec.summary} size="lg" busy={busy} footer={footer}>
      {error ? <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}

      {done ? (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-sm font-semibold">
            นำเข้าเรียบร้อย{done.created ? ` เพิ่มใหม่ ${n(done.created)}` : ""}{done.updated ? ` แก้ไข ${n(done.updated)}` : ""}{!done.created && !done.updated ? " ไม่มีข้อมูลที่ต้องเปลี่ยน" : ""} รายการ — ดูประวัติได้ในบันทึกกิจกรรม
          </p>
        </div>
      ) : result ? (
        <CheckResult result={result} />
      ) : (
        <ol className="space-y-5">
          <li>
            <p className="text-sm font-black text-slate-900">1. ดาวน์โหลดไฟล์ตัวอย่างแล้วกรอกข้อมูล</p>
            <p className="mt-1 text-sm text-slate-600">
              กรอก {spec.unit} ในแผ่นงาน “กรอกข้อมูล” · หัวคอลัมน์สีส้มต้องกรอก · ช่องที่มีลูกศรให้เลือกจากรายการ · ไม่เกิน {n(MAX_IMPORT_ROWS)} แถวต่อไฟล์
            </p>
            <a href={templateHref} download className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <Download className="h-4 w-4" aria-hidden="true" /> ดาวน์โหลดไฟล์ตัวอย่าง
            </a>
            <div className="mt-3"><ColumnGuide spec={spec} /></div>
          </li>
          <li>
            <p className="text-sm font-black text-slate-900">2. เลือกไฟล์ที่กรอกแล้ว</p>
            <p className="mt-1 text-sm text-slate-600">ระบบจะตรวจทุกแถวก่อน ยังไม่บันทึกจนกว่าจะกดยืนยัน รองรับ .xlsx และ .csv ไม่เกิน 5 MB</p>
            <label className={`mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center ${busy ? "border-slate-200 text-slate-400" : "border-[#c9dcee] text-[#0b4c86] hover:bg-[#edf5fc]"}`}>
              <Upload className="h-6 w-6" aria-hidden="true" />
              <span className="text-sm font-bold">{busy ? `กำลังตรวจ ${file?.name || ""}…` : "คลิกเพื่อเลือกไฟล์"}</span>
              <input ref={inputRef} type="file" accept=".xlsx,.csv" className="sr-only" disabled={busy} onChange={choose} />
            </label>
          </li>
          {(spec.notes || []).length ? (
            <li className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-bold text-slate-800">ถ้าข้อมูลมีอยู่แล้ว</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">{spec.notes.map((note) => <li key={note}>{note}</li>)}</ul>
            </li>
          ) : null}
        </ol>
      )}
    </AppDialog>
  );
}
