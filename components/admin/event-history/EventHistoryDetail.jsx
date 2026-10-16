"use client";

// สรุปเหตุการณ์หนึ่งครั้ง: เกิดอะไรขึ้น → ช่วยเหลือไปเท่าไร → ศูนย์ทำงานอย่างไร → บันทึกกิจกรรม
// หัวข้อที่ไม่มีข้อมูลจะไม่แสดงเป็นกล่องว่าง แต่รวมไว้ในบรรทัดเดียวท้ายหน้า
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, FileText, HeartCrack, HeartPulse, Home, Tent, Users } from "lucide-react";
import { AdminPage, Button, StatStrip, StatusPill } from "@/components/admin/crud";
import { apiRequest, formatDateTime, formatNumber } from "@/lib/adminApi";
import { formatEocDisplayName } from "@/lib/eocDisplay";

function shortDate(value, withYear = true) {
  if (!value) return "-";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  const date = y && m && d ? new Date(y, m - 1, d) : new Date(value);
  return date.toLocaleDateString("th-TH", withYear ? { day: "numeric", month: "short", year: "2-digit" } : { day: "numeric", month: "short" });
}

function fileUrl(path) {
  if (!path) return "";
  return path.startsWith("/stn-eoc") ? path : `/stn-eoc${path}`;
}

function Section({ title, children, aside }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-black text-slate-900">{title}</h2>
        {aside ? <span className="text-xs text-slate-500">{aside}</span> : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Facts({ items }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs text-slate-500">{item.label}</dt>
          <dd className={`text-lg font-black ${item.tone === "red" ? "text-red-700" : "text-slate-900"}`}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// แท่งแนวนอนอย่างง่าย (ไม่ใช้ไลบรารีกราฟ) — ใช้ได้ทั้งรายวันและรายอำเภอ
function Bars({ rows, valueKey, labelKey, format = formatNumber, highlight }) {
  const max = Math.max(1, ...rows.map((row) => row[valueKey] || 0));
  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={row[labelKey]} className="grid grid-cols-[5.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-sm">
          <span className="truncate text-slate-600">{row.displayLabel || row[labelKey]}</span>
          <span className="h-3 rounded-sm bg-slate-100">
            <span className={`block h-3 rounded-sm ${highlight?.(row) ? "bg-[#083865]" : "bg-[#7ea8cf]"}`} style={{ width: `${Math.max(2, ((row[valueKey] || 0) / max) * 100)}%` }} />
          </span>
          <span className="text-right font-semibold tabular-nums text-slate-800">{format(row[valueKey])}</span>
        </li>
      ))}
    </ul>
  );
}

