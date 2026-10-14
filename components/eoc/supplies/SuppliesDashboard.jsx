"use client";

// Dashboard วิเคราะห์เวชภัณฑ์ของเหตุการณ์: ต้องเติมด่วน · ภาพรวมรายเวชภัณฑ์ · แนวโน้มรายวัน · การส่งรายงาน · หน่วยบริการ/อำเภอ × เวชภัณฑ์ · ยอดนับไม่ตรง
import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, DataTable, FilterSelect, StatStrip, StatusPill } from "@/components/admin/crud";
import { formatNumber } from "@/lib/adminApi";
import { COVER_LEVELS, DAILY_WINDOW_DAYS, shortThaiDate } from "@/lib/medicalDaily";
import { STOCK_LEVEL_LABELS } from "@/lib/medicalInventory";

const LEVEL_CELL = {
  out: "bg-red-100 text-red-900",
  low: "bg-amber-100 text-amber-900",
  ok: "bg-emerald-50 text-emerald-900",
  unknown: "bg-slate-50 text-slate-500"
};

function Section({ title, description, actions, children }) {
  return (
    <section className="rounded-xl border border-[#c9dcee] bg-white">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-base font-black text-slate-900">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-slate-600">{description}</p> : null}
        </div>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function CoverPill({ days, level }) {
  const config = COVER_LEVELS[level] || COVER_LEVELS.idle;
  return <StatusPill tone={config.tone}>{days === null || days === undefined ? "ยังไม่มีการใช้" : `${formatNumber(days)} วัน`}</StatusPill>;
}

function LevelPill({ level }) {
  const config = STOCK_LEVEL_LABELS[level] || STOCK_LEVEL_LABELS.unknown;
  return <StatusPill tone={config.tone}>{config.label}</StatusPill>;
}

const qty = (value, unit) => <span className="tabular-nums">{formatNumber(value)}{unit ? <span className="ml-1 text-xs text-slate-500">{unit}</span> : null}</span>;

function ItemTrend({ item }) {
  if (!item) return <p className="text-sm text-slate-500">เลือกเวชภัณฑ์จากตารางด้านบนเพื่อดูแนวโน้ม</p>;
  const data = item.series.map((point) => ({ ...point, label: shortThaiDate(point.date) }));
  if (!data.length) return <p className="text-sm text-slate-500">ยังไม่มีข้อมูลรายวันของรายการนี้</p>;
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="flow" tick={{ fontSize: 12 }} allowDecimals={false} width={56} />
          <YAxis yAxisId="balance" orientation="right" tick={{ fontSize: 12 }} allowDecimals={false} width={64} />
          <Tooltip formatter={(value, name) => [`${formatNumber(value)} ${item.unit || ""}`, name]} labelFormatter={(label) => `วันที่ ${label}`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="flow" dataKey="used" name="ใช้ไป/จ่ายออก" fill="#c2410c" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="flow" dataKey="received" name="รับเข้า" fill="#0b4c86" radius={[4, 4, 0, 0]} />
          <Line yAxisId="balance" type="monotone" dataKey="end" name="คงเหลือสิ้นวัน" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ReportingPanel({ reporting, onPickFacility }) {
  const today = reporting.today;
  const pending = today.facilities.filter((facility) => facility.status !== "complete");
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div>
        <p className="text-sm text-slate-700">
          ครบ <b className="text-emerald-700">{formatNumber(today.complete)}</b> · ไม่ครบ <b className="text-amber-700">{formatNumber(today.partial)}</b> · ยังไม่รายงาน <b className="text-red-700">{formatNumber(today.missing)}</b> จาก {formatNumber(today.total)} หน่วยบริการ
        </p>
        {pending.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {pending.map((facility) => (
              <li key={facility.facility_id}>
                <button type="button" onClick={() => onPickFacility?.(facility.facility_id)} className={`rounded-full border px-3 py-1 text-sm font-semibold hover:brightness-95 ${facility.status === "missing" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                  {facility.name}{facility.status === "partial" ? ` (${facility.reported}/${facility.items})` : ""}
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm font-semibold text-emerald-700">ทุกหน่วยบริการรายงานครบแล้ว</p>}
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={reporting.series.map((day) => ({ ...day, label: shortThaiDate(day.date) }))} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip formatter={(value, name) => [`${formatNumber(value)} หน่วย`, name]} />
            <Bar dataKey="complete" name="ครบ" stackId="r" fill="#059669" />
            <Bar dataKey="partial" name="ไม่ครบ" stackId="r" fill="#d97706" />
            <Bar dataKey="missing" name="ยังไม่รายงาน" stackId="r" fill="#dc2626" radius={[3, 3, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Matrix({ stocks, items, districts, mode }) {
  const shortName = (name) => (name.length > 16 ? `${name.slice(0, 15)}…` : name);
  if (mode === "district") {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-600">
            <tr>
              <th scope="col" className="sticky left-0 bg-slate-50 px-3 py-2 text-left">อำเภอ</th>
              {items.map((item) => <th key={item.item_code} scope="col" title={`${item.item_name} (${item.unit || ""})`} className="px-3 py-2 text-right">{shortName(item.item_name)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {districts.map((district) => (
              <tr key={district.district}>
                <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left font-semibold text-slate-900">อ.{district.district}<span className="block text-xs font-normal text-slate-500">{district.facilities} หน่วย</span></th>
                {items.map((item) => {
                  const cell = district.items[item.item_code];
                  return (
                    <td key={item.item_code} className={`px-3 py-2 text-right tabular-nums ${cell?.out ? "bg-red-50 text-red-900" : ""}`}>
                      {cell ? <>{formatNumber(cell.balance)}<span className="block text-xs text-slate-500">ใช้ {formatNumber(cell.avg_use)}/วัน{cell.out ? ` · หมด ${cell.out}` : ""}</span></> : <span className="text-slate-300">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const facilities = [];
  const seen = new Map();
  for (const stock of stocks) {
    if (!seen.has(stock.facility_id)) {
      seen.set(stock.facility_id, { id: stock.facility_id, name: stock.agency_name, district: stock.district, cells: {} });
      facilities.push(seen.get(stock.facility_id));
    }
    seen.get(stock.facility_id).cells[stock.item_code] = stock;
  }
  facilities.sort((a, b) => String(a.district).localeCompare(String(b.district), "th") || String(a.name).localeCompare(String(b.name), "th"));
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs font-bold text-slate-600">
          <tr>
            <th scope="col" className="sticky left-0 bg-slate-50 px-3 py-2 text-left">หน่วยบริการ</th>
            {items.map((item) => <th key={item.item_code} scope="col" title={`${item.item_name} (${item.unit || ""})`} className="px-3 py-2 text-right">{shortName(item.item_name)}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {facilities.map((facility) => (
            <tr key={facility.id}>
              <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left font-semibold text-slate-900">{facility.name}<span className="block text-xs font-normal text-slate-500">อ.{facility.district}</span></th>
              {items.map((item) => {
                const cell = facility.cells[item.item_code];
                if (!cell) return <td key={item.item_code} className="px-3 py-2 text-right text-slate-300">—</td>;
                return (
                  <td key={item.item_code} className={`px-3 py-2 text-right tabular-nums ${LEVEL_CELL[cell.level] || ""}`} title={`${cell.item_name}: คงเหลือ ${formatNumber(cell.balance)} ${cell.unit || ""}${cell.days_cover !== null ? ` · พอใช้อีก ${formatNumber(cell.days_cover)} วัน` : ""}`}>
                    {formatNumber(cell.balance)}
                    {cell.days_cover !== null ? <span className={`block text-xs ${cell.cover_level === "critical" ? "font-bold text-red-700" : "text-slate-500"}`}>{formatNumber(cell.days_cover)} วัน</span> : null}
                    {!cell.reported_today ? <span className="block text-xs text-slate-400">ยังไม่รายงาน</span> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SuppliesDashboard({ eocType = "flood", sessionId, refreshKey, onPickFacility }) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [itemCode, setItemCode] = useState("");
  const [matrixMode, setMatrixMode] = useState("facility");

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({ eoc: eocType });
    if (sessionId) params.set("session_id", String(sessionId));
    setState((current) => ({ ...current, loading: true, error: "" }));
    fetch(`/stn-eoc/api/eoc/supplies/dashboard?${params}`, { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok || !json.success) throw new Error(json.message || "โหลด dashboard ไม่สำเร็จ");
        if (alive) setState({ loading: false, data: json.dashboard, error: "" });
      })
      .catch((error) => { if (alive) setState({ loading: false, data: null, error: error.message }); });
    return () => { alive = false; };
  }, [eocType, sessionId, refreshKey]);

  const dashboard = state.data;
  const items = useMemo(() => dashboard?.items || [], [dashboard]);
  const selectedItem = items.find((item) => item.item_code === itemCode) || items[0] || null;

  if (state.loading && !dashboard) return <div className="h-64 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />;
  if (state.error) return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>;
  if (!dashboard || !dashboard.stocks.length) {
    return <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">ยังไม่มีรายการเวชภัณฑ์ — นำเข้ายอดตั้งต้นหรือเพิ่มรายการก่อน แล้ว dashboard จะแสดงที่นี่</p>;
  }

  const { summary, reporting } = dashboard;
  const urgentColumns = [
    { key: "item_name", label: "รายการ", render: (row) => <span className="font-bold text-slate-900">{row.item_name}<span className="block text-xs font-normal text-slate-500">{row.agency_name} · อ.{row.district}</span></span> },
    { key: "balance", label: "คงเหลือ", className: "text-right", render: (row) => qty(row.balance, row.unit) },
    { key: "avg_use", label: `ใช้เฉลี่ย/วัน (${DAILY_WINDOW_DAYS} วัน)`, className: "text-right", render: (row) => qty(row.avg_use) },
    { key: "days_cover", label: "พอใช้อีก", render: (row) => <CoverPill days={row.days_cover} level={row.cover_level} /> },
    { key: "level", label: "สถานะ", render: (row) => <LevelPill level={row.level} /> },
    { key: "last_report", label: "รายงานล่าสุด", render: (row) => (row.last_report ? shortThaiDate(row.last_report) : <span className="text-slate-400">ยังไม่เคย</span>) }
  ];
  const itemColumns = [
    { key: "item_name", label: "เวชภัณฑ์", render: (row) => (
      <button type="button" onClick={() => setItemCode(row.item_code)} className={`text-left font-bold hover:underline ${selectedItem?.item_code === row.item_code ? "text-[#0b4c86]" : "text-slate-900"}`}>
        {row.item_name}<span className="block text-xs font-normal text-slate-500">{row.facilities} หน่วยบริการ · {row.unit || "-"}</span>
      </button>
    ) },
    { key: "opening", label: "ยอดตั้งต้น", className: "text-right", render: (row) => qty(row.opening) },
    { key: "received", label: "รับเข้า", className: "text-right", render: (row) => qty(row.received) },
    { key: "used", label: "ใช้ไป", className: "text-right", render: (row) => qty(row.used) },
    { key: "balance", label: "คงเหลือ", className: "text-right", render: (row) => <b>{qty(row.balance)}</b> },
    { key: "avg_use", label: "ใช้เฉลี่ย/วัน", className: "text-right", render: (row) => qty(row.avg_use) },
    { key: "days_cover", label: "พอใช้อีก", render: (row) => <CoverPill days={row.days_cover} level={row.cover_level} /> },
    { key: "out", label: "หน่วยที่หมด/ใกล้หมด", className: "text-right", render: (row) => <span className="tabular-nums"><span className={row.out ? "font-bold text-red-700" : ""}>{row.out}</span> / <span className={row.low ? "font-bold text-amber-700" : ""}>{row.low}</span></span> }
  ];
  const diffColumns = [
    { key: "date", label: "วันที่", render: (row) => shortThaiDate(row.date) },
    { key: "item_name", label: "รายการ", render: (row) => <span>{row.item_name}<span className="block text-xs text-slate-500">{row.agency_name}</span></span> },
    { key: "end", label: "ระบบคำนวณ", className: "text-right", render: (row) => qty(row.end, row.unit) },
    { key: "counted", label: "นับได้จริง", className: "text-right", render: (row) => qty(row.counted, row.unit) },
    { key: "diff", label: "ต่าง", className: "text-right", render: (row) => <b className={row.diff < 0 ? "text-red-700" : "text-amber-700"}>{row.diff > 0 ? "+" : ""}{formatNumber(row.diff)}</b> }
  ];

  return (
    <div className="space-y-4">
      <StatStrip items={[
        { label: "รายการเวชภัณฑ์", value: `${formatNumber(summary.items)} ชนิด` },
        { label: `รายงานวันที่ ${shortThaiDate(dashboard.today)}`, value: `${formatNumber(reporting.today.complete)}/${formatNumber(reporting.today.total)} หน่วย`, className: reporting.today.missing ? "text-amber-700" : "text-emerald-700" },
        { label: "หมด / พอใช้ไม่ถึง 3 วัน", value: `${formatNumber(summary.out)} / ${formatNumber(summary.critical_cover)}`, className: summary.out || summary.critical_cover ? "text-red-700" : undefined },
        { label: "ยอดนับไม่ตรงวันนี้", value: formatNumber(summary.discrepancies), className: summary.discrepancies ? "text-amber-700" : undefined }
      ]} />

      <Section title="ต้องเติมด่วน" description={`รายการที่หมด ใกล้หมด หรือคาดว่าพอใช้ไม่เกิน 7 วัน (คิดจากอัตราใช้เฉลี่ย ${DAILY_WINDOW_DAYS} วันล่าสุด)`}>
        <DataTable columns={urgentColumns} rows={dashboard.urgent} caption="ต้องเติมด่วน" emptyText="ไม่มีรายการที่ต้องเติมด่วน" pageSize={10}
          rowClassName={(row) => (row.level === "out" || row.cover_level === "critical" ? "bg-red-50/40" : "")} />
      </Section>

      <Section title="การส่งรายงานประจำวัน" description="หน่วยบริการต้องรายงานทุกรายการทุกวัน กดชื่อหน่วยที่ยังไม่รายงานเพื่อกรอกแทนได้">
        <ReportingPanel reporting={reporting} onPickFacility={onPickFacility} />
      </Section>

      <Section title="ภาพรวมรายเวชภัณฑ์ทั้งจังหวัด" description="ยอดรวมทุกหน่วยบริการ กดชื่อเวชภัณฑ์เพื่อดูแนวโน้มรายวัน">
        <DataTable columns={itemColumns} rows={items} rowKey="item_code" caption="ภาพรวมรายเวชภัณฑ์" pageSize={20} />
      </Section>

      <Section
        title={`แนวโน้มรายวัน${selectedItem ? `: ${selectedItem.item_name}` : ""}`}
        description="แท่ง = ใช้ไปและรับเข้าในแต่ละวัน · เส้น = ยอดคงเหลือสิ้นวันรวมทุกหน่วยบริการ"
        actions={items.length ? (
          <FilterSelect label="เวชภัณฑ์" value={selectedItem?.item_code || ""} onChange={setItemCode} className="min-w-[14rem]"
            options={items.map((item) => ({ value: item.item_code, label: item.item_name }))} />
        ) : null}
      >
        <ItemTrend item={selectedItem} />
      </Section>

      <Section
        title={matrixMode === "district" ? "คงเหลือรายอำเภอ × เวชภัณฑ์" : "คงเหลือรายหน่วยบริการ × เวชภัณฑ์"}
        description={matrixMode === "district" ? "ยอดรวมของหน่วยบริการในอำเภอ พร้อมอัตราใช้ต่อวัน" : "สีแดง = หมด · สีเหลือง = ใกล้หมด · ตัวเลขเล็ก = พอใช้อีกกี่วัน"}
        actions={(
          <div className="flex gap-1" role="group" aria-label="มุมมอง">
            <Button variant={matrixMode === "facility" ? "primary" : "secondary"} className="min-h-9 px-3" onClick={() => setMatrixMode("facility")}>รายหน่วยบริการ</Button>
            <Button variant={matrixMode === "district" ? "primary" : "secondary"} className="min-h-9 px-3" onClick={() => setMatrixMode("district")}>รายอำเภอ</Button>
          </div>
        )}
      >
        <Matrix stocks={dashboard.stocks} items={items} districts={dashboard.districts} mode={matrixMode} />
      </Section>

      <Section title="ยอดนับจริงไม่ตรงกับที่ระบบคำนวณ" description="เกิดจากรายงานใช้ไป/รับเข้าไม่ครบ หรือของสูญหาย/หมดอายุ ตรวจแล้วปรับยอดที่หน้า คงคลัง (ปุ่มตาชั่ง)">
        <DataTable columns={diffColumns} rows={dashboard.discrepancies} rowKey={(row) => `${row.stock_id}-${row.date}`} caption="ยอดนับไม่ตรง" emptyText="ยังไม่มียอดนับที่ไม่ตรง" pageSize={10} />
      </Section>
    </div>
  );
}
