"use client";

// ภาพรวมโรคและสุขภาพในเหตุการณ์: ตอบ 3 คำถามในห้องประชุม
//  1) สถานการณ์ดีขึ้นหรือแย่ลง (แนวโน้ม + 7 วันเทียบ 7 วันก่อน)  2) ที่ไหน/โรคอะไร  3) ควรทำอะไรต่อ
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertOctagon, AlertTriangle, Ambulance, ArrowDownRight, ArrowUpRight, CalendarDays, CalendarRange, HeartCrack, HeartPulse, Info, MapPin, Minus, RefreshCw, Siren } from "lucide-react";
import { Bar, Line } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { Button } from "@/components/admin/crud";
import { apiRequest, formatDateTime, formatNumber } from "@/lib/adminApi";
import { MetricCard, toneFromClass } from "@/components/common/MetricCards";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip, Legend);

// สีตามหน้าที่: ชุมชน = slot 1 (น้ำเงิน), ศูนย์พักพิง = slot 2 (ส้ม), ค่าเฉลี่ย = หมึกรอง
const COLORS = { community: "#2a78d6", shelter: "#eb6834", avg: "#52514e", grid: "#e7e5e0", text: "#52514e" };
const FONT = { family: "'Noto Sans Thai Looped', 'Noto Sans Thai', sans-serif", size: 12 };

const shortDate = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
};