export default function EventHistoryDetail({ sessionId }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [showAllLogs, setShowAllLogs] = useState(false);

  useEffect(() => {
    let alive = true;
    apiRequest(`/stn-eoc/api/admin/eoc-sessions/${sessionId}/history`)
      .then((json) => alive && setState({ loading: false, error: "", data: json.data }))
      .catch((error) => alive && setState({ loading: false, error: error.message, data: null }));
    return () => { alive = false; };
  }, [sessionId]);

  const data = state.data;
  const session = data?.session;

  const logGroups = useMemo(() => {
    const list = (data?.activity?.recent || []).slice(0, showAllLogs ? 200 : 15);
    const groups = new Map();
    for (const log of list) {
      const key = String(log.created_at).slice(0, 10);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(log);
    }
    return [...groups.entries()];
  }, [data, showAllLogs]);

  const back = (
    <Link href="/admin/eoc-sessions" className="inline-flex items-center gap-1 text-sm font-semibold text-[#0b4c86] hover:underline">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> ประวัติเหตุการณ์
    </Link>
  );

  if (state.loading) {
    return <AdminPage context={back} title="กำลังโหลดสรุปเหตุการณ์…"><div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" /></AdminPage>;
  }
  if (!data) {
    return <AdminPage context={back} title="ไม่พบเหตุการณ์"><p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{state.error || "ไม่พบเหตุการณ์นี้"}</p></AdminPage>;
  }

  const { impact, casualties, shelters, health, vulnerable, directives, citizen, teams, it, activity } = data;
  const peak = impact?.peak;
  const empty = [];

  const headline = [
    peak ? { icon: Users, tone: "blue", label: "ได้รับผลกระทบสูงสุด", value: formatNumber(peak.people), unit: "คน" } : null,
    peak ? { icon: Home, label: "หมู่บ้านน้ำท่วมสูงสุด", value: formatNumber(peak.villages) } : null,
    health.patients ? { icon: HeartPulse, label: "ผู้ป่วยสะสม", value: formatNumber(health.patients), unit: "ราย" } : null,
    shelters.opened ? { icon: Tent, label: "เปิดศูนย์พักพิง", value: formatNumber(shelters.opened), unit: "แห่ง" } : null,
    casualties.deaths ? { icon: HeartCrack, label: "เสียชีวิต", value: formatNumber(casualties.deaths), unit: "ราย", className: "text-red-700" } : null,
    { icon: CalendarDays, label: "ระยะเวลา", value: formatNumber(session.days), unit: "วัน" }
  ].filter(Boolean).slice(0, 4);

  const hasCasualties = casualties.deaths || casualties.missing || casualties.injured || casualties.evacuated;
  if (!hasCasualties) empty.push("ผู้เสียชีวิต/สูญหาย/บาดเจ็บ");
  if (!shelters.opened) empty.push("ศูนย์พักพิง");
  if (!health.patients) empty.push("ผู้ป่วย");
  if (!vulnerable.total) empty.push("กลุ่มเปราะบาง");
  if (!citizen.total) empty.push("คำขอจากประชาชน");
  if (!it.total) empty.push("IT support");
  if (impact && !impact.days.length) empty.push("บันทึกพื้นที่น้ำท่วม");

  const days = (impact?.days || []).map((row) => ({ ...row, displayLabel: shortDate(row.date, false) }));

  return (
    <AdminPage
      context={back}
      title={`${formatEocDisplayName(session)} ครั้งที่ ${session.session_number}`}
      description={`${shortDate(session.opened_at)} – ${session.closed_at ? shortDate(session.closed_at) : "ปัจจุบัน"} · ${formatNumber(session.days)} วัน`}
      actions={(
        <>
          <StatusPill tone={session.status === "active" ? "green" : "gray"}>{session.status === "active" ? "เปิดอยู่" : "ปิดแล้ว"}</StatusPill>
          <Link href={`/admin/eoc-sessions/${session.id}/teams`}>
            <Button variant="secondary" className="min-h-9"><Users className="h-4 w-4" aria-hidden="true" /> กลุ่มภารกิจ</Button>
          </Link>
        </>
      )}
    >
      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2">
        <div>
          <div className="text-xs text-slate-500">เปิดเหตุการณ์</div>
          <div className="font-semibold text-slate-900">{formatDateTime(session.opened_at)}{session.opened_by_name ? ` · ${session.opened_by_name}` : ""}</div>
          {session.open_reason ? <p className="mt-1 text-slate-700">{session.open_reason}</p> : null}
          {session.open_order_file_path ? (
            <a href={fileUrl(session.open_order_file_path)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold text-[#0b4c86] hover:underline">
              <FileText className="h-4 w-4" aria-hidden="true" /> {session.open_order_file_name || "คำสั่งเปิด EOC"}
            </a>
          ) : null}
        </div>
        <div>
          <div className="text-xs text-slate-500">ปิดเหตุการณ์</div>
          {session.closed_at ? (
            <>
              <div className="font-semibold text-slate-900">{formatDateTime(session.closed_at)}{session.closed_by_name ? ` · ${session.closed_by_name}` : ""}</div>
              {session.close_reason ? <p className="mt-1 text-slate-700">{session.close_reason}</p> : null}
            </>
          ) : <div className="font-semibold text-emerald-700">ยังเปิดอยู่</div>}
        </div>
      </section>

      <StatStrip items={headline} />

      {impact && impact.days.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="ผู้ได้รับผลกระทบรายวัน" aside={peak ? `สูงสุด ${shortDate(peak.date)}` : null}>
            <Bars rows={days} valueKey="people" labelKey="date" highlight={(row) => row.date === peak?.date} />
            <p className="mt-3 text-xs text-slate-500">บันทึกพื้นที่น้ำท่วม {formatNumber(impact.reportDays)} วัน · นับเฉพาะหมู่บ้านที่ระดับน้ำไม่ใช่ “ไม่มี”</p>
          </Section>
          <Section title="รายอำเภอ (วันที่หนักที่สุดของแต่ละอำเภอ)">
            {impact.districts.length ? (
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr><th className="pb-2 font-semibold">อำเภอ</th><th className="pb-2 text-right font-semibold">คน</th><th className="pb-2 text-right font-semibold">หมู่บ้าน</th><th className="pb-2 text-right font-semibold">ระดับสูง</th><th className="pb-2 text-right font-semibold">ลึกสุด</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {impact.districts.map((row) => (
                    <tr key={row.district}>
                      <td className="py-1.5 font-semibold text-slate-900">{row.district}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatNumber(row.people)}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatNumber(row.villages)}</td>
                      <td className={`py-1.5 text-right tabular-nums ${row.severe ? "font-bold text-red-700" : ""}`}>{formatNumber(row.severe)}</td>
                      <td className="py-1.5 text-right tabular-nums">{row.depth ? `${formatNumber(row.depth)} ซม.` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-sm text-slate-600">ทุกหมู่บ้านรายงานว่าไม่มีน้ำท่วม</p>}
          </Section>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {hasCasualties ? (
          <Section title="ผู้ประสบภัย">
            <Facts items={[
              { label: "เสียชีวิต", value: formatNumber(casualties.deaths), tone: casualties.deaths ? "red" : undefined },
              { label: "สูญหาย", value: formatNumber(casualties.missing), tone: casualties.missing ? "red" : undefined },
              { label: "บาดเจ็บ", value: formatNumber(casualties.injured) },
              { label: "อพยพ", value: formatNumber(casualties.evacuated) }
            ]} />
          </Section>
        ) : null}

        {shelters.opened ? (
          <Section title="ศูนย์พักพิง" aside={`ผู้พักพิงล่าสุด ${formatNumber(shelters.occupancy)} / ${formatNumber(shelters.capacity)} ที่`}>
            <p className="mb-2 text-sm text-slate-700">เปิดใช้ {formatNumber(shelters.opened)} แห่ง</p>
            {shelters.top.some((row) => row.occupancy) ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {shelters.top.filter((row) => row.occupancy).map((row) => (
                  <li key={row.name} className="flex justify-between gap-2 py-1.5">
                    <span className="min-w-0 truncate">{row.name} <span className="text-xs text-slate-500">อ.{row.district}</span></span>
                    <span className="shrink-0 tabular-nums font-semibold">{formatNumber(row.occupancy)}{row.capacity ? `/${formatNumber(row.capacity)}` : ""}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>
        ) : null}

        {health.patients ? (
          <Section title="สุขภาพ" aside={`ผู้ป่วยสะสม ${formatNumber(health.patients)} ราย`}>
            <Bars rows={health.diseases} valueKey="cases" labelKey="disease" />
          </Section>
        ) : null}

        {vulnerable.total ? (
          <Section title="กลุ่มเปราะบาง">
            <Facts items={[
              { label: "ในพื้นที่ประสบภัย", value: `${formatNumber(vulnerable.total)} คน` },
              { label: "ดูแลแล้ว", value: `${formatNumber(vulnerable.cared)} คน` },
              { label: "เคลื่อนย้าย", value: `${formatNumber(vulnerable.moved)} คน` },
              { label: "ผู้ป่วยติดเตียง", value: `${formatNumber(vulnerable.bedridden)} คน` }
            ]} />
          </Section>
        ) : null}

        <Section title="การทำงานของศูนย์">
          <Facts items={[
            { label: "กลุ่มภารกิจ", value: `${formatNumber(teams.teams)} ทีม · ${formatNumber(teams.members)} คน` },
            { label: "ข้อสั่งการ", value: directives.total ? `ทำแล้ว ${formatNumber(directives.done)}/${formatNumber(directives.total)}` : "-" },
            { label: "คำขอจากประชาชน", value: citizen.total ? `${formatNumber(citizen.total)} เรื่อง` : "-" },
            { label: "แจ้งปัญหา IT", value: it.total ? `แก้แล้ว ${formatNumber(it.resolved)}/${formatNumber(it.total)}` : "-" }
          ]} />
          {citizen.total ? (
            <p className="mt-3 text-xs text-slate-500">
              คำขอจากประชาชน: ขอความช่วยเหลือ {formatNumber(citizen.help)} · แจ้งจุดปัญหา/เส้นทาง {formatNumber(citizen.points)} · ดำเนินการแล้ว {formatNumber(citizen.handled)} · ไม่ดำเนินการ {formatNumber(citizen.rejected)}
            </p>
          ) : null}
        </Section>
      </div>

      <Section title="บันทึกกิจกรรม" aside={activity.total ? `${formatNumber(activity.total)} รายการ` : null}>
        {activity.total ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {activity.byAction.map((row) => (
                <span key={row.action || row.label} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{row.label} {formatNumber(row.count)}</span>
              ))}
            </div>
            {activity.users.length ? (
              <p className="text-sm text-slate-600">
                บันทึกมากที่สุด: {activity.users.slice(0, 4).map((user) => `${user.name} (${formatNumber(user.count)})`).join(" · ")}
              </p>
            ) : null}
            <ol className="space-y-3">
              {logGroups.map(([date, logs]) => (
                <li key={date}>
                  <h3 className="mb-1 text-xs font-bold text-slate-500">{shortDate(date)}</h3>
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {logs.map((log) => (
                      <li key={log.id} className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:gap-3">
                        <span className="tabular-nums text-xs text-slate-500 sm:text-sm">{String(log.created_at).slice(11, 16)}</span>
                        <span className="min-w-0">
                          <span className="font-semibold text-slate-900">{log.actionLabel}{log.targetLabel ? ` · ${log.targetLabel}` : ""}</span>
                          {log.description ? <span className="block text-slate-600">{log.description}</span> : null}
                          {log.change_reason ? <span className="block text-xs text-amber-800">เหตุผล: {log.change_reason}</span> : null}
                        </span>
                        <span className="text-xs text-slate-500">{log.name}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            {!showAllLogs && activity.recent.length > 15 ? (
              <Button variant="secondary" onClick={() => setShowAllLogs(true)}>แสดงเพิ่ม ({formatNumber(Math.min(activity.recent.length, 200) - 15)} รายการ)</Button>
            ) : null}
            {showAllLogs && activity.total > 200 ? (
              <p className="text-xs text-slate-500">แสดง 200 รายการล่าสุด ดูทั้งหมดได้ที่ <Link href={`/admin/activity-logs?sessionId=${session.id}`} className="font-semibold text-[#0b4c86] hover:underline">ประวัติการใช้งาน</Link></p>
            ) : null}
          </div>
        ) : <p className="text-sm text-slate-600">ยังไม่มีบันทึกกิจกรรมของเหตุการณ์นี้</p>}
      </Section>

      {empty.length ? (
        <p className="text-xs text-slate-500">ไม่มีข้อมูลบันทึกในเหตุการณ์นี้: {empty.join(" · ")}</p>
      ) : null}
    </AdminPage>
  );
}
