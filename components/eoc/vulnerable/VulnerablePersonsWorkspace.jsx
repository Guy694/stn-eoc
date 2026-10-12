"use client";

// แผนที่และทะเบียนกลุ่มเปราะบางรายบุคคล (เฉพาะเจ้าหน้าที่ที่เข้าสู่ระบบ)
// - หมุดสี + สัญลักษณ์ตามสถานะ: ยังไม่จัดการ / กำลังดำเนินการ / จัดการแล้ว
// - เจ้าหน้าที่หน้างานกดเปลี่ยนสถานะได้ทันที (กำลังเดินทาง → ถึงพื้นที่ → ช่วยเหลือแล้ว/เคลื่อนย้าย)
// ข้อมูลส่วนบุคคลเข้ารหัสในฐานข้อมูล ถอดรหัสที่เซิร์ฟเวอร์เฉพาะคำขอของเจ้าหน้าที่ และบันทึกการเข้าดูทุกครั้ง
import dynamic from "next/dynamic";
import VulnerableViewTabs from "@/components/eoc/vulnerable/VulnerableViewTabs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, History, Lock, MapPinOff, Navigation, Pencil, Phone, RefreshCw, Trash2, UserRound } from "lucide-react";
import {
  AddButton, AdminPage, Button, Field, FilterSelect, FormDialog, FormGrid, FormSection, ReadOnlyNotice, StatusPill,
  Toolbar, UpdatedAt, inputClass, useNotice
} from "@/components/admin/crud";
import LocationPicker from "@/components/admin/LocationPicker";
import { pinSvg } from "@/components/eoc/vulnerable/vulnerablePins";
import { apiRequest, formatDateTime, formatNumber } from "@/lib/adminApi";
import { getEocTypeLabel } from "@/lib/eocDisplay";
import { pointInGeometry } from "@/lib/healthFacilityStatus";
import { SHELTER_TYPES, suggestShelters, suggestionReason, shelterTypeMeta } from "@/lib/shelterSuitability";
import {
  CASE_GROUPS, CASE_STATUSES, VULNERABLE_TYPES, QUICK_FILTERS, caseStatus, filterPersons, maskPhone, matchesQuickFilter, pregnancyAlert, sortByUrgency, summarizePersons, typeMeta, validatePerson
} from "@/lib/vulnerablePersons";

const API = "/stn-eoc/api/eoc/vulnerable-persons";
const AREA_API = "/stn-eoc/api/eoc/vulnerable-event";

const VulnerablePersonsMap = dynamic(() => import("@/components/eoc/vulnerable/VulnerablePersonsMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100" aria-label="กำลังโหลดแผนที่" />
});

const EMPTY_FORM = {
  name: "", vulnerable_type: "bedridden", phone: "", district: "", tambon: "", village: "", address: "", needs: "",
  caregiver_name: "", caregiver_phone: "", lat: "", lng: "", due_date: "", preterm_history: false
};
const bangkokToday = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const EMPTY_FILTERS = { group: "all", status: "all", type: "all", district: "all", tambon: "all", search: "", quick: "all" };
const FLOOD_LEVELS = new Set(["severe", "moderate", "mild"]);
// ปุ่มลัดบนการ์ด: ขั้นถัดไปที่เจ้าหน้าที่หน้างานกดบ่อย
const QUICK_NEXT = { waiting: ["en_route", "arrived"], unreachable: ["en_route"], en_route: ["arrived"], arrived: ["assisted", "moved"] };

function Pin({ status, size = 18 }) {
  // SVG สร้างจากค่าคงที่ในโค้ด (ไม่มีข้อมูลผู้ใช้)
  return <span className="inline-block shrink-0" aria-hidden="true" dangerouslySetInnerHTML={{ __html: pinSvg(status, size) }} />;
}

function areaText(person) {
  return [person.village, person.tambon && `ต.${person.tambon}`, person.district && `อ.${person.district}`].filter(Boolean).join(" ");
}

const sortTh = (list) => [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));

