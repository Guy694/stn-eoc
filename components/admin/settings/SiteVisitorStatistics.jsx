"use client";

// สถิติผู้เข้าชมเว็บไซต์ (ย้ายมาจากหน้าตั้งค่าส่วนตัว) + ส่งออก CSV
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CalendarRange, Download, RefreshCw, Users } from "lucide-react";
import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from "chart.js";
import { apiRequest, formatNumber } from "@/lib/adminApi";
import { visitorStatsToCsv } from "@/lib/systemStatus";
import { MetricCard } from "@/components/common/MetricCards";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const DEVICE_LABELS = { mobile: "มือถือ", tablet: "แท็บเล็ต", desktop: "คอมพิวเตอร์", other: "อื่น ๆ" };

function Stat({ icon, label, value, note, tone }) {
  return <MetricCard icon={icon} label={label} value={value} note={note} tone={tone} />;
}

function RankList({ title, rows, label, valueKey, unit = "ครั้ง" }) {
  const max = Math.max(1, ...rows.map((row) => row[valueKey] || 0));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <h4 className="border-b border-slate-100 px-4 py-3 font-black text-slate-900">{title}</h4>
      {rows.length ? (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={`${label(row)}`} className="px-4 py-2.5">
              <div className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-slate-700" title={label(row)}>{label(row)}</span>
                <span className="shrink-0 font-bold tabular-nums text-slate-900">{formatNumber(row[valueKey])} <span className="font-normal text-slate-500">{unit}</span></span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full bg-[#0b4c86]" style={{ width: `${((row[valueKey] || 0) / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      ) : <p className="p-4 text-sm text-slate-500">ยังไม่มีข้อมูล</p>}
    </div>
  );
}

export default function SiteVisitorStatistics() {
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const result = await apiRequest("/stn-eoc/api/admin/site-statistics");
      setState({ loading: false, data: result.data, error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message || "โหลดสถิติผู้เข้าชมไม่สำเร็จ" });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    const blob = new Blob([visitorStatsToCsv(state.data)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `สถิติผู้เข้าชม-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stats = state.data;
  const help = stats?.helpRequests || {};
  const daily = [...(stats?.dailyVisits || [])].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={load} disabled={state.loading} className="inline-flex items-center gap-1.5 rounded-lg border border-[#c9dcee] bg-white px-3 py-1.5 text-sm font-bold text-[#0b4c86] hover:bg-[#edf5fc] disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} aria-hidden="true" />รีเฟรช
        </button>
        <button type="button" onClick={exportCsv} disabled={!stats} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0b4c86] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#083865] disabled:opacity-60">
          <Download className="h-4 w-4" aria-hidden="true" />ส่งออก CSV
        </button>
      </div>
      {state.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}</p> : null}
      {state.loading && !stats ? <p className="py-10 text-center text-sm text-slate-500">กำลังโหลดสถิติ…</p> : null}
      {stats ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat icon={Users} tone="blue" label="ผู้เข้าชมทั้งหมด" value={formatNumber(stats.totalVisits)} note="นับครั้งละหนึ่งเซสชันของเบราว์เซอร์" />
            <Stat icon={CalendarDays} label="วันนี้" value={formatNumber(stats.todayVisits)} />
            <Stat icon={CalendarRange} label="7 วันล่าสุด" value={formatNumber(stats.last7DaysVisits)} />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h4 className="mb-2 font-black text-slate-900">ยอดเข้าชมรายวัน 30 วันล่าสุด</h4>
            {daily.length ? (
              <div className="h-56" role="img" aria-label="กราฟยอดผู้เข้าชมรายวัน 30 วันล่าสุด">
                <Bar
                  data={{
                    labels: daily.map((row) => new Date(`${row.date}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" })),
                    datasets: [{ label: "ผู้เข้าชม", data: daily.map((row) => row.visits), backgroundColor: "#2a78d6", borderRadius: 2 }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true } }, y: { beginAtZero: true, ticks: { precision: 0 } } } }}
                />
              </div>
            ) : <p className="text-sm text-slate-500">ยังไม่มีข้อมูลการเข้าชมรายวัน</p>}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <RankList title="หน้าที่เข้าชมมากที่สุด (30 วัน)" rows={stats.topPages || []} label={(row) => row.path} valueKey="visits" />
            <RankList title="อุปกรณ์ที่ใช้เข้าชม (30 วัน)" rows={stats.devices || []} label={(row) => DEVICE_LABELS[row.type] || row.type} valueKey="visits" />
          </div>
          <div className="rounded-xl border border-[#c9dcee] bg-[#edf5fc] p-4">
            <h4 className="font-black text-[#083865]">เส้นทางการขอความช่วยเหลือ (30 วัน)</h4>
            <p className="text-sm text-[#083865]">
              เปิดหน้าขอความช่วยเหลือ {formatNumber(help.opened)} ครั้ง · ส่งสำเร็จ {formatNumber(help.submitted)} ครั้ง
              {help.opened ? ` · ส่งสำเร็จ ${Math.round((help.submitted / help.opened) * 100)}%` : ""}
            </p>
            <div className="mt-3"><RankList title="หน้าที่ผู้ใช้อยู่ก่อนกดขอความช่วยเหลือ" rows={help.sources || []} label={(row) => row.path} valueKey="starts" /></div>
          </div>
        </>
      ) : null}
    </div>
  );
}
