"use client";

// นำเข้าข้อมูลจากระบบคลังยาของโรงพยาบาล (DRUGLIST / INVENTORY / RECEIPT / DISTRIBUTION)
// 1) เลือกหลายไฟล์พร้อมกัน → เบราว์เซอร์อ่านและรวมเป็นรายการยา 2) เลือกยาใหม่ที่จะติดตาม
// 3) ตรวจก่อนบันทึก: ระบบคำนวณใช้ไป = ยกมา + รับเข้า − คงคลังในไฟล์ ของยาที่ติดตามอยู่ 4) ยืนยันบันทึกเป็นรายงานประจำวัน
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileUp, Search } from "lucide-react";
import AppDialog, { AppDialogActions } from "@/components/ui/app-dialog";
import { Button, StatusPill } from "@/components/admin/crud";
import { apiRequest } from "@/lib/adminApi";
import {
  HOSPITAL_FILE_KINDS, buildImportPayload, decodeHospitalFile, mergeHospitalFiles, parseHospitalFile, periodLabel
} from "@/lib/hospitalDrugFiles";
import { shortThaiDate } from "@/lib/medicalDaily";
import { PLAN_ACTIONS, hospitalPrefix } from "@/lib/hospitalDrugPlan";

const ENDPOINT = "/stn-eoc/api/eoc/supplies/hospital-import/";
const n = (value) => (value === null || value === undefined ? "–" : Number(value).toLocaleString("th-TH", { maximumFractionDigits: 2 }));

async function readFiles(fileList) {
  const parsed = [];
  for (const file of fileList) {
    const decoded = decodeHospitalFile(new Uint8Array(await file.arrayBuffer()));
    parsed.push(parseHospitalFile(decoded.text, file.name));
  }
  return parsed;
}

const GROUP_ORDER = ["error", "out", "report", "create", "opening", "missing", "unchanged", "skip"];