function GroupChips({ summary, value, onChange }) {
  const items = [
    { key: "all", label: "ทั้งหมด", count: summary.total, color: "#0b4c86", pin: null },
    ...CASE_GROUPS.map((group) => ({
      ...group,
      count: summary.byGroup[group.key] || 0,
      pin: group.key === "pending" ? "waiting" : group.key === "progress" ? "arrived" : "assisted"
    }))
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="กรองตามการจัดการ">
      {items.map((item) => {
        const active = value === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            aria-pressed={active}
            className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left transition hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b4c86] ${active ? "border-transparent ring-2" : "border-slate-200"}`}
            style={active ? { "--tw-ring-color": item.color } : undefined}
          >
            {item.pin ? <Pin status={item.pin} size={22} /> : <UserRound className="h-6 w-6 shrink-0 text-[#0b4c86]" aria-hidden="true" />}
            <span className="min-w-0">
              <span className="block text-xs font-bold text-slate-600">{item.label}</span>
              <span className="block font-[family-name:var(--font-kanit)] text-2xl font-semibold leading-tight tabular-nums" style={{ color: item.color }}>
                {formatNumber(item.count)}<span className="ml-1 text-xs font-normal text-slate-500">คน</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MapLegend({ showShelters = false }) {
  // จอเล็ก: พับคำอธิบายไว้ไม่ให้บังแผนที่ จอใหญ่: เปิดไว้
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(window.matchMedia("(min-width: 1024px)").matches); }, []);
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}
      className="pointer-events-auto absolute bottom-2 left-2 z-[500] max-w-[15rem] rounded-xl bg-white/95 p-2.5 text-[11px] shadow-lg ring-1 ring-slate-200 backdrop-blur">
      <summary className="cursor-pointer font-black text-slate-800">สัญลักษณ์</summary>
      <div className="mt-1">
      <ul className="grid grid-cols-1 gap-y-1">
        {CASE_STATUSES.map((status) => (
          <li key={status.key} className="flex items-center gap-1.5 text-slate-700"><Pin status={status.key} size={14} />{status.label}</li>
        ))}
      </ul>
      <p className="mt-1.5 flex items-center gap-1.5 text-slate-600">
        <span className="rounded-full bg-white px-1.5 text-[10px] font-bold text-red-700 ring-1 ring-red-500">HD</span>
        ป้ายบนหมุด = ประเภท (ขอบแดง = ต้องช่วยก่อน)
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-slate-600">
        <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center" aria-hidden="true"><span className="absolute inset-0 rounded-full bg-red-500/40" /><span className="h-1.5 w-1.5 rounded-full bg-red-600" /></span>
        วงกะพริบ = กลุ่มต้องช่วยก่อนที่ยังรอ
      </p>
      {showShelters ? (
        <>
          <p className="mb-1 mt-2 font-black text-slate-800">ศูนย์พักพิง (ตัวเลข = ที่ว่าง)</p>
          <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            {SHELTER_TYPES.map((type) => (
              <li key={type.key} className="flex items-center gap-1 text-slate-700"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: type.color }} aria-hidden="true" />{type.short}</li>
            ))}
          </ul>
        </>
      ) : null}
      </div>
    </details>
  );
}

function QuickFilterBar({ counts, value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="ตัวกรองลัด">
      {QUICK_FILTERS.filter((item) => item.key === "all" || counts[item.key] !== undefined).map((item) => {
        const active = value === item.key;
        const count = counts[item.key];
        return (
          <button key={item.key} type="button" onClick={() => onChange(active ? "all" : item.key)} aria-pressed={active} title={item.hint}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold transition ${active ? "border-[#0b4c86] bg-[#0b4c86] text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`}>
            {item.label}
            {count !== undefined && item.key !== "all" ? <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? "bg-white/20" : item.key === "unmapped" ? "bg-slate-100" : count ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"}`}>{formatNumber(count)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function LayerToggles({ layers, onChange, floodCount, shelterCount, canFlood }) {
  const toggle = (key) => onChange({ ...layers, [key]: !layers[key] });
  return (
    <div className="pointer-events-auto absolute right-2 top-2 z-[500] rounded-xl bg-white/95 p-2 text-xs shadow-lg ring-1 ring-slate-200 backdrop-blur">
      <p className="mb-1 font-black text-slate-800">ชั้นข้อมูล</p>
      {canFlood ? (
        <label className="flex items-center gap-1.5 py-0.5"><input type="checkbox" checked={layers.flood} onChange={() => toggle("flood")} />พื้นที่น้ำท่วมล่าสุด ({formatNumber(floodCount)})</label>
      ) : null}
      <label className="flex items-center gap-1.5 py-0.5"><input type="checkbox" checked={layers.shelters} onChange={() => toggle("shelters")} />ศูนย์พักพิงที่เปิด ({formatNumber(shelterCount)})</label>
      {layers.shelters ? <label className="flex items-center gap-1.5 py-0.5 pl-4 text-slate-600"><input type="checkbox" checked={layers.allShelters} onChange={() => toggle("allShelters")} />รวมศูนย์ที่ยังไม่เปิด</label> : null}
    </div>
  );
}

function PersonCard({ person, selected, onSelect, perms, onQuick, onStatus, onEdit, onRemove, busy }) {
  const status = caseStatus(person.status);
  const type = typeMeta(person.vulnerable_type);
  const quick = perms.can_update_status ? QUICK_NEXT[status.key] || [] : [];
  const [today] = useState(bangkokToday);
  const pregnancy = pregnancyAlert(person, today);
  return (
    <li>
      <article
        className={`rounded-xl border bg-white p-3 transition ${selected ? "border-[#0b4c86] shadow-md ring-1 ring-[#0b4c86]" : "border-slate-200 hover:border-slate-300"}`}
        aria-current={selected ? "true" : undefined}
      >
        <button type="button" onClick={() => onSelect(person.id)} className="flex w-full items-start gap-2.5 text-left">
          <Pin status={status.key} size={24} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-black text-slate-900">{person.name}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">{type?.short || person.vulnerable_type}</span>
              {pregnancy ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200">{pregnancy.text}</span> : null}
              {person.in_flood_area && caseStatus(person.status).group !== "done" ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800 ring-1 ring-sky-200">บ้านอยู่ในพื้นที่น้ำท่วม</span> : null}
              {!person.location ? <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-700"><MapPinOff className="h-3 w-3" aria-hidden="true" />ไม่มีพิกัด</span> : null}
            </span>
            <span className="block truncate text-xs text-slate-500">{areaText(person)}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
              <span className="font-bold" style={{ color: status.color }}>{status.label}</span>
              {person.moved_to ? <span className="text-slate-600">→ {person.moved_to}</span> : null}
              {person.status_updated_at ? <span className="text-slate-400"><UpdatedAt value={person.status_updated_at} />{person.status_updated_by ? ` • ${person.status_updated_by}` : ""}</span> : null}
            </span>
          </span>
        </button>

        {selected ? (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm">
            <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1 text-[13px]">
              <dt className="text-slate-500">โทร</dt>
              <dd>{person.phone ? <a className="font-bold text-[#0b4c86] underline" href={`tel:${person.phone}`}><Phone className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{person.phone}</a> : "-"}</dd>
              <dt className="text-slate-500">ผู้ดูแล</dt>
              <dd>{person.caregiver_name || "-"}{person.caregiver_phone ? <> • <a className="font-bold text-[#0b4c86] underline" href={`tel:${person.caregiver_phone}`}>{person.caregiver_phone}</a></> : null}</dd>
              <dt className="text-slate-500">ที่อยู่</dt>
              <dd>{person.address || "-"}</dd>
              <dt className="text-slate-500">ความต้องการ</dt>
              <dd className="font-semibold text-slate-800">{person.needs || "-"}</dd>
              {person.case_note ? (<><dt className="text-slate-500">บันทึกล่าสุด</dt><dd>{person.case_note}</dd></>) : null}
            </dl>
            <div className="flex flex-wrap gap-1.5">
              {quick.map((key) => (
                <Button key={key} className="min-h-9 px-3 py-1 text-xs" disabled={busy} onClick={() => (key === "moved" ? onStatus(person, key) : onQuick(person, key))}>
                  <Pin status={key} size={14} />{caseStatus(key).label}
                </Button>
              ))}
              {perms.can_update_status ? (
                <Button variant="secondary" className="min-h-9 px-3 py-1 text-xs" disabled={busy} onClick={() => onStatus(person)}>
                  <History className="h-3.5 w-3.5" aria-hidden="true" />สถานะอื่น/ประวัติ
                </Button>
              ) : null}
              {person.location ? (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${person.location.lat},${person.location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Navigation className="h-3.5 w-3.5" aria-hidden="true" />นำทาง<ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              ) : null}
              {perms.can_edit_registry ? (
                <Button variant="secondary" className="min-h-9 px-3 py-1 text-xs" disabled={busy} onClick={() => onEdit(person)}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />แก้ไข</Button>
              ) : null}
              {perms.can_delete ? (
                <Button variant="secondary" className="min-h-9 px-3 py-1 text-xs text-red-700" disabled={busy} onClick={() => onRemove(person)}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />นำออก</Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </article>
    </li>
  );
}

function StatusDialog({ target, sessionId, shelters = [], onClose, onSaved }) {
  const [form, setForm] = useState({ status: "arrived", moved_to: "", moved_shelter_id: "", note: "" });
  const [history, setHistory] = useState({ loading: false, rows: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const person = target?.person;

  useEffect(() => {
    if (!person) return;
    setForm({ status: target.status || person.status || "arrived", moved_to: person.moved_shelter_id ? "" : person.moved_to || "", moved_shelter_id: person.moved_shelter_id ? String(person.moved_shelter_id) : "", note: "" });
    setError("");
    setHistory({ loading: true, rows: [] });
    apiRequest(`${API}/status?session_id=${sessionId}&person_id=${person.id}`)
      .then((json) => setHistory({ loading: false, rows: json.data || [] }))
      .catch(() => setHistory({ loading: false, rows: [] }));
  }, [person, target, sessionId]);

  const suggestions = useMemo(() => (person ? suggestShelters(person, shelters, { limit: 5 }) : []), [person, shelters]);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const json = await apiRequest(`${API}/status`, { method: "POST", body: { session_id: sessionId, person_id: person.id, ...form, moved_shelter_id: form.status === "moved" ? form.moved_shelter_id : "" } });
      onSaved(json.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={Boolean(person)}
      onOpenChange={(open) => !open && onClose()}
      title={person ? `อัปเดตสถานะ: ${person.name}` : ""}
      description={person ? `${typeMeta(person.vulnerable_type)?.label || ""} • ${areaText(person)}` : ""}
      onSubmit={submit}
      busy={busy}
      error={error}
      submitText="บันทึกสถานะ"
    >
      {person ? (
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-slate-800">สถานะตอนนี้</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {CASE_STATUSES.map((status) => {
                const checked = form.status === status.key;
                return (
                  <label key={status.key} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 ${checked ? "border-[#0b4c86] bg-[#eef5fb] ring-1 ring-[#0b4c86]" : "border-slate-200 hover:border-slate-300"}`}>
                    <input type="radio" name="vp-status" className="sr-only" checked={checked} onChange={() => setForm((current) => ({ ...current, status: status.key }))} />
                    <Pin status={status.key} size={22} />
                    <span>
                      <span className="block text-sm font-black text-slate-900">{status.label}</span>
                      <span className="block text-xs text-slate-500">{status.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {form.status === "moved" ? (
            <fieldset>
              <legend className="mb-1 text-sm font-bold text-slate-800">เคลื่อนย้ายไปที่</legend>
              <p className="mb-2 text-xs text-slate-500">ศูนย์ที่เปิดในเหตุการณ์นี้ เรียงจากที่เหมาะกับ{typeMeta(person.vulnerable_type)?.short || "กลุ่มนี้"}และใกล้บ้านที่สุด</p>
              {suggestions.length ? (
                <div className="space-y-1.5">
                  {suggestions.map((item) => {
                    const checked = String(form.moved_shelter_id) === String(item.id);
                    return (
                      <label key={item.id} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 ${checked ? "border-[#0b4c86] bg-[#eef5fb] ring-1 ring-[#0b4c86]" : item.full ? "border-slate-200 opacity-70" : "border-slate-200 hover:border-slate-300"}`}>
                        <input type="radio" name="vp-shelter" className="mt-1" checked={checked} onChange={() => setForm((current) => ({ ...current, moved_shelter_id: String(item.id), moved_to: "" }))} />
                        <span className="min-w-0">
                          <span className="block text-sm font-black text-slate-900">{item.name}{item.suitable && item.shelter_type !== "general" ? <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: shelterTypeMeta(item.shelter_type).color }}>{shelterTypeMeta(item.shelter_type).short}</span> : null}</span>
                          <span className="block text-xs text-slate-600">{suggestionReason(item) || [item.tambon && `ต.${item.tambon}`, item.district_name && `อ.${item.district_name}`].filter(Boolean).join(" ")}</span>
                          {item.missing?.length && item.shelter_type !== "general" ? <span className="block text-[11px] text-amber-700">ยังไม่ระบุว่ามี: {item.missing.length} รายการที่กลุ่มนี้ควรมี</span> : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">ยังไม่มีศูนย์พักพิงที่เปิดในเหตุการณ์นี้ (เปิดได้ที่เมนูศูนย์พักพิง) — ระบุปลายทางเองด้านล่าง</p>}
              <label className="mt-2 block text-xs font-semibold text-slate-700">หรือที่อื่น (โรงพยาบาล บ้านญาติ ฯลฯ)
                <input className={`${inputClass} mt-1`} value={form.moved_to} placeholder="เช่น รพ.ละงู, บ้านญาติ ต.กำแพง"
                  onChange={(event) => setForm((current) => ({ ...current, moved_to: event.target.value, moved_shelter_id: event.target.value ? "" : current.moved_shelter_id }))} />
              </label>
            </fieldset>
          ) : null}
          <Field label="บันทึกหน้างาน" hint="เช่น ส่งยาครบ 7 วัน, ต้องการเครื่องผลิตออกซิเจน (เก็บแบบเข้ารหัส)">
            <textarea rows={2} className={inputClass} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
          </Field>
          <section aria-label="ประวัติสถานะ">
            <h3 className="mb-1.5 text-sm font-bold text-slate-800">ประวัติในเหตุการณ์นี้</h3>
            {history.loading ? <p className="text-xs text-slate-500">กำลังโหลด…</p> : history.rows.length ? (
              <ol className="space-y-1.5 border-l-2 border-slate-200 pl-3">
                {history.rows.map((row) => (
                  <li key={row.id} className="text-xs text-slate-700">
                    <span className="font-bold" style={{ color: caseStatus(row.status).color }}>{row.label}</span>
                    {row.moved_to ? ` → ${row.moved_to}` : ""}
                    <span className="text-slate-400"> • {formatDateTime(row.created_at)}{row.created_by ? ` • ${row.created_by}` : ""}</span>
                    {row.note ? <span className="block text-slate-600">{row.note}</span> : null}
                  </li>
                ))}
              </ol>
            ) : <p className="text-xs text-slate-500">ยังไม่มีการอัปเดตสถานะ</p>}
          </section>
        </div>
      ) : null}
    </FormDialog>
  );
}

function PersonDialog({ open, editing, areas, sessionId, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(editing ? {
      ...EMPTY_FORM,
      ...Object.fromEntries(Object.keys(EMPTY_FORM).map((key) => [key, editing[key] ?? ""])),
      preterm_history: Boolean(editing.preterm_history),
      lat: editing.location?.lat ?? "",
      lng: editing.location?.lng ?? ""
    } : EMPTY_FORM);
  }, [open, editing]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const districts = useMemo(() => sortTh(areas.map((row) => row.district)), [areas]);
  const tambons = useMemo(() => sortTh(areas.filter((row) => row.district === form.district).map((row) => row.tambon)), [areas, form.district]);
  const villages = useMemo(() => sortTh(areas.filter((row) => row.district === form.district && row.tambon === form.tambon).map((row) => row.village)), [areas, form.district, form.tambon]);

  const submit = async () => {
    const checked = validatePerson(form);
    if (checked.error) {
      setError(checked.error);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const json = await apiRequest(editing ? `${API}?id=${editing.id}` : API, { method: editing ? "PUT" : "POST", body: { ...form, session_id: sessionId || undefined } });
      onSaved(json.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(value) => !value && onClose()}
      title={editing ? `แก้ไขข้อมูล: ${editing.name}` : "เพิ่มรายชื่อกลุ่มเปราะบาง"}
      description="ชื่อ เบอร์ ที่อยู่ พิกัดบ้าน และความต้องการ ถูกเข้ารหัสก่อนบันทึก เห็นได้เฉพาะเจ้าหน้าที่ที่เข้าสู่ระบบ"
      onSubmit={submit}
      busy={busy}
      error={error}
    >
      <datalist id="vp-districts">{districts.map((name) => <option key={name} value={name} />)}</datalist>
      <datalist id="vp-tambons">{tambons.map((name) => <option key={name} value={name} />)}</datalist>
      <datalist id="vp-villages">{villages.map((name) => <option key={name} value={name} />)}</datalist>
      <FormGrid>
        <FormSection title="ข้อมูลบุคคล">
          <Field label="ชื่อ-นามสกุล" required><input className={inputClass} value={form.name} onChange={set("name")} autoComplete="off" /></Field>
          <Field label="ประเภท" required>
            <select className={inputClass} value={form.vulnerable_type} onChange={set("vulnerable_type")}>
              {VULNERABLE_TYPES.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
            </select>
          </Field>
          {form.vulnerable_type === "pregnant" ? (
            <>
              <Field label="กำหนดคลอด" hint="ใช้เรียงลำดับและเตือนเมื่อใกล้คลอดภายใน 30 วัน"><input type="date" className={inputClass} value={form.due_date || ""} onChange={set("due_date")} /></Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-slate-800">
                <input type="checkbox" className="h-4 w-4" checked={Boolean(form.preterm_history)} onChange={(event) => setForm((current) => ({ ...current, preterm_history: event.target.checked }))} />
                เคยคลอดก่อนกำหนด
              </label>
            </>
          ) : null}
          <Field label="เบอร์โทร"><input className={inputClass} inputMode="tel" value={form.phone} onChange={set("phone")} autoComplete="off" /></Field>
          <Field label="ความต้องการ/อาการที่ต้องระวัง" hint="เช่น ใช้ออกซิเจน, ต้องฟอกไต, ต้องใช้รถเข็น"><input className={inputClass} value={form.needs} onChange={set("needs")} /></Field>
          <Field label="ชื่อผู้ดูแล"><input className={inputClass} value={form.caregiver_name} onChange={set("caregiver_name")} autoComplete="off" /></Field>
          <Field label="เบอร์ผู้ดูแล"><input className={inputClass} inputMode="tel" value={form.caregiver_phone} onChange={set("caregiver_phone")} autoComplete="off" /></Field>
        </FormSection>
        <FormSection title="ที่อยู่และพิกัดบ้าน">
          <Field label="อำเภอ" required><input className={inputClass} list="vp-districts" value={form.district} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value, tambon: "", village: "" }))} /></Field>
          <Field label="ตำบล" required><input className={inputClass} list="vp-tambons" value={form.tambon} onChange={(event) => setForm((current) => ({ ...current, tambon: event.target.value, village: "" }))} /></Field>
          <Field label="หมู่บ้าน"><input className={inputClass} list="vp-villages" value={form.village} onChange={set("village")} /></Field>
          <Field label="บ้านเลขที่/จุดสังเกต"><input className={inputClass} value={form.address} onChange={set("address")} /></Field>
          <LocationPicker lat={form.lat} lon={form.lng} onChange={(next) => setForm((current) => ({ ...current, ...(next.lat !== undefined ? { lat: next.lat } : {}), ...(next.lon !== undefined ? { lng: next.lon } : {}) }))} />
        </FormSection>
      </FormGrid>
    </FormDialog>
  );
}

export default function VulnerablePersonsWorkspace({ eocType = "flood" }) {
  const { notice, success, fail } = useNotice();
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [areas, setAreas] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [personDialog, setPersonDialog] = useState({ open: false, editing: null });
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [floodAreas, setFloodAreas] = useState([]);
  const [layers, setLayers] = useState({ flood: true, shelters: true, allShelters: false });
  const [today] = useState(() => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      setState({ loading: false, data: await apiRequest(`${API}?eoc=${eocType}`), error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [eocType]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiRequest(`${AREA_API}?eoc=${eocType}`).then((json) => setAreas(json.baseline || [])).catch(() => setAreas([]));
  }, [eocType]);

  const data = state.data;
  const session = data?.session || null;
  const perms = data?.permissions || {};
  const shelters = useMemo(() => data?.shelters || [], [data]);
  const sessionId = session?.id;
  // พื้นที่น้ำท่วมล่าสุดของเหตุการณ์ (หมู่บ้านที่รายงานว่ามีน้ำ) — ใช้ซ้อนแผนที่และบอกว่าบ้านใครอยู่ในพื้นที่น้ำท่วม
  useEffect(() => {
    if (eocType !== "flood" || !sessionId) return;
    let cancelled = false;
    fetch(`/stn-eoc/api/eoc/flood/area-status?session_id=${sessionId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => { if (!cancelled) setFloodAreas((json?.data || []).filter((area) => FLOOD_LEVELS.has(area.flood_level) && area.geometry)); })
      .catch(() => { if (!cancelled) setFloodAreas([]); });
    return () => { cancelled = true; };
  }, [eocType, sessionId]);
  const persons = useMemo(() => (data?.persons || []).map((person) => ({
    ...person,
    in_flood_area: Boolean(person.location && floodAreas.some((area) => pointInGeometry(person.location.lat, person.location.lng, area.geometry)))
  })), [data, floodAreas]);
  const summary = useMemo(() => summarizePersons(persons), [persons]);
  const quickCounts = useMemo(() => {
    const counts = { priority: persons.filter((person) => matchesQuickFilter(person, "priority", today)).length, unmapped: persons.filter((person) => !person.location).length };
    if (floodAreas.length) counts.flood_pending = persons.filter((person) => matchesQuickFilter(person, "flood_pending", today)).length;
    return counts;
  }, [persons, floodAreas.length, today]);
  const filtered = useMemo(() => sortByUrgency(filterPersons(persons, { ...filters, today })), [persons, filters, today]);
  const activeShelterCount = shelters.filter((shelter) => Number(shelter.active) === 1).length;
  const districtOptions = useMemo(() => sortTh(persons.map((person) => person.district)), [persons]);
  const tambonOptions = useMemo(() => sortTh(persons.filter((person) => filters.district === "all" || person.district === filters.district).map((person) => person.tambon)), [persons, filters.district]);
  const unmapped = filtered.filter((person) => !person.location).length;
  const fitKey = JSON.stringify(filters) + (state.loading ? "" : ":ready");
  const setFilter = (key) => (value) => setFilters((current) => ({ ...current, [key]: value, ...(key === "district" ? { tambon: "all" } : {}), ...(key === "group" ? { status: "all" } : {}) }));
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  const quickStatus = async (person, status) => {
    setBusy(true);
    try {
      const json = await apiRequest(`${API}/status`, { method: "POST", body: { session_id: session.id, person_id: person.id, status } });
      success(`${person.name}: ${json.message}`);
      await load();
    } catch (error) {
      fail(error.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async () => {
    setBusy(true);
    setRemoveError("");
    try {
      const json = await apiRequest(`${API}?id=${removing.id}`, { method: "DELETE" });
      success(json.message);
      setRemoving(null);
      setSelectedId(null);
      await load();
    } catch (error) {
      setRemoveError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const context = session ? `${getEocTypeLabel(eocType)} ครั้งที่ ${session.session_number}${session.status === "active" ? "" : " (ปิดแล้ว)"}` : null;

  return (
    <AdminPage
      context={context}
      title="แผนที่กลุ่มเปราะบางรายบุคคล"
      description="ดูว่าใครยังไม่ได้รับการช่วยเหลือ อยู่ตรงไหน และอัปเดตสถานะเมื่อเจ้าหน้าที่เข้าพื้นที่"
      actions={(
        <div className="flex flex-wrap gap-2">
          {perms.can_edit_registry ? <AddButton onClick={() => setPersonDialog({ open: true, editing: null })}>เพิ่มรายชื่อ</AddButton> : null}
        </div>
      )}
    >
      <VulnerableViewTabs eocType={eocType} current="persons" />
      {notice}
      <p className="flex items-start gap-2 rounded-xl border border-[#c9dcee] bg-[#f3f8fc] px-3 py-2 text-xs text-slate-700">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#0b4c86]" aria-hidden="true" />
        ข้อมูลส่วนบุคคลและพิกัดบ้านเข้ารหัสในฐานข้อมูล เห็นได้เฉพาะเจ้าหน้าที่ที่เข้าสู่ระบบ ทุกการเปิดดูและแก้ไขถูกบันทึกไว้ — ห้ามคัดลอกหรือแคปหน้าจอเผยแพร่
      </p>
      {state.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{state.error}</p> : null}
      {data?.migration_needed ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">ฐานข้อมูลยังไม่มีตารางทะเบียนรายบุคคล ให้ผู้ดูแลระบบรัน migrations/20261009_vulnerable_persons.sql</p>
      ) : null}
      {data && !session ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">ยังไม่เคยเปิด EOC {getEocTypeLabel(eocType)} — ดูทะเบียนและแผนที่ได้ แต่จะอัปเดตสถานะการช่วยเหลือได้เมื่อเปิดเหตุการณ์</p>
      ) : session && session.status !== "active" ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">เหตุการณ์นี้ปิดแล้ว สถานะที่แสดงเป็นผลสุดท้ายของเหตุการณ์ (ดูได้อย่างเดียว)</p>
      ) : null}
      <ReadOnlyNotice message={perms.read_only_message} />

      <GroupChips summary={summary} value={filters.group} onChange={setFilter("group")} />
      <QuickFilterBar counts={quickCounts} value={filters.quick} onChange={setFilter("quick")} />
      {summary.total ? (
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200" role="meter" aria-valuenow={summary.donePercent} aria-valuemin={0} aria-valuemax={100} aria-label="สัดส่วนที่จัดการแล้ว">
            <div className="flex h-full">
              {CASE_GROUPS.slice().reverse().map((group) => (
                <span key={group.key} style={{ width: `${((summary.byGroup[group.key] || 0) / summary.total) * 100}%`, backgroundColor: group.color }} />
              ))}
            </div>
          </div>
          <span className="shrink-0 font-bold">จัดการแล้ว {summary.donePercent}%</span>
        </div>
      ) : null}

      <Toolbar
        search={filters.search}
        onSearchChange={setFilter("search")}
        searchPlaceholder="ค้นหาชื่อ หมู่บ้าน ความต้องการ"
        right={(
          <>
            {filtersActive ? <Button variant="secondary" className="min-h-10" onClick={() => setFilters(EMPTY_FILTERS)}>ล้างตัวกรอง</Button> : null}
            <Button variant="secondary" className="min-h-10" disabled={state.loading} onClick={load}><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />รีเฟรช</Button>
          </>
        )}
      >
        <FilterSelect label="สถานะ" value={filters.status} onChange={setFilter("status")} options={[{ value: "all", label: "ทุกสถานะ" }, ...CASE_STATUSES.filter((status) => filters.group === "all" || status.group === filters.group).map((status) => ({ value: status.key, label: status.label }))]} />
        <FilterSelect label="ประเภท" value={filters.type} onChange={setFilter("type")} options={[{ value: "all", label: "ทุกประเภท" }, ...VULNERABLE_TYPES.map((type) => ({ value: type.key, label: `${type.short} (${formatNumber(summary.byType[type.key] || 0)})` }))]} />
        <FilterSelect label="อำเภอ" value={filters.district} onChange={setFilter("district")} options={[{ value: "all", label: "ทุกอำเภอ" }, ...districtOptions.map((name) => ({ value: name, label: `อ.${name}` }))]} />
        <FilterSelect label="ตำบล" value={filters.tambon} onChange={setFilter("tambon")} options={[{ value: "all", label: "ทุกตำบล" }, ...tambonOptions.map((name) => ({ value: name, label: `ต.${name}` }))]} />
      </Toolbar>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="relative h-[55vh] min-h-[360px] overflow-hidden rounded-xl border border-slate-200 bg-white lg:h-[calc(100vh-17rem)] lg:min-h-[520px]">
          <VulnerablePersonsMap people={filtered} selectedId={selectedId} onSelect={setSelectedId} fitKey={fitKey} floodAreas={floodAreas} shelters={shelters} layers={layers} />
          <MapLegend showShelters={layers.shelters && shelters.length > 0} />
          {session ? <LayerToggles layers={layers} onChange={setLayers} floodCount={floodAreas.length} shelterCount={activeShelterCount} canFlood={eocType === "flood"} /> : null}
          {!state.loading && filtered.length && !filtered.some((person) => person.location) ? (
            <p className="absolute inset-x-3 top-3 z-[500] rounded-lg bg-amber-50/95 px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">รายชื่อที่กรองไว้ยังไม่มีพิกัดบ้าน กด &quot;แก้ไข&quot; แล้วปักหมุดเพื่อให้แสดงบนแผนที่</p>
          ) : null}
        </div>

        <section aria-label="รายชื่อกลุ่มเปราะบาง" className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-slate-50 lg:h-[calc(100vh-17rem)] lg:min-h-[520px]">
          <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 text-xs text-slate-600">
            <span><b className="text-slate-900">{formatNumber(filtered.length)}</b> คน{filtersActive ? ` (จาก ${formatNumber(summary.total)})` : ""} • เรียงคนที่ต้องไปก่อนไว้บนสุด</span>
            {unmapped ? <span className="shrink-0 font-semibold text-amber-700">ไม่มีพิกัด {formatNumber(unmapped)}</span> : null}
          </header>
          {state.loading && !persons.length ? (
            <div className="space-y-2 p-3" aria-busy="true">{[0, 1, 2, 3].map((index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-white" />)}</div>
          ) : filtered.length ? (
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 max-lg:max-h-[70vh]">
              {filtered.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  selected={person.id === selectedId}
                  onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
                  perms={perms}
                  busy={busy}
                  onQuick={quickStatus}
                  onStatus={(target, status) => setStatusTarget({ person: target, status })}
                  onEdit={(target) => setPersonDialog({ open: true, editing: target })}
                  onRemove={(target) => { setRemoveError(""); setRemoving(target); }}
                />
              ))}
            </ul>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-sm text-slate-600">
              <UserRound className="h-10 w-10 text-slate-300" aria-hidden="true" />
              {summary.total ? <p className="mt-2">ไม่พบรายชื่อตามตัวกรอง</p> : (
                <>
                  <p className="mt-2 font-bold text-slate-800">ยังไม่มีรายชื่อในทะเบียน</p>
                  <p className="mt-1 max-w-xs text-xs">เพิ่มผู้ป่วยติดเตียง ผู้พิการ หญิงตั้งครรภ์ ฯลฯ พร้อมปักหมุดบ้าน เพื่อวางแผนเข้าช่วยเหลือเมื่อเกิดเหตุ</p>
                  {perms.can_edit_registry ? <div className="mt-3"><AddButton onClick={() => setPersonDialog({ open: true, editing: null })}>เพิ่มรายชื่อ</AddButton></div> : null}
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {session ? (
        <StatusDialog
          target={statusTarget}
          sessionId={session.id}
          shelters={shelters}
          onClose={() => setStatusTarget(null)}
          onSaved={async (message) => { setStatusTarget(null); success(message); await load(); }}
        />
      ) : null}

      <PersonDialog
        open={personDialog.open}
        editing={personDialog.editing}
        areas={areas}
        sessionId={session?.id}
        onClose={() => setPersonDialog({ open: false, editing: null })}
        onSaved={async (message) => { setPersonDialog({ open: false, editing: null }); success(message); await load(); }}
      />

      <FormDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="นำออกจากทะเบียน"
        description={removing ? `${removing.name} • ${areaText(removing)}` : ""}
        onSubmit={confirmRemove}
        busy={busy}
        error={removeError}
        submitText="นำออกจากทะเบียน"
        size="md"
      >
        <p className="text-sm text-slate-700">รายชื่อนี้จะไม่แสดงในรายการและแผนที่อีก ประวัติการช่วยเหลือในเหตุการณ์ที่ผ่านมายังเก็บไว้ ใช้เมื่อย้ายออกนอกพื้นที่หรือเสียชีวิต</p>
        {removing?.phone ? <p className="mt-2 text-xs text-slate-500">เบอร์ที่บันทึกไว้: {maskPhone(removing.phone)}</p> : null}
      </FormDialog>
    </AdminPage>
  );
}