function Change({ value, suffix = "" }) {
  if (value === null) return <span className="inline-flex items-center gap-0.5 font-bold text-red-700"><ArrowUpRight className="h-3.5 w-3.5" />ใหม่{suffix}</span>;
  if (!value) return <span className="inline-flex items-center gap-0.5 text-slate-500"><Minus className="h-3.5 w-3.5" />คงที่</span>;
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-bold ${up ? "text-red-700" : "text-emerald-700"}`}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{up ? "+" : ""}{value}%{suffix}
    </span>
  );
}

function Kpi({ icon, label, value, unit = "ราย", hint, tone = "text-slate-900" }) {
  return <MetricCard icon={icon} label={label} value={value} unit={unit} note={hint} tone={toneFromClass(tone)} compact />;
}

const ACTION_STYLE = {
  critical: { icon: AlertOctagon, label: "วิกฤต", box: "border-red-300 bg-red-50", text: "text-red-900", chip: "bg-red-700 text-white" },
  serious: { icon: Siren, label: "เร่งด่วน", box: "border-orange-300 bg-orange-50", text: "text-orange-950", chip: "bg-orange-600 text-white" },
  warning: { icon: AlertTriangle, label: "เฝ้าระวัง", box: "border-amber-200 bg-amber-50", text: "text-amber-950", chip: "bg-amber-500 text-amber-950" },
  info: { icon: Info, label: "ข้อมูล", box: "border-slate-200 bg-slate-50", text: "text-slate-800", chip: "bg-slate-600 text-white" }
};

function Panel({ title, subtitle, children, right }) {
  return (
    <section className="rounded-xl border border-[#c9dcee] bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-black text-slate-900">{title}</h3>
          {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function heatColor(value, max) {
  if (!value) return { background: "#f4f6f8", color: "#9aa3ad" };
  // ลำดับสีเดียว (น้ำเงิน) จากอ่อนไปเข้ม
  const t = Math.min(value / max, 1);
  const lightness = 94 - t * 62;
  return { background: `hsl(212 70% ${lightness}%)`, color: lightness < 55 ? "#ffffff" : "#0b0b0b" };
}

export default function HealthDashboard({ eocType = "flood", onGoto }) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      setState({ loading: false, data: await apiRequest(`/stn-eoc/api/eoc/health-dashboard?eoc=${eocType}`), error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [eocType]);
  useEffect(() => { load(); }, [load]);

  const data = state.data;
  const trendChart = useMemo(() => {
    if (!data?.trend?.length) return null;
    return {
      data: {
        labels: data.trend.map((item) => shortDate(item.day)),
        datasets: [
          { label: "ในชุมชน", data: data.trend.map((item) => item.community), borderColor: COLORS.community, backgroundColor: COLORS.community, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0.25 },
          { label: "ในศูนย์พักพิง", data: data.trend.map((item) => item.shelter), borderColor: COLORS.shelter, backgroundColor: COLORS.shelter, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0.25 },
          { label: "ค่าเฉลี่ย 7 วัน (รวม)", data: data.trend.map((item) => item.avg7), borderColor: COLORS.avg, backgroundColor: COLORS.avg, borderWidth: 2, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 4, tension: 0.3 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, pointStyle: "line", font: FONT, color: COLORS.text } },
          tooltip: { titleFont: FONT, bodyFont: FONT, callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)} ราย` } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: FONT, color: COLORS.text, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
          y: { beginAtZero: true, grid: { color: COLORS.grid }, border: { display: false }, ticks: { font: FONT, color: COLORS.text, precision: 0 } }
        }
      }
    };
  }, [data]);

  const districtChart = useMemo(() => {
    const rows = (data?.districts || []).filter((row) => row.total > 0).slice(0, 10);
    if (!rows.length) return null;
    return {
      height: Math.max(160, rows.length * 34 + 40),
      data: {
        labels: rows.map((row) => `อ.${row.district}`),
        datasets: [
          { label: "ในชุมชน", data: rows.map((row) => row.community), backgroundColor: COLORS.community, borderColor: "#ffffff", borderWidth: { right: 2 }, borderRadius: 4, borderSkipped: false, barThickness: 18 },
          { label: "ในศูนย์พักพิง", data: rows.map((row) => row.shelter), backgroundColor: COLORS.shelter, borderColor: "#ffffff", borderWidth: { right: 2 }, borderRadius: 4, borderSkipped: false, barThickness: 18 }
        ]
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, pointStyle: "rectRounded", font: FONT, color: COLORS.text } },
          tooltip: { titleFont: FONT, bodyFont: FONT, callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.parsed.x)} ราย` } }
        },
        scales: {
          x: { stacked: true, beginAtZero: true, grid: { color: COLORS.grid }, border: { display: false }, ticks: { font: FONT, color: COLORS.text, precision: 0 } },
          y: { stacked: true, grid: { display: false }, ticks: { font: FONT, color: "#0b0b0b" } }
        }
      }
    };
  }, [data]);

  if (state.loading && !data) return <div className="space-y-3">{[0, 1, 2].map((key) => <div key={key} className="h-28 animate-pulse rounded-xl bg-white" />)}</div>;
  if (state.error) return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}</p>;
  if (!data?.session) return <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">{data?.message || "ยังไม่มีเหตุการณ์"}</p>;

  const { totals } = data;
  const maxDisease = Math.max(1, ...data.diseases.map((item) => item.total));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <p>ข้อมูลช่วง {data.range.start ? shortDate(data.range.start) : "-"} – {shortDate(data.range.end)}{totals.lastReport ? ` · รายงานล่าสุด ${shortDate(totals.lastReport)}` : ""} · อัปเดต {formatDateTime(data.generated_at)}</p>
        <Button variant="ghost" onClick={load} disabled={state.loading}><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} />โหลดใหม่</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={HeartPulse} label="ผู้ป่วยสะสม" value={formatNumber(totals.cases)} hint={`ชุมชน ${formatNumber(totals.community)} · ศูนย์ ${formatNumber(totals.shelter)}`} tone="text-[#0b4c86]" />
        <Kpi icon={CalendarDays} label="วันนี้" value={formatNumber(totals.today)} hint="ผู้ป่วยรายใหม่ที่รายงานวันนี้" />
        <Kpi icon={CalendarRange} label="7 วันล่าสุด" value={formatNumber(totals.last7)} hint={<span>เทียบ 7 วันก่อน ({formatNumber(totals.prev7)}) <Change value={totals.change} /></span>} tone={totals.change === null || totals.change > 0 ? "text-red-700" : "text-slate-900"} />
        <Kpi icon={MapPin} label="อำเภอที่พบผู้ป่วย" value={formatNumber(totals.districtsWithCases)} unit="อำเภอ" />
        <Kpi icon={Ambulance} label="ส่งต่อโรงพยาบาล" value={formatNumber(totals.hospitalized)} hint="จากศูนย์พักพิง" tone={totals.hospitalized ? "text-amber-700" : "text-slate-900"} />
        <Kpi icon={HeartCrack} label="เสียชีวิต" value={formatNumber(totals.deaths)} hint={totals.severeReports ? `รายงานอาการรุนแรง ${totals.severeReports} ครั้ง` : "จากศูนย์พักพิง"} tone={totals.deaths ? "text-red-700" : "text-slate-900"} />
      </div>

      <Panel title="ควรทำอะไรต่อ" subtitle="สรุปอัตโนมัติจากแนวโน้มและชนิดโรค ใช้ประกอบการตัดสินใจของทีม ไม่ใช่คำสั่ง">
        <ul className="grid gap-2 lg:grid-cols-2">
          {data.actions.map((action) => {
            const style = ACTION_STYLE[action.level] || ACTION_STYLE.info;
            const Icon = style.icon;
            return (
              <li key={action.title} className={`flex gap-3 rounded-lg border p-3 ${style.box}`}>
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.text}`} aria-hidden="true" />
                <div className={`min-w-0 ${style.text}`}>
                  <p className="text-sm font-bold"><span className={`mr-1.5 rounded px-1.5 py-0.5 text-[11px] ${style.chip}`}>{style.label}</span>{action.title}</p>
                  <p className="mt-0.5 text-sm">{action.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="แนวโน้มผู้ป่วยรายวัน" subtitle="เส้นประ = ค่าเฉลี่ย 7 วัน ใช้ดูทิศทางโดยไม่หลอกตาจากวันที่รายงานไม่ครบ">
        {trendChart ? <div className="h-72"><Line data={trendChart.data} options={trendChart.options} aria-label="กราฟแนวโน้มผู้ป่วยรายวัน" role="img" /></div> : <p className="text-sm text-slate-500">ยังไม่มีข้อมูล</p>}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="ผู้ป่วยสะสมรายอำเภอ" subtitle="แยกในชุมชนและในศูนย์พักพิง">
          {districtChart ? <div style={{ height: districtChart.height }}><Bar data={districtChart.data} options={districtChart.options} aria-label="กราฟผู้ป่วยรายอำเภอ" role="img" /></div> : <p className="text-sm text-slate-500">ยังไม่มีข้อมูล</p>}
        </Panel>

        <Panel title="เทียบ 7 วันล่าสุดกับ 7 วันก่อน (รายอำเภอ)" subtitle="อำเภอที่เพิ่มขึ้นควรได้ทรัพยากร/ทีมลงพื้นที่ก่อน">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="text-xs text-slate-500"><tr><th className="py-2 pr-3">อำเภอ</th><th className="px-2 py-2 text-right">7 วันก่อน</th><th className="px-2 py-2 text-right">7 วันล่าสุด</th><th className="px-2 py-2 text-right">เปลี่ยนแปลง</th><th className="py-2 pl-2 text-right">ต่อแสน ปชก.</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.districts.filter((row) => row.total > 0).map((row) => (
                  <tr key={row.district}>
                    <td className="py-2 pr-3 font-semibold text-slate-900">อ.{row.district}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-600">{formatNumber(row.prev7)}</td>
                    <td className="px-2 py-2 text-right font-bold tabular-nums">{formatNumber(row.last7)}</td>
                    <td className="px-2 py-2 text-right"><Change value={row.change} /></td>
                    <td className="py-2 pl-2 text-right tabular-nums text-slate-600">{row.ratePer100k === null ? "-" : formatNumber(row.ratePer100k)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {data.heat.rows.length ? (
        <Panel title="ความหนาแน่นผู้ป่วย อำเภอ × วัน (14 วันล่าสุด)" subtitle="สีเข้ม = ผู้ป่วยมาก ใช้ดูว่าการระบาดเคลื่อนไปอำเภอไหน">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0.5 text-center text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white pr-2 text-left font-semibold text-slate-500">อำเภอ</th>
                  {data.heat.days.map((day) => <th key={day} className="min-w-9 font-normal text-slate-500">{shortDate(day).split(" ")[0]}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.heat.rows.map((row) => (
                  <tr key={row.district}>
                    <th className="sticky left-0 whitespace-nowrap bg-white pr-2 text-left text-sm font-semibold text-slate-900">อ.{row.district}</th>
                    {row.values.map((value, index) => (
                      <td key={data.heat.days[index]} className="h-8 rounded tabular-nums" style={heatColor(value, data.heat.max)} title={`อ.${row.district} ${shortDate(data.heat.days[index])}: ${value} ราย`}>{value || ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span>น้อย</span>
            {[0.15, 0.35, 0.55, 0.75, 1].map((t) => <span key={t} className="h-3 w-6 rounded" style={heatColor(t * data.heat.max, data.heat.max)} />)}
            <span>มาก (สูงสุด {formatNumber(data.heat.max)} ราย/วัน)</span>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="โรคที่พบมาก" subtitle="สะสมทั้งเหตุการณ์ พร้อมแนวโน้ม 7 วัน และมาตรการที่ควรพิจารณา">
          {data.diseases.length ? (
            <ul className="space-y-3">
              {data.diseases.map((item) => (
                <li key={item.disease}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="font-semibold text-slate-900">{item.disease}</span>
                    <span className="tabular-nums text-slate-600"><b className="text-slate-900">{formatNumber(item.total)}</b> ราย · 7 วัน {formatNumber(item.last7)} <Change value={item.change} /></span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#0b4c86]" style={{ width: `${(item.total / maxDisease) * 100}%` }} /></div>
                  {item.advice && item.last7 ? <p className="mt-1 text-xs text-slate-600">→ {item.advice}</p> : null}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">ยังไม่มีข้อมูล</p>}
        </Panel>

        <Panel
          title="หมู่บ้านที่ต้องจับตา"
          subtitle="ผู้ป่วยในชุมชนสูงสุดใน 7 วันล่าสุด"
          right={<button type="button" onClick={() => onGoto?.("community")} className="text-sm font-bold text-[#0b4c86] hover:underline">บันทึกโรคในชุมชน</button>}
        >
          {data.villages.length ? (
            <ol className="divide-y divide-slate-100">
              {data.villages.map((row, index) => (
                <li key={`${row.district}-${row.tambon}-${row.village}`} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-5 text-right text-xs font-bold text-slate-400">{index + 1}</span>
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{row.village || `ต.${row.tambon}`}</span><span className="block truncate text-xs text-slate-500">ต.{row.tambon} อ.{row.district}</span></span>
                  </span>
                  <span className="shrink-0 text-right text-sm tabular-nums"><b>{formatNumber(row.last7)}</b> ราย <span className="block text-xs"><Change value={row.change} /></span></span>
                </li>
              ))}
            </ol>
          ) : <p className="flex items-center gap-2 text-sm text-slate-500"><HeartPulse className="h-4 w-4" />ยังไม่มีผู้ป่วยในชุมชนใน 7 วันล่าสุด</p>}
        </Panel>
      </div>
    </div>
  );
}
