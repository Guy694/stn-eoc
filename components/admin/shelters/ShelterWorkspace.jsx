"use client";

// ศูนย์พักพิง (หน้าเดียว 3 แท็บ — เป็นทางเข้าเดียวของเรื่องศูนย์พักพิงทั้งระบบ)
//  - ในเหตุการณ์: เปิด/ปิดใช้ศูนย์ในเหตุการณ์ที่เปิดอยู่ และอัปเดตยอดผู้พักพิง (ข้อมูลที่ใช้ในห้องประชุม)
//  - แผนที่: ตำแหน่งศูนย์ (ศูนย์ที่เปิดในเหตุการณ์เด่นขึ้น)
//  - ทะเบียนกลาง: รายชื่อศูนย์ทั้งหมดของจังหวัด เพิ่ม/แก้ไข/ปิดใช้งาน/ลบ
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Power, PowerOff, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEOC } from "@/context/EOCContext";
import {
  AddButton, AdminPage, Button, DataTable, DeleteDialog, Field, FilterSelect, FormDialog, FormGrid, IconButton, RowActions,
  StatusPill, Tabs, Toolbar, UpdatedAt, inputClass, useNotice
} from "@/components/admin/crud";
import AreaFields from "@/components/admin/AreaFields";
import LocationPicker from "@/components/admin/LocationPicker";
import AppDialog, { AppDialogActions, AppDialogCancel } from "@/components/ui/app-dialog";
import { apiRequest, formatNumber } from "@/lib/adminApi";
import { readQuery, useUrlState } from "@/components/admin/useUrlState";
import ShelterSessionDashboard from "@/components/admin/shelters/ShelterSessionDashboard";
import { summarizeShelters } from "@/lib/shelterDashboard";
import { sendOrQueue } from "@/lib/offlineQueue";
import { SHELTER_CAPABILITIES, SHELTER_TYPES, capabilityLabel, parseCapabilities, shelterTypeMeta } from "@/lib/shelterSuitability";

// แผนที่ใช้ Leaflet (ทำงานเฉพาะในเบราว์เซอร์) — โหลดเมื่อเปิดแท็บแผนที่เท่านั้น
const ShelterCenterMap = dynamic(() => import("@/components/ShelterCenterMap"), {
  ssr: false,
  loading: () => <div className="flex h-96 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">กำลังโหลดแผนที่…</div>
});


const REGISTRY_API = "/stn-eoc/api/admin/shelter-center";
const ACTIVATION_API = "/stn-eoc/api/eoc/shelter-activations";
const EDITOR_ROLES = ["admin", "commander", "MCATT", "SAT", "SEhRT"];

export const SHELTER_EOC_TYPES = [
  { value: "flood", label: "อุทกภัย" },
  { value: "disease", label: "โรคระบาด" },
  { value: "tsunami", label: "สึนามิ" },
  { value: "earthquake", label: "แผ่นดินไหว" },
  { value: "drought", label: "ภัยแล้ง" }
];
const typeLabel = (value) => SHELTER_EOC_TYPES.find((item) => item.value === value)?.label || value || "-";

const EMPTY_SHELTER = {
  sheltername: "", eoc_type: "flood", shelter_capacity: "", contact_phone: "",
  district_name: "", tambon: "", village: "", address: "", lat: "", lon: "", is_active: 1,
  shelter_type: "general", capabilities: ""
};

function ShelterTypeChip({ row }) {
  const type = shelterTypeMeta(row.shelter_type);
  const caps = parseCapabilities(row.capabilities);
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ backgroundColor: type.color }}>{type.short}</span>
      {caps.length ? <span className="text-[11px] text-slate-500" title={caps.map(capabilityLabel).join(", ")}>ความพร้อม {caps.length} รายการ</span> : null}
    </span>
  );
}

function area(row) {
  return [row.village, row.tambon && `ต.${row.tambon}`, row.district_name && `อ.${row.district_name}`].filter(Boolean).join(" ");
}

function OccupancyBar({ occupancy, capacity }) {
  const ratio = capacity ? Math.min(occupancy / capacity, 1) : 0;
  const tone = ratio >= 1 ? "bg-red-600" : ratio >= 0.8 ? "bg-amber-500" : "bg-emerald-600";
  return (
    <div className="min-w-[8rem]">
      <div className="text-sm"><strong className="font-bold">{formatNumber(occupancy)}</strong> <span className="text-slate-500">/ {formatNumber(capacity)} คน</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
    </div>
  );
}

