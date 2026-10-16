"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPage, Button, DataTable, Field, FormDialog, FormGrid, FormSection, ReadOnlyNotice, StatStrip, StatusPill, Tabs, inputClass, useNotice } from "@/components/admin/crud";
import { useUrlState } from "@/components/admin/useUrlState";
import { Activity, ClipboardCheck, Layers, Package, Users } from "lucide-react";
import { apiRequest, formatNumber } from "@/lib/adminApi";
import { getEocTypeLabel } from "@/lib/eocDisplay";
import { TEAM_REPORT_KEYS, TEAM_REPORT_TYPES, summarizeTeamReports } from "@/lib/teamDailyReports";
import { cn } from "@/lib/utils";

const thaiDate = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "");

// ตัวเลขที่แสดงในตารางรายอำเภอ (ไม่ใส่ทุกช่อง เพื่อให้อ่านง่าย) — ช่องที่เหลือดูได้ในหน้าต่างกรอก
const TABLE_FIELDS = {
  mcatt: ["teams_working", "home_visits", "stress_assessed", "stress_high", "referred"],
  medical: ["units", "treated", "counseled", "referred"],
  mert: ["mert_teams", "mini_mert_teams", "rescue_teams", "served", "referred"],
  doxy: ["at_risk", "doxy_new"],
  resources: ["relief_kits", "hospital_kits", "foot_meds", "boots", "life_jackets"]
};

function groupFields(config) {
  const groups = new Map();
  for (const field of config.fields) groups.set(field.group, [...(groups.get(field.group) || []), field]);
  return [...groups.entries()];
}

