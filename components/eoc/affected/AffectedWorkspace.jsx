"use client";

// ผู้ได้รับผลกระทบรายอำเภอ/ตำบล (ประชาชน อสม. บุคลากร) และการช่วยเหลือ — ใช้ส่วนประกอบเดียวกับหน้าอื่นของระบบ
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import { Bandage, HeartCrack, Home, Pencil, Search, Trash2 } from "lucide-react";
import {
  AddButton, AdminPage, Button, DataTable, Field, FilterSelect, FormDialog, FormGrid, FormSection, ReadOnlyNotice,
  StatStrip, inputClass, latestTime, useNotice
} from "@/components/admin/crud";
import { apiRequest, formatNumber } from "@/lib/adminApi";
import { getEocTypeLabel } from "@/lib/eocDisplay";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const API = "/stn-eoc/api/eoc/flood/affected";
const DISTRICTS = ["เมืองสตูล", "ควนโดน", "ควนกาหลง", "ท่าแพ", "ละงู", "ทุ่งหว้า", "มะนัง"];
const IMPACT_GROUPS = [
  { key: "citizen", title: "ประชาชน" },
  { key: "volunteer", title: "อสม." },
  { key: "staff", title: "บุคลากรสาธารณสุข" }
];
const IMPACT_FIELDS = [
  ["property", "ทรัพย์สินเสียหาย"],
  ["injured", "บาดเจ็บ"],
  ["deaths", "เสียชีวิต"],
  ["missing", "สูญหาย"]
];
const ASSIST_FIELDS = [
  ["medicine_support", "จ่ายยา/เวชภัณฑ์"],
  ["evacuated", "อพยพ"],
  ["not_evacuated", "ไม่อพยพ"]
];
const NUMBER_KEYS = [...IMPACT_GROUPS.flatMap((group) => IMPACT_FIELDS.map(([field]) => `${group.key}_${field}`)), ...ASSIST_FIELDS.map(([key]) => key)];
// สีตามความรุนแรงของผลกระทบต่อชีวิต (ใช้กับกราฟเท่านั้น)
const CASUALTY_SERIES = [
  ["deaths", "เสียชีวิต", "#7f1d1d"],
  ["missing", "สูญหาย", "#dc2626"],
  ["injured", "บาดเจ็บ", "#f59e0b"]
];

