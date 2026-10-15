"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Pencil, Trash2, UserCheck } from "lucide-react";
import {
  AddButton, AdminPage, Button, DataTable, Field, FilterSelect, FormDialog, FormGrid, FormSection, StatStrip, StatusPill, Toolbar,
  inputClass, useNotice
} from "@/components/admin/crud";
import { apiRequest, formatDateTime } from "@/lib/adminApi";
import { showDeleteConfirm } from "@/lib/sweetAlert";
import { TEAM_ROLE_OPTIONS } from "@/lib/eocRoles";
import { PASSWORD_POLICY_TEXT, validatePassword } from "@/lib/passwordPolicy";
import { TEAM_LEADER_ROLE, TEAM_MEMBER_ROLE, normalizeTeamMemberRole } from "@/lib/teamMemberRoles";

const API = "/stn-eoc/api/admin/officers";
const TITLES = ["นาย", "นาง", "นางสาว", "ดร.", "ผศ.ดร.", "รศ.ดร.", "ศ.ดร."];
const SYSTEM_ROLES = [
  { value: "admin", label: "ผู้ดูแลระบบ", tone: "red" },
  { value: "commander", label: "ผู้บัญชาการเหตุการณ์", tone: "amber" },
  { value: "staff", label: "เจ้าหน้าที่ทั่วไป", tone: "gray" },
  ...TEAM_ROLE_OPTIONS.map((role) => ({ value: role.value, label: role.label, tone: "blue" }))
];
const ROLE_BY_VALUE = new Map(SYSTEM_ROLES.map((role) => [role.value, role]));
const EOC_LABEL = { flood: "อุทกภัย", disease: "โรคติดต่อ" };
const REG_STATUS = { pending: ["รอยืนยัน ThaiD", "amber"], verified: ["ยืนยัน ThaiD แล้ว", "blue"], approved: ["อนุมัติแล้ว", "green"], rejected: ["ปฏิเสธ", "red"] };

const EMPTY_FORM = { username: "", password: "", title: "", given_name: "", family_name: "", email: "", phone: "", role: "staff", department: "", is_approved: 1 };
const fullName = (row) => `${row.title || ""}${row.title ? " " : ""}${row.given_name || ""} ${row.family_name || ""}`.trim();
const roleLabel = (value) => ROLE_BY_VALUE.get(value)?.label || value || "-";
const shortRole = (value) => roleLabel(value).split(" - ")[0];

function RolePill({ role }) {
  const config = ROLE_BY_VALUE.get(role);
  return <StatusPill tone={config?.tone || "gray"}>{shortRole(role)}</StatusPill>;
}

