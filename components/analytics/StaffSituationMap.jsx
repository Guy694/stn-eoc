"use client";

// แผนที่สถานการณ์เต็มจอสำหรับเจ้าหน้าที่ (เมนู "วิเคราะห์ข้อมูล" /analytics)
// ใช้แผนที่เดียวกับหน้าประชาชน (WeatherWatchWorkspace: ความเสี่ยงรายอำเภอ ฝน ระดับน้ำ CCTV น้ำทะเล PM2.5 Windy)
// แล้วเพิ่ม: หมุดกลุ่มเปราะบางรายบุคคล + คำขอความช่วยเหลือ พร้อมตัวกรอง (ประเภท กลุ่มสี สถานะการช่วยเหลือ สถานะคำขอ อำเภอ)
// และแถบรายละเอียดด้านซ้าย (สรุป → รายการ → รายละเอียดรายคน/รายเรื่อง)
// สิทธิ์รายบุคคลตัดสินที่ API: /api/eoc/vulnerable-persons (ผู้บัญชาการ/แอดมิน หรือทีมของเหตุการณ์ที่เปิดอยู่) และ /api/admin/incident-reports
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ExternalLink, HandHeart, MapPin, Phone, RefreshCw, Search, UsersRound, X } from "lucide-react";
import WeatherWatchWorkspace from "@/components/weather/WeatherWatchWorkspace";
import { SectionTitle, SidebarItem } from "@/components/public/map/WindyStyleControls";
import { caseStatus, sortByUrgency, typeMeta } from "@/lib/vulnerablePersons";
import { careGroupMeta, effectiveCareGroup } from "@/lib/careGroups";
import { incidentStatusMeta } from "@/lib/incidentStatuses";
import {
  CARE_GROUPS,
  CASE_STATUSES,
  HELP_STATUS_COLORS,
  INCIDENT_STATUSES,
  VULNERABLE_TYPES,
  countBy,
  defaultStaffMapFilters,
  filterHelpRequests,
  filterPeople,
  summarizeStaffMap,
  toggleValue
} from "@/lib/staffSituationMap";

const StaffMapLayers = dynamic(() => import("@/components/analytics/StaffMapLayers"), { ssr: false });

const EOC_TYPES = [
  { key: "flood", label: "อุทกภัย" },
  { key: "disease", label: "โรคระบาด" }
];
const DISTRICTS = ["เมืองสตูล", "ควนโดน", "ควนกาหลง", "ท่าแพ", "ละงู", "ทุ่งหว้า", "มะนัง"];
const LIST_STEP = 60;
const URGENCY_LABELS = { critical: "วิกฤต", high: "สูง", medium: "ปานกลาง", low: "ต่ำ" };
const REFRESH_MS = 5 * 60 * 1000;

const formatDateTime = (value) => (value ? new Date(value).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }) : "-");
const helpName = (report) => [report.first_name, report.last_name].filter(Boolean).join(" ") || "ไม่ระบุชื่อ";
const place = (item) => [item.village, item.tambon || item.sub_district, item.district ? `อ.${String(item.district).replace(/^อ(\.|ำเภอ)\s*/, "")}` : ""].filter(Boolean).join(" ");

// ---------- เมนูตัวกรอง (ต่อบนสุดของเมนูชั้นข้อมูลขวา) ----------