/** ผลการตรวจก่อนบันทึก: แยกกลุ่มตามสิ่งที่ระบบจะทำ พร้อมยกมา / รับเข้า / ใช้ไป / คงเหลือ */
function PlanPreview({ plan }) {
  const s = plan.summary;
  const rows = [...plan.rows].sort((a, b) => GROUP_ORDER.indexOf(a.action) - GROUP_ORDER.indexOf(b.action) || String(a.name).localeCompare(String(b.name)));
  return (
    <section className="space-y-3 rounded-lg border border-[#c9dcee] bg-white p-3" aria-label="ผลการตรวจก่อนบันทึก">
      <h3 className="text-base font-bold text-[#083865]">ผลการตรวจ{plan.date ? ` · ยอด ณ สิ้นวันที่ ${shortThaiDate(plan.date)}` : ""}</h3>
      {plan.blocking ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="alert">{plan.blocking}</p> : null}
      <p className="text-sm text-slate-700">
        รายงานประจำวัน <b>{n(s.report)}</b> · หมด <b className={s.out ? "text-red-700" : ""}>{n(s.out)}</b> · ยาใหม่ <b>{n(s.create)}</b>
        {s.opening ? <> · แก้ยอดตั้งต้น <b>{n(s.opening)}</b></> : null} · เท่าเดิม <b>{n(s.unchanged)}</b>
        {s.missing ? <> · ยังไม่รายงาน <b className="text-amber-700">{n(s.missing)}</b></> : null}{s.skip ? <> · ข้าม <b>{n(s.skip)}</b></> : null}
      </p>
      {s.replaces ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{n(s.replaces)} รายการมีรายงานของวันนี้ที่กรอกผ่านแบบฟอร์มหรือ Excel อยู่แล้ว ระบบจะแทนที่ด้วยยอดจากไฟล์คลังยา</p> : null}
      {s.extra_received ? <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">{n(s.extra_received)} รายการมียอดคงคลังเพิ่มขึ้นมากกว่าที่รับตามไฟล์ RECEIPT ระบบนับส่วนต่างเป็น “รับเข้า” (ถ้ามีการรับจริงให้แนบไฟล์ RECEIPT ของวันนั้นด้วย)</p> : null}
      {plan.manual?.length ? (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p>หน่วยนี้มี {n(plan.manual.length)} รายการที่เพิ่มเองผ่านแบบฟอร์ม ไฟล์นี้ไม่แตะรายการเหล่านั้น ยังต้องรายงานประจำวันเองตามเดิม</p>
          {plan.manual.filter((row) => row.possible_duplicate).length ? (
            <ul className="mt-1 list-disc pl-5 text-amber-900">
              {plan.manual.filter((row) => row.possible_duplicate).map((row) => <li key={row.stock_id}>“{row.item_name}” อาจเป็นยาเดียวกับ “{row.possible_duplicate}” ในไฟล์ — ถ้าซ้ำ ให้เลือกติดตามจากไฟล์และหยุดรายงานรายการที่เพิ่มเอง</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="max-h-[20rem] overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">ยา</th>
              <th className="px-3 py-2 text-left">ระบบจะทำ</th>
              <th className="px-3 py-2 text-right">ยกมา</th>
              <th className="px-3 py-2 text-right">รับเข้า</th>
              <th className="px-3 py-2 text-right">ใช้ไป</th>
              <th className="px-3 py-2 text-right">คงเหลือ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const meta = PLAN_ACTIONS[row.action] || PLAN_ACTIONS.skip;
              return (
                <tr key={`${row.action}-${row.working_code}`}>
                  <td className="px-3 py-1.5"><span className="font-semibold text-slate-900">{row.name}</span><span className="block text-xs text-slate-500">รหัส {row.working_code}{row.unit ? ` · ${row.unit}` : ""}</span></td>
                  <td className="px-3 py-1.5">
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                    {row.reason ? <span className="block text-xs text-slate-500">{row.reason}</span> : null}
                    {row.replaces_label && row.replaces !== "hospital" ? <span className="block text-xs text-amber-800">แทนที่รายงานจาก{row.replaces_label}</span> : null}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{row.action === "create" ? <span className="text-xs text-slate-500">ตั้งต้น {n(row.opening)}</span> : row.action === "opening" ? n(row.before) : n(row.start)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{n(row.received)}{row.extra_received ? <span className="block text-xs text-sky-700">นับจากคงคลัง</span> : null}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{n(row.used)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{n(row.end)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function HospitalDrugImportDialog({ open, onOpenChange, eocType = "flood", sessionId, onImported }) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]); // ไฟล์ที่อ่านแล้ว (สะสมได้หลายครั้ง)
  const [context, setContext] = useState(null);
  const [facilityId, setFacilityId] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [search, setSearch] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [plan, setPlan] = useState(null);

  const merged = useMemo(() => (files.length ? mergeHospitalFiles(files) : null), [files]);
  const hospCode = merged?.hospCode || "";

  useEffect(() => {
    if (!open) {
      setFiles([]); setContext(null); setFacilityId(""); setSelected(new Set()); setSearch(""); setOnlySelected(false); setError(""); setResult(null); setPlan(null);
    }
  }, [open]);

  // ข้อมูลประกอบ: หน่วยบริการ หน่วยที่เคยจับคู่กับรหัส รพ. และรายการที่ติดตามอยู่
  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams({ eoc: eocType });
    if (sessionId) params.set("session_id", String(sessionId));
    if (hospCode) params.set("hosp_code", hospCode);
    apiRequest(`${ENDPOINT}?${params}`)
      .then((json) => {
        setContext(json);
        if (json.mapped_facility_id) setFacilityId((current) => current || String(json.mapped_facility_id));
      })
      .catch((err) => setError(err.message));
  }, [open, eocType, sessionId, hospCode]);

  // ยาที่หน่วยนี้ติดตามอยู่แล้วจากไฟล์ของ รพ. นี้ (รายงานทุกครั้งที่นำเข้า เอาออกไม่ได้)
  const tracked = useMemo(() => {
    const prefix = hospitalPrefix(hospCode);
    return new Set((context?.tracked?.[facilityId] || []).map((code) => String(code).toUpperCase()).filter((code) => code.startsWith(prefix)).map((code) => code.slice(prefix.length)));
  }, [context, facilityId, hospCode]);
  const isTracked = (item) => tracked.has(item.working_code.toUpperCase());

  // ยาใหม่: ติ๊กยาจำเป็นช่วงภัยให้อัตโนมัติ
  useEffect(() => {
    if (!merged) return;
    setSelected(new Set(merged.items.filter((item) => item.essential && !tracked.has(item.working_code.toUpperCase())).map((item) => item.working_code)));
  }, [merged, tracked]);

  // เปลี่ยนไฟล์/หน่วยบริการ/รายการที่เลือก → ต้องตรวจใหม่
  useEffect(() => { setPlan(null); }, [merged, facilityId, selected]);

  const addFiles = async (fileList) => {
    if (!fileList?.length) return;
    setError("");
    setResult(null);
    try {
      const parsed = await readFiles([...fileList]);
      setFiles((current) => [...current, ...parsed]);
    } catch (err) {
      setError(`อ่านไฟล์ไม่สำเร็จ: ${err.message}`);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const visible = useMemo(() => {
    if (!merged) return [];
    const term = search.trim().toLowerCase();
    const prefix = hospitalPrefix(hospCode);
    const trackedCodes = new Set((context?.tracked?.[facilityId] || []).map((code) => String(code).toUpperCase()).filter((code) => code.startsWith(prefix)).map((code) => code.slice(prefix.length)));
    return merged.items.filter((item) => (!onlySelected || selected.has(item.working_code) || trackedCodes.has(item.working_code.toUpperCase()))
      && (!term || `${item.name} ${item.trade_name} ${item.working_code}`.toLowerCase().includes(term)));
  }, [merged, search, onlySelected, selected, context, facilityId, hospCode]);

  const toggle = (code) => setSelected((current) => {
    if (tracked.has(String(code).toUpperCase())) return current;
    const next = new Set(current);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });
  const setMany = (codes, on) => setSelected((current) => {
    const next = new Set(current);
    for (const code of codes) {
      if (tracked.has(String(code).toUpperCase())) continue;
      if (on) next.add(code); else next.delete(code);
    }
    return next;
  });

  const hasInventory = merged?.kinds.some((kind) => kind.kind === "INVENTORY");
  const chosenCodes = merged ? merged.items.filter((item) => isTracked(item) || selected.has(item.working_code)).map((item) => item.working_code) : [];
  const canCheck = merged && merged.items.length && facilityId && (chosenCodes.length || tracked.size) && !busy && merged.hospCodes.length <= 1;

  const send = async (preview) => {
    setBusy(true);
    setError("");
    try {
      const json = await apiRequest(ENDPOINT, {
        method: "POST",
        body: {
          preview,
          eoc: eocType,
          session_id: sessionId,
          facility_id: Number(facilityId),
          hosp_code: hospCode,
          files: files.filter((file) => !file.error).map((file) => file.filename),
          onhand_date: merged.onhandDate,
          inventory_complete: merged.inventoryComplete,
          items: buildImportPayload(merged, chosenCodes)
        }
      });
      if (preview) setPlan(json.plan);
      else {
        setResult(json.counts);
        setPlan(null);
        onImported?.();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppDialog open={open} onOpenChange={onOpenChange} size="xl" busy={busy}
      title="นำเข้าข้อมูลจากระบบคลังยาของโรงพยาบาล"
      description="ไฟล์ DRUGLIST / INVENTORY / RECEIPT / DISTRIBUTION ที่ส่งออกจากระบบคลังยาของ รพ. เลือกได้หลายไฟล์พร้อมกัน ระบบยังไม่บันทึกจนกว่าจะกดยืนยัน">
      <div className="space-y-4">
        {result ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
            <p className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5" aria-hidden="true" />นำเข้าเรียบร้อย</p>
            <p className="mt-1">รายงานประจำวัน {n(result.reported)} · หมด {n(result.out)} · เพิ่มยาใหม่ {n(result.created)}{result.opening ? ` · แก้ยอดตั้งต้น ${n(result.opening)}` : ""} · เท่าเดิม {n(result.unchanged)}{result.missing ? ` · ยังไม่รายงาน ${n(result.missing)}` : ""}{result.skipped ? ` · ข้าม ${n(result.skipped)}` : ""} · ล็อต {n(result.lots)}</p>
          </div>
        ) : null}

        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 sm:grid-cols-2">
          {Object.entries(HOSPITAL_FILE_KINDS).map(([kind, meta]) => (
            <p key={kind}><b className="text-slate-900">{kind}</b> {meta.label} — {meta.use}</p>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input ref={inputRef} type="file" multiple accept=".txt,.json,application/json,text/plain" className="sr-only" id="hospital-drug-files"
            onChange={(event) => addFiles(event.target.files)} />
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}><FileUp className="h-4 w-4" aria-hidden="true" />เลือกไฟล์</Button>
          {files.length ? <Button type="button" variant="ghost" onClick={() => { setFiles([]); setResult(null); }} disabled={busy}>ล้างไฟล์ที่เลือก</Button> : null}
          <span className="text-sm text-slate-500">{files.length ? `อ่านแล้ว ${files.length} ไฟล์` : "ยังไม่ได้เลือกไฟล์"}</span>
        </div>

        {merged ? (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr><th className="px-3 py-2 text-left">ชนิดไฟล์</th><th className="px-3 py-2 text-right">ไฟล์</th><th className="px-3 py-2 text-right">รายการที่อ่านได้</th><th className="px-3 py-2 text-left">ความครบถ้วน</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {merged.kinds.map((kind) => (
                    <tr key={kind.kind}>
                      <td className="px-3 py-2 font-semibold">{kind.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{n(kind.files)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{n(kind.rows)}</td>
                      <td className={`px-3 py-2 ${kind.partial ? "font-semibold text-amber-800" : "text-emerald-700"}`}>
                        {kind.totalPages === null ? "ไฟล์เต็ม" : kind.partial ? `ได้ ${n(kind.pages)} จาก ${n(kind.totalPages)} หน้า` : "ครบทุกหน้า"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {[...merged.errors, ...merged.warnings].length ? (
              <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {[...merged.errors, ...merged.warnings].map((message) => <li key={message}>• {message}</li>)}
              </ul>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
              <label className="text-sm font-semibold text-slate-800">
                หน่วยบริการของข้อมูลนี้{hospCode ? <span className="font-normal text-slate-500"> (รหัสในไฟล์ {hospCode})</span> : null}
                <select value={facilityId} onChange={(event) => setFacilityId(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal" required>
                  <option value="">เลือกหน่วยบริการ</option>
                  {(context?.facilities || []).map((facility) => <option key={facility.value} value={facility.value}>{facility.label}{facility.district ? ` (อ.${facility.district})` : ""}</option>)}
                </select>
                {context?.mapped_facility_id ? <span className="mt-1 block text-xs font-normal text-slate-500">ระบบจำหน่วยบริการของรหัสนี้จากครั้งก่อน</span> : null}
              </label>
              <div className="text-sm text-slate-700">
                <p className="font-semibold text-slate-800">ยอดคงคลัง</p>
                <p className="mt-1">{hasInventory ? `ณ สิ้นวันที่ ${merged.onhandDate ? shortThaiDate(merged.onhandDate) : "ไม่ระบุ"} — ยาที่ติดตามอยู่: ระบบคำนวณใช้ไปของวันนั้นเป็นรายงานประจำวัน · ยาใหม่: ใช้เป็นยอดตั้งต้น` : "ไม่มีไฟล์ INVENTORY: บันทึกได้เฉพาะอัตราใช้ปกติของยาที่ติดตามอยู่"}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-[14rem] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นชื่อยาหรือรหัส" className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-2 text-sm" aria-label="ค้นชื่อยาหรือรหัส" />
              </label>
              <label className="flex items-center gap-1.5 text-sm text-slate-700"><input type="checkbox" checked={onlySelected} onChange={(event) => setOnlySelected(event.target.checked)} />แสดงเฉพาะที่ติดตาม/เลือก</label>
              <Button type="button" variant="ghost" className="min-h-9 px-2" onClick={() => setMany(visible.map((item) => item.working_code), true)}>เลือกที่แสดงทั้งหมด</Button>
              <Button type="button" variant="ghost" className="min-h-9 px-2" onClick={() => setMany(visible.map((item) => item.working_code), false)}>เอาออกที่แสดงทั้งหมด</Button>
            </div>
            <p className="text-sm text-slate-600">
              ติดตามอยู่ <b className="text-slate-900">{n(tracked.size)}</b> รายการ (รายงานทุกครั้งที่นำเข้า) · เลือกยาใหม่ <b className="text-slate-900">{n([...selected].filter((code) => !tracked.has(code.toUpperCase())).length)}</b> รายการ จากในไฟล์ {n(merged.items.length)} รายการ · ระบบติ๊กยาจำเป็นช่วงภัยให้แล้ว
            </p>

            <div className="max-h-[22rem] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="w-10 px-3 py-2"><span className="sr-only">เลือก</span></th>
                    <th className="px-3 py-2 text-left">ยา</th>
                    <th className="px-3 py-2 text-right">คงคลัง</th>
                    <th className="px-3 py-2 text-left">หมดอายุใกล้สุด</th>
                    <th className="px-3 py-2 text-right">ใช้/วัน (เดือนล่าสุด)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.slice(0, 500).map((item) => {
                    const month = item.usage.find((entry) => entry.used > 0);
                    return (
                      <tr key={item.working_code} className={isTracked(item) || selected.has(item.working_code) ? "bg-sky-50/60" : ""}>
                        <td className="px-3 py-1.5"><input type="checkbox" checked={isTracked(item) || selected.has(item.working_code)} disabled={isTracked(item)} onChange={() => toggle(item.working_code)} aria-label={`เลือก ${item.name}`} /></td>
                        <td className="px-3 py-1.5">
                          <span className="font-semibold text-slate-900">{item.name}</span>
                          {isTracked(item) ? <span className="ml-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">ติดตามอยู่</span> : tracked.size ? <span className="ml-1.5 rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-bold text-sky-800">ใหม่</span> : null}
                          {item.essential ? <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800">ยาจำเป็น</span> : null}
                          <span className="block text-xs text-slate-500">รหัส {item.working_code}{item.trade_name && item.trade_name !== item.name ? ` · ${item.trade_name}` : ""}{item.nlem ? ` · บัญชี ${item.nlem}` : ""}</span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{item.onhand === null ? <span className="text-slate-400">–</span> : <>{n(item.onhand)} <span className="text-xs text-slate-500">{item.unit}</span></>}</td>
                        <td className="px-3 py-1.5">{item.nearest_expiry ? shortThaiDate(item.nearest_expiry) : <span className="text-slate-400">–</span>}{item.lots.length > 1 ? <span className="block text-xs text-slate-500">{item.lots.length} ล็อต</span> : null}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{month ? <>{n(month.avg_daily)}<span className="block text-xs text-slate-500">{periodLabel(month.period)}</span></> : <span className="text-slate-400">–</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visible.length > 500 ? <p className="px-3 py-2 text-xs text-slate-500">แสดง 500 รายการแรก ค้นชื่อเพื่อหารายการอื่น</p> : null}
              {!visible.length ? <p className="px-3 py-6 text-center text-sm text-slate-500">ไม่พบรายการ</p> : null}
            </div>
          </>
        ) : null}

        {plan ? <PlanPreview plan={plan} /> : null}

        {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p> : null}
      </div>
      <AppDialogActions className="mt-4">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>{result ? "ปิด" : "ยกเลิก"}</Button>
        {plan && !plan.blocking
          ? <Button type="button" onClick={() => send(false)} disabled={busy}>{busy ? "กำลังบันทึก…" : "ยืนยันบันทึก"}</Button>
          : <Button type="button" onClick={() => send(true)} disabled={!canCheck}>{busy ? "กำลังตรวจ…" : "ตรวจก่อนบันทึก"}</Button>}
      </AppDialogActions>
    </AppDialog>
  );
}
