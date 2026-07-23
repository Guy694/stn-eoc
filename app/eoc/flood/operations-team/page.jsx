"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    AlertCircle,
    Crown,
    Network,
    Pencil,
    Plus,
    RefreshCw,
    Save,
    ShieldCheck,
    Trash2,
    UserCheck,
    Users,
    X
} from "lucide-react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { useAuth } from "@/context/AuthContext";
import AppIcon from "@/components/icons/AppIcon";
import { showError, showSuccess } from "@/lib/sweetAlert";

const COMMAND_ROLES = {
    incident_commander: "ผู้บัญชาการเหตุการณ์",
    deputy_incident_commander: "รองผู้บัญชาการเหตุการณ์"
};

const emptyCommanderForm = {
    id: "",
    officer_id: "",
    command_role: "deputy_incident_commander",
    sort_order: 0,
    notes: ""
};

const emptyTeamForm = {
    teamId: "",
    sessionTeamId: "",
    teamLeadOfficerId: "",
    notes: ""
};

function personName(person) {
    const parts = [person?.title, person?.given_name, person?.family_name].filter(Boolean);
    return parts.join(" ").trim() || person?.full_name?.trim() || person?.username || "ไม่ระบุชื่อ";
}

function memberName(member) {
    const parts = [member.given_name, member.family_name].filter(Boolean);
    return parts.join(" ").trim() || member.full_name || member.username || "ไม่ระบุชื่อ";
}

