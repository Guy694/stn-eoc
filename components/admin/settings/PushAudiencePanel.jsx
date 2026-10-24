"use client";

// ผู้รับแจ้งเตือนภัย: เครื่องที่รับอยู่ (แยกพื้นที่/อุปกรณ์) สมัครใหม่รายวัน และแต่ละแจ้งเตือน ส่ง → ถึงเครื่อง → แสดงแล้ว → เปิดอ่าน
import { useCallback, useEffect, useState } from "react";
import { BellRing, Eye, MousePointerClick, RefreshCw, Smartphone, UserPlus } from "lucide-react";
import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from "chart.js";
import { apiRequest, formatDateTime, formatNumber } from "@/lib/adminApi";
import { MetricCard } from "@/components/common/MetricCards";
import { SATUN_DISTRICT_NAMES } from "@/lib/satunDistricts";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const API = "/stn-eoc/api/admin/push-audience";
const RANGES = [[7, "7 วัน"], [30, "30 วัน"], [90, "90 วัน"], [365, "1 ปี"]];
const pct = (value) => (value == null ? "—" : `${value}%`);
const num = (value) => (value == null ? "—" : formatNumber(value));

function lastDays(rows, days) {
  const map = new Map(rows.map((row) => [row.day, row.n]));
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ key, label: d.toLocaleDateString("th-TH", { day: "numeric", month: "short" }), n: map.get(key) || 0 });
  }
  return out;
}

