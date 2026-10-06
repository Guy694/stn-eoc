"use client";

// Dashboard ศูนย์พักพิงในเหตุการณ์: ภาพรวมความจุ รายอำเภอ ศูนย์ที่ต้องติดตาม สุขภาพ และกลุ่มผู้พักพิง
import Link from "next/link";
import { AlertTriangle, BedDouble, Building2, Clock3, HeartPulse, Users } from "lucide-react";
import { formatNumber } from "@/lib/adminApi";

const PILL = {
  red: "bg-red-50 text-red-800 ring-red-200",
  amber: "bg-amber-50 text-amber-900 ring-amber-200",
  gray: "bg-slate-100 text-slate-700 ring-slate-200"
};

function usageTone(percent) {
  if (percent >= 100) return "bg-red-600";
  if (percent >= 80) return "bg-amber-500";
  return "bg-emerald-600";
}

function Kpi({ icon: Icon, label, value, unit, hint, tone = "text-slate-900" }) {
  return (
    <div className="rounded-xl border border-[#c9dcee] bg-white p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Icon className="h-4 w-4" aria-hidden="true" />{label}</div>
      <p className={`mt-1 text-3xl font-black tabular-nums ${tone}`}>{value}{unit ? <span className="ml-1 text-sm font-semibold text-slate-500">{unit}</span> : null}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Meter({ percent, label }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="meter" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-full rounded-full ${usageTone(percent)}`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

export default function ShelterSessionDashboard({ summary, onShowShelter }) {
  const { health } = summary;
  const maxGroup = Math.max(1, ...summary.groups.map((group) => group.value));
  const maxDisease = Math.max(1, ...health.byDisease.map((item) => item.new_cases));

  return (
    <section aria-label="สรุปศูนย์พักพิงในเหตุการณ์" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Building2} label="ศูนย์ที่เปิดใช้" value={formatNumber(summary.activeCount)} unit="แห่ง" hint={`จากทะเบียน ${formatNumber(summary.registered)} แห่ง`} tone="text-[#0b4c86]" />
        <Kpi icon={Users} label="ผู้พักพิงขณะนี้" value={formatNumber(summary.occupancy)} unit="คน" hint={`ใช้ไป ${summary.usePercent}% ของความจุ`} />
        <Kpi icon={BedDouble} label="ที่ว่างรวม" value={formatNumber(summary.free)} unit="ที่" hint={`ความจุรวม ${formatNumber(summary.capacity)} คน`} tone={summary.activeCount && !summary.free ? "text-red-700" : "text-emerald-700"} />
        <Kpi icon={AlertTriangle} label="เต็ม / ใกล้เต็ม" value={`${formatNumber(summary.full)} / ${formatNumber(summary.nearFull)}`} unit="แห่ง" hint="ใกล้เต็ม = ใช้ 80% ขึ้นไป" tone={summary.full ? "text-red-700" : summary.nearFull ? "text-amber-700" : "text-slate-900"} />
        <Kpi icon={Clock3} label="ยอดไม่อัปเดตเกิน 12 ชม." value={formatNumber(summary.stale)} unit="แห่ง" hint="ควรให้ศูนย์รายงานยอดใหม่" tone={summary.stale ? "text-amber-700" : "text-slate-900"} />
        <Kpi icon={HeartPulse} label="ผู้ป่วยในศูนย์ (สะสม)" value={formatNumber(health.totals.new_cases)} unit="ราย" hint={`วันนี้ ${formatNumber(health.totals.today_new_cases)} · ส่งต่อ ${formatNumber(health.totals.hospitalized)}`} tone={health.totals.today_new_cases ? "text-amber-700" : "text-slate-900"} />
      </div>

      {summary.activeCount ? (
        <div className="rounded-xl border border-[#c9dcee] bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-black text-slate-900">การใช้ความจุรวม</h3>
            <p className="text-sm tabular-nums text-slate-600"><b className="text-slate-900">{formatNumber(summary.occupancy)}</b> / {formatNumber(summary.capacity)} คน ({summary.usePercent}%)</p>
          </div>
          <div className="mt-2"><Meter percent={summary.usePercent} label="การใช้ความจุรวม" /></div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <div className="overflow-x-auto rounded-xl border border-[#c9dcee] bg-white">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="px-5 pt-4 text-left text-base font-black text-slate-900">แยกตามอำเภอ</caption>
            <thead className="text-xs text-slate-500">
              <tr><th className="px-5 py-2">อำเภอ</th><th className="px-3 py-2 text-right">ศูนย์</th><th className="px-3 py-2 text-right">ผู้พักพิง</th><th className="px-3 py-2 text-right">ที่ว่าง</th><th className="w-44 px-5 py-2">การใช้ความจุ</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.districts.length ? summary.districts.map((row) => (
                <tr key={row.district}>
                  <td className="px-5 py-2.5 font-semibold text-slate-900">อ.{row.district}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(row.shelters)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(row.occupancy)}</td>
                  <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${row.free ? "text-emerald-700" : "text-red-700"}`}>{formatNumber(row.free)}</td>
                  <td className="px-5 py-2.5"><div className="flex items-center gap-2"><div className="flex-1"><Meter percent={row.usePercent} label={`การใช้ความจุ อ.${row.district}`} /></div><span className="w-10 text-right text-xs tabular-nums text-slate-600">{row.usePercent}%</span></div></td>
                </tr>
              )) : <tr><td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">ยังไม่ได้เปิดใช้ศูนย์ในเหตุการณ์นี้</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-[#c9dcee] bg-white p-5">
          <h3 className="text-base font-black text-slate-900">ศูนย์ที่ต้องติดตาม</h3>
          {summary.attention.length ? (
            <ul className="mt-2 divide-y divide-slate-100">
              {summary.attention.map((item) => (
                <li key={item.id} className="py-2.5">
                  <button type="button" onClick={() => onShowShelter?.(item.name)} className="text-left text-sm font-bold text-slate-900 hover:text-[#0b4c86] hover:underline">{item.name}</button>
                  <span className="ml-1 text-xs text-slate-500">{item.district ? `อ.${item.district}` : ""}</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.reasons.map((reason) => <span key={reason.text} className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${PILL[reason.tone]}`}>{reason.text}</span>)}
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">ทุกศูนย์อยู่ในเกณฑ์ปกติ</p>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#c9dcee] bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-black text-slate-900">โรคที่พบในศูนย์</h3>
            <Link href="/eoc/flood/health?tab=shelter" className="text-sm font-bold text-[#0b4c86] hover:underline">บันทึกรายงานโรค</Link>
          </div>
          <p className="text-xs text-slate-500">
            {health.sheltersWithCases ? `พบผู้ป่วยใน ${formatNumber(health.sheltersWithCases)} ศูนย์` : "ยังไม่มีรายงานผู้ป่วยในศูนย์"}
            {health.totals.latest_report_date ? ` · รายงานล่าสุด ${health.totals.latest_report_date}` : ""}
            {health.totals.deaths ? ` · เสียชีวิต ${formatNumber(health.totals.deaths)} ราย` : ""}
          </p>
          {health.byDisease.length ? (
            <ul className="mt-3 space-y-2.5">
              {health.byDisease.map((item) => (
                <li key={item.disease_type}>
                  <div className="flex justify-between gap-3 text-sm"><span className="font-semibold text-slate-800">{item.disease_type}</span><span className="tabular-nums text-slate-600"><b className="text-slate-900">{formatNumber(item.new_cases)}</b> ราย · {formatNumber(item.shelters)} ศูนย์</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#0b4c86]" style={{ width: `${(item.new_cases / maxDisease) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="rounded-xl border border-[#c9dcee] bg-white p-5">
          <h3 className="text-base font-black text-slate-900">กลุ่มที่ต้องดูแลพิเศษในศูนย์</h3>
          <p className="text-xs text-slate-500">ตามข้อมูลผู้พักพิงรายกลุ่มในทะเบียนศูนย์ (รวมเฉพาะศูนย์ที่เปิดใช้)</p>
          {summary.hasGroupData ? (
            <ul className="mt-3 space-y-2.5">
              {summary.groups.map((group) => (
                <li key={group.key}>
                  <div className="flex justify-between text-sm"><span className="font-semibold text-slate-800">{group.label}</span><b className="tabular-nums text-slate-900">{formatNumber(group.value)}</b></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#2a9db0]" style={{ width: `${(group.value / maxGroup) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">ยังไม่มีข้อมูลผู้พักพิงแยกกลุ่ม ดูผู้เปราะบางที่เคลื่อนย้ายได้ที่ <Link href="/eoc/flood/vulnerable-groups" className="font-bold text-[#0b4c86] hover:underline">กลุ่มเปราะบาง</Link></p>}
        </div>
      </div>
    </section>
  );
}
