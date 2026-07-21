"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BarChart3, ClipboardList, History, LayoutDashboard, Lock, Users } from "lucide-react";
import EOCLayout from "@/components/layouts/EOCLayout";

const REPORT_LINKS = {
    SAT: { href: "/eoc/flood/records", label: "บันทึกเหตุการณ์และสถานการณ์" },
    LOGISTICS: { href: "/resources/medical-inventory", label: "คลังเวชภัณฑ์และการเบิกจ่าย" },
    RISKCOM: { href: "/admin/announcements", label: "จัดการข่าวประชาสัมพันธ์" }
};

function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TeamWorkspacePage() {
    const params = useParams();
    const [team, setTeam] = useState(null);
    const [session, setSession] = useState(null);
    const [tab, setTab] = useState("dashboard");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const sessionId = params.sessionId;
    const sessionTeamId = params.sessionTeamId;

    const loadWorkspace = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(`/stn-eoc/api/eoc/sessions/${sessionId}/teams`);
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || "ไม่สามารถโหลดพื้นที่ทำงานทีมได้");
            const selectedTeam = (result.teams || []).find((item) => String(item.session_team_id) === String(sessionTeamId));
            if (!selectedTeam) throw new Error("คุณไม่มีสิทธิ์เข้าถึงกลุ่มภารกิจนี้ หรือทีมไม่ได้เปิดใช้งาน");
            setSession(result.session || null);
            setTeam(selectedTeam);
        } catch (loadError) {
            setError(loadError.message || "ไม่สามารถโหลดพื้นที่ทำงานทีมได้");
        } finally {
            setLoading(false);
        }
    }, [sessionId, sessionTeamId]);

    useEffect(() => { loadWorkspace(); }, [loadWorkspace]);

    const isClosed = session?.status === "closed";
    const reportLink = REPORT_LINKS[team?.team_code];

    return (
        <EOCLayout>
            <section className="mx-auto max-w-6xl space-y-5">
                <Link href="/eoc/staff" className="text-sm font-bold text-cyan-700 hover:underline">กลับไปยังเมนูกลุ่มภารกิจ</Link>
                {loading ? <div className="bg-white p-10 text-center text-sm text-slate-500">กำลังโหลดพื้นที่ทำงาน...</div> : error ? <div className="border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-800">{error}</div> : team && <>
                    <header className="border-l-4 border-cyan-600 bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black text-cyan-700">{team.team_code}</p><h1 className="mt-1 text-2xl font-black text-slate-900">{team.team_name_th}</h1><p className="mt-2 text-sm text-slate-600">EOC Session #{session?.session_number || session?.id} · เปิดเมื่อ {formatDate(session?.opened_at)}</p></div><span className={`border px-3 py-2 text-sm font-bold ${isClosed ? "border-slate-300 bg-slate-100 text-slate-600" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{isClosed ? <><Lock className="mr-1 inline h-4 w-4" />อ่านอย่างเดียว</> : "พร้อมบันทึกและรายงาน"}</span></div>
                    </header>

                    <nav className="flex overflow-x-auto border-b border-slate-200 bg-white">
                        <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={<LayoutDashboard className="h-4 w-4" />}>Dashboard</TabButton>
                        <TabButton active={tab === "reports"} onClick={() => setTab("reports")} icon={<ClipboardList className="h-4 w-4" />}>รายงานผล</TabButton>
                        <TabButton active={tab === "history"} onClick={() => setTab("history")} icon={<History className="h-4 w-4" />}>ประวัติ</TabButton>
                    </nav>

                    {tab === "dashboard" && <div className="grid gap-4 md:grid-cols-[1.35fr_.65fr]"><div className="bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-900">ภาพรวมกลุ่มภารกิจ</h2><p className="mt-1 text-sm text-slate-600">Dashboard มาตรฐานของทีมจะแสดงข้อมูลตาม session และประเภท EOC ที่เลือก</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><Kpi label="สมาชิกทีม" value={team.member_count || 0} /><Kpi label="สถานะ Session" value={isClosed ? "ปิดแล้ว" : "เปิดอยู่"} text /><Kpi label="หัวหน้าทีม" value={team.team_lead_name || "ยังไม่กำหนด"} text /></div></div><div className="bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Users className="h-5 w-5 text-cyan-700" />สมาชิก</h2><ul className="mt-3 space-y-2 text-sm">{team.members?.length ? team.members.map((member) => <li key={member.id} className="border-b border-slate-100 pb-2"><p className="font-bold text-slate-800">{member.given_name} {member.family_name}</p><p className="text-slate-500">{member.role_in_team || "สมาชิกทีม"}</p></li>) : <li className="text-slate-500">ยังไม่มีสมาชิกที่กำหนดในทีม</li>}</ul></div></div>}

                    {tab === "reports" && <div className="bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-900">รายงานผลของกลุ่มภารกิจ</h2><p className="mt-1 text-sm text-slate-600">การบันทึกข้อมูลใช้เฉพาะระบบข้อมูลจริงของ EOC Session นี้ และจะถูกจำกัดเป็นอ่านอย่างเดียวหลังปิด session</p>{reportLink ? <Link href={reportLink.href} className="mt-5 inline-flex items-center gap-2 bg-cyan-700 px-4 py-3 text-sm font-bold text-white hover:bg-cyan-800"><BarChart3 className="h-4 w-4" />{reportLink.label}</Link> : <div className="mt-5 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">ทีมนี้ยังไม่มีแบบฟอร์มรายงานเฉพาะในระบบ MVP กรุณาบันทึกรายงานผ่าน workflow ที่ผู้บัญชาการกำหนดก่อน</div>}</div>}

                    {tab === "history" && <div className="bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-900">ประวัติการดำเนินงาน</h2><p className="mt-1 text-sm text-slate-600">ข้อมูล audit log สำหรับตรวจสอบการทำงานดูได้เฉพาะผู้ดูแลระบบจากเมนู Activity Log</p><div className="mt-5 border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">เมื่อเพิ่มแบบฟอร์มรายงานของแต่ละทีม การสร้าง แก้ไข และส่งรายงานต้องบันทึก `activity_logs` พร้อม `session_id` และ `team_code` ทุกครั้ง</div></div>}
                </>}
            </section>
        </EOCLayout>
    );
}

function TabButton({ active, onClick, icon, children }) { return <button type="button" onClick={onClick} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold ${active ? "border-cyan-700 text-cyan-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{icon}{children}</button>; }
function Kpi({ label, value, text = false }) { return <div className="border border-slate-200 p-3"><p className="text-xs font-bold text-slate-500">{label}</p><p className={`mt-2 font-black text-slate-900 ${text ? "text-base" : "text-2xl"}`}>{value}</p></div>; }