function BarList({ title, rows, note }) {
  const max = Math.max(1, ...rows.map((row) => row.n));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <h4 className="border-b border-slate-100 px-4 py-3 font-black text-slate-900">{title}</h4>
      {rows.length ? (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.label} className="px-4 py-2.5">
              <div className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-slate-700">{row.label}</span>
                <span className="shrink-0 font-bold tabular-nums text-slate-900">{formatNumber(row.n)} <span className="font-normal text-slate-500">เครื่อง</span></span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full bg-[#0b4c86]" style={{ width: `${(row.n / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      ) : <p className="p-4 text-sm text-slate-500">ยังไม่มีข้อมูล</p>}
      {note ? <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}

// ขั้นของแจ้งเตือน: ความกว้างของแถบเทียบกับ "ถึงเครื่อง"
function Funnel({ totals }) {
  const steps = [
    ["ถึงเครื่อง", totals.delivered, "บริการแจ้งเตือนของ Apple/Google รับไปส่งแล้ว"],
    ["แสดงแล้ว", totals.shown, "แจ้งเตือนขึ้นบนเครื่องจริง"],
    ["เปิดอ่าน", totals.opened, "ผู้ใช้กดแจ้งเตือนเพื่ออ่าน"]
  ];
  const base = Math.max(1, totals.delivered);
  return (
    <ol className="space-y-3">
      {steps.map(([label, value, hint]) => (
        <li key={label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-bold text-slate-800">{label} <span className="font-normal text-slate-500">{hint}</span></span>
            <span className="shrink-0 font-bold tabular-nums text-slate-900">{formatNumber(value)}{totals.delivered ? <span className="ml-1 font-normal text-slate-500">({Math.round((value / base) * 100)}%)</span> : null}</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full rounded-full bg-[#0b4c86]" style={{ width: `${(value / base) * 100}%` }} /></div>
        </li>
      ))}
    </ol>
  );
}

function AlertRow({ row }) {
  const cells = [["ส่ง", num(row.recipients)], ["ถึงเครื่อง", num(row.delivered)], ["แสดงแล้ว", num(row.shown)], ["เปิดอ่าน", row.tracked ? `${formatNumber(row.opened)} (${pct(row.open_rate)})` : "—"]];
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <p className="min-w-0 basis-full break-words text-sm sm:basis-0 sm:flex-1"><b className="text-slate-900">{row.title}</b> <span className="text-slate-600">— {row.body}</span></p>
        <span className="text-xs text-slate-500">{formatDateTime(row.created_at)}{row.kind === "auto" ? " • อัตโนมัติ" : " • เจ้าหน้าที่ส่ง"}{row.districts?.length ? ` • อ.${row.districts.join(", อ.")}` : " • ทั้งจังหวัด"}</span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cells.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 px-2.5 py-1.5">
            <dt className="text-[11px] text-slate-500">{label}</dt>
            <dd className="font-bold tabular-nums text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      {!row.tracked ? <p className="mt-1.5 text-xs text-slate-500">ส่งก่อนเริ่มนับ &quot;แสดงแล้ว/เปิดอ่าน&quot;</p> : null}
    </li>
  );
}

export default function PushAudiencePanel() {
  const [days, setDays] = useState(30);
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const result = await apiRequest(`${API}?days=${days}`);
      setState({ loading: false, data: result.data, error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message || "โหลดข้อมูลผู้รับแจ้งเตือนไม่สำเร็จ" });
    }
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const data = state.data;
  const rangeLabel = RANGES.find(([value]) => value === days)?.[1] || `${days} วัน`;
  const districts = data ? SATUN_DISTRICT_NAMES.map((name) => ({ label: `อ.${name}`, n: data.by_district?.[name] || 0 })).filter((row) => row.n).sort((a, b) => b.n - a.n) : [];
  const devices = data ? Object.entries(data.by_device || {}).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n) : [];
  const daily = data ? lastDays(data.new_by_day || [], Math.min(days, 90)) : [];
  const totals = data?.totals;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="ช่วงเวลา">
          {RANGES.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}
              className={`min-h-9 rounded-full px-3.5 text-sm font-semibold ring-1 ${days === value ? "bg-[#0b4c86] text-white ring-[#0b4c86]" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"}`}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={load} disabled={state.loading} className="inline-flex items-center gap-1.5 rounded-lg border border-[#c9dcee] bg-white px-3 py-1.5 text-sm font-bold text-[#0b4c86] hover:bg-[#edf5fc] disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} aria-hidden="true" />รีเฟรช
        </button>
      </div>

      {state.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}</p> : null}
      {state.loading && !data ? <p className="py-10 text-center text-sm text-slate-500">กำลังโหลด…</p> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={BellRing} tone="blue" label="เครื่องที่รับแจ้งเตือนอยู่" value={formatNumber(data.total)}
              note={`ทั้งจังหวัด ${formatNumber(data.whole_province)} • เลือกพื้นที่ ${formatNumber(data.areas)}${data.officers ? ` • เจ้าหน้าที่ ${formatNumber(data.officers)}` : ""}`} />
            <MetricCard icon={UserPlus} label={`สมัครใหม่ใน ${rangeLabel}`} value={formatNumber(data.new_total)} note="นับเฉพาะเครื่องที่ยังรับอยู่" />
            <MetricCard icon={Eye} label={`เครื่องที่แจ้งเตือนขึ้นจริงใน ${rangeLabel}`} value={data.receipts_ready ? formatNumber(data.reached_devices) : "—"}
              note={data.receipts_ready ? "อย่างน้อย 1 ครั้ง (ไม่นับซ้ำ)" : "ยังไม่ได้รัน migration 20261024_push_receipts"} />
            <MetricCard icon={MousePointerClick} label="เปิดอ่าน" value={pct(totals?.open_rate)}
              note={totals?.tracked_alerts ? `${formatNumber(totals.opened)} จาก ${formatNumber(totals.delivered)} เครื่องที่ส่งถึง` : "ยังไม่มีแจ้งเตือนที่นับได้ในช่วงนี้"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="font-black text-slate-900">แจ้งเตือนถึงประชาชนใน {rangeLabel}</h4>
              <p className="mb-3 text-sm text-slate-600">
                {totals.alerts ? `${formatNumber(totals.alerts)} ครั้ง${totals.tracked_alerts < totals.alerts ? ` (นับผู้รับได้ ${formatNumber(totals.tracked_alerts)} ครั้ง)` : ""}` : "ยังไม่มีการส่งในช่วงนี้"}
              </p>
              {totals.tracked_alerts ? <Funnel totals={totals} /> : <p className="text-sm text-slate-500">ตัวเลข &quot;แสดงแล้ว/เปิดอ่าน&quot; เริ่มนับตั้งแต่แจ้งเตือนครั้งถัดไป</p>}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="mb-2 font-black text-slate-900">สมัครใหม่รายวัน{days > 90 ? " (90 วันล่าสุด)" : ""}</h4>
              <div className="h-48" role="img" aria-label={`กราฟจำนวนเครื่องที่สมัครรับแจ้งเตือนใหม่รายวัน รวม ${data.new_total} เครื่อง`}>
                <Bar
                  data={{ labels: daily.map((row) => row.label), datasets: [{ label: "สมัครใหม่", data: daily.map((row) => row.n), backgroundColor: "#2a78d6", borderRadius: 2 }] }}
                  options={{ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true } }, y: { beginAtZero: true, ticks: { precision: 0 } } } }}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BarList title="เลือกรับเฉพาะอำเภอ" rows={districts} note={`ไม่รวม ${formatNumber(data.whole_province)} เครื่องที่รับทั้งจังหวัด (ได้รับทุกอำเภอ) • เครื่องหนึ่งเลือกได้หลายอำเภอ`} />
            <BarList title="อุปกรณ์" rows={devices} />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <h4 className="border-b border-slate-100 px-4 py-3 font-black text-slate-900">แต่ละแจ้งเตือน</h4>
            {data.alerts.length ? <ul className="divide-y divide-slate-100">{data.alerts.map((row) => <AlertRow key={row.id} row={row} />)}</ul> : <p className="p-4 text-sm text-slate-500">ยังไม่มีการส่งในช่วงนี้</p>}
          </section>

          <p className="flex gap-2 rounded-xl border border-[#c9dcee] bg-[#edf5fc] p-4 text-sm text-[#083865]">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              &quot;แสดงแล้ว&quot; และ &quot;เปิดอ่าน&quot; มาจากสัญญาณที่เครื่องผู้รับส่งกลับ ระบบนับเครื่องละครั้งต่อแจ้งเตือน และไม่เก็บ IP ชื่อ หรือตำแหน่ง
              ถ้าเครื่องไม่มีเน็ตตอนแจ้งเตือนขึ้น สัญญาณจะส่งไม่ถึง ตัวเลขนี้จึงเป็นค่าต่ำสุด
            </span>
          </p>
        </>
      ) : null}
    </div>
  );
}
