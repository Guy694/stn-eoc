"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, AlertCircle, ChevronRight, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { useAuth } from "@/context/AuthContext";

const MODULES = [
    { value: "flood", label: "อุทกภัย" },
    { value: "disease", label: "โรคระบาด" },
    { value: "festival-accidents", label: "อุบัติเหตุช่วงเทศกาล" }
];

const COLOR_STYLES = {
    red: "border-red-200 bg-red-50 text-red-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    orange: "border-orange-200 bg-orange-50 text-orange-800",
    teal: "border-teal-200 bg-teal-50 text-teal-800",
    purple: "border-violet-200 bg-violet-50 text-violet-800",
    pink: "border-pink-200 bg-pink-50 text-pink-800"
};

function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function StaffEocOverviewPage() {
    const { user, loading: authLoading } = useAuth();
    const [moduleType, setModuleType] = useState("flood");
    const [sessions, setSessions] = useState([]);
    const [selectedSessionId, setSelectedSessionId] = useState("");
    const [session, setSession] = useState(null);
    const [teams, setTeams] = useState([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadSessions = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(`/stn-eoc/api/eoc/sessions?type=${moduleType}&limit=100`);
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || "ไม่สามารถโหลด EOC Session ได้");
            const rows = Array.isArray(result.data) ? result.data : [];
            setSessions(rows);
            const defaultSession = rows.find((item) => item.status === "active") || rows[0];
            setSelectedSessionId(defaultSession ? String(defaultSession.id) : "");
            if (!defaultSession) {
                setSession(null);
                setTeams([]);
            }
        } catch (loadError) {
            setError(loadError.message || "ไม่สามารถโหลด EOC Session ได้");
            setSessions([]);
            setSession(null);
            setTeams([]);
        } finally {
            setLoading(false);
        }
    }, [moduleType]);

    const loadTeams = useCallback(async () => {
        if (!selectedSessionId) return;
        setLoading(true);
        setError("");
        try {
            const response = await fetch(`/stn-eoc/api/eoc/sessions/${selectedSessionId}/teams`);
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || "ไม่สามารถโหลดกลุ่มภารกิจได้");
            setSession(result.session || null);
            setTeams(Array.isArray(result.teams) ? result.teams : []);
        } catch (loadError) {
            setError(loadError.message || "ไม่สามารถโหลดกลุ่มภารกิจได้");
            setSession(null);
            setTeams([]);
        } finally {
            setLoading(false);
        }
    }, [selectedSessionId]);

    useEffect(() => {
        if (!authLoading && user) loadSessions();
    }, [authLoading, loadSessions, user]);

    useEffect(() => {
        if (selectedSessionId) loadTeams();
    }, [loadTeams, selectedSessionId]);

    const visibleTeams = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return teams;
        return teams.filter((team) => `${team.team_code} ${team.team_name_th} ${team.team_name_en}`.toLowerCase().includes(normalized));
    }, [query, teams]);

    const activeModule = MODULES.find((item) => item.value === moduleType);
    const isClosed = session?.status === "closed";

    return (
        <EOCLayout>
            <section className="mx-auto max-w-7xl space-y-5">
                <header className="border-b-4 border-cyan-600 bg-white px-5 py-6 shadow-sm">
                    <p className="text-sm font-bold text-cyan-700">STAFF WORKSPACE</p>
                    <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">ศูนย์ปฏิบัติงานเจ้าหน้าที่ EOC</h1>
                            <p className="mt-1 text-sm text-slate-600">เลือก EOC และกลุ่มภารกิจที่ได้รับมอบหมายเพื่อดู Dashboard และรายงานผล</p>
                        </div>
                        <button type="button" onClick={loadSessions} className="inline-flex h-10 items-center gap-2 border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                            <RefreshCw className="h-4 w-4" /> รีเฟรช
                        </button>
                    </div>
                </header>

                <div className="grid gap-3 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <label className="grid gap-1 text-sm font-bold text-slate-700">โมดูล EOC
                        <select value={moduleType} onChange={(event) => setModuleType(event.target.value)} className="h-11 border border-slate-300 bg-white px-3 font-medium">
                            {MODULES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                    </label>
                    <label className="grid gap-1 text-sm font-bold text-slate-700">EOC Session
                        <select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)} disabled={!sessions.length} className="h-11 border border-slate-300 bg-white px-3 font-medium disabled:bg-slate-100">
                            {!sessions.length && <option value="">ไม่พบ Session</option>}
                            {sessions.map((item) => <option key={item.id} value={item.id}>#{item.session_number || item.id} · {item.status === "active" ? "เปิดอยู่" : "ปิดแล้ว"} · {formatDate(item.opened_at)}</option>)}
                        </select>
                    </label>
                    <div className="flex items-end"><div className={`w-full border px-3 py-3 text-sm font-bold ${isClosed ? "border-slate-300 bg-slate-100 text-slate-600" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{isClosed ? "อ่านอย่างเดียว" : "เปิดรับรายงาน"}</div></div>
                </div>

                {error && <div className="flex items-center gap-2 border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800"><AlertCircle className="h-5 w-5" />{error}</div>}

                {!loading && session && <div className="grid gap-3 md:grid-cols-3">
                    <Metric label="กลุ่มภารกิจที่เข้าถึงได้" value={teams.length} icon={<Users className="h-5 w-5" />} />
                    <Metric label="สมาชิกในกลุ่มทั้งหมด" value={teams.reduce((sum, team) => sum + Number(team.member_count || 0), 0)} icon={<ShieldCheck className="h-5 w-5" />} />
                    <Metric label="โมดูลที่เลือก" value={activeModule?.label || "-"} icon={<Activity className="h-5 w-5" />} text />
                </div>}

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h2 className="text-lg font-black text-slate-900">กลุ่มภารกิจที่เปิดใช้งาน</h2><p className="text-sm text-slate-600">แสดงตามสิทธิ์และการเป็นสมาชิกใน EOC Session นี้</p></div>
                    <label className="relative block"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหากลุ่มภารกิจ" className="h-10 border border-slate-300 pl-9 pr-3 text-sm" /></label>
                </div>

                {loading ? <div className="bg-white p-10 text-center text-sm text-slate-500">กำลังโหลดข้อมูล...</div> : !session ? <div className="bg-white p-10 text-center text-sm text-slate-500">เลือก EOC Session เพื่อเริ่มทำงาน</div> : !visibleTeams.length ? <div className="bg-white p-10 text-center text-sm text-slate-500">ยังไม่มีกลุ่มภารกิจที่คุณเข้าถึงได้ใน Session นี้</div> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleTeams.map((team) => <Link key={team.session_team_id} href={`/eoc/staff/${session.id}/teams/${team.session_team_id}`} className={`group border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${COLOR_STYLES[team.color] || "border-slate-200 bg-white text-slate-800"}`}>
                        <div className="flex items-start justify-between gap-3"><span className="text-2xl">{team.icon || "ทีม"}</span><ChevronRight className="h-5 w-5 transition group-hover:translate-x-1" /></div>
                        <p className="mt-4 text-xs font-black">{team.team_code}</p><h3 className="mt-1 text-base font-black">{team.team_name_th}</h3>
                        <p className="mt-3 text-sm">หัวหน้าทีม: {team.team_lead_name || "ยังไม่กำหนด"}</p><p className="mt-1 text-sm">สมาชิก {team.member_count || 0} คน</p>
                        <div className="mt-4 border-t border-current/20 pt-3 text-xs font-bold">Dashboard · รายงานผล · ประวัติ</div>
                    </Link>)}
                </div>}
            </section>
        </EOCLayout>
    );
}

function Metric({ label, value, icon, text = false }) {
    return <div className="flex items-center gap-3 bg-white p-4 shadow-sm"><span className="grid h-10 w-10 place-items-center bg-cyan-50 text-cyan-700">{icon}</span><div><p className="text-xs font-bold text-slate-500">{label}</p><p className={text ? "mt-1 text-base font-black text-slate-900" : "mt-1 text-2xl font-black text-slate-900"}>{value}</p></div></div>;
}