const n = (value) => Number(value) || 0;
const bangkokToday = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
/** ค่าวันที่จาก API (DATE หรือ ISO) → YYYY-MM-DD ตามเวลาไทย */
const toDateKey = (value) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
};
const thaiDate = (value) => {
  const key = toDateKey(value);
  return key ? new Date(`${key}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-";
};
const emptyForm = (date) => ({
  report_date: date,
  district_name: "",
  tambon: "",
  notes: "",
  ...Object.fromEntries(NUMBER_KEYS.map((key) => [key, ""]))
});
const totalsOf = (row) => ({
  deaths: IMPACT_GROUPS.reduce((sum, group) => sum + n(row[`${group.key}_deaths`]), 0),
  missing: IMPACT_GROUPS.reduce((sum, group) => sum + n(row[`${group.key}_missing`]), 0),
  injured: IMPACT_GROUPS.reduce((sum, group) => sum + n(row[`${group.key}_injured`]), 0),
  affected: IMPACT_GROUPS.reduce((sum, group) => sum + n(row[`${group.key}_property`]), 0)
});

/** ตัวเลข 0 แสดงเป็นขีดจาง ให้ตัวเลขที่มีค่าเด่น */
function Num({ value, strong = false }) {
  const number = n(value);
  if (!number) return <span className="text-slate-300">–</span>;
  return <span className={strong ? "font-bold text-red-700" : "text-slate-800"}>{formatNumber(number)}</span>;
}

function DistrictTable({ rows, prefix, title }) {
  const byDistrict = new Map(rows.map((row) => [row.district_name, row]));
  const value = (row, key) => n(row?.[`${prefix}_${key}`]);
  const total = (key) => rows.reduce((sum, row) => sum + value(row, key), 0);
  const columns = [...IMPACT_GROUPS.flatMap((group) => IMPACT_FIELDS.map(([field]) => `${group.key}_${field}`)), ...ASSIST_FIELDS.map(([key]) => key)];
  const critical = (key) => /_(deaths|missing)$/.test(key);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="font-black text-slate-900">สรุปรายอำเภอ</h2>
        <span className="text-xs text-slate-500">{title}</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#083865] text-white">
              <th rowSpan={2} scope="col" className="sticky left-0 z-10 bg-[#083865] px-3 py-2 text-left font-bold">อำเภอ</th>
              {IMPACT_GROUPS.map((group) => <th key={group.key} colSpan={4} scope="colgroup" className="border-l border-white/15 px-2 py-1.5 text-center font-bold">{group.title}</th>)}
              <th colSpan={3} scope="colgroup" className="border-l border-white/15 px-2 py-1.5 text-center font-bold">การช่วยเหลือ</th>
            </tr>
            <tr className="bg-[#0b4c86] text-xs text-white/90">
              {IMPACT_GROUPS.map((group) => IMPACT_FIELDS.map(([field, label], index) => (
                <th key={`${group.key}-${field}`} scope="col" className={`whitespace-nowrap px-2 py-1.5 text-center font-semibold ${index === 0 ? "border-l border-white/15" : ""}`}>{label.replace("ทรัพย์สินเสียหาย", "ทรัพย์สิน")}</th>
              )))}
              {ASSIST_FIELDS.map(([key, label], index) => <th key={key} scope="col" className={`whitespace-nowrap px-2 py-1.5 text-center font-semibold ${index === 0 ? "border-l border-white/15" : ""}`}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {DISTRICTS.map((district, rowIndex) => {
              const row = byDistrict.get(district);
              return (
                <tr key={district} className={rowIndex % 2 ? "bg-slate-50/70" : "bg-white"}>
                  <th scope="row" className={`sticky left-0 z-10 whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-900 ${rowIndex % 2 ? "bg-slate-50" : "bg-white"}`}>อ.{district}</th>
                  {columns.map((key) => <td key={key} className="px-2 py-2 text-center tabular-nums"><Num value={value(row, key)} strong={critical(key)} /></td>)}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#0b4c86] bg-[#edf5fc] font-bold text-slate-900">
              <th scope="row" className="sticky left-0 z-10 bg-[#edf5fc] px-3 py-2 text-left">รวมทั้งจังหวัด</th>
              {columns.map((key) => <td key={key} className="px-2 py-2 text-center tabular-nums"><Num value={total(key)} strong={critical(key)} /></td>)}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function CasualtyChart({ rows, prefix }) {
  const byDistrict = new Map(rows.map((row) => [row.district_name, row]));
  const any = rows.some((row) => CASUALTY_SERIES.some(([key]) => n(row[`${prefix}_${key}`])));
  if (!any) {
    return <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">ยังไม่มีรายงานผู้เสียชีวิต สูญหาย หรือบาดเจ็บในช่วงที่เลือก</p>;
  }
  const data = {
    labels: DISTRICTS.map((district) => `อ.${district}`),
    datasets: CASUALTY_SERIES.map(([key, label, color]) => ({
      label, backgroundColor: color, borderRadius: 3, stack: "people",
      data: DISTRICTS.map((district) => n(byDistrict.get(district)?.[`${prefix}_${key}`]))
    }))
  };
  const options = {
    indexAxis: "y",
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { family: "Kanit", size: 12 } } }, tooltip: { mode: "index", intersect: false } },
    scales: {
      x: { stacked: true, beginAtZero: true, ticks: { precision: 0, font: { family: "Kanit" } }, grid: { color: "rgba(15,23,42,0.06)" } },
      y: { stacked: true, ticks: { font: { family: "Kanit" } }, grid: { display: false } }
    }
  };
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-black text-slate-900">เสียชีวิต สูญหาย บาดเจ็บ รายอำเภอ</h2>
      <p className="text-xs text-slate-500">รวมประชาชน อสม. และบุคลากร · ยอดทรัพย์สินเสียหายดูในตารางสรุป</p>
      <div className="mt-3 h-64"><Bar data={data} options={options} /></div>
    </section>
  );
}

export default function AffectedWorkspace() {
  const { notice, success, fail } = useNotice();
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [state, setState] = useState({ loading: true, reports: [], summary: { today: [], cumulative: [], province: {} }, permissions: {} });
  const [mode, setMode] = useState("range");
  const [range, setRange] = useState({ start: "", end: bangkokToday(), date: bangkokToday() });
  const [district, setDistrict] = useState("all");
  const [dialog, setDialog] = useState(null); // { editing, form }
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);

  // เหตุการณ์อุทกภัย: เริ่มที่เหตุการณ์ที่เปิดอยู่ ช่วงวันที่ตั้งแต่วันเปิดเหตุการณ์ถึงวันนี้
  useEffect(() => {
    apiRequest("/stn-eoc/api/eoc/sessions?type=flood&limit=50")
      .then((json) => {
        const list = Array.isArray(json.data) ? json.data : [];
        setSessions(list);
        const pick = list.find((item) => item.status === "active") || list[0];
        if (pick) {
          setSessionId(String(pick.id));
          setRange((current) => ({ ...current, start: toDateKey(pick.opened_at) || current.end }));
        } else {
          setState((current) => ({ ...current, loading: false }));
        }
      })
      .catch((error) => { fail(error.message); setState((current) => ({ ...current, loading: false })); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const session = sessions.find((item) => String(item.id) === sessionId) || null;

  const load = useCallback(async () => {
    if (!sessionId) return;
    const params = new URLSearchParams({ session_id: sessionId });
    if (mode === "daily") params.set("date", range.date);
    else if (range.start && range.end) { params.set("start_date", range.start); params.set("end_date", range.end); }
    setState((current) => ({ ...current, loading: true }));
    try {
      const json = await apiRequest(`${API}?${params.toString()}`);
      setState({
        loading: false,
        reports: Array.isArray(json.data) ? json.data : [],
        summary: json.summary || { today: [], cumulative: [], province: {} },
        permissions: json.permissions || {}
      });
    } catch (error) {
      fail(error.message);
      setState((current) => ({ ...current, loading: false }));
    }
  }, [sessionId, mode, range.date, range.start, range.end, fail]);
  useEffect(() => { load(); }, [load]);

  const canEdit = state.permissions.can_edit === true && session?.status === "active";
  const prefix = mode === "daily" ? "today" : "cumulative";
  const summaryRows = mode === "daily" ? state.summary.today || [] : state.summary.cumulative || [];
  const province = state.summary.province || {};
  const periodLabel = mode === "daily" ? `ประจำวันที่ ${thaiDate(range.date)}` : `สะสม ${thaiDate(range.start)} – ${thaiDate(range.end)}`;
  const reports = useMemo(() => state.reports.filter((row) => district === "all" || row.district_name === district), [state.reports, district]);

  const openForm = (report = null) => {
    setFormError("");
    setDialog({
      editing: report,
      form: report
        ? { ...emptyForm(toDateKey(report.report_date)), district_name: report.district_name || "", tambon: report.tambon || "", notes: report.notes || "", ...Object.fromEntries(NUMBER_KEYS.map((key) => [key, report[key] ?? ""])) }
        : emptyForm(mode === "daily" ? range.date : bangkokToday())
    });
  };
  const setField = (key) => (event) => setDialog((current) => ({ ...current, form: { ...current.form, [key]: event.target.value } }));
  const formTotals = dialog ? totalsOf(dialog.form) : null;

  const submit = async () => {
    const form = dialog.form;
    if (!form.report_date || !form.district_name) return setFormError("กรุณาเลือกวันที่และอำเภอ");
    if (NUMBER_KEYS.some((key) => n(form[key]) < 0)) return setFormError("ตัวเลขต้องไม่ติดลบ");
    const numbers = Object.fromEntries(NUMBER_KEYS.map((key) => [key, Math.max(0, Math.round(n(form[key])))]));
    const totals = totalsOf(numbers);
    setBusy(true);
    setFormError("");
    try {
      await apiRequest(dialog.editing ? `${API}?id=${dialog.editing.id}` : API, {
        method: dialog.editing ? "PUT" : "POST",
        body: { ...form, ...numbers, ...totals, session_id: Number(sessionId) }
      });
      success(dialog.editing ? "บันทึกการแก้ไขแล้ว" : "บันทึกรายงานแล้ว");
      setDialog(null);
      await load();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async () => {
    setBusy(true);
    try {
      await apiRequest(`${API}?id=${removing.id}`, { method: "DELETE" });
      success("ลบรายงานแล้ว");
      setRemoving(null);
      await load();
    } catch (error) {
      fail(error.message);
    } finally {
      setBusy(false);
    }
  };

  const deaths = n(province.province_deaths);
  const missing = n(province.province_missing);
  const injured = n(province.province_injured);
  const columns = [
    { key: "report_date", label: "วันที่", render: (row) => <span className="whitespace-nowrap">{thaiDate(row.report_date)}</span> },
    { key: "area", label: "พื้นที่", render: (row) => <span><b className="text-slate-900">อ.{row.district_name}</b>{row.tambon ? <span className="text-slate-500"> · ต.{row.tambon}</span> : null}</span> },
    {
      key: "casualty", label: "เสียชีวิต / สูญหาย / บาดเจ็บ", className: "text-center",
      render: (row) => (
        <span className="tabular-nums" title={IMPACT_GROUPS.map((group) => `${group.title}: เสียชีวิต ${n(row[`${group.key}_deaths`])} สูญหาย ${n(row[`${group.key}_missing`])} บาดเจ็บ ${n(row[`${group.key}_injured`])}`).join("\n")}>
          <Num value={row.deaths} strong /> <span className="text-slate-300">/</span> <Num value={row.missing} strong /> <span className="text-slate-300">/</span> <Num value={row.injured} />
        </span>
      )
    },
    { key: "affected", label: "ทรัพย์สินเสียหาย", className: "text-center", render: (row) => <span className="tabular-nums"><Num value={row.affected} /></span> },
    {
      key: "assist", label: "การช่วยเหลือ",
      render: (row) => (
        <span className="text-xs text-slate-600">
          {ASSIST_FIELDS.filter(([key]) => n(row[key])).map(([key, label]) => `${label} ${formatNumber(n(row[key]))}`).join(" · ") || <span className="text-slate-300">–</span>}
        </span>
      )
    },
    { key: "notes", label: "หมายเหตุ", render: (row) => <span className="text-xs text-slate-600">{row.notes || <span className="text-slate-300">–</span>}</span> }
  ];

  return (
    <AdminPage
      context={session ? `${getEocTypeLabel("flood")} ครั้งที่ ${session.session_number}${session.status === "active" ? "" : " (ปิดแล้ว)"}` : null}
      title="ผู้ได้รับผลกระทบ"
      description="ผู้เสียชีวิต สูญหาย บาดเจ็บ และทรัพย์สินเสียหาย ของประชาชน อสม. และบุคลากรสาธารณสุข พร้อมการช่วยเหลือ รายอำเภอ"
      actions={canEdit ? <AddButton onClick={() => openForm()}>เพิ่มรายงาน</AddButton> : null}
      freshness={session ? { value: latestTime(state.reports.map((row) => row.updated_at || row.created_at)), staleHours: 24, label: "รายงานล่าสุด" } : null}
    >
      {notice}
      <ReadOnlyNotice message={state.permissions.can_edit ? null : state.permissions.read_only_message} />

      {/* ช่วงเวลา */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div role="group" aria-label="รูปแบบช่วงเวลา" className="inline-flex overflow-hidden rounded-lg border border-slate-300">
          {[["range", "สะสมตามช่วง"], ["daily", "รายวัน"]].map(([key, label]) => (
            <button key={key} type="button" aria-pressed={mode === key} onClick={() => setMode(key)}
              className={`min-h-10 px-4 text-sm font-bold transition ${mode === key ? "bg-[#0b4c86] text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</button>
          ))}
        </div>
        {mode === "daily" ? (
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-slate-600">วันที่</span>
            <input type="date" className={inputClass} value={range.date} max={bangkokToday()} onChange={(event) => setRange((current) => ({ ...current, date: event.target.value }))} />
          </label>
        ) : (
          <>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold text-slate-600">ตั้งแต่</span>
              <input type="date" className={inputClass} value={range.start} max={range.end} onChange={(event) => setRange((current) => ({ ...current, start: event.target.value }))} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold text-slate-600">ถึง</span>
              <input type="date" className={inputClass} value={range.end} min={range.start} onChange={(event) => setRange((current) => ({ ...current, end: event.target.value }))} />
            </label>
          </>
        )}
        <div className="min-w-[10rem]">
          <span className="mb-1 block text-xs font-semibold text-slate-600">อำเภอ (รายการรายงาน)</span>
          <FilterSelect label="อำเภอ" value={district} onChange={setDistrict} options={[{ value: "all", label: "ทุกอำเภอ" }, ...DISTRICTS.map((name) => ({ value: name, label: `อ.${name}` }))]} />
        </div>
        {sessions.length > 1 ? (
          <div className="ml-auto min-w-[14rem]">
            <span className="mb-1 block text-xs font-semibold text-slate-600">เหตุการณ์</span>
            <FilterSelect label="เหตุการณ์" value={sessionId} onChange={(value) => {
              setSessionId(value);
              const next = sessions.find((item) => String(item.id) === value);
              if (next) setRange((current) => ({ ...current, start: toDateKey(next.opened_at), end: next.closed_at ? toDateKey(next.closed_at) : bangkokToday() }));
            }} options={sessions.map((item) => ({ value: String(item.id), label: `ครั้งที่ ${item.session_number} · ${thaiDate(item.opened_at)}${item.status === "active" ? " (เปิดอยู่)" : ""}` }))} />
          </div>
        ) : null}
      </div>

      {!state.loading && !session ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">ยังไม่มีเหตุการณ์อุทกภัย</p>
      ) : null}

      {session ? (
        <>
          <StatStrip items={[
            { icon: HeartCrack, label: "เสียชีวิต", value: formatNumber(deaths), unit: "คน", className: deaths ? "text-red-800" : undefined },
            { icon: Search, label: "สูญหาย", value: formatNumber(missing), unit: "คน", className: missing ? "text-red-700" : undefined },
            { icon: Bandage, label: "บาดเจ็บ", value: formatNumber(injured), unit: "คน", className: injured ? "text-amber-700" : undefined },
            { icon: Home, label: "ทรัพย์สินเสียหาย", value: formatNumber(n(province.province_affected)), unit: "ราย" }
          ]} />
          <p className="-mt-2 text-xs text-slate-500">ยอดทั้งจังหวัด {periodLabel}</p>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <CasualtyChart rows={summaryRows} prefix={prefix} />
            <DistrictTable rows={summaryRows} prefix={prefix} title={periodLabel} />
          </div>

          <section className="space-y-2">
            <h2 className="font-black text-slate-900">รายงานที่บันทึก <span className="text-sm font-semibold text-slate-500">({formatNumber(reports.length)} รายการ)</span></h2>
            <DataTable
              columns={columns}
              rows={reports}
              loading={state.loading}
              emptyText="ยังไม่มีรายงานในช่วงวันที่ที่เลือก"
              emptyAction={canEdit ? <AddButton onClick={() => openForm()}>เพิ่มรายงาน</AddButton> : null}
              rowActions={canEdit ? (row) => (
                <span className="inline-flex gap-1">
                  <Button variant="ghost" className="min-h-9 px-2" onClick={() => openForm(row)} aria-label={`แก้ไขรายงาน อ.${row.district_name}`}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" className="min-h-9 px-2 text-red-700" onClick={() => setRemoving(row)} aria-label={`ลบรายงาน อ.${row.district_name}`}><Trash2 className="h-4 w-4" /></Button>
                </span>
              ) : undefined}
            />
          </section>
        </>
      ) : null}

      <FormDialog
        open={Boolean(dialog)}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        title={dialog?.editing ? "แก้ไขรายงานผู้ได้รับผลกระทบ" : "เพิ่มรายงานผู้ได้รับผลกระทบ"}
        description="กรอกเฉพาะช่องที่มีตัวเลข ช่องว่างนับเป็น 0 ระบบรวมยอดทั้งสามกลุ่มให้"
        onSubmit={submit}
        busy={busy}
        error={formError}
        submitText={dialog?.editing ? "บันทึกการแก้ไข" : "บันทึกรายงาน"}
      >
        {dialog ? (
          <FormGrid>
            <Field label="วันที่รายงาน" required><input type="date" className={inputClass} value={dialog.form.report_date} max={bangkokToday()} onChange={setField("report_date")} /></Field>
            <Field label="อำเภอ" required>
              <select className={inputClass} value={dialog.form.district_name} onChange={setField("district_name")}>
                <option value="">เลือกอำเภอ</option>
                {DISTRICTS.map((name) => <option key={name} value={name}>อ.{name}</option>)}
              </select>
            </Field>
            <Field label="ตำบล" hint="เว้นว่างถ้ารายงานรวมทั้งอำเภอ" wide><input className={inputClass} value={dialog.form.tambon} onChange={setField("tambon")} /></Field>
            {IMPACT_GROUPS.map((group) => (
              <FormSection key={group.key} title={group.title}>
                <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4">
                  {IMPACT_FIELDS.map(([field, label]) => (
                    <Field key={field} label={label}>
                      <input type="number" min="0" inputMode="numeric" className={inputClass} value={dialog.form[`${group.key}_${field}`]} onChange={setField(`${group.key}_${field}`)} placeholder="0" />
                    </Field>
                  ))}
                </div>
              </FormSection>
            ))}
            <FormSection title="การช่วยเหลือ">
              <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                {ASSIST_FIELDS.map(([key, label]) => (
                  <Field key={key} label={label}><input type="number" min="0" inputMode="numeric" className={inputClass} value={dialog.form[key]} onChange={setField(key)} placeholder="0" /></Field>
                ))}
              </div>
            </FormSection>
            <Field label="หมายเหตุ" wide><textarea rows={2} className={inputClass} value={dialog.form.notes} onChange={setField("notes")} /></Field>
            <p className="rounded-lg bg-[#edf5fc] px-3 py-2 text-sm text-[#083865] sm:col-span-2">
              รวมทั้งสามกลุ่ม: เสียชีวิต <b>{formTotals.deaths}</b> · สูญหาย <b>{formTotals.missing}</b> · บาดเจ็บ <b>{formTotals.injured}</b> · ทรัพย์สินเสียหาย <b>{formTotals.affected}</b>
            </p>
          </FormGrid>
        ) : null}
      </FormDialog>

      <FormDialog
        open={Boolean(removing)}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        title="ลบรายงาน"
        description={removing ? `อ.${removing.district_name}${removing.tambon ? ` ต.${removing.tambon}` : ""} วันที่ ${thaiDate(removing.report_date)}` : ""}
        onSubmit={confirmRemove}
        busy={busy}
        submitText="ลบรายงาน"
        size="md"
      >
        <p className="text-sm text-slate-700">รายงานนี้จะถูกลบออกจากยอดสรุปทั้งหมด ถ้าตัวเลขผิดให้ใช้ปุ่มแก้ไขแทน</p>
      </FormDialog>
    </AdminPage>
  );
}
