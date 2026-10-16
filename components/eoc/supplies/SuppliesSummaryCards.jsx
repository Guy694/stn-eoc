"use client";

// การ์ดสรุปของหน้าเวชภัณฑ์และคลังยา
// - DashboardSummary: แท็บภาพรวม (การส่งรายงานวันนี้ + สัญญาณที่ต้องจัดการ)
// - StockSummary: แท็บคงคลัง (สัดส่วนสถานะ กดการ์ดเพื่อกรองตาราง)
// การ์ดพื้นฐานอยู่ที่ components/common/MetricCards.jsx
import { AlertTriangle, CalendarX2, Hourglass, PackageCheck, PackageX, Pill, Scale, CircleHelp, Warehouse, ClipboardCheck } from "lucide-react";
import { formatNumber } from "@/lib/adminApi";
import { HeroCard, MetricCard, sharePercent as pct } from "@/components/common/MetricCards";
import { shortThaiDate } from "@/lib/medicalDaily";

/** แท็บภาพรวม */
export function DashboardSummary({ summary, reporting, today }) {
  const rt = reporting?.today || { complete: 0, partial: 0, missing: 0, total: 0 };
  const rows = summary.stock_rows || 0;
  const reportPct = pct(rt.complete, rt.total);
  const cards = [
    {
      key: "items", icon: Pill, label: "รายการเวชภัณฑ์", value: formatNumber(summary.items), unit: "ชนิด", tone: "blue",
      note: `${formatNumber(summary.facilities)} หน่วยบริการ · ${formatNumber(rows)} รายการในคลัง`
    },
    {
      key: "out", icon: PackageX, label: "หมดคลัง", value: formatNumber(summary.out), unit: "รายการ", tone: summary.out ? "red" : "slate",
      tag: summary.out ? "ต้องเติม" : null, share: pct(summary.out, rows), shareLabel: "สัดส่วนของรายการในคลังทั้งหมด"
    },
    {
      key: "critical", icon: Hourglass, label: "พอใช้ไม่ถึง 3 วัน", value: formatNumber(summary.critical_cover), unit: "รายการ", tone: summary.critical_cover ? "red" : "slate",
      tag: summary.critical_cover ? "ด่วน" : null, note: summary.warning_cover ? `อีก ${formatNumber(summary.warning_cover)} รายการพอใช้ 3–7 วัน` : "คิดจากอัตราใช้เฉลี่ยต่อวัน"
    },
    {
      key: "low", icon: AlertTriangle, label: "ใกล้หมด (ต่ำกว่า 20%)", value: formatNumber(summary.low), unit: "รายการ", tone: summary.low ? "amber" : "slate",
      share: pct(summary.low, rows), shareLabel: "สัดส่วนของรายการในคลังทั้งหมด"
    },
    {
      key: "diff", icon: Scale, label: "ยอดนับไม่ตรงวันนี้", value: formatNumber(summary.discrepancies), unit: "รายการ", tone: summary.discrepancies ? "amber" : "slate",
      note: summary.discrepancies ? "ตรวจแล้วปรับยอดที่แท็บคงคลัง" : "ยอดนับตรงกับที่ระบบคำนวณ"
    },
    ...(summary.lots ? [{
      key: "expiry", icon: CalendarX2, label: "ล็อตหมดอายุ / ใน 3 เดือน", value: `${formatNumber(summary.expired)} / ${formatNumber(summary.expiring_90)}`,
      tone: summary.expired ? "red" : summary.expiring_90 ? "amber" : "slate",
      note: summary.expiring_180 ? `อีก ${formatNumber(summary.expiring_180)} ล็อตหมดอายุใน 6 เดือน` : `จาก ${formatNumber(summary.lots)} ล็อต`
    }] : [])
  ];

  return (
    <section className="grid gap-3 lg:grid-cols-[17rem_minmax(0,1fr)]" aria-label="สรุปเวชภัณฑ์และคลังยา">
      <HeroCard
        title={`ส่งรายงานครบ วันที่ ${shortThaiDate(today)}`}
        value={`${formatNumber(rt.complete)}/${formatNumber(rt.total)}`}
        unit="หน่วย"
        caption={rt.total ? `${reportPct}% ของหน่วยบริการ` : "ยังไม่มีหน่วยบริการในบัญชีคลัง"}
        total={rt.total}
        segments={[
          { key: "complete", label: "รายงานครบ", value: rt.complete, color: "bg-emerald-400" },
          { key: "partial", label: "รายงานไม่ครบ", value: rt.partial, color: "bg-amber-300" },
          { key: "missing", label: "ยังไม่รายงาน", value: rt.missing, color: "bg-red-400" }
        ]}
        footer="ดูรายชื่อหน่วยที่ยังไม่รายงานได้ด้านล่าง"
        footerIcon={ClipboardCheck}
      />
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {cards.map(({ key, ...card }) => <li key={key}><MetricCard {...card} /></li>)}
      </ul>
    </section>
  );
}

/** แท็บคงคลัง — การ์ดสถานะกดแล้วกรองตาราง กดซ้ำเพื่อยกเลิก */
export function StockSummary({ summary, levelFilter, onFilter }) {
  const rows = summary.rows || 0;
  const ok = Math.max(0, rows - summary.out - summary.low - summary.unknown);
  const levels = [
    { key: "out", icon: PackageX, label: "หมด", value: summary.out, tone: summary.out ? "red" : "slate", color: "bg-red-400", tag: summary.out ? "ต้องเติม" : null },
    { key: "low", icon: AlertTriangle, label: "ใกล้หมด (ต่ำกว่า 20%)", value: summary.low, tone: summary.low ? "amber" : "slate", color: "bg-amber-300" },
    { key: "ok", icon: PackageCheck, label: "พอใช้", value: ok, tone: "green", color: "bg-emerald-400" },
    { key: "unknown", icon: CircleHelp, label: "ยังไม่รายงาน", value: summary.unknown, tone: "slate", color: "bg-slate-300" }
  ];
  const toggle = (key) => onFilter?.(levelFilter === key ? "" : key);
  return (
    <section className="grid gap-3 lg:grid-cols-[17rem_minmax(0,1fr)]" aria-label="สรุปคงคลัง">
      <HeroCard
        title="รายการในคลังทั้งหมด"
        value={formatNumber(rows)}
        unit="รายการ"
        caption={`${formatNumber(summary.items)} ชนิด · ${formatNumber(summary.agencies)} หน่วยบริการ/คลัง`}
        total={rows}
        segments={levels.map(({ key, label, value, color }) => ({ key, label, value, color }))}
        footer="กดการ์ดสถานะเพื่อกรองตาราง"
        footerIcon={Warehouse}
      />
      <ul className="grid grid-cols-2 gap-2.5">
        {levels.map(({ key, color, ...level }) => (
          <li key={key}>
            <MetricCard {...level} value={formatNumber(level.value)} unit="รายการ" share={pct(level.value, rows)} shareLabel="สัดส่วนของรายการในคลังทั้งหมด"
              active={levelFilter === key} onClick={() => toggle(key)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export { MetricCard };