// จัดการเจ้าหน้าที่: บัญชีผู้ใช้ สิทธิ์ระบบ และกลุ่มภารกิจ EOC ที่ได้รับมอบหมาย
export default function OfficerWorkspace() {
  const { notice, success, fail } = useNotice();
  const [officers, setOfficers] = useState([]);
  const [roleStats, setRoleStats] = useState({});
  const [registrations, setRegistrations] = useState({ rows: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [dialog, setDialog] = useState(null); // { officer | null }
  const [form, setForm] = useState(EMPTY_FORM);
  const [teams, setTeams] = useState({ loading: false, loaded: false, error: "", available: [], selected: new Map() });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [list, regs] = await Promise.all([
        apiRequest(API),
        apiRequest("/stn-eoc/api/admin/registrations?limit=8").catch(() => null)
      ]);
      setOfficers(list.data || []);
      setRoleStats(list.stats || {});
      if (regs) setRegistrations({ rows: regs.data || [], stats: regs.stats || {} });
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return officers
      .filter((row) => !roleFilter || row.role === roleFilter)
      .filter((row) => !statusFilter || (statusFilter === "pending" ? Number(row.is_approved) !== 1 : Number(row.is_approved) === 1))
      .filter((row) => !keyword || `${fullName(row)} ${row.username} ${row.email || ""} ${row.phone || ""}`.toLowerCase().includes(keyword));
  }, [officers, search, roleFilter, statusFilter]);

  const pendingCount = officers.filter((row) => Number(row.is_approved) !== 1).length;
  const roleOptions = useMemo(() => [
    { value: "", label: "ทุกสิทธิ์ระบบ" },
    ...SYSTEM_ROLES.filter((role) => roleStats[role.value]).map((role) => ({ value: role.value, label: `${shortRole(role.value)} (${roleStats[role.value]})` }))
  ], [roleStats]);

  /* ---------- ฟอร์ม ---------- */
  const loadTeams = async (officerId) => {
    setTeams({ loading: true, loaded: false, error: "", available: [], selected: new Map() });
    try {
      const data = await apiRequest(`${API}/${officerId || "new"}/team-assignments`);
      const available = data.availableTeams || [];
      const openIds = new Set(available.map((team) => String(team.session_team_id)));
      const selected = new Map(
        (data.assignments || [])
          .filter((item) => openIds.has(String(item.session_team_id)))
          .map((item) => [String(item.session_team_id), normalizeTeamMemberRole(item.role_in_team)])
      );
      setTeams({ loading: false, loaded: true, error: "", available, selected });
    } catch (error) {
      setTeams({ loading: false, loaded: false, error: error.message || "โหลดกลุ่มภารกิจไม่สำเร็จ", available: [], selected: new Map() });
    }
  };

  const openForm = (officer = null) => {
    setFormError("");
    setForm(officer ? {
      username: officer.username || "", password: "", title: officer.title || "", given_name: officer.given_name || "", family_name: officer.family_name || "",
      email: officer.email || "", phone: officer.phone || "", role: officer.role || "staff", department: officer.department || "", is_approved: Number(officer.is_approved) === 1 ? 1 : 0
    } : EMPTY_FORM);
    setDialog({ officer });
    loadTeams(officer?.id);
  };

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleTeam = (id) => setTeams((current) => {
    const selected = new Map(current.selected);
    if (selected.has(id)) selected.delete(id); else selected.set(id, TEAM_MEMBER_ROLE);
    return { ...current, selected };
  });
  const setTeamRole = (id, role) => setTeams((current) => {
    const selected = new Map(current.selected);
    selected.set(id, role);
    return { ...current, selected };
  });

  const submit = async () => {
    const editing = dialog?.officer;
    setFormError("");
    if (form.password || !editing) {
      const problem = validatePassword(form.password, { username: form.username });
      if (problem) { setFormError(problem); return; }
    }
    setBusy(true);
    let officerId = editing?.id;
    try {
      const body = { ...form, username: form.username.trim(), given_name: form.given_name.trim(), family_name: form.family_name.trim(), requested_role: form.role };
      if (editing && !body.password) delete body.password;
      const saved = await apiRequest(editing ? `${API}/${editing.id}` : API, { method: editing ? "PUT" : "POST", body });
      officerId = officerId || saved.data?.id;
    } catch (error) {
      setFormError(error.message || "บันทึกข้อมูลเจ้าหน้าที่ไม่สำเร็จ");
      setBusy(false);
      return;
    }

    // บันทึกกลุ่มภารกิจเฉพาะเมื่อโหลดรายการทีมได้ครบ (กันการล้างทีมเดิมเมื่อโหลดไม่สำเร็จ)
    if (teams.loaded && officerId) {
      try {
        await apiRequest(`${API}/${officerId}/team-assignments`, {
          method: "PUT",
          body: { assignments: [...teams.selected].map(([sessionTeamId, roleInTeam]) => ({ sessionTeamId: Number(sessionTeamId), roleInTeam })) }
        });
      } catch (error) {
        setBusy(false);
        await load();
        if (!editing) setDialog({ officer: { id: officerId, ...form } });
        setFormError(`บันทึกข้อมูลเจ้าหน้าที่แล้ว แต่บันทึกกลุ่มภารกิจไม่สำเร็จ: ${error.message}`);
        return;
      }
    }
    setBusy(false);
    setDialog(null);
    success(editing ? "บันทึกการแก้ไขแล้ว" : "เพิ่มเจ้าหน้าที่แล้ว");
    load();
  };

  /* ---------- อนุมัติ / ลบ ---------- */
  const approve = async (officer) => {
    const role = officer.requested_role || officer.role || "staff";
    try {
      await apiRequest(`${API}/${officer.id}`, { method: "PUT", body: { role, requested_role: role, is_approved: 1 } });
      success(`อนุมัติ ${fullName(officer) || "เจ้าหน้าที่"} แล้ว`);
      load();
    } catch (error) {
      fail(error.message || "อนุมัติไม่สำเร็จ");
    }
  };

  const remove = async (officer) => {
    if (!await showDeleteConfirm(`ลบบัญชี ${fullName(officer)} (${officer.username}) ใช่หรือไม่?`)) return;
    try {
      await apiRequest(`${API}/${officer.id}`, { method: "DELETE" });
      success("ลบบัญชีแล้ว");
      load();
    } catch (error) {
      fail(error.message || "ลบไม่สำเร็จ");
    }
  };

  /* ---------- ตาราง ---------- */
  const columns = [
    { key: "name", label: "เจ้าหน้าที่", render: (row) => (
      <span className="block min-w-0">
        <span className="font-bold text-slate-900">{fullName(row) || "-"}</span>
        <span className="block text-xs text-slate-500">{row.username}</span>
      </span>
    ) },
    { key: "role", label: "สิทธิ์ระบบ", render: (row) => (
      <span className="flex flex-col items-start gap-1">
        <RolePill role={row.role} />
        {row.requested_role && row.requested_role !== row.role ? <span className="text-xs text-amber-700">ขอสิทธิ์ {shortRole(row.requested_role)}</span> : null}
      </span>
    ) },
    { key: "status", label: "สถานะ", render: (row) => (Number(row.is_approved) === 1 ? <StatusPill tone="green">ใช้งานได้</StatusPill> : <StatusPill tone="amber">รออนุมัติ</StatusPill>) },
    { key: "contact", label: "ติดต่อ", render: (row) => (
      <span className="block text-sm text-slate-700">{row.phone || "-"}{row.email ? <span className="block break-all text-xs text-slate-500">{row.email}</span> : null}</span>
    ) },
    { key: "created_at", label: "สร้างเมื่อ", className: "whitespace-nowrap text-slate-600", render: (row) => (row.created_at ? formatDateTime(row.created_at) : "-") }
  ];

  const editing = dialog?.officer;
  const regStats = registrations.stats || {};

  return (
    <AdminPage
      title="จัดการเจ้าหน้าที่"
      description="บัญชีผู้ใช้ สิทธิ์การใช้ระบบ และกลุ่มภารกิจ EOC ที่แต่ละคนได้รับมอบหมายในเหตุการณ์ที่เปิดอยู่"
      actions={<AddButton onClick={() => openForm()}>เพิ่มเจ้าหน้าที่</AddButton>}
    >
      {notice}
      <StatStrip items={[
        { label: "เจ้าหน้าที่ทั้งหมด", value: officers.length.toLocaleString("th-TH") },
        { label: "รออนุมัติ", value: pendingCount.toLocaleString("th-TH"), className: pendingCount ? "text-amber-700" : undefined },
        { label: "ผู้ดูแลระบบ", value: (roleStats.admin || 0).toLocaleString("th-TH") },
        { label: "ลงทะเบียนใหม่รอดำเนินการ", value: (regStats.actionable || 0).toLocaleString("th-TH"), className: regStats.actionable ? "text-amber-700" : undefined }
      ]} />

      {registrations.rows.length ? (
        <section className="overflow-hidden rounded-xl border border-amber-200 bg-white">
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3">
            <h2 className="font-black text-amber-950">ผู้ลงทะเบียนใหม่</h2>
            <p className="text-sm text-amber-800">รอยืนยัน ThaiD {regStats.pending || 0} คน · ยืนยันแล้วรออนุมัติ {regStats.verified || 0} คน</p>
          </header>
          <ul className="divide-y divide-slate-100">
            {registrations.rows.map((reg) => {
              const [statusText, tone] = REG_STATUS[reg.status] || [reg.status, "gray"];
              const canApprove = reg.user_type === "officer" && Number(reg.is_approved) !== 1 && reg.officer_id;
              const requested = reg.requested_role || reg.role || "staff";
              return (
                <li key={reg.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900">{fullName(reg) || "-"}</p>
                    <p className="text-xs text-slate-500">{reg.user_type === "officer" ? "เจ้าหน้าที่" : "ประชาชน"}{reg.username ? ` · ${reg.username}` : ""}{reg.agency ? ` · ${reg.agency}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={tone}>{statusText}</StatusPill>
                    {reg.user_type === "officer" ? <StatusPill tone="gray">ขอสิทธิ์ {shortRole(requested)}</StatusPill> : null}
                    {canApprove ? (
                      <Button className="min-h-9 px-3" onClick={() => approve({ ...reg, id: reg.officer_id, requested_role: requested })}>
                        <UserCheck className="h-4 w-4" aria-hidden="true" />อนุมัติ
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="ค้นหาชื่อ ชื่อผู้ใช้ อีเมล หรือเบอร์โทร">
        <FilterSelect label="สถานะ" value={statusFilter} onChange={setStatusFilter} options={[
          { value: "", label: "ทุกสถานะ" }, { value: "pending", label: "รออนุมัติ" }, { value: "approved", label: "ใช้งานได้" }
        ]} />
        <FilterSelect label="สิทธิ์ระบบ" value={roleFilter} onChange={setRoleFilter} options={roleOptions} className="min-w-[12rem]" />
      </Toolbar>

      {loadError ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{loadError}</p> : null}
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        caption="รายชื่อเจ้าหน้าที่"
        emptyText={officers.length ? "ไม่พบเจ้าหน้าที่ตามเงื่อนไข" : "ยังไม่มีบัญชีเจ้าหน้าที่"}
        rowClassName={(row) => (Number(row.is_approved) !== 1 ? "bg-amber-50/40" : "")}
        rowActions={(row) => (
          <div className="flex flex-wrap justify-end gap-1">
            {Number(row.is_approved) !== 1 ? (
              <Button className="min-h-9 px-2.5" onClick={() => approve(row)}><CheckCircle2 className="h-4 w-4" aria-hidden="true" />อนุมัติ</Button>
            ) : null}
            <Button variant="secondary" className="min-h-9 px-2.5" onClick={() => openForm(row)}><Pencil className="h-4 w-4" aria-hidden="true" />แก้ไข</Button>
            <Button variant="ghost" className="min-h-9 px-2 text-red-700" onClick={() => remove(row)} aria-label={`ลบ ${fullName(row)}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
          </div>
        )}
      />

      <FormDialog
        open={Boolean(dialog)}
        onOpenChange={(open) => { if (!open && !busy) setDialog(null); }}
        title={editing ? `แก้ไข ${fullName(editing) || editing.username || "เจ้าหน้าที่"}` : "เพิ่มเจ้าหน้าที่"}
        description={editing ? `ชื่อผู้ใช้ ${editing.username || form.username}` : "สร้างบัญชีให้เจ้าหน้าที่ แล้วมอบหมายกลุ่มภารกิจได้ทันที"}
        onSubmit={submit}
        busy={busy}
        error={formError}
        submitText={editing ? "บันทึกการแก้ไข" : "เพิ่มเจ้าหน้าที่"}
      >
        <FormGrid>
          <FormSection title="บัญชีเข้าใช้งาน">
            <Field label="ชื่อผู้ใช้" required>
              <input required className={inputClass} value={form.username} autoComplete="off" onChange={(event) => setField("username", event.target.value)} />
            </Field>
            <Field label={editing ? "ตั้งรหัสผ่านใหม่" : "รหัสผ่าน"} required={!editing} hint={editing ? "เว้นว่างถ้าไม่เปลี่ยน ถ้าตั้งใหม่ ผู้ใช้ต้องเปลี่ยนรหัสเมื่อเข้าสู่ระบบครั้งถัดไป" : PASSWORD_POLICY_TEXT}>
              <input type="password" required={!editing} className={inputClass} value={form.password} autoComplete="new-password" onChange={(event) => setField("password", event.target.value)} />
            </Field>
          </FormSection>

          <FormSection title="ข้อมูลส่วนตัว">
            <Field label="คำนำหน้า">
              <select className={inputClass} value={form.title} onChange={(event) => setField("title", event.target.value)}>
                <option value="">ไม่ระบุ</option>
                {TITLES.map((title) => <option key={title} value={title}>{title}</option>)}
                {form.title && !TITLES.includes(form.title) ? <option value={form.title}>{form.title}</option> : null}
              </select>
            </Field>
            <Field label="หน่วยงาน">
              <input className={inputClass} value={form.department} onChange={(event) => setField("department", event.target.value)} placeholder="เช่น สสจ.สตูล" />
            </Field>
            <Field label="ชื่อ" required>
              <input required className={inputClass} value={form.given_name} onChange={(event) => setField("given_name", event.target.value)} />
            </Field>
            <Field label="นามสกุล" required>
              <input required className={inputClass} value={form.family_name} onChange={(event) => setField("family_name", event.target.value)} />
            </Field>
            <Field label="เบอร์โทร">
              <input type="tel" inputMode="tel" className={inputClass} value={form.phone} onChange={(event) => setField("phone", event.target.value)} />
            </Field>
            <Field label="อีเมล">
              <input type="email" className={inputClass} value={form.email} onChange={(event) => setField("email", event.target.value)} />
            </Field>
          </FormSection>

          <FormSection title="สิทธิ์การใช้ระบบ">
            <Field label="สิทธิ์ระบบ" required wide hint="กำหนดว่าเข้าเมนูใดได้ แยกจากกลุ่มภารกิจในเหตุการณ์ด้านล่าง">
              <select required className={inputClass} value={form.role} onChange={(event) => setField("role", event.target.value)}>
                {SYSTEM_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 sm:col-span-2">
              <input type="checkbox" className="h-4 w-4" checked={form.is_approved === 1} onChange={(event) => setField("is_approved", event.target.checked ? 1 : 0)} />
              อนุมัติให้เข้าใช้งานได้
            </label>
          </FormSection>

          <fieldset className="sm:col-span-2">
            <legend className="mb-1 text-sm font-black text-[#0b4c86]">กลุ่มภารกิจ EOC</legend>
            <p className="mb-2 text-xs text-slate-500">เลือกได้หลายกลุ่มจากเหตุการณ์ที่เปิดอยู่ หัวหน้าทีมมีได้ทีมละ 1 คน ถ้าตั้งคนใหม่ คนเดิมจะเป็นสมาชิกทีมแทน</p>
            {teams.loading ? <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">กำลังโหลดกลุ่มภารกิจ…</p>
              : teams.error ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  โหลดกลุ่มภารกิจไม่สำเร็จ ({teams.error}) ระบบจะบันทึกเฉพาะข้อมูลเจ้าหน้าที่ และไม่เปลี่ยนกลุ่มภารกิจเดิม
                  <Button variant="ghost" className="ml-2 min-h-8 px-2" onClick={() => loadTeams(editing?.id)}>ลองอีกครั้ง</Button>
                </p>
              ) : !teams.available.length ? <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">ยังไม่มีเหตุการณ์ EOC ที่เปิดอยู่</p>
              : (
                <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                  {teams.available.map((team) => {
                    const id = String(team.session_team_id);
                    const role = teams.selected.get(id);
                    return (
                      <li key={id} className={`flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center ${role ? "bg-sky-50" : ""}`}>
                        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 text-sm">
                          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={Boolean(role)} onChange={() => toggleTeam(id)} />
                          <span className="min-w-0">
                            <span className="font-bold text-slate-900">{team.team_code}</span> <span className="text-slate-700">{team.team_name_th}</span>
                            <span className="block text-xs text-slate-500">EOC {EOC_LABEL[team.eoc_type] || team.eoc_type} ครั้งที่ {team.session_number}</span>
                          </span>
                        </label>
                        {role ? (
                          <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-slate-300 text-sm" role="radiogroup" aria-label={`บทบาทใน ${team.team_code}`}>
                            {[TEAM_MEMBER_ROLE, TEAM_LEADER_ROLE].map((option) => (
                              <button key={option} type="button" role="radio" aria-checked={role === option} onClick={() => setTeamRole(id, option)}
                                className={`px-3 py-1.5 font-semibold ${role === option ? "bg-[#0b4c86] text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>
                                {option}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            {teams.loaded && teams.selected.size ? <p className="mt-1 text-xs text-slate-600">เลือก {teams.selected.size} กลุ่มภารกิจ</p> : null}
          </fieldset>
        </FormGrid>
      </FormDialog>
    </AdminPage>
  );
}