function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("th-TH", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function sessionLabel(session) {
    if (!session) return "";
    const status = session.status === "active" ? "เปิดอยู่" : "ปิดแล้ว";
    return `เหตุการณ์ที่ ${session.session_number || session.id} (${status}) - ${formatDateTime(session.opened_at)}`;
}

function roleLabel(role) {
    return COMMAND_ROLES[role] || role || "-";
}

export default function FloodOperationsTeamPage() {
    const { user } = useAuth();
    const [sessions, setSessions] = useState([]);
    const [selectedSessionId, setSelectedSessionId] = useState("");
    const [sessionDetail, setSessionDetail] = useState(null);
    const [teams, setTeams] = useState([]);
    const [availableTeams, setAvailableTeams] = useState([]);
    const [commanders, setCommanders] = useState([]);
    const [officerOptions, setOfficerOptions] = useState([]);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [loadingTeams, setLoadingTeams] = useState(false);
    const [loadingCommanders, setLoadingCommanders] = useState(false);
    const [savingCommander, setSavingCommander] = useState(false);
    const [error, setError] = useState("");
    const [commanderMessage, setCommanderMessage] = useState("");
    const [showCommanderModal, setShowCommanderModal] = useState(false);
    const [editingCommander, setEditingCommander] = useState(null);
    const [commanderForm, setCommanderForm] = useState(emptyCommanderForm);
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [editingTeam, setEditingTeam] = useState(null);
    const [teamForm, setTeamForm] = useState(emptyTeamForm);
    const [savingTeam, setSavingTeam] = useState(false);

    const canManageCommanders = user?.role === "admin" || user?.role === "commander";
    const selectedSession = useMemo(
        () => sessions.find((session) => String(session.id) === String(selectedSessionId)) || null,
        [selectedSessionId, sessions]
    );
    const incidentCommander = commanders.find((item) => item.command_role === "incident_commander") || null;
    const deputyCommanders = commanders.filter((item) => item.command_role === "deputy_incident_commander");
    const totalMembers = teams.reduce((sum, team) => sum + Number(team.member_count || team.members?.length || 0), 0);
    const unassignedTeams = useMemo(() => {
        const assignedIds = new Set(teams.map((team) => Number(team.team_id)));
        return availableTeams.filter((team) => !assignedIds.has(Number(team.id)));
    }, [availableTeams, teams]);

    const loadSessions = useCallback(async () => {
        setLoadingSessions(true);
        setError("");
        try {
            const response = await fetch("/stn-eoc/api/eoc/sessions?type=flood&limit=100");
            const result = await response.json();
            if (!result.success) {
                setError(result.message || "โหลดข้อมูลเหตุการณ์ไม่สำเร็จ");
                setSessions([]);
                return;
            }

            const rows = Array.isArray(result.data) ? result.data : [];
            setSessions(rows);
            const defaultSession = rows.find((item) => item.status === "active") || rows[0];
            setSelectedSessionId((current) => current || (defaultSession ? String(defaultSession.id) : ""));
        } catch (fetchError) {
            console.error("Error loading flood sessions:", fetchError);
            setError("เกิดข้อผิดพลาดในการโหลดข้อมูลเหตุการณ์ EOC");
            setSessions([]);
        } finally {
            setLoadingSessions(false);
        }
    }, []);

    const loadTeams = useCallback(async (sessionId) => {
        if (!sessionId) {
            setSessionDetail(null);
            setTeams([]);
            return;
        }

        setLoadingTeams(true);
        setError("");
        try {
            const response = await fetch(`/stn-eoc/api/eoc/sessions/${sessionId}/teams`);
            const result = await response.json();
            if (result.success) {
                setSessionDetail(result.session || null);
                setTeams(Array.isArray(result.teams) ? result.teams : []);
            } else {
                setError(result.message || "โหลดข้อมูลทีมไม่สำเร็จ");
                setSessionDetail(null);
                setTeams([]);
            }
        } catch (fetchError) {
            console.error("Error loading session teams:", fetchError);
            setError("เกิดข้อผิดพลาดในการโหลดข้อมูลทีมปฏิบัติการ");
            setSessionDetail(null);
            setTeams([]);
        } finally {
            setLoadingTeams(false);
        }
    }, []);

    const loadCommanders = useCallback(async (sessionId) => {
        if (!sessionId) {
            setCommanders([]);
            setOfficerOptions([]);
            return;
        }

        setLoadingCommanders(true);
        setCommanderMessage("");
        try {
            const response = await fetch(`/stn-eoc/api/eoc/sessions/${sessionId}/commanders`);
            const result = await response.json();
            if (result.success) {
                setCommanders(Array.isArray(result.commanders) ? result.commanders : []);
                setOfficerOptions(Array.isArray(result.officerOptions) ? result.officerOptions : []);
            } else {
                setCommanderMessage(result.message || "โหลดข้อมูลผู้บัญชาการเหตุการณ์ไม่สำเร็จ");
                setCommanders([]);
                setOfficerOptions([]);
            }
        } catch (fetchError) {
            console.error("Error loading session commanders:", fetchError);
            setCommanderMessage("เกิดข้อผิดพลาดในการโหลดข้อมูลผู้บัญชาการเหตุการณ์");
            setCommanders([]);
            setOfficerOptions([]);
        } finally {
            setLoadingCommanders(false);
        }
    }, []);

    const loadAvailableTeams = useCallback(async () => {
        try {
            const response = await fetch("/stn-eoc/api/admin/eoc-teams?active=true");
            const result = await response.json();
            if (result.success) {
                setAvailableTeams(Array.isArray(result.teams) ? result.teams : []);
            } else {
                setAvailableTeams([]);
            }
        } catch (fetchError) {
            console.error("Error loading available teams:", fetchError);
            setAvailableTeams([]);
        }
    }, []);

    const refreshAll = useCallback(() => {
        loadSessions();
        loadAvailableTeams();
        if (selectedSessionId) {
            loadTeams(selectedSessionId);
            loadCommanders(selectedSessionId);
        }
    }, [loadAvailableTeams, loadCommanders, loadSessions, loadTeams, selectedSessionId]);

    useEffect(() => {
        loadSessions();
        loadAvailableTeams();
    }, [loadAvailableTeams, loadSessions]);

    useEffect(() => {
        loadTeams(selectedSessionId);
        loadCommanders(selectedSessionId);
    }, [loadCommanders, loadTeams, selectedSessionId]);

    const openCreateCommander = (commandRole = "deputy_incident_commander") => {
        setEditingCommander(null);
        setCommanderForm({
            ...emptyCommanderForm,
            command_role: commandRole,
            sort_order: commandRole === "incident_commander" ? 0 : deputyCommanders.length + 1
        });
        setCommanderMessage("");
        setShowCommanderModal(true);
    };

    const openEditCommander = (commander) => {
        setEditingCommander(commander);
        setCommanderForm({
            id: commander.id,
            officer_id: commander.officer_id,
            command_role: commander.command_role,
            sort_order: commander.sort_order || 0,
            notes: commander.notes || ""
        });
        setCommanderMessage("");
        setShowCommanderModal(true);
    };

    const closeCommanderModal = () => {
        setShowCommanderModal(false);
        setEditingCommander(null);
        setCommanderForm(emptyCommanderForm);
    };

    const saveCommander = async (event) => {
        event.preventDefault();
        if (!selectedSessionId) return;

        setSavingCommander(true);
        setCommanderMessage("");
        try {
            const response = await fetch(`/stn-eoc/api/eoc/sessions/${selectedSessionId}/commanders`, {
                method: editingCommander ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(commanderForm)
            });
            const result = await response.json();
            if (result.success) {
                closeCommanderModal();
                showSuccess(editingCommander ? "แก้ไขผู้บัญชาการแล้ว" : "เพิ่มผู้บัญชาการแล้ว");
                await loadCommanders(selectedSessionId);
            } else {
                showError(result.message || "บันทึกข้อมูลไม่สำเร็จ");
            }
        } catch (saveError) {
            console.error("Error saving commander:", saveError);
            showError("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        } finally {
            setSavingCommander(false);
        }
    };

    const deleteCommander = async (commander) => {
        if (!selectedSessionId) return;
        const confirmed = window.confirm(`ลบ ${roleLabel(commander.command_role)}: ${personName(commander)} ใช่หรือไม่?`);
        if (!confirmed) return;

        setCommanderMessage("");
        try {
            const response = await fetch(`/stn-eoc/api/eoc/sessions/${selectedSessionId}/commanders?id=${commander.id}`, {
                method: "DELETE"
            });
            const result = await response.json();
            if (result.success) {
                showSuccess("ลบผู้บัญชาการแล้ว");
                await loadCommanders(selectedSessionId);
            } else {
                showError(result.message || "ลบข้อมูลไม่สำเร็จ");
            }
        } catch (deleteError) {
            console.error("Error deleting commander:", deleteError);
            showError("เกิดข้อผิดพลาดในการลบข้อมูล");
        }
    };

    const openAddTeam = () => {
        setEditingTeam(null);
        setTeamForm(emptyTeamForm);
        setShowTeamModal(true);
    };

    const openEditTeam = (team) => {
        setEditingTeam(team);
        setTeamForm({
            teamId: team.team_id || "",
            sessionTeamId: team.session_team_id || "",
            teamLeadOfficerId: team.team_lead_officer_id || "",
            notes: team.notes || ""
        });
        setShowTeamModal(true);
    };

    const closeTeamModal = () => {
        setShowTeamModal(false);
        setEditingTeam(null);
        setTeamForm(emptyTeamForm);
    };

    const saveTeam = async (event) => {
        event.preventDefault();
        if (!selectedSessionId) return;

        setSavingTeam(true);
        try {
            const response = await fetch(`/stn-eoc/api/admin/eoc-sessions/${selectedSessionId}/teams`, {
                method: editingTeam ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingTeam
                    ? {
                        sessionTeamId: teamForm.sessionTeamId,
                        teamLeadOfficerId: teamForm.teamLeadOfficerId || null,
                        notes: teamForm.notes || ""
                    }
                    : {
                        teamId: teamForm.teamId,
                        teamLeadOfficerId: teamForm.teamLeadOfficerId || null,
                        notes: teamForm.notes || ""
                    })
            });
            const result = await response.json();
            if (result.success) {
                closeTeamModal();
                showSuccess(editingTeam ? "แก้ไขทีมแล้ว" : "เพิ่มทีมใน Session แล้ว");
                await loadTeams(selectedSessionId);
                await loadAvailableTeams();
            } else {
                showError(result.message || "บันทึกทีมไม่สำเร็จ");
            }
        } catch (saveError) {
            console.error("Error saving session team:", saveError);
            showError("เกิดข้อผิดพลาดในการบันทึกทีม");
        } finally {
            setSavingTeam(false);
        }
    };

    const deleteTeam = async (team) => {
        if (!selectedSessionId) return;
        const confirmed = window.confirm(`ถอดทีม "${team.team_name_th || team.team_name_en}" ออกจากเหตุการณ์นี้ใช่หรือไม่?`);
        if (!confirmed) return;

        try {
            const response = await fetch(`/stn-eoc/api/admin/eoc-sessions/${selectedSessionId}/teams?teamId=${team.team_id}`, {
                method: "DELETE"
            });
            const result = await response.json();
            if (result.success) {
                showSuccess("ถอดทีมออกจาก Session แล้ว");
                await loadTeams(selectedSessionId);
                await loadAvailableTeams();
            } else {
                showError(result.message || "ลบทีมไม่สำเร็จ");
            }
        } catch (deleteError) {
            console.error("Error deleting session team:", deleteError);
            showError("เกิดข้อผิดพลาดในการลบทีม");
        }
    };

    return (
        <EOCLayout>
            <div className="mx-auto max-w-[1500px] space-y-5">
                <section className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
                        <div>
                            <div className="flex items-center gap-2 text-sm font-black text-blue-700">
                                <Network className="h-4 w-4" />
                                EOC อุทกภัยน้ำท่วม
                            </div>
                            <h1 className="mt-2 text-2xl font-black text-slate-900 md:text-3xl">ทีมปฏิบัติการ</h1>
                            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                                ผังบทบาทของทีมปฏิบัติการในแต่ละเหตุการณ์ EOC โดยให้ผู้บัญชาการเหตุการณ์และรองผู้บัญชาการเหตุการณ์เป็นหัวหน้าของโครงสร้าง ไม่อ้างอิงผู้ดูแลระบบ
                            </p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="block">
                                <span className="mb-1 block text-xs font-bold text-slate-500">เลือกเหตุการณ์ EOC</span>
                                <select
                                    value={selectedSessionId}
                                    onChange={(event) => setSelectedSessionId(event.target.value)}
                                    disabled={loadingSessions || sessions.length === 0}
                                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 disabled:bg-slate-100"
                                >
                                    {sessions.length === 0 && <option value="">ไม่มีเหตุการณ์</option>}
                                    {sessions.map((session) => (
                                        <option key={session.id} value={session.id}>
                                            {sessionLabel(session)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <button
                                type="button"
                                onClick={refreshAll}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-700 hover:bg-blue-100"
                            >
                                <RefreshCw className="h-4 w-4" />
                                รีเฟรชข้อมูล
                            </button>
                        </div>
                    </div>
                </section>

                {error && (
                    <section className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                            <h2 className="font-black">โหลดข้อมูลไม่สำเร็จ</h2>
                            <p className="mt-1 text-sm">{error}</p>
                        </div>
                    </section>
                )}

                {commanderMessage && (
                    <section className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        <p className="text-sm font-semibold">{commanderMessage}</p>
                    </section>
                )}

                <section className="grid gap-3 md:grid-cols-3">
                    <SummaryCard icon={Crown} label="ผู้บัญชาการเหตุการณ์" value={incidentCommander ? personName(incidentCommander) : "ยังไม่กำหนด"} />
                    <SummaryCard icon={ShieldCheck} label="รองผู้บัญชาการเหตุการณ์" value={`${deputyCommanders.length.toLocaleString("th-TH")} คน`} />
                    <SummaryCard icon={Users} label="ทีม / บุคลากร" value={`${teams.length.toLocaleString("th-TH")} ทีม / ${totalMembers.toLocaleString("th-TH")} คน`} />
                </section>

                <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-lg font-black text-slate-900">หัวหน้าผังบัญชาการ</h2>
                            <p className="mt-1 text-sm text-slate-500">เลือกจากเจ้าหน้าที่ที่ไม่ใช่ผู้ดูแลระบบ และผูกกับเหตุการณ์ EOC ที่เลือก</p>
                        </div>
                        {canManageCommanders && selectedSessionId && (
                            <div className="flex flex-wrap gap-2">
                                {!incidentCommander && (
                                    <button
                                        type="button"
                                        onClick={() => openCreateCommander("incident_commander")}
                                        className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
                                    >
                                        <Plus className="h-4 w-4" />
                                        เพิ่มผู้บัญชาการ
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => openCreateCommander("deputy_incident_commander")}
                                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
                                >
                                    <Plus className="h-4 w-4" />
                                    เพิ่มรองผู้บัญชาการ
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-lg font-black text-slate-900">ทีมในเหตุการณ์ EOC</h2>
                            <p className="mt-1 text-sm text-slate-500">เพิ่ม แก้ไขหัวหน้าทีม/หมายเหตุ หรือถอดทีมออกจากเหตุการณ์ที่เลือก</p>
                        </div>
                        {canManageCommanders && selectedSessionId && (
                            <button
                                type="button"
                                onClick={openAddTeam}
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                            >
                                <Plus className="h-4 w-4" />
                                เพิ่มทีม
                            </button>
                        )}
                    </div>
                </section>

                <section className="rounded-xl border border-blue-100 bg-[#f8fbff] p-4 shadow-sm">
                    {loadingSessions || loadingTeams || loadingCommanders ? (
                        <div className="flex min-h-[360px] items-center justify-center rounded-xl bg-white text-slate-500">
                            <div className="text-center">
                                <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                                กำลังโหลดผังทีมปฏิบัติการ...
                            </div>
                        </div>
                    ) : !selectedSessionId ? (
                        <EmptyState title="ยังไม่มี EOC Session อุทกภัยน้ำท่วม" description="เมื่อเปิด EOC แล้ว ระบบจะแสดงผังทีมปฏิบัติการในหน้านี้" />
                    ) : (
                        <OperationsFlow
                            canManage={canManageCommanders}
                            commanders={commanders}
                            incidentCommander={incidentCommander}
                            deputyCommanders={deputyCommanders}
                            onAddCommander={openCreateCommander}
                            onEditCommander={openEditCommander}
                            onDeleteCommander={deleteCommander}
                            onEditTeam={openEditTeam}
                            onDeleteTeam={deleteTeam}
                            session={sessionDetail || selectedSession}
                            teams={teams}
                        />
                    )}
                </section>
            </div>

            {showCommanderModal && (
                <CommanderModal
                    form={commanderForm}
                    setForm={setCommanderForm}
                    editingCommander={editingCommander}
                    incidentCommander={incidentCommander}
                    officerOptions={officerOptions}
                    onClose={closeCommanderModal}
                    onSubmit={saveCommander}
                    saving={savingCommander}
                />
            )}

            {showTeamModal && (
                <TeamModal
                    form={teamForm}
                    setForm={setTeamForm}
                    editingTeam={editingTeam}
                    officerOptions={officerOptions}
                    teamOptions={unassignedTeams}
                    onClose={closeTeamModal}
                    onSubmit={saveTeam}
                    saving={savingTeam}
                />
            )}
        </EOCLayout>
    );
}

function SummaryCard({ icon: Icon, label, value }) {
    return (
        <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-500">{label}</p>
                    <p className="mt-1 truncate text-lg font-black text-slate-900">{value}</p>
                </div>
            </div>
        </div>
    );
}

function EmptyState({ title, description }) {
    return (
        <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-blue-200 bg-white p-8 text-center">
            <div>
                <Users className="mx-auto h-12 w-12 text-blue-300" />
                <h2 className="mt-3 text-xl font-black text-slate-800">{title}</h2>
                <p className="mt-1 text-sm text-slate-500">{description}</p>
                <Link href="/admin/eoc-management" className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
                    ไปหน้าจัดการ EOC
                </Link>
            </div>
        </div>
    );
}

function OperationsFlow({
    canManage,
    incidentCommander,
    deputyCommanders,
    onAddCommander,
    onEditCommander,
    onDeleteCommander,
    onEditTeam,
    onDeleteTeam,
    session,
    teams
}) {
    return (
        <div className="overflow-x-auto pb-2">
            <div className="min-w-[980px]">
                <div className="mx-auto max-w-xl">
                    {incidentCommander ? (
                        <CommanderNode
                            commander={incidentCommander}
                            featured
                            canManage={canManage}
                            onEdit={onEditCommander}
                            onDelete={onDeleteCommander}
                            session={session}
                        />
                    ) : (
                        <MissingCommanderNode canManage={canManage} onAdd={() => onAddCommander("incident_commander")} />
                    )}
                </div>

                <div className="mx-auto h-10 w-px bg-blue-300" />

                <div className="mx-auto max-w-5xl">
                    {deputyCommanders.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4">
                            {deputyCommanders.map((commander) => (
                                <CommanderNode
                                    key={commander.id}
                                    commander={commander}
                                    canManage={canManage}
                                    onEdit={onEditCommander}
                                    onDelete={onDeleteCommander}
                                    session={session}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="mx-auto max-w-lg rounded-xl border border-dashed border-blue-200 bg-white p-4 text-center text-sm text-slate-500">
                            ยังไม่กำหนดรองผู้บัญชาการเหตุการณ์
                            {canManage && (
                                <button
                                    type="button"
                                    onClick={() => onAddCommander("deputy_incident_commander")}
                                    className="ml-3 inline-flex rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                                >
                                    เพิ่มรองผู้บัญชาการ
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="mx-auto h-12 w-px bg-blue-300" />
                <div className="mx-12 h-px bg-blue-300" />

                {teams.length === 0 ? (
                    <div className="mx-auto mt-8 max-w-lg rounded-xl border border-dashed border-blue-200 bg-white p-6 text-center text-slate-500">
                        ยังไม่มีข้อมูลทีมปฏิบัติการใน session นี้
                    </div>
                ) : (
                    <div className="mt-8 grid grid-cols-3 gap-4 xl:grid-cols-4">
                        {teams.map((team) => (
                            <TeamNode
                                key={team.session_team_id}
                                team={team}
                                canManage={canManage}
                                onEdit={onEditTeam}
                                onDelete={onDeleteTeam}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function CommanderNode({ commander, featured = false, canManage, onEdit, onDelete, session }) {
    const label = roleLabel(commander.command_role);
    return (
        <article className={`rounded-2xl border-2 p-5 text-center shadow-lg ${featured ? "border-blue-700 bg-blue-800 text-white" : "border-cyan-200 bg-white text-slate-900"}`}>
            <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ${featured ? "bg-white/15" : "bg-cyan-50 text-cyan-700"}`}>
                {featured ? <Crown className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
            </div>
            <p className={`text-xs font-black uppercase tracking-[0.18em] ${featured ? "text-blue-100" : "text-cyan-700"}`}>
                {featured ? "Incident Commander" : "Deputy Incident Commander"}
            </p>
            <h2 className="mt-2 text-2xl font-black">{personName(commander)}</h2>
            <p className={`mt-1 text-sm ${featured ? "text-blue-100" : "text-slate-500"}`}>
                {commander.position || label}
            </p>
            <p className={`mt-1 text-xs ${featured ? "text-blue-100" : "text-slate-400"}`}>
                {commander.department || session?.eoc_name || "EOC อุทกภัยน้ำท่วม"} {session?.session_number ? `Session #${session.session_number}` : ""}
            </p>
            {commander.notes && (
                <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${featured ? "bg-white/10 text-blue-50" : "bg-slate-50 text-slate-600"}`}>
                    {commander.notes}
                </p>
            )}
            {canManage && (
                <div className="mt-4 flex justify-center gap-2">
                    <button
                        type="button"
                        onClick={() => onEdit(commander)}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold ${featured ? "bg-white/15 text-white hover:bg-white/25" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}
                    >
                        <Pencil className="h-3.5 w-3.5" />
                        แก้ไข
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(commander)}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold ${featured ? "bg-red-500/90 text-white hover:bg-red-500" : "bg-red-50 text-red-700 hover:bg-red-100"}`}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        ลบ
                    </button>
                </div>
            )}
        </article>
    );
}

function MissingCommanderNode({ canManage, onAdd }) {
    return (
        <article className="rounded-2xl border-2 border-dashed border-blue-300 bg-white p-5 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                <Crown className="h-7 w-7" />
            </div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Incident Commander</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">ยังไม่กำหนดผู้บัญชาการเหตุการณ์</h2>
            <p className="mt-1 text-sm text-slate-500">head ของผังต้องเลือกจากเจ้าหน้าที่ ไม่ใช่ admin/ผู้เปิด session</p>
            {canManage && (
                <button
                    type="button"
                    onClick={onAdd}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
                >
                    <Plus className="h-4 w-4" />
                    เพิ่มผู้บัญชาการ
                </button>
            )}
        </article>
    );
}

function TeamNode({ team, canManage, onEdit, onDelete }) {
    const visibleMembers = Array.isArray(team.members) ? team.members : [];
    const leadName = team.team_lead_name?.trim() || "ยังไม่ระบุหัวหน้าทีม";

    return (
        <article className="relative rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="absolute -top-8 left-1/2 h-8 w-px -translate-x-1/2 bg-blue-200" />
            <div className="flex items-start gap-3">
                <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ backgroundColor: team.color || "#dbeafe" }}
                >
                    <AppIcon icon={team.icon || "users"} className="h-8 w-8" />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-black text-blue-700">{team.team_code || "TEAM"}</p>
                    <h3 className="mt-0.5 text-base font-black leading-snug text-slate-900">{team.team_name_th || team.team_name_en || "ทีมปฏิบัติการ"}</h3>
                    {team.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{team.description}</p>}
                </div>
            </div>

            {canManage && (
                <div className="mt-3 flex gap-2">
                    <button
                        type="button"
                        onClick={() => onEdit(team)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                        แก้ไขทีม
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(team)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        ลบทีม
                    </button>
                </div>
            )}

            <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-black text-emerald-700">
                    <UserCheck className="h-4 w-4" />
                    หัวหน้าทีม
                </div>
                <p className="font-black text-slate-900">{leadName}</p>
                {team.team_lead_role && <p className="mt-1 text-xs text-slate-500">{team.team_lead_role}</p>}
            </div>

            <div className="mt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-slate-500">สมาชิกทีม</p>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">
                        {Number(team.member_count || visibleMembers.length || 0).toLocaleString("th-TH")} คน
                    </span>
                </div>
                {visibleMembers.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">ยังไม่มีรายชื่อสมาชิก</p>
                ) : (
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {visibleMembers.map((member) => (
                            <div key={member.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                <p className="truncate text-sm font-bold text-slate-800">{memberName(member)}</p>
                                <p className="mt-0.5 truncate text-xs text-slate-500">{member.role_in_team || member.officer_role || "เจ้าหน้าที่"}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </article>
    );
}

function CommanderModal({
    form,
    setForm,
    editingCommander,
    incidentCommander,
    officerOptions,
    onClose,
    onSubmit,
    saving
}) {
    const incidentRoleDisabled = Boolean(incidentCommander && incidentCommander.id !== editingCommander?.id);

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/50 p-4">
            <form onSubmit={onSubmit} className="w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-black text-slate-900">
                            {editingCommander ? "แก้ไข head ของผัง" : "เพิ่ม head ของผัง"}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">เลือกเจ้าหน้าที่ที่ไม่ใช่ผู้ดูแลระบบ</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-5 space-y-4">
                    <label className="block">
                        <span className="mb-1 block text-sm font-bold text-slate-700">บทบาท</span>
                        <select
                            value={form.command_role}
                            onChange={(event) => setForm((current) => ({ ...current, command_role: event.target.value }))}
                            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
                        >
                            <option value="incident_commander" disabled={incidentRoleDisabled}>
                                ผู้บัญชาการเหตุการณ์
                            </option>
                            <option value="deputy_incident_commander">รองผู้บัญชาการเหตุการณ์</option>
                        </select>
                        {incidentRoleDisabled && (
                            <p className="mt-1 text-xs font-semibold text-amber-700">มีผู้บัญชาการเหตุการณ์อยู่แล้ว ต้องแก้ไขหรือลบรายการเดิมก่อน</p>
                        )}
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-sm font-bold text-slate-700">เจ้าหน้าที่</span>
                        <select
                            value={form.officer_id}
                            onChange={(event) => setForm((current) => ({ ...current, officer_id: event.target.value }))}
                            required
                            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
                        >
                            <option value="">เลือกเจ้าหน้าที่</option>
                            {officerOptions.map((officer) => (
                                <option key={officer.id} value={officer.id}>
                                    {personName(officer)} - {officer.position || officer.role}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-sm font-bold text-slate-700">ลำดับแสดงผล</span>
                        <input
                            type="number"
                            min="0"
                            value={form.sort_order}
                            onChange={(event) => setForm((current) => ({ ...current, sort_order: Number(event.target.value) }))}
                            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-sm font-bold text-slate-700">หมายเหตุ</span>
                        <textarea
                            value={form.notes}
                            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                            rows={3}
                            className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
                            placeholder="เช่น รับผิดชอบภาพรวมการบัญชาการ / เวรช่วงเช้า"
                        />
                    </label>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:bg-blue-300"
                    >
                        <Save className="h-4 w-4" />
                        {saving ? "กำลังบันทึก..." : "บันทึก"}
                    </button>
                </div>
            </form>
        </div>
    );
}

function TeamModal({
    form,
    setForm,
    editingTeam,
    officerOptions,
    teamOptions,
    onClose,
    onSubmit,
    saving
}) {
    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/50 p-4">
            <form onSubmit={onSubmit} className="w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-black text-slate-900">
                            {editingTeam ? "แก้ไขทีมใน Session" : "เพิ่มทีมเข้า Session"}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {editingTeam ? "แก้ไขหัวหน้าทีมและหมายเหตุของทีมที่เลือก" : "เลือกทีมที่ยังไม่ได้ถูกมอบหมายใน Session นี้"}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-5 space-y-4">
                    {editingTeam ? (
                        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                            <p className="text-xs font-bold text-blue-700">ทีมที่แก้ไข</p>
                            <p className="mt-1 font-black text-slate-900">{editingTeam.team_name_th || editingTeam.team_name_en}</p>
                            <p className="text-xs text-slate-500">{editingTeam.team_code}</p>
                        </div>
                    ) : (
                        <label className="block">
                            <span className="mb-1 block text-sm font-bold text-slate-700">ทีม</span>
                            <select
                                value={form.teamId}
                                onChange={(event) => setForm((current) => ({ ...current, teamId: event.target.value }))}
                                required
                                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
                            >
                                <option value="">เลือกทีม</option>
                                {teamOptions.map((team) => (
                                    <option key={team.id} value={team.id}>
                                        {team.team_code ? `${team.team_code} - ` : ""}{team.team_name_th || team.team_name_en}
                                    </option>
                                ))}
                            </select>
                            {teamOptions.length === 0 && (
                                <p className="mt-1 text-xs font-semibold text-amber-700">ทุกทีมถูกเพิ่มใน Session นี้แล้ว</p>
                            )}
                        </label>
                    )}

                    <label className="block">
                        <span className="mb-1 block text-sm font-bold text-slate-700">หัวหน้าทีม</span>
                        <select
                            value={form.teamLeadOfficerId}
                            onChange={(event) => setForm((current) => ({ ...current, teamLeadOfficerId: event.target.value }))}
                            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
                        >
                            <option value="">ยังไม่ระบุหัวหน้าทีม</option>
                            {officerOptions.map((officer) => (
                                <option key={officer.id} value={officer.id}>
                                    {personName(officer)} - {officer.position || officer.role}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-sm font-bold text-slate-700">หมายเหตุ</span>
                        <textarea
                            value={form.notes}
                            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                            rows={3}
                            className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
                            placeholder="เช่น ภารกิจหลัก พื้นที่รับผิดชอบ หรือช่วงเวลาปฏิบัติงาน"
                        />
                    </label>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="submit"
                        disabled={saving || (!editingTeam && teamOptions.length === 0)}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:bg-emerald-300"
                    >
                        <Save className="h-4 w-4" />
                        {saving ? "กำลังบันทึก..." : "บันทึก"}
                    </button>
                </div>
            </form>
        </div>
    );
}
