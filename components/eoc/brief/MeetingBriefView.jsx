"use client";

// สรุปสำหรับห้องประชุม (หน้าเดียว พิมพ์/บันทึก PDF ได้)
import { useCallback, useEffect, useState } from "react";
import { areaLabel } from "@/lib/vulnerableEvent";
import Link from "next/link";
import { AlertOctagon, AlertTriangle, ArrowRight, Info, Printer, RefreshCw, Siren, FileSpreadsheet } from "lucide-react";
import { apiRequest, formatDateTime, formatNumber } from "@/lib/adminApi";
import { getEocTypeLabel } from "@/lib/eocDisplay";
import { LEVEL_LABELS } from "@/lib/meetingBrief";
import { numberItems } from "@/lib/dailyDirectives";
import AlertsPanel from "@/components/eoc/brief/AlertsPanel";
import { EmptyPanel, PageHero, heroButtonClass, heroPrimaryButtonClass } from "@/components/common/ThemePanels";

// กลุ่มบนหัวหน้า (eyebrow) ตามประเภทเหตุการณ์
const EYEBROWS = { flood: "อุทกภัย", disease: "โรคระบาด" };

const LEVEL_STYLE = {
  critical: { icon: AlertOctagon, box: "border-red-300 bg-red-50", chip: "bg-red-700 text-white", text: "text-red-950" },
  serious: { icon: Siren, box: "border-orange-300 bg-orange-50", chip: "bg-orange-600 text-white", text: "text-orange-950" },
  warning: { icon: AlertTriangle, box: "border-amber-200 bg-amber-50", chip: "bg-amber-500 text-amber-950", text: "text-amber-950" },
  info: { icon: Info, box: "border-slate-200 bg-slate-50", chip: "bg-slate-600 text-white", text: "text-slate-800" }
};

function Section({ title, href, children }) {
  return (
    <section className="break-inside-avoid rounded-2xl border border-slate-200 bg-white p-4 print:rounded-none print:border-slate-300">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-black text-slate-900">{title}</h2>
        {href ? <Link href={href} className="inline-flex items-center gap-1 text-xs font-bold text-[#0b4c86] hover:underline print:hidden">รายละเอียด <ArrowRight className="h-3 w-3" /></Link> : null}
      </div>
      {children}
    </section>
  );
}

