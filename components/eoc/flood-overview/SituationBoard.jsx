"use client";

// แผงสรุปสถานการณ์ (บนสุดของหน้าภาพรวม): อ่านจากบนลงล่าง = สถานการณ์รวม → ตัวชี้วัดหลัก → เรื่องที่ต้องตัดสินใจ → อำเภอไหนต้องไปก่อน
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Circle, ClipboardList, FileSpreadsheet, RefreshCw } from "lucide-react";
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

function KpiCard({ kpi }) {
  const t = TONE[kpi.tone] || TONE.gray;
  return (
    <Link href={kpi.href} className={`group flex flex-col rounded-xl border border-l-4 border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#0b4c86]/40 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b4c86] ${t.bar}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-slate-600">{kpi.label}</p>
        <StatusPill tone={kpi.tone} />
      </div>
      <p className="mt-2 text-3xl font-black tabular-nums text-slate-900">
        {typeof kpi.value === "number" ? formatNumber(kpi.value) : kpi.value}
        <span className="ml-1 text-sm font-semibold text-slate-500">{kpi.unit}</span>
      </p>
      <Delta kpi={kpi} />
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{kpi.detail}</p>
    </Link>
  );
}

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
          <thead className="bg-slate-50 text-xs text-slate-600">
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
                    <span className="block font-bold text-slate-900">อ.{row.district}</span>
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
    <Link href="/eoc/flood/triggers" className="flex flex-wrap items-center gap-2 rounded-xl border border-[#c9dcee] bg-white px-3 py-2.5 shadow-sm hover:shadow">
      <span className="font-black text-slate-900">ธงเตือนภัย/Trigger</span>
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
      <span className="ml-auto text-xs font-bold text-[#0b4c86]">ประกาศ/ดูรายชื่อเป้าหมาย</span>
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
    <Link href="/eoc/flood/area-risk" className="block rounded-xl border border-[#c9dcee] bg-white p-3 shadow-sm hover:shadow">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-black text-slate-900">พยากรณ์ตำบลเสี่ยงน้ำท่วม 7 วัน</h3>
        <span className="text-xs font-bold text-[#0b4c86]">ดูรายตำบลและเหตุผล</span>
      </div>
      <ol className="grid grid-cols-7 gap-1.5">
        {days.map((day) => (
          <li key={day.date} className={`rounded-lg px-1 py-2 text-center ${OUTLOOK_TONE[day.worst]}`} title={`เฝ้าระวัง ${day.count.watch} · สูง ${day.count.high} · วิกฤต ${day.count.critical} ตำบล`}>
            <span className="block text-[11px] font-semibold opacity-90">{label(day.date)}</span>
            <span className="block text-lg font-black tabular-nums leading-tight">{day.total || "–"}</span>
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
    <details open={missingRequired > 0} className={`group rounded-xl border bg-white shadow-sm ${missingRequired ? "border-amber-300" : "border-[#c9dcee]"}`}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-black text-slate-900">ตั้งค่าเหตุการณ์ให้พร้อมใช้งาน</span>
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
    return <div className="mb-6 rounded-xl border border-[#c9dcee] bg-white p-10 text-center text-sm text-slate-500">กำลังสรุปสถานการณ์…</div>;
  }
  if (state.error) {
    return (
      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
        {state.error} <button type="button" onClick={load} className="ml-2 font-bold underline">ลองใหม่</button>
      </div>
    );
  }
  if (!data?.session) return null;
  const banner = TONE[data.headline?.tone] || TONE.gray;

  return (
    <section id="sec-situation" aria-labelledby="situation-title" className="mb-8 scroll-mt-20 space-y-4">
      <SetupChecklist setup={data.setup} />
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${banner.banner}`}>
        <div className="min-w-0">
          <h2 id="situation-title" className="text-lg font-black leading-snug">{data.headline?.text}</h2>
          <p className="text-xs opacity-80">สถานการณ์ล่าสุด ณ {formatDateTime(data.generated_at)} · อัปเดตอัตโนมัติทุก 5 นาที</p>
        </div>
        <button type="button" onClick={load} disabled={state.loading} className="inline-flex items-center gap-1.5 rounded-lg border border-current/20 bg-white/70 px-3 py-1.5 text-sm font-bold hover:bg-white disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} aria-hidden="true" />ดึงข้อมูลล่าสุด
        </button>
        {eocType === "flood" ? (
          <a href={`/stn-eoc/api/eoc/sheet-export/?eoc=flood&session_id=${data.session.id}`} download title="แบบรายงานเตรียมความพร้อมรับมืออุทกภัยของ สสจ.สตูล 14 แผ่นงาน"
            className="inline-flex items-center gap-1.5 rounded-lg border border-current/20 bg-white/70 px-3 py-1.5 text-sm font-bold hover:bg-white">
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />ส่งออก Excel แบบชีต สสจ.
          </a>
        ) : null}
      </div>

      {eocType === "flood" ? <TriggerStrip sessionId={data?.session?.id} /> : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-[#c9dcee] bg-white shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <h3 className="font-black text-slate-900">เรื่องที่ต้องตัดสินใจและติดตาม</h3>
            <Link href="/eoc/flood/meeting-brief" className="text-sm font-bold text-[#0b4c86] hover:underline">ดูทั้งหมด {formatNumber(data.agendaTotal)} เรื่อง</Link>
          </div>
          {data.agenda.length ? (
            <ol className="divide-y divide-slate-100">
              {data.agenda.map((item, index) => {
                const level = LEVEL[item.level] || LEVEL.info;
                return (
                  <li key={`${item.title}-${index}`}>
                    <Link href={item.href || "#"} className="flex gap-3 px-4 py-3 hover:bg-[#edf5fc]">
                      <span className={`mt-0.5 h-fit shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${level.cls}`}>{level.label}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-900"><span className="font-semibold text-slate-500">{item.module} · </span>{item.title}</span>
                        <span className="block text-xs leading-relaxed text-slate-600">{item.detail}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : <p className="p-6 text-sm text-slate-500">ยังไม่มีเรื่องเร่งด่วน</p>}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-[#c9dcee] bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-black text-slate-900">ผู้ป่วยรายวัน 14 วันล่าสุด</h3>
              <Link href="/eoc/flood/health" className="text-sm font-bold text-[#0b4c86] hover:underline">รายละเอียด</Link>
            </div>
            <TrendChart trend={data.trend} />
          </div>
          <Link href="/eoc/flood/management/directives" className="flex items-center gap-3 rounded-xl border border-[#c9dcee] bg-white p-4 shadow-sm hover:bg-[#edf5fc]">
            <ClipboardList className="h-8 w-8 shrink-0 text-[#0b4c86]" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block font-black text-slate-900">สถานการณ์/ข้อสั่งการ</span>
              <span className="block text-sm text-slate-600">
                {data.directives.date
                  ? <>ฉบับวันที่ {new Date(`${data.directives.date}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" })} · <b className={data.directives.open ? "text-amber-800" : "text-emerald-700"}>ยังไม่ดำเนินการ {data.directives.open} จาก {data.directives.total} ข้อ</b></>
                  : "ยังไม่มีบันทึกข้อสั่งการ"}
              </span>
            </span>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((kpi) => <KpiCard key={kpi.key} kpi={kpi} />)}
        {data.completeness ? (
          <Link href="/eoc/flood/records" className={`flex flex-col rounded-xl border border-l-4 border-slate-200 bg-white p-4 shadow-sm hover:shadow ${data.completeness.percent >= 80 ? TONE.green.bar : data.completeness.percent > 0 ? TONE.amber.bar : TONE.red.bar}`}>
            <p className="text-sm font-semibold text-slate-600">ความครบของรายงานวันนี้</p>
            <p className="mt-2 text-3xl font-black tabular-nums text-slate-900">{data.completeness.percent}<span className="ml-1 text-sm font-semibold text-slate-500">%</span></p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full bg-[#0b4c86]" style={{ width: `${data.completeness.percent}%` }} /></div>
            <p className="mt-2 text-xs text-slate-600">ส่งแล้ว {formatNumber(data.completeness.reported)} จาก {formatNumber(data.completeness.total)} ตำบล — ตัวเลขด้านบนอาจยังไม่ครบถ้ารายงานไม่ครบ</p>
          </Link>
        ) : null}
      </div>

      {eocType === "flood" ? <ForecastStrip /> : null}


      <div id="sec-districts" className="scroll-mt-20 overflow-hidden rounded-xl border border-[#c9dcee] bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="font-black text-slate-900">สถานการณ์รายอำเภอ</h3>
          <p className="text-xs text-slate-600">เรียงอำเภอที่ต้องส่งทีมและทรัพยากรไปก่อนไว้บนสุด · สีพื้นเข้ม = ตัวเลขสูงเมื่อเทียบอำเภออื่น · ผลกระทบใช้รายงานวันล่าสุด</p>
        </div>
        <DistrictMatrix rows={data.matrix} />
      </div>
    </section>
  );
}
