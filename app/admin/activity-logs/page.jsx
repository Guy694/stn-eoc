"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Filter, RefreshCw, Search } from "lucide-react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { useAuth } from "@/context/AuthContext";

const PAGE_SIZE = 25;
const ACTION_OPTIONS = ["", "login", "logout", "eoc_activate", "eoc_deactivate", "data_create", "data_update", "data_delete", "profile_update", "password_change", "officer_create", "officer_update", "officer_delete", "other"];
const ACTION_LABELS = {
    data_create: "เพิ่มข้อมูล",
    data_update: "แก้ไขข้อมูล",
    data_delete: "ลบ/ถอดข้อมูล",
    officer_create: "เพิ่มเจ้าหน้าที่",
    officer_update: "แก้ไขเจ้าหน้าที่",
    officer_delete: "ลบเจ้าหน้าที่",
};

function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function TeamAssignmentDetail({ log }) {
    const metadata = log.metadata || {};
    const oldRole = log.old_values?.roleInTeam;
    const newRole = log.new_values?.roleInTeam;
    return <div>
        <p>{log.description || "-"}</p>
        <p className="mt-1 text-xs text-slate-500">
            {metadata.officerUsername ? `บัญชี: ${metadata.officerUsername}` : null}
            {metadata.sessionNumber ? ` · Session #${metadata.sessionNumber}` : null}
        </p>
        {(oldRole || newRole) && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">{oldRole || "ยังไม่ได้เป็นสมาชิก"}</span>
            <span className="text-slate-400">→</span>
            <span className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">{newRole || "ถอดออกจากทีม"}</span>
        </div>}
    </div>;
}