function Figures({ items }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-2 print:bg-white print:ring-1 print:ring-slate-200">
          <dt className="text-[11px] font-semibold text-slate-500">{item.label}</dt>
          <dd className={`text-xl font-black tabular-nums ${item.tone || "text-slate-900"}`}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function MeetingBriefView({ eocType = "flood" }) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      setState({ loading: false, data: await apiRequest(`/stn-eoc/api/eoc/meeting-brief?eoc=${eocType}`), error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [eocType]);
  useEffect(() => { load(); }, [load]);

  const data = state.data;
  if (state.loading && !data) return <div className="space-y-3">{[0, 1, 2].map((key) => <div key={key} className="h-32 animate-pulse rounded-xl bg-white" />)}</div>;
  if (state.error || !data?.session) {
    return (
      <div className="w-full space-y-4">
        <PageHero icon="clipboard" eyebrow={EYEBROWS[eocType] || getEocTypeLabel(eocType)} title="สรุปสถานการณ์สำหรับห้องประชุม" subtitle="ศูนย์ข้อมูลสถานการณ์ฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล" />
        {state.error
          ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}</p>
          : <EmptyPanel icon="info" title={data?.message || "ยังไม่มีเหตุการณ์ที่เปิดอยู่"} />}
      </div>
    );
  }

  const base = `/eoc/${eocType}`;
  const { health, shelters, supplies, vulnerable, it, directives, completeness } = data;
  const directiveItems = directives?.items || [];
  const numbers = numberItems(directiveItems);

  return (
    <div className="w-full space-y-4 print:max-w-none print:space-y-3 print:text-[12px]">
      <style>{"@media print { @page { size: A4; margin: 12mm; } }"}</style>
      <PageHero
        icon="clipboard"
        eyebrow={EYEBROWS[eocType] || getEocTypeLabel(eocType)}
        title="สรุปสถานการณ์สำหรับห้องประชุม"
        subtitle="ศูนย์ข้อมูลสถานการณ์ฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล"
        meta={`${getEocTypeLabel(eocType)} ครั้งที่ ${data.session.session_number}${data.session.status === "active" ? "" : " (ปิดแล้ว)"} · ข้อมูล ณ ${formatDateTime(data.generated_at)}`}
        className="print:hidden"
        actions={(
          <>
            <button type="button" className={heroButtonClass} onClick={load} disabled={state.loading}><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} aria-hidden="true" />ดึงข้อมูลล่าสุด</button>
            {eocType === "flood" ? (
              <a href={`/stn-eoc/api/eoc/sheet-export/?eoc=flood&session_id=${data.session.id}`} download
                title="14 แผ่นงานตามแบบรายงานเตรียมความพร้อมรับมืออุทกภัยของ สสจ.สตูล (ไม่รวมข้อมูลรายบุคคล)"
                className={heroButtonClass}>
                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />ส่งออก Excel แบบชีต สสจ.
              </a>
            ) : null}
            <button type="button" className={heroPrimaryButtonClass} onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden="true" />พิมพ์ / บันทึก PDF</button>
          </>
        )}
      />
      {/* หัวสำหรับพิมพ์ (บนจอใช้ PageHero ด้านบน) */}
      <header className="hidden flex-wrap items-end justify-between gap-3 border-b-2 border-[#0b4c86] pb-3 print:flex">
        <div>
          <p className="text-sm font-semibold text-[#0b4c86]">ศูนย์ข้อมูลสถานการณ์ฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล</p>
          <p className="font-[family-name:var(--font-kanit)] text-2xl font-semibold text-slate-900">สรุปสถานการณ์สำหรับห้องประชุม</p>
          <p className="text-sm text-slate-600">{getEocTypeLabel(eocType)} ครั้งที่ {data.session.session_number}{data.session.status === "active" ? "" : " (ปิดแล้ว)"} · ข้อมูล ณ {formatDateTime(data.generated_at)}</p>
        </div>
      </header>

      <Section title={`เรื่องที่ต้องตัดสินใจและติดตาม (${data.agenda.length})`}>
        {data.agenda.length ? (
          <ol className="space-y-2">
            {data.agenda.map((item, index) => {
              const style = LEVEL_STYLE[item.level] || LEVEL_STYLE.info;
              const Icon = style.icon;
              return (
                <li key={`${item.module}-${item.title}`} className={`flex gap-3 rounded-lg border p-3 ${style.box} break-inside-avoid`}>
                  <span className="w-5 shrink-0 pt-0.5 text-right text-sm font-black text-slate-500">{index + 1}.</span>
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.text} print:hidden`} aria-hidden="true" />
                  <div className={`min-w-0 flex-1 ${style.text}`}>
                    <p className="text-sm font-bold"><span className={`mr-1.5 rounded px-1.5 py-0.5 text-[11px] ${style.chip}`}>{LEVEL_LABELS[item.level]}</span><span className="mr-1.5 text-xs font-semibold opacity-75">[{item.module}]</span>{item.title}</p>
                    {item.detail ? <p className="mt-0.5 text-sm">{item.detail}</p> : null}
                  </div>
                  {item.href ? <Link href={item.href} className="self-center text-xs font-bold text-[#0b4c86] hover:underline print:hidden">เปิด</Link> : null}
                </li>
              );
            })}
          </ol>
        ) : <p className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">ไม่มีเรื่องเร่งด่วนจากข้อมูลในระบบ</p>}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2 print:gap-3">
        <Section title="สุขภาพและโรค" href={`${base}/health`}>
          <Figures items={[
            { label: "ผู้ป่วยสะสม", value: formatNumber(health.totals.cases) },
            { label: "7 วันล่าสุด", value: `${formatNumber(health.totals.last7)}${health.totals.change === null ? " (ใหม่)" : health.totals.change ? ` (${health.totals.change > 0 ? "+" : ""}${health.totals.change}%)` : ""}`, tone: health.totals.change === null || health.totals.change > 0 ? "text-red-700" : undefined },
            { label: "ส่งต่อโรงพยาบาล", value: formatNumber(health.totals.hospitalized) },
            { label: "เสียชีวิต", value: formatNumber(health.totals.deaths), tone: health.totals.deaths ? "text-red-700" : undefined }
          ]} />
          {health.diseases.length ? <p className="mt-2 text-sm text-slate-700"><b>โรคที่พบมาก:</b> {health.diseases.map((item) => `${item.disease} ${formatNumber(item.total)}`).join(" · ")}</p> : null}
          {health.districts.filter((row) => row.last7).length ? <p className="mt-1 text-sm text-slate-700"><b>อำเภอที่มีผู้ป่วย 7 วันล่าสุด:</b> {health.districts.filter((row) => row.last7).map((row) => `${row.district} ${formatNumber(row.last7)}`).join(" · ")}</p> : null}
        </Section>

        <Section title="ศูนย์พักพิง" href="/eoc/shelters?eoc=flood">
          <Figures items={[
            { label: "ศูนย์ที่เปิด", value: `${formatNumber(shelters.activeCount)} แห่ง` },
            { label: "ผู้พักพิง", value: `${formatNumber(shelters.occupancy)} คน` },
            { label: "ที่ว่าง", value: formatNumber(shelters.free), tone: shelters.activeCount && !shelters.free ? "text-red-700" : undefined },
            { label: "เต็ม/ใกล้เต็ม", value: `${formatNumber(shelters.full)}/${formatNumber(shelters.nearFull)}`, tone: shelters.full ? "text-red-700" : undefined }
          ]} />
          {shelters.attention.length ? <p className="mt-2 text-sm text-slate-700"><b>ติดตาม:</b> {shelters.attention.slice(0, 5).map((item) => `${item.name} (${item.reasons.map((reason) => reason.text).join(", ")})`).join(" · ")}</p> : null}
        </Section>

        <Section title="กลุ่มเปราะบาง" href={`${base}/vulnerable-groups`}>
          <Figures items={[
            { label: "หมู่บ้านที่ประสบภัย", value: formatNumber(vulnerable.villages) },
            { label: "ได้รับผลกระทบ", value: `${formatNumber(vulnerable.affected)} คน` },
            { label: "ดูแลแล้ว", value: `${vulnerable.caredPercent}%`, tone: "text-emerald-700" },
            { label: "ยังไม่ได้ดูแล", value: formatNumber(vulnerable.pending), tone: vulnerable.pending ? "text-red-700" : undefined }
          ]} />
          {vulnerable.urgent?.length ? <p className="mt-2 text-sm text-slate-700"><b>ติดตามด่วน:</b> {vulnerable.urgent.slice(0, 5).map((row) => `${areaLabel(row).main} รอ ${formatNumber(row.pending)}`).join(" · ")}</p> : null}
        </Section>

        <Section title="เวชภัณฑ์และคลังยา" href={`${base}/supplies`}>
          {supplies.opened ? (
            <>
              <Figures items={[
                { label: "ชนิดเวชภัณฑ์", value: formatNumber(supplies.summary.items) },
                { label: "หน่วยบริการ", value: formatNumber(supplies.summary.agencies) },
                { label: "หมด", value: formatNumber(supplies.summary.out), tone: supplies.summary.out ? "text-red-700" : undefined },
                { label: "ใกล้หมด", value: formatNumber(supplies.summary.low), tone: supplies.summary.low ? "text-amber-700" : undefined }
              ]} />
              {supplies.critical.length ? <p className="mt-2 text-sm text-slate-700"><b>ต้องจัดสรร:</b> {supplies.critical.slice(0, 6).map((row) => `${row.item_name} @${row.agency_name} เหลือ ${formatNumber(row.balance_qty)}`).join(" · ")}</p> : null}
            </>
          ) : <p className="text-sm text-slate-600">ยังไม่ได้เปิดบัญชีคลังของเหตุการณ์นี้</p>}
        </Section>

        <Section title="IT และการสื่อสาร" href={`${base}/it-support`}>
          <Figures items={[
            { label: "ปัญหาที่ยังเปิด", value: formatNumber(it.summary.open) },
            { label: "วิกฤต/สูง", value: formatNumber(it.summary.critical), tone: it.summary.critical ? "text-red-700" : undefined },
            { label: "แก้แล้ววันนี้", value: formatNumber(it.summary.resolvedToday) },
            { label: "อุปกรณ์ออฟไลน์", value: formatNumber(it.offline.length), tone: it.offline.length ? "text-red-700" : undefined }
          ]} />
          {it.openTickets.length ? <p className="mt-2 text-sm text-slate-700"><b>เรื่องค้าง:</b> {it.openTickets.slice(0, 4).map((ticket) => `${ticket.ticket_no} ${ticket.title} (${ticket.unit_name})`).join(" · ")}</p> : null}
        </Section>

        <Section title="ความครบของรายงานวันนี้" href={eocType === "flood" ? "/eoc/flood/overview#sec-completeness" : undefined}>
          {completeness?.total ? (
            <>
              <p className="text-2xl font-black text-[#0b4c86]">{completeness.percent}% <span className="text-sm font-semibold text-slate-600">({formatNumber(completeness.reported)}/{formatNumber(completeness.total)} ตำบล)</span></p>
              {completeness.districts.filter((row) => row.missing.length).length ? <p className="mt-1 text-sm text-slate-700"><b>ยังขาด:</b> {completeness.districts.filter((row) => row.missing.length).map((row) => `อ.${row.district} ${row.missing.length} ตำบล`).join(" · ")}</p> : null}
            </>
          ) : <p className="text-sm text-slate-600">ไม่มีข้อมูล</p>}
        </Section>
      </div>

      <Section title={`สถานการณ์/ข้อสั่งการ${directives?.date ? ` (${directives.date})` : ""}`} href={`${base}/management/directives`}>
        {directiveItems.length ? (
          <ol className="space-y-1">
            {directiveItems.map((item, index) => (
              <li key={item.id} className="flex gap-2 text-sm" style={{ paddingLeft: `${Number(item.item_level) * 1.5}rem` }}>
                <span className="w-9 shrink-0 text-right font-bold tabular-nums text-slate-500">{numbers[index]}.</span>
                <span className={item.item_status === "done" ? "text-slate-500 line-through" : "text-slate-900"}>{item.content}</span>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-slate-600">ยังไม่มีบันทึกสถานการณ์/ข้อสั่งการ</p>}
      </Section>

      <AlertsPanel eocType={eocType} />

      <p className="text-xs text-slate-500">สรุปอัตโนมัติจากข้อมูลที่บันทึกในระบบ ข้อเสนอเป็นข้อมูลประกอบการตัดสินใจ ไม่ใช่คำสั่ง</p>
    </div>
  );
}
