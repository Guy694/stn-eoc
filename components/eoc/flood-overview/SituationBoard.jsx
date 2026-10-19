"use client";

// แผงสรุปสถานการณ์ (บนสุดของหน้าภาพรวม): อ่านจากบนลงล่าง = สถานการณ์รวม → ตัวชี้วัดหลัก → เรื่องที่ต้องตัดสินใจ → อำเภอไหนต้องไปก่อน
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowDownRight, ArrowUpRight, Boxes, CalendarRange, CheckCircle2, ChevronRight, Circle, ClipboardList, FileSpreadsheet, Flag, HeartCrack, HeartPulse, LineChart, ListChecks, MapPinned, MonitorCog, PersonStanding, RefreshCw, Tent, Users, Wind } from "lucide-react";
import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip } from "chart.js";
import { apiRequest, formatDateTime, formatNumber } from "@/lib/adminApi";
import { areaLabel, flagMeta, stageMeta } from "@/lib/floodTriggers";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineController, LineElement, PointElement, Tooltip, Legend);

const TONE = {
  red: { label: "เร่งด่วน", dot: "bg-red-600", pill: "bg-red-50 text-red-800 ring-red-200", bar: "border-l-red-600", banner: "border-red-200 bg-red-50 text-red-900" },
  amber: { label: "เฝ้าระวัง", dot: "bg-amber-500", pill: "bg-amber-50 text-amber-900 ring-amber-200", bar: "border-l-amber-500", banner: "border-amber-200 bg-amber-50 text-amber-950" },
  green: { label: "ปกติ", dot: "bg-emerald-600", pill: "bg-emerald-50 text-emerald-800 ring-emerald-200", bar: "border-l-emerald-600", banner: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  gray: { label: "ไม่มีข้อมูล", dot: "bg-slate-400", pill: "bg-slate-100 text-slate-600 ring-slate-200", bar: "border-l-slate-300", banner: "border-slate-200 bg-slate-50 text-slate-700" }
};
const LEVEL = {
  critical: { label: "วิกฤต", cls: "bg-red-700 text-white" },
  serious: { label: "เร่งด่วน", cls: "bg-red-50 text-red-800 ring-1 ring-red-200" },
  warning: { label: "เฝ้าระวัง", cls: "bg-amber-50 text-amber-900 ring-1 ring-amber-200" },
  info: { label: "ข้อมูล", cls: "bg-slate-100 text-slate-700" }
};
// ตัวชี้วัดที่ "เพิ่มขึ้น = แย่ลง"
const UP_IS_BAD = new Set(["impact", "health"]);

function StatusPill({ tone }) {
  const t = TONE[tone] || TONE.gray;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${t.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden="true" />{t.label}
    </span>
  );
}

function Delta({ kpi }) {
  if (kpi.delta === null || kpi.delta === undefined) {
    return kpi.deltaLabel ? <p className="mt-1 text-xs font-semibold text-red-700">{kpi.deltaLabel}</p> : null;
  }
  if (kpi.delta === 0) return <p className="mt-1 text-xs text-slate-500">คงที่ · {kpi.deltaLabel}</p>;
  const up = kpi.delta > 0;
  const bad = UP_IS_BAD.has(kpi.key) ? up : !up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p className={`mt-1 inline-flex items-center gap-0.5 text-xs font-semibold ${bad ? "text-red-700" : "text-emerald-700"}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {up ? "เพิ่ม" : "ลด"} {formatNumber(Math.abs(kpi.delta))}{kpi.deltaUnit || ""}
      <span className="font-normal text-slate-500">· {kpi.deltaLabel}</span>
    </p>
  );
}

// เส้นแนวโน้มเล็ก (เฉพาะตัวชี้วัดที่มีข้อมูลรายวัน) — จุดสุดท้ายเน้นสีตามสถานะ
function Sparkline({ values, tone }) {
  if (!values || values.length < 3) return null;
  const width = 96;
  const height = 30;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const points = values.map((value, index) => [index * step, height - 3 - (value / max) * (height - 6)]);
  const path = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;
  const color = tone === "red" ? "#dc2626" : tone === "amber" ? "#d97706" : "#0b4c86";
  const [lastX, lastY] = points[points.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 overflow-visible" aria-hidden="true">
      <path d={area} fill={color} opacity="0.08" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="2.6" fill={color} />
    </svg>
  );
}

// การ์ดตัวชี้วัด (ธีมเดียวกับการ์ดทั้งระบบ): ไอคอนในกรอบสี · ตัวเลข · แนวโน้ม · เปลี่ยนแปลง · รายละเอียด
const KPI_ICONS = { impact: Users, casualties: HeartCrack, shelters: Tent, health: HeartPulse, vulnerable: PersonStanding, supplies: Boxes, it: MonitorCog, oxygen: Wind, teams: ListChecks };
const KPI_TONE = {
  red: { tile: "bg-red-50 text-red-700 ring-red-100", value: "text-red-700", ring: "border-red-200 hover:border-red-300" },
  amber: { tile: "bg-amber-50 text-amber-700 ring-amber-100", value: "text-amber-700", ring: "border-amber-200 hover:border-amber-300" },
  green: { tile: "bg-emerald-50 text-emerald-700 ring-emerald-100", value: "text-slate-900", ring: "border-slate-200 hover:border-emerald-200" },
  gray: { tile: "bg-slate-50 text-slate-400 ring-slate-200", value: "text-slate-400", ring: "border-slate-200 hover:border-slate-300" }
};

function KpiCard({ kpi }) {
  const tone = KPI_TONE[kpi.tone] || KPI_TONE.gray;
  const Icon = KPI_ICONS[kpi.key] || Activity;
  const alert = kpi.tone === "red" || kpi.tone === "amber";
  return (
    <Link href={kpi.href} className={`group flex h-full flex-col rounded-2xl border bg-white p-4 font-[family-name:var(--font-kanit)] transition-shadow hover:shadow-[0_12px_28px_-20px_rgba(15,23,42,.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b4c86] ${tone.ring}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tone.tile}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
        {alert ? <StatusPill tone={kpi.tone} /> : <span className="text-[11px] font-medium text-slate-400">{(TONE[kpi.tone] || TONE.gray).label}</span>}
      </div>
      <p className="mt-3 text-[13px] font-medium leading-snug text-slate-600">{kpi.label}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className={`text-[1.7rem] font-bold leading-none tabular-nums ${tone.value}`}>
          {typeof kpi.value === "number" ? formatNumber(kpi.value) : kpi.value}
          <span className="ml-1 text-sm font-medium text-slate-500">{kpi.unit}</span>
        </p>
        <Sparkline values={kpi.spark} tone={kpi.tone} />
      </div>
      <Delta kpi={kpi} />
      <p className="mt-2 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-500">{kpi.detail}</p>
      <span className="mt-auto flex items-center gap-0.5 pt-2 text-xs font-semibold text-[#0b4c86] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">เปิดดู<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
    </Link>
  );
}

/** กล่องเนื้อหาธีมเดียวกัน: หัวข้อมีไอคอน + ลิงก์ด้านขวา */
function Panel({ icon: Icon, title, subtitle, action, children, className = "", bodyClassName = "" }) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white font-[family-name:var(--font-kanit)] ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon ? <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#0b4c86] ring-1 ring-sky-100"><Icon className="h-4 w-4" aria-hidden="true" /></span> : null}
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">{title}</h3>
            {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

const panelLink = "inline-flex items-center gap-0.5 text-sm font-semibold text-[#0b4c86] hover:underline";

function TrendChart({ trend }) {
  if (!trend?.length) return <p className="py-10 text-center text-sm text-slate-500">ยังไม่มีรายงานผู้ป่วย</p>;
  const labels = trend.map((row) => new Date(`${row.day || row.date}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" }));
  const data = {
    labels,
    datasets: [
      { type: "bar", label: "ในชุมชน", data: trend.map((row) => row.community), backgroundColor: "#2a78d6", stack: "cases", borderRadius: 2 },
      { type: "bar", label: "ในศูนย์พักพิง", data: trend.map((row) => row.shelter), backgroundColor: "#eb6834", stack: "cases", borderRadius: 2 },
      { type: "line", label: "ค่าเฉลี่ย 7 วัน", data: trend.map((row) => row.avg7), borderColor: "#52514e", borderDash: [5, 4], borderWidth: 2, pointRadius: 0, tension: 0.3 }
    ]
  };
  const options = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { mode: "index", intersect: false } },
    scales: { x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } } }
  };
  return <div className="h-48" role="img" aria-label="กราฟผู้ป่วยรายวัน 14 วันล่าสุด แยกในชุมชนและในศูนย์พักพิง"><Bar data={data} options={options} /></div>;
}

// พื้นหลังเข้มขึ้นตามขนาดตัวเลขเทียบอำเภออื่น ช่วยกวาดตาหาอำเภอที่หนักที่สุด
function heat(value, max) {
  if (!value || !max) return undefined;
  const alpha = 0.08 + 0.32 * Math.min(value / max, 1);
  return { backgroundColor: `rgba(11, 76, 134, ${alpha.toFixed(2)})` };
}

// สถานะตำบลที่เคยท่วม: ยังไม่คลี่คลาย / คลี่คลาย / กลับสู่ภาวะปกติ
function RecoveryLine({ recovery }) {
  const parts = [
    recovery.ongoing ? <b key="o" className="text-red-700">ยังไม่คลี่คลาย {recovery.ongoing}</b> : null,
    recovery.easing ? <span key="e" className="text-sky-700">คลี่คลาย {recovery.easing}</span> : null,
    recovery.normal ? <span key="n" className="text-emerald-700">ปกติ {recovery.normal}</span> : null
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <span className="block whitespace-nowrap text-xs" title="สถานะตำบลที่เคยประสบภัย คำนวณจากบันทึกพื้นที่น้ำท่วมล่าสุด">
      ตำบล: {parts.reduce((acc, part, index) => (index ? [...acc, " · ", part] : [part]), [])}
    </span>
  );
}

function DistrictMatrix({ rows }) {
  const max = (key) => Math.max(0, ...rows.map((row) => row[key] || 0));
  const maxPeople = max("people");
  const maxCases = max("cases7");
  const maxVulnerable = max("vulnerablePending");
  if (!rows.length) return <p className="p-6 text-center text-sm text-slate-500">ยังไม่มีข้อมูลรายอำเภอ</p>;
  return (
    <>
      {/* จอใหญ่: ตาราง */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-sm">
          <caption className="sr-only">สถานการณ์รายอำเภอ เรียงตามความเร่งด่วน</caption>
          <thead className="bg-slate-50/80 text-xs text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">อำเภอ</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">ได้รับผลกระทบ</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">เสียชีวิต/สูญหาย/บาดเจ็บ</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">ศูนย์พักพิง</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">ผู้ป่วย 7 วัน</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">เปราะบางรอดูแล</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">รายงานวันนี้</th>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">ประเด็น</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const use = row.capacity ? Math.round((row.occupancy / row.capacity) * 100) : null;
              return (
                <tr key={row.district} className="align-top">
                  <th scope="row" className="px-4 py-3 text-left">
                    <span className="block font-semibold text-slate-900">อ.{row.district}</span>
                    <span className="mt-1 inline-block"><StatusPill tone={row.tone} /></span>
                  </th>
                  <td className="px-3 py-3 text-right tabular-nums" style={heat(row.people, maxPeople)}>
                    <span className="font-bold text-slate-900">{row.people ? formatNumber(row.people) : "-"}</span>
                    {row.villages ? <span className="block text-xs text-slate-600">{formatNumber(row.villages)} หมู่บ้าน{row.severe ? <b className="text-red-700"> · รุนแรง {row.severe}</b> : null}</span> : null}
                    {row.recovery ? <RecoveryLine recovery={row.recovery} /> : null}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${row.deaths + row.missing ? "font-bold text-red-700" : "text-slate-700"}`}>
                    {row.deaths || row.missing || row.injured ? `${row.deaths} / ${row.missing} / ${row.injured}` : "-"}
                  </td>
                  <td className="px-3 py-3">
                    {row.capacity ? (
                      <div className="min-w-28">
                        <p className="tabular-nums text-slate-800"><b>{formatNumber(row.occupancy)}</b>/{formatNumber(row.capacity)} <span className="text-xs text-slate-500">({row.shelters} ศูนย์)</span></p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                          <div className={`h-full ${use >= 100 ? "bg-red-600" : use >= 80 ? "bg-amber-500" : "bg-[#0b4c86]"}`} style={{ width: `${Math.min(use, 100)}%` }} />
                        </div>
                      </div>
                    ) : <span className="text-slate-400">ไม่มีศูนย์เปิด</span>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums" style={heat(row.cases7, maxCases)}>
                    <span className="font-bold text-slate-900">{row.cases7 ? formatNumber(row.cases7) : "-"}</span>
                    {row.cases7 ? <span className={`block text-xs ${row.casesChange === null || row.casesChange > 0 ? "text-red-700" : "text-emerald-700"}`}>{row.casesChange === null ? "พบใหม่" : row.casesChange > 0 ? `+${row.casesChange}%` : `${row.casesChange}%`}</span> : null}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums" style={heat(row.vulnerablePending, maxVulnerable)}>
                    <span className="font-bold text-slate-900">{row.vulnerablePending ? formatNumber(row.vulnerablePending) : "-"}</span>
                  </td>
                  <td className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${row.tambons && row.reported === 0 ? "font-bold text-amber-800" : "text-slate-700"}`}>
                    {row.tambons ? `${row.reported}/${row.tambons} ตำบล` : "-"}
                  </td>
                  <td className="px-4 py-3 text-xs leading-relaxed text-slate-700">{row.reasons.length ? row.reasons.join(" · ") : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* จอเล็ก: การ์ด */}
      <ul className="divide-y divide-slate-100 lg:hidden">
        {rows.map((row) => (
          <li key={row.district} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-slate-900">อ.{row.district}</p>
              <StatusPill tone={row.tone} />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
              <div><dt className="inline">กระทบ </dt><dd className="inline font-bold text-slate-900">{formatNumber(row.people)} คน</dd></div>
              <div><dt className="inline">ผู้ป่วย 7 วัน </dt><dd className="inline font-bold text-slate-900">{formatNumber(row.cases7)}</dd></div>
              <div><dt className="inline">ศูนย์พักพิง </dt><dd className="inline font-bold text-slate-900">{row.capacity ? `${formatNumber(row.occupancy)}/${formatNumber(row.capacity)}` : "-"}</dd></div>
              <div><dt className="inline">เปราะบางรอ </dt><dd className="inline font-bold text-slate-900">{formatNumber(row.vulnerablePending)}</dd></div>
              <div><dt className="inline">เสียชีวิต/สูญหาย </dt><dd className="inline font-bold text-slate-900">{row.deaths}/{row.missing}</dd></div>
              <div><dt className="inline">รายงานวันนี้ </dt><dd className="inline font-bold text-slate-900">{row.tambons ? `${row.reported}/${row.tambons}` : "-"}</dd></div>
            </dl>
            {row.recovery ? <p className="mt-1 text-xs"><RecoveryLine recovery={row.recovery} /></p> : null}
            {row.reasons.length ? <p className="mt-2 text-xs text-slate-700">{row.reasons.join(" · ")}</p> : null}
          </li>
        ))}
      </ul>
    </>
  );
}

// รายการตรวจหลังเปิด EOC — เปิดค้างไว้ถ้ายังขาดข้อจำเป็น และหายไปเมื่อทำครบทุกข้อ
// พยากรณ์ 7 วันข้างหน้า: จำนวนตำบลที่คาดว่าเสี่ยงในแต่ละวัน (กดไปหน้าพยากรณ์พื้นที่เสี่ยง)
const OUTLOOK_TONE = { critical: "bg-red-600 text-white", high: "bg-orange-500 text-white", watch: "bg-amber-200 text-amber-950", normal: "bg-slate-100 text-slate-500" };
// ธงเตือนภัย/Trigger ที่ประกาศอยู่ (เกณฑ์ SAT) — กดไปหน้าประกาศและรายชื่อเป้าหมาย
function TriggerStrip({ sessionId }) {
  const [current, setCurrent] = useState(null);
  useEffect(() => {
    let cancelled = false;
    apiRequest(`/stn-eoc/api/eoc/area-triggers?eoc=flood${sessionId ? `&session_id=${sessionId}` : ""}`)
      .then((json) => { if (!cancelled) setCurrent(json.current || []); })
      .catch(() => { if (!cancelled) setCurrent(null); });
    return () => { cancelled = true; };
  }, [sessionId]);
  if (current === null) return null;
  return (
    <Link href="/eoc/flood/triggers" className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 font-[family-name:var(--font-kanit)] hover:shadow-[0_12px_28px_-20px_rgba(15,23,42,.55)]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-100"><Flag className="h-4 w-4" aria-hidden="true" /></span>
      <span className="font-semibold text-slate-900">ธงเตือนภัย/Trigger</span>
      {current.length ? current.map((item) => {
        const meta = stageMeta(item.stage);
        const flag = flagMeta(meta?.flag);
        return (
          <span key={item.id} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
            style={flag ? { background: flag.soft, color: flag.text, boxShadow: `inset 0 0 0 1.5px ${flag.color}` } : { background: "#f1f5f9", color: "#334155" }}>
            {areaLabel(item)} · {flag ? flag.label : `Trigger ${meta?.trigger}`}{flag && meta?.trigger !== 1 ? ` (T${meta.trigger})` : ""}
          </span>
        );
      }) : <span className="text-sm text-slate-600">ยังไม่มีพื้นที่ที่ประกาศ</span>}
      <span className="ml-auto inline-flex items-center text-xs font-semibold text-[#0b4c86]">ประกาศ/ดูรายชื่อเป้าหมาย<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
    </Link>
  );
}

function ForecastStrip() {
  const [outlook, setOutlook] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/stn-eoc/api/public/flood-outlook/")
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => { if (!cancelled && result?.success) setOutlook(result.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  if (!outlook?.dates?.length || !outlook.areas?.length) return null;
  const days = outlook.dates.slice(0, 7).map((date, index) => {
    const count = { critical: 0, high: 0, watch: 0 };
    for (const area of outlook.areas) {
      const level = area.levels[index];
      if (count[level] !== undefined) count[level] += 1;
    }
    const worst = count.critical ? "critical" : count.high ? "high" : count.watch ? "watch" : "normal";
    return { date, count, worst, total: count.critical + count.high + count.watch };
  });
  const label = (date) => new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", { weekday: "short", day: "numeric" });
  return (
    <Link href="/eoc/flood/area-risk" className="block rounded-2xl border border-slate-200 bg-white p-4 font-[family-name:var(--font-kanit)] hover:shadow-[0_12px_28px_-20px_rgba(15,23,42,.55)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#0b4c86] ring-1 ring-sky-100"><CalendarRange className="h-4 w-4" aria-hidden="true" /></span>
          <h3 className="font-semibold text-slate-900">พยากรณ์ตำบลเสี่ยงน้ำท่วม 7 วัน</h3>
        </span>
        <span className="inline-flex items-center text-xs font-semibold text-[#0b4c86]">ดูรายตำบลและเหตุผล<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
      </div>
      <ol className="grid grid-cols-7 gap-1.5">
        {days.map((day) => (
          <li key={day.date} className={`rounded-xl px-1 py-2.5 text-center ${OUTLOOK_TONE[day.worst]}`} title={`เฝ้าระวัง ${day.count.watch} · สูง ${day.count.high} · วิกฤต ${day.count.critical} ตำบล`}>
            <span className="block text-[11px] font-semibold opacity-90">{label(day.date)}</span>
            <span className="block text-xl font-bold tabular-nums leading-tight">{day.total || "–"}</span>
            <span className="block text-[10px] opacity-80">{day.total ? "ตำบล" : "ปกติ"}</span>
          </li>
        ))}
      </ol>
    </Link>
  );
}

function SetupChecklist({ setup }) {
  if (!setup || setup.complete) return null;
  const missingRequired = setup.required - setup.requiredDone;
  const todo = setup.items.filter((item) => !item.done);
  const done = setup.items.filter((item) => item.done);
  const percent = Math.round((setup.done / setup.total) * 100);
  return (
    <details open={missingRequired > 0} className={`group rounded-2xl border bg-white font-[family-name:var(--font-kanit)] ${missingRequired ? "border-amber-300" : "border-slate-200"}`}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-semibold text-slate-900">ตั้งค่าเหตุการณ์ให้พร้อมใช้งาน</span>
          <span className={`block text-sm ${missingRequired ? "font-semibold text-amber-900" : "text-slate-600"}`}>
            {missingRequired ? `ยังขาดข้อจำเป็น ${missingRequired} ข้อ — บางเมนูจะยังบันทึกข้อมูลไม่ได้` : `ทำแล้ว ${setup.done} จาก ${setup.total} ข้อ`}
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className="hidden w-32 sm:block" aria-hidden="true">
            <span className="block h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full bg-[#0b4c86]" style={{ width: `${percent}%` }} /></span>
          </span>
          <span className="text-sm font-bold tabular-nums text-slate-700">{setup.done}/{setup.total}</span>
          <span className="text-sm font-bold text-[#0b4c86] group-open:hidden">แสดง</span>
          <span className="hidden text-sm font-bold text-[#0b4c86] group-open:inline">ซ่อน</span>
        </span>
      </summary>
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {todo.map((item) => (
          <li key={item.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Circle className={`h-5 w-5 shrink-0 ${item.required ? "text-amber-600" : "text-slate-400"}`} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-900">
                {item.title}
                {item.required ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">จำเป็น</span> : null}
              </span>
              <span className="block text-xs text-slate-600">{item.detail}</span>
            </span>
            <Link href={item.href} className="shrink-0 rounded-lg bg-[#0b4c86] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#083865]">{item.action}</Link>
          </li>
        ))}
        {done.map((item) => (
          <li key={item.key} className="flex items-center gap-3 px-4 py-2.5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <span className="min-w-0 text-sm text-slate-600"><span className="font-semibold text-slate-800">{item.title}</span> · {item.detail}</span>
            <span className="sr-only">ทำแล้ว</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function SituationBoard({ sessionId, eocType = "flood" }) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const params = new URLSearchParams({ eoc: eocType });
      if (sessionId) params.set("session_id", String(sessionId));
      const data = await apiRequest(`/stn-eoc/api/eoc/situation-board?${params}`);
      setState({ loading: false, data, error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message || "โหลดสรุปสถานการณ์ไม่สำเร็จ" });
    }
  }, [eocType, sessionId]);

  useEffect(() => {
    load();
    // ข้อมูลเปลี่ยนตลอดระหว่างเหตุการณ์ — โหลดใหม่ทุก 5 นาทีขณะเปิดหน้าไว้
    const timer = setInterval(() => { if (document.visibilityState === "visible") load(); }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [load]);

  const { data } = state;
  if (state.loading && !data) {
    return <div className="mb-6 space-y-4" aria-busy="true"><div className="h-40 animate-pulse rounded-2xl bg-[#0b4c86]/20" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-100" />)}</div><p className="sr-only">กำลังสรุปสถานการณ์…</p></div>;
  }
  if (state.error) {
    return (
      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
        {state.error} <button type="button" onClick={load} className="ml-2 font-bold underline">ลองใหม่</button>
      </div>
    );
  }
  if (!data?.session) return null;
  const headlineTone = data.headline?.tone || "gray";
  const HERO_DOT = { red: "bg-red-400", amber: "bg-amber-300", green: "bg-emerald-400", gray: "bg-slate-300" };
  const completeness = data.completeness;
  const heroButton = "inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/20 disabled:opacity-60";

  return (
    <section id="sec-situation" aria-labelledby="situation-title" className="mb-8 scroll-mt-20 space-y-4">
      <SetupChecklist setup={data.setup} />

      {/* การ์ดหลัก: สถานการณ์รวม + ความครบของรายงานวันนี้ */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0b4c86] p-5 font-[family-name:var(--font-kanit)] text-white shadow-[0_18px_36px_-24px_rgba(11,76,134,.9)] sm:p-6">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10" aria-hidden="true" />
        <div className="absolute -bottom-24 right-40 h-48 w-48 rounded-full bg-white/5" aria-hidden="true" />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-blue-100">
              <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                {headlineTone === "red" ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70 motion-reduce:animate-none" /> : null}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${HERO_DOT[headlineTone] || HERO_DOT.gray}`} />
              </span>
              สถานการณ์ตอนนี้ · {(TONE[headlineTone] || TONE.gray).label}
            </p>
            <h2 id="situation-title" className="mt-2 text-xl font-semibold leading-snug sm:text-2xl">{data.headline?.text}</h2>
            <p className="mt-2 text-xs text-blue-100">ข้อมูล ณ {formatDateTime(data.generated_at)} · อัปเดตอัตโนมัติทุก 5 นาที</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={load} disabled={state.loading} className={heroButton}>
                <RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} aria-hidden="true" />ดึงข้อมูลล่าสุด
              </button>
              {eocType === "flood" ? (
                <a href={`/stn-eoc/api/eoc/sheet-export/?eoc=flood&session_id=${data.session.id}`} download title="แบบรายงานเตรียมความพร้อมรับมืออุทกภัยของ สสจ.สตูล 14 แผ่นงาน" className={heroButton}>
                  <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />ส่งออก Excel แบบชีต สสจ.
                </a>
              ) : null}
            </div>
          </div>
          {completeness ? (
            <Link href="/eoc/flood/records" className="block rounded-xl bg-white/10 p-4 ring-1 ring-white/15 hover:bg-white/15">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-blue-100">ความครบของรายงานวันนี้</span>
                <span className="text-3xl font-bold tabular-nums">{completeness.percent}<span className="ml-0.5 text-base font-medium text-blue-100">%</span></span>
              </span>
              <span className="mt-2 block h-2 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
                <span className={`block h-full rounded-full ${completeness.percent >= 80 ? "bg-emerald-400" : completeness.percent > 0 ? "bg-amber-300" : "bg-red-400"}`} style={{ width: `${completeness.percent}%` }} />
              </span>
              <span className="mt-2 block text-xs text-blue-100">ส่งแล้ว {formatNumber(completeness.reported)} จาก {formatNumber(completeness.total)} ตำบล{completeness.percent < 100 ? " — ตัวเลขด้านล่างอาจยังไม่ครบ" : ""}</span>
            </Link>
          ) : null}
        </div>
      </div>

      {eocType === "flood" ? <TriggerStrip sessionId={data?.session?.id} /> : null}

      {/* ตัวชี้วัดหลัก */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.kpis.map((kpi) => <KpiCard key={kpi.key} kpi={kpi.key === "health" ? { ...kpi, spark: (data.trend || []).map((row) => Number(row.total) || 0) } : kpi} />)}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel icon={ClipboardList} title="เรื่องที่ต้องตัดสินใจและติดตาม" className="lg:col-span-3"
          action={<Link href="/eoc/flood/meeting-brief" className={panelLink}>ดูทั้งหมด {formatNumber(data.agendaTotal)} เรื่อง<ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>}>
          {data.agenda.length ? (
            <ol className="divide-y divide-slate-100">
              {data.agenda.map((item, index) => {
                const level = LEVEL[item.level] || LEVEL.info;
                return (
                  <li key={`${item.title}-${index}`}>
                    <Link href={item.href || "#"} className="flex gap-3 px-4 py-3 hover:bg-[#f5f9fd]">
                      <span className={`mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${level.cls}`}>{level.label}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900"><span className="font-medium text-slate-500">{item.module} · </span>{item.title}</span>
                        <span className="block text-xs leading-relaxed text-slate-600">{item.detail}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="flex items-center gap-2 p-6 text-sm text-slate-500"><CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />ยังไม่มีเรื่องเร่งด่วน</p>
          )}
        </Panel>

        <div className="space-y-4 lg:col-span-2">
          <Panel icon={LineChart} title="ผู้ป่วยรายวัน 14 วันล่าสุด" bodyClassName="p-4"
            action={<Link href="/eoc/flood/health" className={panelLink}>รายละเอียด<ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>}>
            <TrendChart trend={data.trend} />
          </Panel>
          <Link href="/eoc/flood/management/directives" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 font-[family-name:var(--font-kanit)] hover:shadow-[0_12px_28px_-20px_rgba(15,23,42,.55)]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#0b4c86] ring-1 ring-sky-100"><ClipboardList className="h-5 w-5" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-900">สถานการณ์/ข้อสั่งการ</span>
              <span className="block text-sm text-slate-600">
                {data.directives.date
                  ? <>ฉบับวันที่ {new Date(`${data.directives.date}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" })} · <b className={data.directives.open ? "font-semibold text-amber-800" : "font-semibold text-emerald-700"}>ยังไม่ดำเนินการ {data.directives.open} จาก {data.directives.total} ข้อ</b></>
                  : "ยังไม่มีบันทึกข้อสั่งการ"}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {eocType === "flood" ? <ForecastStrip /> : null}

      <div id="sec-districts" className="scroll-mt-20">
        <Panel icon={MapPinned} title="สถานการณ์รายอำเภอ" subtitle="เรียงอำเภอที่ต้องส่งทีมและทรัพยากรไปก่อนไว้บนสุด · สีพื้นเข้ม = ตัวเลขสูงเมื่อเทียบอำเภออื่น · ผลกระทบใช้รายงานวันล่าสุด">
          <DistrictMatrix rows={data.matrix} />
        </Panel>
      </div>
    </section>
  );
}
