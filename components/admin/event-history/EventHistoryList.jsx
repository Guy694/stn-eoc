"use client";

// ประวัติเหตุการณ์: ทุกครั้งที่เปิด EOC พร้อมตัวเลขที่บอกว่าเหตุการณ์นั้นใหญ่แค่ไหน — กดเพื่อดูสรุปเต็ม
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AdminPage, DataTable, FilterSelect, StatusPill, Tabs, Toolbar } from "@/components/admin/crud";
import { apiRequest, formatNumber } from "@/lib/adminApi";
import { formatEocDisplayName, getEocTypeLabel } from "@/lib/eocDisplay";
import { useUrlState } from "@/components/admin/useUrlState";

const TYPE_TABS = ["all", "flood", "disease", "festival-accidents"];

function shortDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

// ตัวเลขที่บอกขนาดเหตุการณ์ เรียงตามความสำคัญ แสดงเฉพาะที่มีข้อมูล
function keyFacts(row) {
  const m = row.metrics || {};
  const facts = [];
  if (m.deaths) facts.push({ label: "เสียชีวิต", value: `${formatNumber(m.deaths)} ราย`, urgent: true });
  if (m.peakPeople) facts.push({ label: "ได้รับผลกระทบสูงสุด", value: `${formatNumber(m.peakPeople)} คน` });
  if (m.floodedVillages) facts.push({ label: "หมู่บ้านน้ำท่วมสูงสุด", value: formatNumber(m.floodedVillages) });
  if (m.patients) facts.push({ label: "ผู้ป่วย", value: `${formatNumber(m.patients)} ราย` });
  if (m.shelters) facts.push({ label: "ศูนย์พักพิง", value: `${formatNumber(m.shelters)} แห่ง` });
  return facts.slice(0, 3);
}

export default function EventHistoryList() {
  const [type, setType] = useUrlState("type", "all", TYPE_TABS);
  const [status, setStatus] = useState("all");
  const [year, setYear] = useState("all");
  const [search, setSearch] = useState("");
  const [state, setState] = useState({ loading: true, error: "", rows: [], years: [] });

  useEffect(() => {
    let alive = true;
    apiRequest("/stn-eoc/api/admin/eoc-sessions")
      .then((json) => alive && setState({ loading: false, error: "", rows: json.data || [], years: json.years || [] }))
      .catch((error) => alive && setState((current) => ({ ...current, loading: false, error: error.message })));
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => {
    const base = { all: state.rows.length };
    for (const row of state.rows) base[row.eoc_type] = (base[row.eoc_type] || 0) + 1;
    return base;
  }, [state.rows]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return state.rows
      .filter((row) => type === "all" || row.eoc_type === type)
      .filter((row) => status === "all" || row.status === status)
      .filter((row) => year === "all" || new Date(row.opened_at).getFullYear() === Number(year))
      .filter((row) => !query || `${formatEocDisplayName(row)} ${row.session_number} ${row.disease_name || ""} ${row.open_reason || ""} ${row.opened_by_name || ""}`.toLowerCase().includes(query));
  }, [state.rows, type, status, year, search]);

  const active = state.rows.filter((row) => row.status === "active").length;

  return (
    <AdminPage
      context="ข้อมูลย้อนหลัง"
      title="ประวัติเหตุการณ์"
      description={`ทุกครั้งที่เปิด EOC ${formatNumber(state.rows.length)} เหตุการณ์${active ? ` (เปิดอยู่ ${active})` : ""} — กดชื่อเหตุการณ์เพื่อดูผลกระทบ การช่วยเหลือ และการทำงานของศูนย์`}
    >
      <Tabs value={type} onChange={setType} items={TYPE_TABS.map((value) => ({
        value,
        label: value === "all" ? "ทั้งหมด" : getEocTypeLabel(value),
        count: counts[value] || 0
      }))} />

      {state.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{state.error}</p> : null}

      <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="ค้นหาครั้งที่ โรค เหตุผลที่เปิด หรือผู้เปิด">
        <FilterSelect label="ปี" value={year} onChange={setYear} options={[{ value: "all", label: "ทุกปี" }, ...state.years.map((value) => ({ value: String(value), label: `พ.ศ. ${value + 543}` }))]} />
        <FilterSelect label="สถานะ" value={status} onChange={setStatus} options={[{ value: "all", label: "ทุกสถานะ" }, { value: "active", label: "เปิดอยู่" }, { value: "closed", label: "ปิดแล้ว" }]} />
      </Toolbar>

      <DataTable
        caption="ประวัติเหตุการณ์ EOC"
        loading={state.loading}
        rows={rows}
        emptyText={state.rows.length ? "ไม่พบเหตุการณ์ตามตัวกรอง" : "ยังไม่เคยเปิดเหตุการณ์"}
        rowClassName={(row) => (row.status === "active" ? "bg-[#f7fbff]" : "")}
        columns={[
          { key: "event", label: "เหตุการณ์", render: (row) => (
            <div className="min-w-0">
              <Link href={`/admin/eoc-sessions/${row.id}`} className="font-bold text-[#0b4c86] hover:underline">
                {getEocTypeLabel(row.eoc_type)} ครั้งที่ {row.session_number}
              </Link>
              {row.disease_name ? <div className="text-xs text-slate-600">{row.disease_name}</div> : null}
              {row.open_reason ? <div className="line-clamp-1 max-w-xs text-xs text-slate-500">{row.open_reason}</div> : null}
            </div>
          ) },
          { key: "period", label: "ช่วงเวลา", render: (row) => (
            <div className="whitespace-nowrap">
              <div className="text-slate-800">{shortDate(row.opened_at)} – {row.closed_at ? shortDate(row.closed_at) : "ปัจจุบัน"}</div>
              <div className="text-xs text-slate-500">{row.days ? `${formatNumber(row.days)} วัน` : "-"}{row.opened_by_name ? ` · เปิดโดย ${row.opened_by_name}` : ""}</div>
            </div>
          ) },
          { key: "facts", label: "ขนาดเหตุการณ์", render: (row) => {
            const facts = keyFacts(row);
            if (!facts.length) return <span className="text-xs text-slate-400">ยังไม่มีข้อมูลผลกระทบ</span>;
            return (
              <dl className="flex flex-wrap gap-x-4 gap-y-1">
                {facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-[11px] text-slate-500">{fact.label}</dt>
                    <dd className={`text-sm font-bold ${fact.urgent ? "text-red-700" : "text-slate-900"}`}>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            );
          } },
          { key: "status", label: "สถานะ", render: (row) => (
            <StatusPill tone={row.status === "active" ? "green" : "gray"}>{row.status === "active" ? "เปิดอยู่" : "ปิดแล้ว"}</StatusPill>
          ) }
        ]}
        rowActions={(row) => (
          <Link href={`/admin/eoc-sessions/${row.id}`} className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold text-[#0b4c86] hover:bg-sky-50">
            ดูสรุป <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      />
    </AdminPage>
  );
}