function Chip({ active, onClick, children, color, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold transition ${active ? "bg-white text-slate-900" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
    >
      {color ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" /> : null}
      {children}
      {count !== undefined ? <span className={`tabular-nums ${active ? "text-slate-500" : "text-white/50"}`}>{count}</span> : null}
    </button>
  );
}

function FilterGroup({ title, onAll, onNone, children }) {
  return (
    <div className="border-t border-white/10 pt-2 first:border-0 first:pt-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] font-black text-white/80">{title}</p>
        <span className="flex gap-1 text-[10px] font-bold">
          <button type="button" onClick={onAll} className="rounded px-1 text-sky-300 hover:bg-white/10">ทั้งหมด</button>
          <button type="button" onClick={onNone} className="rounded px-1 text-white/60 hover:bg-white/10">ล้าง</button>
        </span>
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function StaffMenu({ filters, setFilters, persons, reports, helpAvailable }) {
  const set = (patch) => setFilters((current) => ({ ...current, ...patch }));
  const toggle = (key, value) => setFilters((current) => ({ ...current, [key]: toggleValue(current[key], value) }));
  const byType = useMemo(() => countBy(persons, (person) => person.vulnerable_type), [persons]);
  const byGroup = useMemo(() => countBy(persons, (person) => effectiveCareGroup(person) || "red"), [persons]);
  const byStatus = useMemo(() => countBy(persons, (person) => person.status || "waiting"), [persons]);
  const byHelp = useMemo(() => countBy(reports, (report) => report.status), [reports]);
  const defaults = defaultStaffMapFilters();

  return (
    <>
      <SectionTitle>ข้อมูลเจ้าหน้าที่</SectionTitle>
      <div className="space-y-1.5">
        <SidebarItem label="กลุ่มเปราะบาง" icon={UsersRound} tone="bg-rose-600" active={filters.showPeople} onClick={() => set({ showPeople: !filters.showPeople })} />
        {helpAvailable ? <SidebarItem label="คำขอความช่วยเหลือ" icon={HandHeart} tone="bg-red-600" active={filters.showHelp} onClick={() => set({ showHelp: !filters.showHelp })} /> : null}
      </div>
      <div className="mt-2 space-y-2 rounded-xl bg-slate-900/80 p-2.5 text-white shadow-xl ring-1 ring-white/10 backdrop-blur-md">
        <label className="flex items-center justify-between gap-2 text-[11px] font-black text-white/80">
          อำเภอ
          <select value={filters.district} onChange={(event) => set({ district: event.target.value })} className="h-7 min-w-0 flex-1 rounded-md border border-white/15 bg-slate-800 px-1.5 text-xs font-bold text-white outline-none focus:border-sky-400">
            <option value="">ทุกอำเภอ</option>
            {DISTRICTS.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        {filters.showPeople ? (
          <>
            <FilterGroup title="ประเภทกลุ่มเปราะบาง" onAll={() => set({ types: defaults.types })} onNone={() => set({ types: [] })}>
              {VULNERABLE_TYPES.map((item) => (
                <Chip key={item.key} active={filters.types.includes(item.key)} onClick={() => toggle("types", item.key)} count={byType[item.key] || 0}>{item.short}</Chip>
              ))}
            </FilterGroup>
            <FilterGroup title="กลุ่มสี (ความเร่งด่วน)" onAll={() => set({ careGroups: defaults.careGroups })} onNone={() => set({ careGroups: [] })}>
              {CARE_GROUPS.map((item) => (
                <Chip key={item.key} active={filters.careGroups.includes(item.key)} onClick={() => toggle("careGroups", item.key)} color={item.color} count={byGroup[item.key] || 0}>{item.label}</Chip>
              ))}
            </FilterGroup>
            <FilterGroup title="สถานะการช่วยเหลือ" onAll={() => set({ statuses: defaults.statuses })} onNone={() => set({ statuses: [] })}>
              {CASE_STATUSES.map((item) => (
                <Chip key={item.key} active={filters.statuses.includes(item.key)} onClick={() => toggle("statuses", item.key)} color={item.color} count={byStatus[item.key] || 0}>{item.label}</Chip>
              ))}
            </FilterGroup>
          </>
        ) : null}
        {helpAvailable && filters.showHelp ? (
          <FilterGroup title="สถานะคำขอความช่วยเหลือ" onAll={() => set({ helpStatuses: INCIDENT_STATUSES.map((item) => item.value) })} onNone={() => set({ helpStatuses: [] })}>
            {INCIDENT_STATUSES.map((item) => (
              <Chip key={item.value} active={filters.helpStatuses.includes(item.value)} onClick={() => toggle("helpStatuses", item.value)} color={HELP_STATUS_COLORS[item.value]} count={byHelp[item.value] || 0}>{item.label}</Chip>
            ))}
          </FilterGroup>
        ) : null}
        <button type="button" onClick={() => setFilters(defaultStaffMapFilters())} className="w-full rounded-lg bg-white/10 py-1 text-[11px] font-bold text-white/80 hover:bg-white/20">คืนค่าตัวกรองเริ่มต้น</button>
      </div>
    </>
  );
}

// ---------- แถบรายละเอียด (ซ้าย) ----------

function Stat({ label, value, tone = "text-white" }) {
  return (
    <div className="rounded-xl bg-white/5 px-2.5 py-2 ring-1 ring-white/10">
      <p className="text-[11px] font-semibold text-white/60">{label}</p>
      <p className={`text-xl font-black tabular-nums ${tone}`}>{Number(value || 0).toLocaleString("th-TH")}</p>
    </div>
  );
}

function Row({ label, children }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2 py-1 text-sm">
      <dt className="text-white/55">{label}</dt>
      <dd className="min-w-0 break-words font-semibold">{children}</dd>
    </div>
  );
}

function PersonDetail({ person, eocType }) {
  const status = caseStatus(person.status);
  const care = careGroupMeta(effectiveCareGroup(person));
  return (
    <div className="space-y-3">
      <div>
        <p className="text-lg font-black leading-tight">{person.name || "-"}</p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold">
          <span className="rounded-full px-2 py-0.5 text-white" style={{ backgroundColor: status.color }}>{status.label}</span>
          {care ? <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: care.soft, color: care.text }}>{care.label}</span> : null}
          <span className="rounded-full bg-white/10 px-2 py-0.5">{typeMeta(person.vulnerable_type)?.label || person.vulnerable_type}</span>
          {person.power_dependent ? <span className="rounded-full bg-violet-500/30 px-2 py-0.5">ใช้อุปกรณ์ไฟฟ้า</span> : null}
        </p>
      </div>
      <dl className="divide-y divide-white/10">
        <Row label="พื้นที่">{place(person)}</Row>
        <Row label="ที่อยู่">{person.address}</Row>
        <Row label="โทร">{person.phone ? <a href={`tel:${person.phone}`} className="inline-flex items-center gap-1 text-sky-300 underline"><Phone className="h-3.5 w-3.5" aria-hidden="true" />{person.phone}</a> : null}</Row>
        <Row label="ผู้ดูแล">{[person.caregiver_name, person.caregiver_phone].filter(Boolean).join(" • ") || null}</Row>
        <Row label="ความต้องการ">{person.needs}</Row>
        <Row label="กำหนดคลอด">{person.due_date}</Row>
        <Row label="ย้ายไปที่">{person.moved_to}</Row>
        <Row label="บันทึก">{person.case_note}</Row>
        <Row label="อัปเดตสถานะ">{person.status_updated_at ? `${formatDateTime(person.status_updated_at)}${person.status_updated_by ? ` • ${person.status_updated_by}` : ""}` : "ยังไม่มีการเปลี่ยนสถานะ"}</Row>
        <Row label="ตำแหน่ง">{person.location ? (person.location.approx ? "ตำแหน่งประมาณ (กลางหมู่บ้าน) ยังไม่ใช่บ้านจริง" : "ปักหมุดบ้านแล้ว") : "ยังไม่มีพิกัด"}</Row>
      </dl>
      <Link href={`/eoc/${eocType}/vulnerable-persons`} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0b4c86] px-3 py-2 text-sm font-bold text-white hover:bg-[#083865]">
        เปิดในทะเบียนกลุ่มเปราะบาง (เปลี่ยนสถานะ) <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

function HelpDetail({ report }) {
  const status = incidentStatusMeta(report.status);
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-bold text-white/60">คำขอความช่วยเหลือ #{report.id}{report.tracking_code ? ` • ${report.tracking_code}` : ""}</p>
        <p className="text-lg font-black leading-tight">{helpName(report)}</p>
        <p className="mt-1 flex flex-wrap gap-1.5 text-xs font-bold">
          <span className="rounded-full px-2 py-0.5 text-white" style={{ backgroundColor: HELP_STATUS_COLORS[report.status] || "#64748b" }}>{status.label}</span>
          {report.urgency ? <span className="rounded-full bg-white/10 px-2 py-0.5">ความเร่งด่วน: {URGENCY_LABELS[report.urgency] || report.urgency}</span> : null}
        </p>
      </div>
      <dl className="divide-y divide-white/10">
        <Row label="พื้นที่">{place(report)}</Row>
        <Row label="โทร">{report.phone ? <a href={`tel:${report.phone}`} className="inline-flex items-center gap-1 text-sky-300 underline"><Phone className="h-3.5 w-3.5" aria-hidden="true" />{report.phone}</a> : null}</Row>
        <Row label="รายละเอียด"><span className="whitespace-pre-line">{report.description}</span></Row>
        <Row label="แจ้งเมื่อ">{formatDateTime(report.created_at)}</Row>
      </dl>
      <Link href={`/admin/incident-reports?status=${encodeURIComponent(report.status)}&id=${report.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0b4c86] px-3 py-2 text-sm font-bold text-white hover:bg-[#083865]">
        เปิดในหน้ารับเรื่อง (เปลี่ยนสถานะ) <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

function StaffPanel({ eocType, setEocType, vp, loading, error, onRefresh, people, help, selected, onSelect, onClear, helpAvailable }) {
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(LIST_STEP);
  const summary = summarizeStaffMap(people, help);
  const selectedPerson = selected?.kind === "person" ? people.find((person) => person.id === selected.id) || (vp?.persons || []).find((person) => person.id === selected.id) : null;
  const selectedHelp = selected?.kind === "help" ? help.find((report) => report.id === selected.id) : null;

  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    const match = (text) => !term || String(text || "").toLowerCase().includes(term);
    const helpItems = help.filter((report) => match(`${helpName(report)} ${place(report)} ${report.phone || ""}`))
      .map((report) => ({ kind: "help", id: report.id, rank: report.status === "pending" ? 0 : 2, report }));
    const personItems = sortByUrgency(people).filter((person) => match(`${person.name} ${place(person)} ${person.phone || ""}`))
      .map((person) => ({ kind: "person", id: person.id, rank: caseStatus(person.status).group === "pending" ? 1 : 3, person }));
    return [...helpItems, ...personItems].sort((a, b) => a.rank - b.rank);
  }, [help, people, search]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-white/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <Link href="/dashboard" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-bold text-white hover:bg-white/20">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> กลับหน้าเมนู
          </Link>
          <button type="button" onClick={onRefresh} className="rounded-full p-2 text-white/80 hover:bg-white/10" aria-label="โหลดข้อมูลล่าสุด" title="โหลดข้อมูลล่าสุด">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
        </div>
        <div>
          <h1 className="text-base font-black">แผนที่สถานการณ์ (เจ้าหน้าที่)</h1>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="inline-flex rounded-full bg-white/10 p-0.5" role="radiogroup" aria-label="ประเภทเหตุการณ์">
              {EOC_TYPES.map((item) => (
                <button key={item.key} type="button" role="radio" aria-checked={eocType === item.key} onClick={() => setEocType(item.key)}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${eocType === item.key ? "bg-white text-slate-900" : "text-white/75 hover:bg-white/10"}`}>
                  {item.label}
                </button>
              ))}
            </div>
            <span className="truncate text-[11px] text-white/60">
              {vp?.session ? `ครั้งที่ ${vp.session.session_number} • ${vp.session.status === "active" ? "เปิดอยู่" : "ปิดแล้ว"}` : "ยังไม่มีเหตุการณ์"}
            </span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [scrollbar-width:thin]">
        {error ? <p className="mb-3 rounded-lg bg-red-500/20 p-2 text-sm font-semibold text-red-100">{error}</p> : null}
        {selectedPerson || selectedHelp ? (
          <div>
            <button type="button" onClick={onClear} className="mb-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-white/70 hover:bg-white/10">
              <X className="h-3.5 w-3.5" aria-hidden="true" /> ปิดรายละเอียด กลับไปที่รายการ
            </button>
            {selectedPerson ? <PersonDetail person={selectedPerson} eocType={eocType} /> : <HelpDetail report={selectedHelp} />}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="กลุ่มเปราะบาง (ตามตัวกรอง)" value={summary.people} />
              <Stat label="รอช่วยเหลือ / เข้าถึงไม่ได้" value={summary.people_pending} tone="text-rose-300" />
              <Stat label="กำลังดำเนินการ" value={summary.people_progress} tone="text-sky-300" />
              <Stat label="จัดการแล้ว" value={summary.people_done} tone="text-emerald-300" />
              {helpAvailable ? <Stat label="คำขอความช่วยเหลือ" value={summary.help} /> : null}
              {helpAvailable ? <Stat label="คำขอรอตรวจสอบ" value={summary.help_pending} tone="text-amber-300" /> : null}
            </div>
            {summary.people_no_location ? <p className="mt-2 text-[11px] text-white/55">ไม่มีพิกัด {summary.people_no_location} คน (ไม่แสดงบนแผนที่ แต่อยู่ในรายการ)</p> : null}
            {vp?.restricted ? <p className="mt-3 rounded-lg bg-amber-400/15 p-2 text-xs leading-5 text-amber-100">{vp.restricted_message}</p> : null}

            <label className="mt-3 flex items-center gap-2 rounded-lg border border-white/15 bg-slate-800 px-2">
              <Search className="h-4 w-4 text-white/50" aria-hidden="true" />
              <input value={search} onChange={(event) => { setSearch(event.target.value); setShown(LIST_STEP); }} placeholder="ค้นหาชื่อ พื้นที่ เบอร์โทร" className="h-9 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40" />
            </label>
            <ul className="mt-2 space-y-1">
              {items.slice(0, shown).map((item) => {
                if (item.kind === "help") {
                  const report = item.report;
                  return (
                    <li key={`h-${report.id}`}>
                      <button type="button" onClick={() => onSelect({ kind: "help", id: report.id })} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/10">
                        <HandHeart className="mt-0.5 h-4 w-4 shrink-0" style={{ color: HELP_STATUS_COLORS[report.status] }} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{helpName(report)}</span>
                          <span className="block truncate text-[11px] text-white/60">คำขอ • {incidentStatusMeta(report.status).label} • {place(report) || "-"}</span>
                        </span>
                      </button>
                    </li>
                  );
                }
                const person = item.person;
                const status = caseStatus(person.status);
                return (
                  <li key={`p-${person.id}`}>
                    <button type="button" onClick={() => onSelect({ kind: "person", id: person.id })} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/10">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/30" style={{ backgroundColor: careGroupMeta(effectiveCareGroup(person))?.color || status.color }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{person.name || "-"}</span>
                        <span className="block truncate text-[11px] text-white/60">{typeMeta(person.vulnerable_type)?.short} • {status.label} • {place(person) || "-"}</span>
                      </span>
                      {!person.location ? <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" aria-label="ไม่มีพิกัด" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {items.length === 0 && !loading ? <p className="mt-2 text-sm text-white/60">ไม่มีรายการตามตัวกรองนี้</p> : null}
            {items.length > shown ? (
              <button type="button" onClick={() => setShown((count) => count + LIST_STEP)} className="mt-2 w-full rounded-lg bg-white/10 py-1.5 text-xs font-bold hover:bg-white/20">
                แสดงเพิ่ม ({(items.length - shown).toLocaleString("th-TH")} รายการ)
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

// ---------- หน้าหลัก ----------

export default function StaffSituationMap() {
  const [eocType, setEocType] = useState("flood");
  const [vp, setVp] = useState(null);
  const [reports, setReports] = useState([]);
  const [helpAvailable, setHelpAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(defaultStaffMapFilters);
  const [selected, setSelected] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [vpResult, helpResult] = await Promise.allSettled([
      fetch(`/stn-eoc/api/eoc/vulnerable-persons?eoc=${eocType}`, { cache: "no-store" }).then(async (response) => ({ ok: response.ok, status: response.status, body: await response.json().catch(() => ({})) })),
      fetch("/stn-eoc/api/admin/incident-reports?report_type=help_request&limit=500", { cache: "no-store" }).then(async (response) => ({ ok: response.ok, status: response.status, body: await response.json().catch(() => ({})) }))
    ]);
    const problems = [];
    if (vpResult.status === "fulfilled" && vpResult.value.ok && vpResult.value.body.success) setVp(vpResult.value.body);
    else {
      setVp(null);
      problems.push(vpResult.value?.body?.message || "โหลดทะเบียนกลุ่มเปราะบางไม่สำเร็จ");
    }
    if (helpResult.status === "fulfilled" && helpResult.value.ok && helpResult.value.body.success) {
      setReports(Array.isArray(helpResult.value.body.data) ? helpResult.value.body.data : []);
      setHelpAvailable(true);
    } else if (helpResult.status === "fulfilled" && [401, 403].includes(helpResult.value.status)) {
      setReports([]);
      setHelpAvailable(false); // บทบาทนี้ไม่มีสิทธิ์ดูคำขอความช่วยเหลือ — ซ่อนชั้นข้อมูลนี้
    } else {
      setReports([]);
      problems.push("โหลดคำขอความช่วยเหลือไม่สำเร็จ");
    }
    setError(problems.join(" • "));
    setLoading(false);
  }, [eocType]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const persons = useMemo(() => vp?.persons || [], [vp]);
  const people = useMemo(() => filterPeople(persons, filters), [persons, filters]);
  const help = useMemo(() => (helpAvailable ? filterHelpRequests(reports, filters) : []), [reports, filters, helpAvailable]);
  const mappedPeople = useMemo(() => people.filter((person) => person.location), [people]);
  const mappedHelp = useMemo(() => filterHelpRequests(help, filters, { requireLocation: true }), [help, filters]);

  const select = useCallback((target) => {
    setSelected(target);
    if (target?.kind === "person") {
      const person = persons.find((item) => item.id === target.id);
      if (person?.location) setFlyTarget({ latitude: person.location.lat, longitude: person.location.lng, zoom: 14, at: Date.now() });
    } else if (target?.kind === "help") {
      const report = reports.find((item) => item.id === target.id);
      if (report && Number(report.latitude)) setFlyTarget({ latitude: Number(report.latitude), longitude: Number(report.longitude), zoom: 14, at: Date.now() });
    }
  }, [persons, reports]);

  const changeType = (key) => {
    setSelected(null);
    setEocType(key);
  };

  return (
    <WeatherWatchWorkspace
      staff={{
        flyTarget,
        mapLayers: <StaffMapLayers people={mappedPeople} help={mappedHelp} selected={selected} onSelect={select} />,
        menu: <StaffMenu filters={filters} setFilters={setFilters} persons={persons} reports={reports} helpAvailable={helpAvailable} />,
        panel: (
          <StaffPanel
            eocType={eocType}
            setEocType={changeType}
            vp={vp}
            loading={loading}
            error={error}
            onRefresh={load}
            people={people}
            help={help}
            selected={selected}
            onSelect={select}
            onClear={() => setSelected(null)}
            helpAvailable={helpAvailable}
          />
        )
      }}
    />
  );
}
