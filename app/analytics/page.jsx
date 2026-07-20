"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Activity,
    AlertTriangle,
    BarChart3,
    Bot,
    Boxes,
    Building2,
    CheckCircle2,
    Clock3,
    HeartPulse,
    LoaderCircle,
    PackageSearch,
    RefreshCw,
    ShieldAlert,
    TrendingDown,
    TrendingUp,
    Users
} from "lucide-react";
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";
import EOCLayout from "@/components/layouts/EOCLayout";
import AnalyticsAIChat from "@/components/analytics/AnalyticsAIChat";
import { useAuth } from "@/context/AuthContext";

const TABS = [
    { id: "overview", label: "ภาพรวม", icon: BarChart3 },
    { id: "teams", label: "กลุ่มภารกิจ", icon: Users },
    { id: "inventory", label: "เวชภัณฑ์", icon: Boxes },
    { id: "disease", label: "โรคระบาด", icon: HeartPulse },
    { id: "ai", label: "AI วิเคราะห์", icon: Bot }
];

const formatNumber = (value) => Number(value || 0).toLocaleString("th-TH");
const dateLabel = (value) => value ? new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : "-";

const priorityStyles = {
    critical: "border-red-200 bg-red-50 text-red-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    info: "border-blue-200 bg-blue-50 text-blue-800"
};