// รายงานประจำวันของทีม: เลือกทีม → เลือกวัน → เห็น 7 อำเภอ ว่าใครรายงานแล้ว กดกรอกจากแถวได้เลย
export default function TeamReportsWorkspace({ eocType = "flood" }) {
  const { notice, success } = useNotice();
  const [team, setTeam] = useUrlState("team", "mcatt", TEAM_REPORT_KEYS);
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [date, setDate] = useState("");
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const url = `/stn-eoc/api/eoc/team-reports?eoc=${eocType}`;
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      setState({ loading: false, data: await apiRequest(url), error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [url]);
  useEffect(() => { load(); }, [load]);

  const data = state.data;
  const today = data?.today || "";
  const selectedDate = date || today;
  const config = TEAM_REPORT_TYPES[team];
  const perms = data?.permissions?.[team] || {};
  const reports = useMemo(() => data?.reports || [], [data]);

  const summary = useMemo(() => summarizeTeamReports(reports, selectedDate), [reports, selectedDate]);
  const teamSummary = summary[team];
  // แถว = อำเภอ (รายงานรายหน่วยบริการ เช่น Doxy: หนึ่งแถวต่อหน่วยที่รายงาน + แถวว่างของอำเภอที่ยังไม่มี)
  const rows = useMemo(() => (data?.districts || []).flatMap((district) => {
    const mine = reports.filter((row) => row.report_type === team && row.report_date === selectedDate && row.district_name === district);
    if (config.perUnit && mine.length) return mine.map((report, index) => ({ id: `${district}|${report.area_note || index}`, district, unit: report.area_note || "", report, first: index === 0 }));
    return [{ id: district, district, unit: "", report: mine[0] || null, first: true }];
  }), [data, reports, team, selectedDate, config.perUnit]);
  const reportedCount = new Set(rows.filter((row) => row.report).map((row) => row.district)).size;
  const districtCount = (data?.districts || []).length;
  // ชื่อหน่วยบริการที่เคยรายงานในอำเภอ (ให้เลือกซ้ำได้ไม่ต้องพิมพ์ใหม่)
  const knownUnits = useMemo(() => {
    const map = {};
    for (const row of reports) if (row.report_type === team && row.area_note) map[row.district_name] = [...new Set([...(map[row.district_name] || []), row.area_note])];
    return map;
  }, [reports, team]);

  const openForm = (row, { newUnit = false } = {}) => {
    setFormError("");
    const report = newUnit ? null : row.report;
    const metrics = report?.metrics || {};
    setForm({
      district_name: row.district,
      previous_unit: report?.area_note || "",
      ...Object.fromEntries(config.fields.map((field) => [field.key, metrics[field.key] ? String(metrics[field.key]) : ""])),
      area_note: report?.area_note || "",
      note: report?.note || ""
    });
    setDialog({ row, newUnit });
  };

  const submit = async () => {
    setBusy(true);
    setFormError("");
    try {
      const result = await apiRequest(url, { method: "POST", body: { ...form, report_type: team, report_date: selectedDate } });
      success(result.message || "บันทึกแล้ว");
      setDialog(null);
      await load();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const fieldOf = (key) => config.fields.find((field) => field.key === key);
  const session = data?.session;
  const context = session ? `${getEocTypeLabel(eocType)} ครั้งที่ ${session.session_number}${session.status === "active" ? "" : " (ปิดแล้ว)"}` : null;

  const columns = [
    { key: "district", label: config.perUnit ? "อำเภอ / หน่วยบริการ" : "อำเภอ", render: (row) => (
      <span>
        <span className={row.first ? "font-bold text-slate-900" : "text-slate-400"}>{row.district}</span>
        {row.unit ? <span className="block text-xs font-semibold text-slate-600">{row.unit}</span> : null}
      </span>
    ) },
    ...TABLE_FIELDS[team].map((key) => {
      const field = fieldOf(key);
      return {
        key,
        label: field.group === "ผลประเมินความเครียด" ? `เครียด${field.label}` : field.label,
        className: "text-right tabular-nums",
        render: (row) => {
          if (!row.report) return <span className="text-slate-300">–</span>;
          const value = Number(row.report.metrics[key]) || 0;
          return <span className={cn(field.alert && value > 0 ? "font-black text-red-700" : "")}>{formatNumber(value)}</span>;
        }
      };
    }),
    { key: "status", label: "สถานะ", render: (row) => (row.report ? <StatusPill tone="green">รายงานแล้ว</StatusPill> : <StatusPill tone="amber">ยังไม่รายงาน</StatusPill>) }
  ];

  // ตัวเลขหลักของแต่ละแบบรายงาน: [ช่อง, คำอธิบาย] ของวันที่เลือกและสะสม
  const keyField = config.fields.find((field) => field.served) || config.fields[0];
  const sumAll = (values = {}) => config.fields.reduce((sum, field) => sum + (Number(values[field.key]) || 0), 0);
  const isResources = team === "resources";
  const stats = [
    { icon: ClipboardCheck, label: "อำเภอที่รายงาน", value: `${reportedCount} / ${districtCount}`, share: districtCount ? Math.round((reportedCount / districtCount) * 1000) / 10 : 0, className: reportedCount < districtCount ? "text-amber-700" : "text-emerald-700" },
    { icon: Activity, tone: "blue", label: isResources ? "แจกจ่ายรวม (วันที่เลือก)" : `${keyField.label} (วันที่เลือก)`, value: formatNumber(isResources ? sumAll(teamSummary?.today) : teamSummary?.today[keyField.key] || 0) },
    { icon: Layers, label: isResources ? "แจกจ่ายรวม สะสม" : `${keyField.label} สะสม`, value: formatNumber(isResources ? sumAll(teamSummary?.cumulative) : teamSummary?.cumulative[keyField.key] || 0) },
    team === "mcatt"
      ? { icon: Users, label: "เครียดระดับสูง สะสม", value: formatNumber(teamSummary?.cumulative.stress_high || 0), className: teamSummary?.cumulative.stress_high ? "text-red-700" : undefined }
      : team === "doxy"
        ? { icon: Users, label: "กลุ่มเสี่ยงที่สำรวจ สะสม", value: formatNumber(teamSummary?.cumulative.at_risk || 0) }
        : isResources
          ? { icon: Package, label: "ชุดยาช่วยเหลือ สะสม", value: formatNumber(teamSummary?.cumulative.relief_kits || 0) }
          : { icon: Users, label: "ส่งต่อ สะสม", value: formatNumber(teamSummary?.cumulative.referred || 0) }
  ];

  return (
    <AdminPage title="รายงานประจำวันรายอำเภอ" context={context} description="แต่ละทีมกรอกตัวเลขของวันนั้นแยกตามอำเภอ ระบบรวมยอดสะสมและนำขึ้นหน้าภาพรวมสถานการณ์ให้เอง">
      {notice}
      {state.error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}
      {data && !session ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">{data.message}</p> : null}
      {data && data.ready === false ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">ยังไม่ได้ติดตั้งตารางรายงานทีม ให้ผู้ดูแลระบบรัน <code>npm run db:migrate</code></p> : null}
      <ReadOnlyNotice message={perms.read_only_message} />

      <div className="rounded-xl border border-[#c9dcee] bg-white px-2">
        <Tabs value={team} onChange={setTeam} items={TEAM_REPORT_KEYS.map((key) => ({ value: key, label: TEAM_REPORT_TYPES[key].label, count: summary[key]?.districtsToday.length || undefined }))} />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <label className="text-sm font-semibold text-slate-700">
          วันที่
          <input type="date" max={today} value={selectedDate} onChange={(event) => setDate(event.target.value)} className={cn(inputClass, "mt-1 w-auto")} />
        </label>
        {selectedDate !== today && today ? <Button variant="ghost" onClick={() => setDate("")}>กลับไปวันนี้</Button> : null}
        <p className="ml-auto text-sm text-slate-600">{config.title} · {thaiDate(selectedDate)}</p>
      </div>

      {session ? <StatStrip items={stats} /> : null}

      <DataTable
        columns={columns}
        rows={rows}
        loading={state.loading}
        caption={`รายงาน ${config.label} รายอำเภอ`}
        emptyText="ยังไม่มีข้อมูล"
        rowClassName={(row) => (row.report ? "" : "bg-amber-50/30")}
        rowActions={perms.can_edit ? (row) => (
          <div className="flex flex-wrap justify-end gap-1">
            <Button variant={row.report ? "secondary" : "primary"} className="min-h-9 px-3" onClick={() => openForm(row)}>{row.report ? "แก้ไข" : "กรอกรายงาน"}</Button>
            {config.perUnit && row.report && row.first ? <Button variant="ghost" className="min-h-9 px-2" onClick={() => openForm(row, { newUnit: true })}>+ หน่วยบริการ</Button> : null}
          </div>
        ) : undefined}
      />

      <FormDialog
        open={Boolean(dialog)}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        title={dialog ? `${config.label} อ.${dialog.row.district}${!dialog.newUnit && dialog.row.unit ? ` · ${dialog.row.unit}` : ""}` : ""}
        description={`รายงานวันที่ ${thaiDate(selectedDate)} — ช่องที่ไม่มีให้เว้นว่าง (นับเป็น 0)`}
        onSubmit={submit}
        busy={busy}
        error={formError}
        submitText="บันทึกรายงาน"
        size="md"
      >
        <FormGrid>
          {groupFields(config).map(([group, fields]) => (
            <FormSection key={group} title={group}>
              {fields.map((field) => (
                <Field key={field.key} label={field.label} hint={field.unit}>
                  <input type="number" min="0" step="1" inputMode="numeric" className={inputClass} value={form[field.key] ?? ""} onChange={set(field.key)} />
                </Field>
              ))}
            </FormSection>
          ))}
          {config.areaField ? (
            <Field label={config.areaField.label} wide required={Boolean(config.areaField.required)}>
              <input className={inputClass} list="team-report-units" required={Boolean(config.areaField.required)} value={form.area_note || ""} placeholder={config.areaField.placeholder} onChange={set("area_note")} />
              <datalist id="team-report-units">{(knownUnits[dialog?.row.district] || []).map((name) => <option key={name} value={name} />)}</datalist>
            </Field>
          ) : null}
          <Field label="หมายเหตุ" wide>
            <textarea rows={2} className={inputClass} value={form.note || ""} onChange={set("note")} />
          </Field>
        </FormGrid>
      </FormDialog>
    </AdminPage>
  );
}