export default function ActivityLogsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filters, setFilters] = useState({ search: "", actionType: "", targetType: "", sessionId: "", dateFrom: "", dateTo: "" });
    const [appliedFilters, setAppliedFilters] = useState(filters);

    useEffect(() => {
        if (!authLoading && (!user || user.role !== "admin")) router.replace("/dashboard");
    }, [authLoading, router, user]);

    const loadLogs = useCallback(async () => {
        if (!user || user.role !== "admin") return;
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) });
            Object.entries(appliedFilters).forEach(([key, value]) => { if (value) params.set(key, value); });
            const response = await fetch(`/stn-eoc/api/activity-logs?${params}`);
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || "ไม่สามารถโหลด Activity Log ได้");
            setLogs(Array.isArray(result.data) ? result.data : []);
            setTotal(Number(result.pagination?.total || 0));
        } catch (loadError) {
            setError(loadError.message || "ไม่สามารถโหลด Activity Log ได้");
            setLogs([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [appliedFilters, page, user]);

    useEffect(() => { loadLogs(); }, [loadLogs]);

    const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
    const applyFilters = (event) => { event.preventDefault(); setPage(1); setAppliedFilters(filters); };
    const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
    const showTeamAssignments = () => {
        const nextFilters = { ...filters, targetType: "eoc_team_member" };
        setFilters(nextFilters);
        setAppliedFilters(nextFilters);
        setPage(1);
    };

    if (authLoading || !user) return <div className="grid min-h-screen place-items-center text-sm text-slate-500">กำลังตรวจสอบสิทธิ์...</div>;
    if (user.role !== "admin") return null;

    return <EOCLayout>
        <section className="mx-auto max-w-7xl space-y-5">
            <header className="border-b-4 border-slate-800 bg-white p-5 shadow-sm"><p className="text-xs font-black text-slate-600">ADMIN ONLY</p><div className="mt-1 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-black text-slate-900">Activity Log</h1><p className="mt-1 text-sm text-slate-600">ตรวจสอบประวัติการเข้าสู่ระบบและการดำเนินงานในระบบ</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={showTeamAssignments} className="inline-flex h-10 items-center border border-cyan-300 bg-cyan-50 px-3 text-sm font-bold text-cyan-900 hover:bg-cyan-100">การมอบหมายทีม</button><button type="button" onClick={loadLogs} className="inline-flex h-10 items-center gap-2 border border-slate-300 px-3 text-sm font-bold hover:bg-slate-50"><RefreshCw className="h-4 w-4" />รีเฟรช</button></div></div></header>

            <form onSubmit={applyFilters} className="grid gap-3 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-7"><label className="relative block xl:col-span-2"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="ค้นหาผู้ใช้ การกระทำ หรือรายละเอียด" className="h-10 w-full border border-slate-300 pl-9 pr-3 text-sm" /></label><select value={filters.actionType} onChange={(event) => updateFilter("actionType", event.target.value)} className="h-10 border border-slate-300 px-3 text-sm"><option value="">ทุกการกระทำ</option>{ACTION_OPTIONS.slice(1).map((action) => <option key={action} value={action}>{ACTION_LABELS[action] || action}</option>)}</select><select value={filters.targetType} onChange={(event) => updateFilter("targetType", event.target.value)} className="h-10 border border-slate-300 px-3 text-sm"><option value="">ทุกประเภทข้อมูล</option><option value="eoc_team_member">การมอบหมายกลุ่มภารกิจ</option><option value="officer">ข้อมูลเจ้าหน้าที่</option></select><input type="number" min="1" value={filters.sessionId} onChange={(event) => updateFilter("sessionId", event.target.value)} placeholder="Session ID" className="h-10 border border-slate-300 px-3 text-sm" /><input type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} className="h-10 border border-slate-300 px-3 text-sm" /><div className="flex gap-2"><input type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} className="min-w-0 flex-1 border border-slate-300 px-3 text-sm" /><button type="submit" className="inline-flex h-10 items-center gap-2 bg-slate-800 px-3 text-sm font-bold text-white hover:bg-slate-700"><Filter className="h-4 w-4" />กรอง</button></div></form>

            {error && <div className="border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{error}</div>}
            <div className="overflow-hidden bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-900 text-xs uppercase tracking-wide text-white"><tr><th className="px-4 py-3">เวลา</th><th className="px-4 py-3">ผู้ใช้งาน</th><th className="px-4 py-3">การกระทำ</th><th className="px-4 py-3">เป้าหมาย</th><th className="px-4 py-3">Session/Team</th><th className="px-4 py-3">รายละเอียด</th><th className="px-4 py-3">IP</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-500">กำลังโหลดข้อมูล...</td></tr> : !logs.length ? <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-500">ไม่พบข้อมูลตามเงื่อนไข</td></tr> : logs.map((log) => <tr key={log.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(log.created_at)}</td><td className="px-4 py-3"><p className="font-bold text-slate-800">{[log.title, log.given_name, log.family_name].filter(Boolean).join("") || log.username || "ระบบ"}</p><p className="text-xs text-slate-500">{log.username || "-"} · {log.user_role || "-"}</p></td><td className="px-4 py-3"><span className="border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-800">{ACTION_LABELS[log.action_type] || log.action_type || "legacy"}</span></td><td className="px-4 py-3 text-slate-600">{log.target_type === "eoc_team_member" ? "สมาชิกกลุ่มภารกิจ" : (log.target_type || "-")}{log.target_id ? ` #${log.target_id}` : ""}</td><td className="px-4 py-3 text-xs">{log.metadata?.sessionNumber ? `Session #${log.metadata.sessionNumber}` : `S: ${log.eoc_session_id || "-"}`}<br/>{log.metadata?.teamCode ? `${log.metadata.teamCode} · T:${log.session_team_id}` : `T: ${log.session_team_id || "-"}`}</td><td className="max-w-md px-4 py-3 text-slate-700">{log.target_type === "eoc_team_member" ? <TeamAssignmentDetail log={log} /> : (log.description || log.details || "-")}{log.change_reason ? <p className="mt-1 text-xs text-amber-700">เหตุผล: {log.change_reason}</p> : null}</td><td className="px-4 py-3 font-mono text-xs text-slate-500">{log.ip_address || "-"}</td></tr>)}</tbody></table></div><footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm"><p className="text-slate-600">แสดง {logs.length ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, total)} จาก {total.toLocaleString()} รายการ</p><div className="flex items-center gap-2"><button type="button" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={page === 1} className="grid h-9 w-9 place-items-center border border-slate-300 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span className="font-bold">{page} / {totalPages}</span><button type="button" onClick={() => setPage((current) => Math.min(current + 1, totalPages))} disabled={page === totalPages} className="grid h-9 w-9 place-items-center border border-slate-300 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></footer></div>
        </section>
    </EOCLayout>;
}