export default function AnalyticsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState("overview");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [authLoading, user, router]);

    const loadAnalytics = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch("/stn-eoc/api/analytics", { cache: "no-store" });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.message || "ไม่สามารถโหลดข้อมูลวิเคราะห์ได้");
            setData(payload.data);
        } catch (fetchError) {
            setError(fetchError.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user) loadAnalytics();
    }, [user, loadAnalytics]);

    const chartData = useMemo(() => (data?.disease?.daily_trend || []).map((item) => ({
        ...item,
        label: dateLabel(item.report_date),
        patient_count: Number(item.patient_count || 0)
    })), [data]);

    if (authLoading || (loading && !data)) {
        return (
            <EOCLayout>
                <div className="flex min-h-[65vh] items-center justify-center text-slate-600">
                    <LoaderCircle className="mr-2 h-6 w-6 animate-spin" /> กำลังวิเคราะห์ข้อมูล...
                </div>
            </EOCLayout>
        );
    }

    if (!user) return null;

    return (
        <EOCLayout>
            <main className="mx-auto max-w-7xl p-4 sm:p-6">
                <header className="rounded-2xl bg-slate-900 p-5 text-white shadow-lg sm:p-7">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-4">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
                                <Activity className="h-6 w-6" />
                            </span>
                            <div>
                                <p className="text-sm font-semibold text-emerald-300">Decision Intelligence</p>
                                <h1 className="mt-1 text-2xl font-black sm:text-3xl">วิเคราะห์สถานการณ์ EOC</h1>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                                    รวมตัวชี้วัด ทีมปฏิบัติการ เวชภัณฑ์ และแนวโน้มโรคเพื่อสนับสนุนการตัดสินใจของ Incident Commander
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="rounded-xl bg-white/10 px-4 py-2 text-sm">
                                อัปเดต {data?.generated_at ? new Date(data.generated_at).toLocaleString("th-TH") : "-"}
                            </div>
                            <button
                                type="button"
                                onClick={loadAnalytics}
                                disabled={loading}
                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> รีเฟรช
                            </button>
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="mt-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                        <AlertTriangle className="h-5 w-5 shrink-0" /> {error}
                    </div>
                )}

                <nav className="mt-5 flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${activeTab === tab.id
                                    ? "bg-slate-900 text-white"
                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                    }`}
                            >
                                <Icon className="h-4 w-4" /> {tab.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="mt-5">
                    {activeTab === "overview" && <OverviewTab data={data} />}
                    {activeTab === "teams" && <TeamsTab teams={data?.teams || []} />}
                    {activeTab === "inventory" && <InventoryTab inventory={data?.inventory} />}
                    {activeTab === "disease" && <DiseaseTab chartData={chartData} districts={data?.disease?.districts || []} />}
                    {activeTab === "ai" && <AnalyticsAIChat />}
                </div>
            </main>
        </EOCLayout>
    );
}

function OverviewTab({ data }) {
    const kpis = data?.kpis || {};
    const cards = [
        { label: "ผู้ได้รับผลกระทบล่าสุด", value: formatNumber(kpis.affected_people), unit: "คน", icon: Users, tone: "blue" },
        { label: "ศูนย์พักพิงที่เปิด", value: formatNumber(kpis.active_shelters), unit: "แห่ง", icon: Building2, tone: "emerald" },
        { label: "เวชภัณฑ์ต่ำกว่าเกณฑ์", value: formatNumber(kpis.low_stock_count), unit: "รายการ", icon: PackageSearch, tone: "amber" },
        { label: "ทีมที่ต้องเร่งเสริม", value: formatNumber(kpis.critical_teams), unit: "ทีม", icon: ShieldAlert, tone: "red" }
    ];
    const toneClass = {
        blue: "border-blue-100 bg-blue-50 text-blue-700",
        emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
        amber: "border-amber-100 bg-amber-50 text-amber-700",
        red: "border-red-100 bg-red-50 text-red-700"
    };

    return (
        <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${toneClass[card.tone]}`}>
                                <Icon className="h-5 w-5" />
                            </span>
                            <p className="mt-4 text-sm font-semibold text-slate-500">{card.label}</p>
                            <p className="mt-1 text-3xl font-black text-slate-900">{card.value} <span className="text-sm font-semibold text-slate-500">{card.unit}</span></p>
                        </article>
                    );
                })}
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><AlertTriangle className="h-5 w-5 text-amber-500" /> ข้อเสนอแนะอัตโนมัติ</h2>
                    <div className="mt-4 space-y-3">
                        {(data?.recommendations || []).map((item) => (
                            <article key={`${item.title}-${item.detail}`} className={`rounded-xl border p-4 ${priorityStyles[item.priority] || priorityStyles.info}`}>
                                <h3 className="font-bold">{item.title}</h3>
                                <p className="mt-1 text-sm leading-6 opacity-90">{item.detail}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Clock3 className="h-5 w-5 text-blue-600" /> EOC ที่กำลังเปิด</h2>
                    <div className="mt-4 space-y-3">
                        {(data?.active_sessions || []).length ? data.active_sessions.map((session) => (
                            <div key={session.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                                <div>
                                    <p className="font-bold text-slate-800">{session.eoc_type}</p>
                                    <p className="text-xs text-slate-500">Session #{session.session_number}</p>
                                </div>
                                <span className="text-sm font-semibold text-emerald-700">เปิด {dateLabel(session.opened_at)}</span>
                            </div>
                        )) : <EmptyText text="ไม่มี EOC ที่กำลังเปิด" />}
                    </div>
                </section>
            </div>
        </div>
    );
}

function TeamsTab({ teams }) {
    const statusMeta = {
        critical: { label: "ต้องเร่งแก้ไข", className: "bg-red-100 text-red-700" },
        warning: { label: "ควรเฝ้าระวัง", className: "bg-amber-100 text-amber-700" },
        ready: { label: "พร้อมปฏิบัติงาน", className: "bg-emerald-100 text-emerald-700" }
    };

    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((team) => {
                const status = statusMeta[team.status] || statusMeta.warning;
                return (
                    <article key={team.team_code} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-black tracking-wider text-blue-600">{team.team_code}</p>
                                <h2 className="mt-1 font-black text-slate-900">{team.team_name_th}</h2>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
                        </div>
                        <div className="mt-5 flex items-end justify-between">
                            <div>
                                <p className="text-sm text-slate-500">คะแนนความพร้อม</p>
                                <p className="text-3xl font-black text-slate-900">{team.readiness_score}<span className="text-sm text-slate-400">/100</span></p>
                            </div>
                            <div className="text-right text-sm text-slate-600">
                                <p>สมาชิก {team.member_count} คน</p>
                                <p>กิจกรรม 7 วัน {team.activity_count_7d} รายการ</p>
                            </div>
                        </div>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${team.status === "critical" ? "bg-red-500" : team.status === "warning" ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${team.readiness_score}%` }} />
                        </div>
                        <div className="mt-4 space-y-2">
                            {team.weaknesses?.length ? team.weaknesses.map((weakness) => (
                                <p key={weakness} className="flex items-start gap-2 text-sm text-slate-600"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> {weakness}</p>
                            )) : <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> ไม่พบจุดอ่อนตามเกณฑ์</p>}
                        </div>
                    </article>
                );
            })}
        </div>
    );
}

function InventoryTab({ inventory }) {
    if (!inventory?.available) return <EmptyText text="ยังไม่มีตารางข้อมูลเวชภัณฑ์ กรุณาเปิดเมนูเวชภัณฑ์และคงคลังเพื่อนำเข้าข้อมูลก่อน" />;
    const rows = inventory.low_stock || [];
    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-5 sm:grid-cols-3">
                <MiniKpi label="รายการเวชภัณฑ์" value={inventory.summary.item_count} />
                <MiniKpi label="ต่ำกว่า 20%" value={inventory.summary.low_stock_count} tone="amber" />
                <MiniKpi label="วิกฤตไม่เกิน 10%" value={inventory.summary.critical_stock_count} tone="red" />
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr><th className="px-5 py-3">หน่วยบริการ / รายการ</th><th className="px-5 py-3">ยอดตั้งต้น</th><th className="px-5 py-3">คงเหลือ</th><th className="px-5 py-3">สัดส่วนคงเหลือ</th><th className="px-5 py-3">ระดับ</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                                <td className="px-5 py-4"><p className="font-bold text-slate-800">{item.item_name}</p><p className="text-xs text-slate-500">{item.agency_name}{item.district_name ? ` • ${item.district_name}` : ""}</p></td>
                                <td className="px-5 py-4 text-slate-600">{formatNumber(item.opening_qty)} {item.unit}</td>
                                <td className="px-5 py-4 font-bold text-slate-900">{formatNumber(item.balance_qty)} {item.unit}</td>
                                <td className="min-w-44 px-5 py-4"><div className="mb-1 flex justify-between text-xs"><span>{item.remain_pct}%</span></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${item.severity === "critical" ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${Math.max(2, item.remain_pct)}%` }} /></div></td>
                                <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.severity === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{item.severity === "critical" ? "วิกฤต" : "เหลือน้อย"}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!rows.length && <EmptyText text="ไม่พบเวชภัณฑ์ต่ำกว่าเกณฑ์ 20%" />}
            </div>
        </section>
    );
}

function DiseaseTab({ chartData, districts }) {
    return (
        <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-black text-slate-900">แนวโน้มผู้ป่วย 30 วันล่าสุด</h2>
                <div className="mt-5 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(value) => [`${formatNumber(value)} ราย`, "ผู้ป่วย"]} />
                            <Line type="monotone" dataKey="patient_count" stroke="#059669" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-black text-slate-900">เทียบ 7 วันรายอำเภอ</h2>
                <div className="mt-4 space-y-3">
                    {districts.map((item) => {
                        const rising = item.change_pct > 0;
                        return (
                            <div key={item.district_name} className="rounded-xl bg-slate-50 p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="font-bold text-slate-800">{item.district_name}</p>
                                    <span className={`inline-flex items-center gap-1 text-xs font-bold ${rising ? "text-red-600" : "text-emerald-600"}`}>
                                        {rising ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                        {item.change_pct > 0 ? "+" : ""}{item.change_pct}%
                                    </span>
                                </div>
                                <p className="mt-1 text-sm text-slate-500">ล่าสุด {formatNumber(item.current_cases)} ราย • ก่อนหน้า {formatNumber(item.previous_cases)} ราย</p>
                            </div>
                        );
                    })}
                    {!districts.length && <EmptyText text="ยังไม่มีข้อมูลโรคในช่วง 14 วันล่าสุด" />}
                </div>
            </section>
        </div>
    );
}

function MiniKpi({ label, value, tone = "slate" }) {
    const color = tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-slate-900";
    return <div className="rounded-xl bg-white p-3"><p className="text-xs font-semibold text-slate-500">{label}</p><p className={`mt-1 text-2xl font-black ${color}`}>{formatNumber(value)}</p></div>;
}

function EmptyText({ text }) {
    return <div className="p-8 text-center text-sm text-slate-500">{text}</div>;
}