export default function ShelterWorkspace() {
  const { user } = useAuth();
  const { eocStatus } = useEOC();
  const [tab, setTab] = useUrlState("tab", "session", ["session", "map", "registry"]);
  const canEdit = EDITOR_ROLES.includes(user?.role);
  const isAdmin = user?.role === "admin";
  const { notice, success, fail } = useNotice();

  // เหตุการณ์ที่เปิดอยู่ (เลือกได้ถ้ามีหลายเหตุการณ์)
  const openEvents = useMemo(() => Object.entries(eocStatus || {})
    .filter(([type, status]) => status?.is_active && status?.session_id && SHELTER_EOC_TYPES.some((item) => item.value === type))
    .map(([type, status]) => ({ type, sessionId: status.session_id, label: `${typeLabel(type)}${status.session_number ? ` ครั้งที่ ${status.session_number}` : ""}` })), [eocStatus]);
  const [eventKey, setEventKey] = useState("");
  useEffect(() => {
    if (!openEvents.length) return;
    const wanted = readQuery("eoc");
    const preferred = openEvents.find((item) => item.type === wanted) || openEvents[0];
    setEventKey((current) => (openEvents.some((item) => item.type === current) ? current : preferred.type));
  }, [openEvents]);
  const currentEvent = openEvents.find((item) => item.type === eventKey) || null;

  // ข้อมูล
  const [registry, setRegistry] = useState([]);
  const [activations, setActivations] = useState([]);
  // สิทธิ์ในเหตุการณ์ (เปิดใช้ศูนย์/ปรับยอด) มาจากเซิร์ฟเวอร์: LOGISTICS บันทึกได้ ทีมอื่นดูอย่างเดียว
  const [sessionPerms, setSessionPerms] = useState({ can_edit: false, read_only_message: null });
  const canEditSession = sessionPerms.can_edit === true;
  const [health, setHealth] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadRegistry = useCallback(async () => {
    const json = await apiRequest(REGISTRY_API);
    setRegistry(json.data || []);
  }, []);
  const loadActivations = useCallback(async () => {
    if (!currentEvent) { setActivations([]); setHealth({}); return; }
    const json = await apiRequest(`${ACTIVATION_API}?session_id=${currentEvent.sessionId}&eoc_type=${currentEvent.type}`);
    setActivations(json.data || []);
    if (json.permissions) setSessionPerms(json.permissions);
    setHealth(json.health || {});
  }, [currentEvent]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadRegistry(), loadActivations()]);
      setLoadError("");
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [loadActivations, loadRegistry]);
  useEffect(() => { reload(); }, [reload]);

  // ตัวกรอง
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("all");
  const [sessionFilter, setSessionFilter] = useState("active");
  const [registryFilter, setRegistryFilter] = useState("all");
  const districts = useMemo(() => [...new Set(registry.map((row) => row.district_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")), [registry]);
  const matches = useCallback((row) => {
    const query = search.trim().toLowerCase();
    if (query && !`${row.sheltername} ${area(row)}`.toLowerCase().includes(query)) return false;
    return district === "all" || row.district_name === district;
  }, [district, search]);

  const sessionRows = useMemo(() => activations.filter((row) => {
    if (!matches(row)) return false;
    if (sessionFilter === "active") return Number(row.is_activated_for_session) === 1;
    if (sessionFilter === "inactive") return Number(row.is_activated_for_session) !== 1;
    return true;
  }), [activations, matches, sessionFilter]);
  const registryRows = useMemo(() => registry.filter((row) => {
    if (!matches(row)) return false;
    if (registryFilter === "active") return Number(row.is_active) === 1;
    if (registryFilter === "inactive") return Number(row.is_active) !== 1;
    if (SHELTER_EOC_TYPES.some((item) => item.value === registryFilter)) return row.eoc_type === registryFilter;
    return true;
  }), [matches, registry, registryFilter]);

  const dashboard = useMemo(() => summarizeShelters(activations, health), [activations, health]);
  const sessionStats = useMemo(() => {
    const active = activations.filter((row) => Number(row.is_activated_for_session) === 1);
    const capacity = active.reduce((sum, row) => sum + Number(row.shelter_capacity || 0), 0);
    const occupancy = active.reduce((sum, row) => sum + Number(row.session_occupancy || 0), 0);
    return { count: active.length, capacity, occupancy, free: Math.max(capacity - occupancy, 0), nearFull: active.filter((row) => row.shelter_capacity && row.session_occupancy / row.shelter_capacity >= 0.8).length };
  }, [activations]);

  // ---------- การทำงานในเหตุการณ์ ----------
  const [occupancyRow, setOccupancyRow] = useState(null);
  const [occupancyForm, setOccupancyForm] = useState({ current_occupancy: 0, notes: "" });
  const [toggleRow, setToggleRow] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const openOccupancy = (row) => {
    setOccupancyRow(row);
    setOccupancyForm({ current_occupancy: Number(row.session_occupancy || 0), notes: row.activation_notes || "" });
    setFormError("");
  };
  const saveOccupancy = async () => {
    const value = Number(occupancyForm.current_occupancy);
    if (!Number.isInteger(value) || value < 0) { setFormError("จำนวนผู้พักพิงต้องเป็นจำนวนเต็มตั้งแต่ 0"); return; }
    setBusy(true);
    try {
      const result = await sendOrQueue(ACTIVATION_API, { method: "PUT", label: `ยอดผู้พักพิง ${occupancyRow.sheltername} = ${value} คน`, body: { shelter_id: occupancyRow.id, session_id: currentEvent.sessionId, current_occupancy: value, notes: occupancyForm.notes || null } });
      success(result.queued ? result.message : `อัปเดตยอดผู้พักพิง ${occupancyRow.sheltername} แล้ว`);
      setOccupancyRow(null);
      loadActivations();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  };
  const confirmToggle = async () => {
    const turningOn = Number(toggleRow.is_activated_for_session) !== 1;
    setBusy(true);
    try {
      const json = await apiRequest(ACTIVATION_API, { method: "POST", body: { shelter_id: toggleRow.id, session_id: currentEvent.sessionId, is_active: turningOn ? 1 : 0 } });
      success(json.message || (turningOn ? "เปิดใช้ศูนย์แล้ว" : "ปิดใช้ศูนย์แล้ว"));
      setToggleRow(null);
      loadActivations();
    } catch (error) {
      fail(error.message);
    } finally {
      setBusy(false);
    }
  };

  // ---------- เปิด/ปิดทุกศูนย์ด้วยปุ่มเดียว ----------
  const usableShelters = useMemo(() => activations.filter((row) => Number(row.is_active) === 1 || Number(row.is_activated_for_session) === 1), [activations]);
  const allOpen = usableShelters.length > 0 && usableShelters.every((row) => Number(row.is_activated_for_session) === 1);
  const [bulkAction, setBulkAction] = useState(null); // "open_all" | "close_all"
  const confirmBulk = async () => {
    setBusy(true);
    try {
      const json = await apiRequest(ACTIVATION_API, { method: "POST", body: { bulk: bulkAction, session_id: currentEvent.sessionId, eoc_type: currentEvent.type } });
      success(json.message);
      setBulkAction(null);
      setSessionFilter(bulkAction === "open_all" ? "active" : "all");
      loadActivations();
    } catch (error) {
      fail(error.message);
    } finally {
      setBusy(false);
    }
  };

  // ---------- ทะเบียนกลาง ----------
  const [editing, setEditing] = useState(null); // null = ปิด, {} = เพิ่ม, row = แก้ไข
  const [form, setForm] = useState(EMPTY_SHELTER);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));

  const openForm = (row = null) => {
    setEditing(row || {});
    setForm(row ? {
      ...EMPTY_SHELTER,
      ...Object.fromEntries(Object.keys(EMPTY_SHELTER).map((key) => [key, row[key] ?? EMPTY_SHELTER[key]]))
    } : EMPTY_SHELTER);
    setFormError("");
  };
  const saveShelter = async () => {
    if (!form.sheltername.trim()) { setFormError("กรุณาระบุชื่อศูนย์พักพิง"); return; }
    if (!form.tambon) { setFormError("กรุณาเลือกอำเภอและตำบล"); return; }
    if (!(Number(form.shelter_capacity) > 0)) { setFormError("ความจุต้องมากกว่า 0"); return; }
    setBusy(true);
    try {
      const body = { ...form, sheltername: form.sheltername.trim(), shelter_capacity: Number(form.shelter_capacity), is_active: Number(form.is_active) ? 1 : 0 };
      if (editing?.id) await apiRequest(`${REGISTRY_API}?id=${editing.id}`, { method: "PUT", body });
      else await apiRequest(REGISTRY_API, { method: "POST", body });
      success(editing?.id ? "บันทึกการแก้ไขแล้ว" : "เพิ่มศูนย์พักพิงแล้ว");
      setEditing(null);
      reload();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  };
  const toggleRegistryActive = async (row) => {
    try {
      const body = { ...Object.fromEntries(Object.keys(EMPTY_SHELTER).map((key) => [key, row[key] ?? EMPTY_SHELTER[key]])), is_active: Number(row.is_active) ? 0 : 1 };
      await apiRequest(`${REGISTRY_API}?id=${row.id}`, { method: "PUT", body });
      success(Number(row.is_active) ? `ปิดใช้งาน ${row.sheltername} แล้ว` : `เปิดใช้งาน ${row.sheltername} แล้ว`);
      reload();
    } catch (error) {
      fail(error.message);
    }
  };
  const confirmDelete = async (reason) => {
    setBusy(true);
    try {
      const json = await apiRequest(`${REGISTRY_API}?id=${deleting.id}`, { method: "DELETE", body: { reason } });
      success(json.message);
      setDeleting(null);
      reload();
    } catch (error) {
      setDeleteError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const districtOptions = [{ value: "all", label: "ทุกอำเภอ" }, ...districts.map((name) => ({ value: name, label: `อ.${name}` }))];

  return (
    <AdminPage
      context={tab === "session" ? (currentEvent ? `เหตุการณ์ ${currentEvent.label}` : "เหตุการณ์") : "ข้อมูลกลาง"}
      title="ศูนย์พักพิง"
      description={tab === "session"
        ? "เปิดใช้ศูนย์ในเหตุการณ์ และอัปเดตยอดผู้พักพิงให้เป็นปัจจุบัน ตัวเลขนี้แสดงในภาพรวมสถานการณ์ สรุปห้องประชุม และหน้าเว็บประชาชน"
        : tab === "map"
          ? "ตำแหน่งศูนย์พักพิงบนแผนที่ คลิกจุดเพื่อดูรายละเอียด — ศูนย์ที่ยังไม่มีพิกัดแก้ได้ที่แท็บทะเบียนกลาง"
          : "รายชื่อศูนย์พักพิงทั้งหมดของจังหวัด ใช้ร่วมกันทุกเหตุการณ์"}
      actions={(
        <>
          {tab === "registry" && canEdit ? <AddButton onClick={() => openForm()}>เพิ่มศูนย์พักพิง</AddButton> : null}
        </>
      )}
    >
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "session", label: "ในเหตุการณ์", count: currentEvent ? sessionStats.count : undefined },
          { value: "map", label: "แผนที่" },
          { value: "registry", label: "ทะเบียนกลาง", count: registry.length }
        ]}
      />

      {loadError ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{loadError}</p> : null}

      {tab === "session" ? (
        !currentEvent ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
            <p className="font-bold text-slate-800">ยังไม่มีเหตุการณ์ที่เปิดอยู่</p>
            <p className="mt-1 text-sm text-slate-600">การเปิดใช้ศูนย์และบันทึกยอดผู้พักพิงทำได้เมื่อเปิด EOC แล้ว ระหว่างนี้จัดการรายชื่อศูนย์ได้ที่แท็บทะเบียนกลาง</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="secondary" onClick={() => setTab("registry")}>ไปที่ทะเบียนกลาง</Button>
              {isAdmin ? <Link href="/admin/eoc-management" className="inline-flex min-h-10 items-center rounded-lg bg-[#0b4c86] px-4 py-2 text-sm font-bold text-white hover:bg-[#083865]">เปิด EOC</Link> : null}
            </div>
          </div>
        ) : (
          <>
            {!canEditSession && sessionPerms.read_only_message ? (
              <p className="rounded-xl border border-[#c9dcee] bg-[#edf5fc] px-4 py-3 text-sm text-[#083865]" role="status">{sessionPerms.read_only_message}</p>
            ) : null}
            <ShelterSessionDashboard summary={dashboard} onShowShelter={(name) => { setSessionFilter("all"); setDistrict("all"); setSearch(name); }} />
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-base font-black text-slate-900">รายชื่อศูนย์ในเหตุการณ์</h3>
              {canEditSession && usableShelters.length ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={allOpen}
                  onClick={() => setBulkAction(allOpen ? "close_all" : "open_all")}
                  disabled={busy}
                  className={`flex items-center gap-3 rounded-full border py-1.5 pl-1.5 pr-4 text-left text-sm font-bold transition-colors disabled:opacity-60 ${allOpen ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}
                >
                  <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${allOpen ? "bg-emerald-600" : sessionStats.count ? "bg-amber-400" : "bg-slate-300"}`} aria-hidden="true">
                    <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${allOpen ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                  </span>
                  <span className="leading-tight">
                    {allOpen ? "ศูนย์ทั้งหมดเปิดอยู่" : "เปิดศูนย์ทั้งหมด"}
                    <span className="block text-xs font-medium opacity-80">เปิดอยู่ {sessionStats.count}/{usableShelters.length} ศูนย์ · แตะเพื่อ{allOpen ? "ปิดทั้งหมด" : "เปิดทั้งหมด"}</span>
                  </span>
                </button>
              ) : null}
            </div>
            <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="ค้นหาชื่อศูนย์ ตำบล อำเภอ">
              {openEvents.length > 1 ? (
                <FilterSelect label="เหตุการณ์" value={eventKey} onChange={setEventKey} options={openEvents.map((item) => ({ value: item.type, label: item.label }))} />
              ) : null}
              <FilterSelect label="สถานะ" value={sessionFilter} onChange={setSessionFilter} options={[
                { value: "active", label: "เปิดใช้อยู่" }, { value: "inactive", label: "ยังไม่เปิดใช้" }, { value: "all", label: "ทั้งหมด" }
              ]} />
              <FilterSelect label="อำเภอ" value={district} onChange={setDistrict} options={districtOptions} />
            </Toolbar>
            <DataTable
              caption="ศูนย์พักพิงในเหตุการณ์"
              loading={loading}
              rows={sessionRows}
              emptyText={sessionFilter === "active" ? "ยังไม่ได้เปิดใช้ศูนย์ใดในเหตุการณ์นี้ เลือก \"ยังไม่เปิดใช้\" เพื่อเปิดใช้ศูนย์" : "ไม่พบศูนย์ตามเงื่อนไข"}
              emptyAction={sessionFilter === "active" && canEditSession ? <Button variant="secondary" onClick={() => setSessionFilter("inactive")}>ดูศูนย์ที่ยังไม่เปิดใช้</Button> : null}
              columns={[
                { key: "sheltername", label: "ศูนย์พักพิง", render: (row) => (<div><div className="font-semibold text-slate-900">{row.sheltername}{row.shelter_type && row.shelter_type !== "general" ? <span className="ml-1.5 rounded px-1.5 py-0.5 align-middle text-[10px] font-bold text-white" style={{ backgroundColor: shelterTypeMeta(row.shelter_type).color }}>{shelterTypeMeta(row.shelter_type).short}</span> : null}</div><div className="text-xs text-slate-500">{area(row)}</div></div>) },
                { key: "state", label: "สถานะ", render: (row) => Number(row.is_activated_for_session) === 1 ? <StatusPill tone="green">เปิดใช้</StatusPill> : <StatusPill>ยังไม่เปิดใช้</StatusPill> },
                { key: "occupancy", label: "ผู้พักพิง / ความจุ", render: (row) => Number(row.is_activated_for_session) === 1 ? <OccupancyBar occupancy={Number(row.session_occupancy || 0)} capacity={Number(row.shelter_capacity || 0)} /> : <span className="text-slate-500">ความจุ {formatNumber(row.shelter_capacity)} คน</span> },
                { key: "updated", label: "อัปเดตล่าสุด", render: (row) => Number(row.is_activated_for_session) === 1 ? <UpdatedAt value={row.activation_updated_at || row.activated_at} staleHours={12} /> : "-" },
                { key: "health", label: "ผู้ป่วยในศูนย์", className: "text-right", render: (row) => {
                  const sick = health.by_shelter?.[row.id];
                  if (!sick?.new_cases) return <span className="text-slate-400">-</span>;
                  return <span className="tabular-nums"><b>{formatNumber(sick.new_cases)}</b> ราย{sick.today_new_cases ? <span className="block text-xs text-amber-700">วันนี้ {formatNumber(sick.today_new_cases)}</span> : null}</span>;
                } },
                { key: "contact", label: "ผู้ประสานงาน", className: "max-w-[12rem]", mobile: false, render: (row) => {
                  const phone = row.coordinator_phone || row.contact_phone;
                  return <span className="text-slate-700">{row.coordinator_name || row.responsible_org || "-"}{phone ? <a href={`tel:${String(phone).split(/[ ,/]/)[0]}`} className="block text-xs font-semibold text-[#0b4c86] hover:underline">{phone}</a> : null}</span>;
                } },
                { key: "notes", label: "หมายเหตุ", className: "max-w-[14rem] text-slate-600", render: (row) => row.activation_notes || "-", mobile: false }
              ]}
              rowActions={canEditSession ? (row) => Number(row.is_activated_for_session) === 1 ? (
                <RowActions>
                  <Button className="min-h-9 px-3" onClick={() => openOccupancy(row)}><Users className="h-4 w-4" aria-hidden="true" /> อัปเดตยอด</Button>
                  <IconButton icon={PowerOff} label={`ปิดใช้ ${row.sheltername}`} onClick={() => setToggleRow(row)} />
                </RowActions>
              ) : (
                <RowActions>
                  <Button variant="secondary" className="min-h-9 px-3" onClick={() => setToggleRow(row)}><Power className="h-4 w-4" aria-hidden="true" /> เปิดใช้</Button>
                </RowActions>
              ) : undefined}
            />
          </>
        )
      ) : tab === "map" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <ShelterCenterMap eocType={currentEvent?.type || readQuery("eoc") || "flood"} sessionId={currentEvent?.sessionId || null} />
        </div>
      ) : (
        <>
          <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="ค้นหาชื่อศูนย์ ตำบล อำเภอ">
            <FilterSelect label="ตัวกรอง" value={registryFilter} onChange={setRegistryFilter} options={[
              { value: "all", label: "ทุกศูนย์" }, { value: "active", label: "ใช้งานได้" }, { value: "inactive", label: "ปิดใช้งาน" },
              ...SHELTER_EOC_TYPES.map((item) => ({ value: item.value, label: `สำหรับ${item.label}` }))
            ]} />
            <FilterSelect label="อำเภอ" value={district} onChange={setDistrict} options={districtOptions} />
          </Toolbar>
          <DataTable
            caption="ทะเบียนศูนย์พักพิง"
            loading={loading}
            rows={registryRows}
            emptyText="ไม่พบศูนย์พักพิงตามเงื่อนไข"
            rowClassName={(row) => (Number(row.is_active) === 1 ? "" : "opacity-60")}
            columns={[
              { key: "sheltername", label: "ศูนย์พักพิง", render: (row) => (<div><div className="font-semibold text-slate-900">{row.sheltername}</div><div className="text-xs text-slate-500">{area(row)}</div></div>) },
              { key: "shelter_type", label: "ประเภทศูนย์", render: (row) => <ShelterTypeChip row={row} /> },
              { key: "eoc_type", label: "ใช้สำหรับ", render: (row) => typeLabel(row.eoc_type) },
              { key: "shelter_capacity", label: "ความจุ", render: (row) => `${formatNumber(row.shelter_capacity)} คน` },
              { key: "contact_phone", label: "ติดต่อ", render: (row) => row.contact_phone || row.coordinator_phone || "-" },
              { key: "is_active", label: "สถานะ", render: (row) => Number(row.is_active) === 1 ? <StatusPill tone="green">ใช้งานได้</StatusPill> : <StatusPill>ปิดใช้งาน</StatusPill> },
              { key: "updated_at", label: "แก้ไขล่าสุด", render: (row) => <UpdatedAt value={row.updated_at} staleHours={24 * 180} />, mobile: false }
            ]}
            rowActions={canEdit ? (row) => (
              <RowActions itemName={row.sheltername} onEdit={() => openForm(row)} onDelete={isAdmin ? () => { setDeleteError(""); setDeleting(row); } : undefined}>
                <IconButton icon={Number(row.is_active) === 1 ? PowerOff : Power} label={`${Number(row.is_active) === 1 ? "ปิดใช้งาน" : "เปิดใช้งาน"} ${row.sheltername}`} onClick={() => toggleRegistryActive(row)} />
              </RowActions>
            ) : undefined}
          />
        </>
      )}

      {/* อัปเดตยอดผู้พักพิง */}
      <FormDialog
        open={Boolean(occupancyRow)}
        onOpenChange={(open) => !open && setOccupancyRow(null)}
        title="อัปเดตยอดผู้พักพิง"
        description={occupancyRow ? `${occupancyRow.sheltername} • ความจุ ${formatNumber(occupancyRow.shelter_capacity)} คน` : ""}
        onSubmit={saveOccupancy}
        busy={busy}
        error={formError}
        size="sm"
      >
        <FormGrid className="sm:grid-cols-1">
          <Field label="จำนวนผู้พักพิงขณะนี้ (คน)" required>
            <input type="number" min={0} step={1} className={`${inputClass} text-lg font-bold`} autoFocus value={occupancyForm.current_occupancy}
              onChange={(event) => setOccupancyForm((current) => ({ ...current, current_occupancy: event.target.value }))} />
          </Field>
          <Field label="หมายเหตุ" hint="เช่น ต้องการน้ำดื่มเพิ่ม / มีผู้ป่วยติดเตียง 2 ราย">
            <textarea rows={3} className={inputClass} value={occupancyForm.notes} onChange={(event) => setOccupancyForm((current) => ({ ...current, notes: event.target.value }))} />
          </Field>
        </FormGrid>
      </FormDialog>

      {/* เปิด/ปิดใช้ศูนย์ในเหตุการณ์ */}
      <AppDialog
        open={Boolean(toggleRow)}
        onOpenChange={(open) => !open && setToggleRow(null)}
        title={toggleRow && Number(toggleRow.is_activated_for_session) === 1 ? "ปิดใช้ศูนย์ในเหตุการณ์นี้" : "เปิดใช้ศูนย์ในเหตุการณ์นี้"}
        size="sm"
        busy={busy}
        footer={(
          <AppDialogActions>
            <AppDialogCancel disabled={busy} />
            <Button onClick={confirmToggle} disabled={busy}>{busy ? "กำลังบันทึก…" : "ยืนยัน"}</Button>
          </AppDialogActions>
        )}
      >
        <p className="text-sm text-slate-700">
          {toggleRow && Number(toggleRow.is_activated_for_session) === 1
            ? <>ปิดใช้ <strong>{toggleRow?.sheltername}</strong> ศูนย์จะไม่แสดงเป็นศูนย์ที่เปิดรับบนหน้าเว็บประชาชน (ประวัติยอดผู้พักพิงยังอยู่)</>
            : <>เปิดใช้ <strong>{toggleRow?.sheltername}</strong> ใน{currentEvent?.label} ศูนย์จะแสดงบนหน้าเว็บประชาชนทันที</>}
        </p>
      </AppDialog>

      {/* เปิด/ปิดทุกศูนย์ */}
      <AppDialog
        open={Boolean(bulkAction)}
        onOpenChange={(open) => !open && !busy && setBulkAction(null)}
        title={bulkAction === "close_all" ? "ปิดศูนย์พักพิงทั้งหมด?" : "เปิดศูนย์พักพิงทั้งหมด?"}
        size="sm"
        busy={busy}
        footer={(
          <AppDialogActions>
            <AppDialogCancel disabled={busy} />
            <Button variant={bulkAction === "close_all" ? "danger" : "primary"} onClick={confirmBulk} disabled={busy}>{busy ? "กำลังบันทึก…" : bulkAction === "close_all" ? "ปิดทั้งหมด" : "เปิดทั้งหมด"}</Button>
          </AppDialogActions>
        )}
      >
        <p className="text-sm text-slate-700">
          {bulkAction === "close_all"
            ? <>ปิดใช้ศูนย์ที่เปิดอยู่ทั้ง <strong>{sessionStats.count} ศูนย์</strong> ใน{currentEvent?.label} ศูนย์จะหายจากหน้าเว็บประชาชนทันที (ยอดผู้พักพิงที่บันทึกไว้ยังอยู่ในประวัติ)</>
            : <>เปิดใช้ศูนย์ในทะเบียนที่ยังไม่เปิดอีก <strong>{usableShelters.length - sessionStats.count} ศูนย์</strong> ใน{currentEvent?.label} รวมเป็น {usableShelters.length} ศูนย์ ทุกศูนย์จะแสดงบนหน้าเว็บประชาชนทันที</>}
        </p>
      </AppDialog>

      {/* เพิ่ม/แก้ไขทะเบียน */}
      <FormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.id ? "แก้ไขศูนย์พักพิง" : "เพิ่มศูนย์พักพิง"}
        onSubmit={saveShelter}
        busy={busy}
        error={formError}
      >
        <FormGrid>
          <Field label="ชื่อศูนย์พักพิง" required wide>
            <input className={inputClass} value={form.sheltername} onChange={(event) => updateForm({ sheltername: event.target.value })} placeholder="เช่น โรงเรียนบ้านควน" />
          </Field>
          <Field label="ใช้สำหรับภัย" required>
            <select className={inputClass} value={form.eoc_type} onChange={(event) => updateForm({ eoc_type: event.target.value })}>
              {SHELTER_EOC_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="ความจุ (คน)" required>
            <input type="number" min={1} className={inputClass} value={form.shelter_capacity} onChange={(event) => updateForm({ shelter_capacity: event.target.value })} />
          </Field>
          <Field label="ประเภทศูนย์" hint="ใช้แนะนำศูนย์ที่เหมาะกับกลุ่มเปราะบางตอนเคลื่อนย้าย">
            <select className={inputClass} value={form.shelter_type || "general"} onChange={(event) => updateForm({ shelter_type: event.target.value })}>
              {SHELTER_TYPES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-sm font-semibold text-slate-800">ความพร้อมของศูนย์</legend>
            <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2">
              {SHELTER_CAPABILITIES.map((item) => {
                const caps = parseCapabilities(form.capabilities);
                const checked = caps.includes(item.key);
                return (
                  <label key={item.key} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" className="h-4 w-4" checked={checked}
                      onChange={() => updateForm({ capabilities: (checked ? caps.filter((key) => key !== item.key) : [...caps, item.key]).join(",") })} />
                    {item.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <AreaFields value={form} onChange={updateForm} names={{ district: "district_name", tambon: "tambon", village: "village" }} />
          <Field label="เบอร์ติดต่อ">
            <input className={inputClass} inputMode="tel" value={form.contact_phone || ""} onChange={(event) => updateForm({ contact_phone: event.target.value })} placeholder="0xx-xxx-xxxx" />
          </Field>
          <Field label="ที่อยู่" wide>
            <textarea rows={2} className={inputClass} value={form.address || ""} onChange={(event) => updateForm({ address: event.target.value })} />
          </Field>
          <LocationPicker lat={form.lat} lon={form.lon} onChange={updateForm} />
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 sm:col-span-2">
            <input type="checkbox" className="h-4 w-4" checked={Number(form.is_active) === 1} onChange={(event) => updateForm({ is_active: event.target.checked ? 1 : 0 })} />
            ใช้งานได้ (เลือกเปิดใช้ในเหตุการณ์ได้)
          </label>
        </FormGrid>
      </FormDialog>

      <DeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        itemType="ศูนย์พักพิง"
        itemLabel={deleting?.sheltername}
        onConfirm={confirmDelete}
        busy={busy}
        error={deleteError}
        note="ศูนย์ที่เคยเปิดใช้ในเหตุการณ์จะลบไม่ได้ (ใช้ปิดใช้งานแทน) ส่วนศูนย์ที่ไม่มีประวัติจะย้ายไปถังขยะ กู้คืนได้"
      />
      {notice}
    </AdminPage>
  );
}
