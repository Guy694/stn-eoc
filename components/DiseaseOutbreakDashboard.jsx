"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";
import AppIcon from "@/components/icons/AppIcon";
import { enrichDistrictOutbreakData } from "@/lib/diseaseOutbreakMetrics";
import PaginationControls, { paginateRows } from "@/components/common/PaginationControls";

const yearColors = {
    "2566": "#64748b",
    "2567": "#0ea5e9",
    "2568": "#10b981",
    "2569": "#e11d48",
    baseline: "#f59e0b"
};
const patientColors = ["#0ea5e9", "#f59e0b", "#e11d48", "#64748b"];

function formatNumber(value, fractionDigits = 0) {
    return Number(value || 0).toLocaleString("th-TH", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
    });
}

function formatDateTime(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getDurationText(openedAt) {
    if (!openedAt) return "-";
    const diffMs = Date.now() - new Date(openedAt).getTime();
    if (diffMs <= 0) return "เพิ่งเปิดใช้งาน";
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    return `เปิดมาแล้ว ${days} วัน ${hours} ชั่วโมง`;
}

function getRiskClass(level) {
    if (level === "วิกฤต" || level === "ระบาด") return "bg-red-50 text-red-700 border-red-200";
    if (level === "เฝ้าระวังสูง") return "bg-orange-50 text-orange-700 border-orange-200";
    if (level === "เฝ้าระวัง") return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function getRiskFill(level) {
    if (level === "วิกฤต" || level === "ระบาด") return "#ef4444";
    if (level === "เฝ้าระวังสูง") return "#f97316";
    if (level === "เฝ้าระวัง") return "#f59e0b";
    return "#10b981";
}

export default function DiseaseOutbreakDashboard({
    session,
    data = null,
    showHeader = true
}) {
    const [districtFilter, setDistrictFilter] = useState("all");
    const [districtMetric, setDistrictMetric] = useState("cases");
    const [liveData, setLiveData] = useState(null);
    const [loadingLiveData, setLoadingLiveData] = useState(Boolean(session));
    const [loadError, setLoadError] = useState("");
    const [codePage, setCodePage] = useState(1);
    const [codePageSize, setCodePageSize] = useState(20);

    useEffect(() => {
        let ignore = false;

        async function fetchDashboardData() {
            setLoadingLiveData(true);
            setLoadError("");
            try {
                const params = new URLSearchParams();
                if (session?.id) params.set("session_id", session.id);
                const response = await fetch(`/stn-eoc/api/eoc/disease/outbreak-dashboard${params.toString() ? `?${params}` : ""}`);
                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.message || "โหลดข้อมูลโรคไข้เลือดออกไม่สำเร็จ");
                }
                if (!ignore) setLiveData(result.data);
            } catch (error) {
                console.error("Error fetching dengue outbreak dashboard:", error);
                if (!ignore) setLoadError(error.message || "โหลดข้อมูลโรคไข้เลือดออกไม่สำเร็จ");
            } finally {
                if (!ignore) setLoadingLiveData(false);
            }
        }

        fetchDashboardData();
        return () => {
            ignore = true;
        };
    }, [session?.id]);

    const dashboardData = liveData || (!session ? data : null);
    const currentYearKey = dashboardData?.current_year_key || "2569";
    const comparisonYearKeys = Object.keys(dashboardData?.weeklyTrend?.[0] || {})
        .filter((key) => /^\d{4}$/.test(key) && key !== currentYearKey);
    const weekLabels = dashboardData?.week_labels?.length
        ? dashboardData.week_labels
        : (dashboardData?.districtWeekly?.[0]?.weeks || []).map((_, index) => `W${index + 1}`);

    const districts = useMemo(
        () => enrichDistrictOutbreakData(dashboardData?.districtCases || []),
        [dashboardData?.districtCases]
    );
    const selectedDistrictRows = districtFilter === "all"
        ? districts
        : districts.filter((item) => item.district_name === districtFilter);
    const totalCases = selectedDistrictRows.reduce((sum, item) => sum + item.total_cases, 0);
    const totalNewCases = selectedDistrictRows.reduce((sum, item) => sum + item.new_cases, 0);
    const hasDeathData = selectedDistrictRows.every((item) => item.deaths !== null);
    const totalDeaths = hasDeathData
        ? selectedDistrictRows.reduce((sum, item) => sum + Number(item.deaths || 0), 0)
        : null;
    const totalPopulation = selectedDistrictRows.reduce((sum, item) => sum + item.population, 0);
    const previousWeek = selectedDistrictRows.reduce((sum, item) => sum + item.previous_week, 0);
    const morbidityRate = totalPopulation > 0 ? (totalCases / totalPopulation) * 100000 : null;
    const caseFatalityRate = totalCases > 0 && hasDeathData
        ? (totalDeaths / totalCases) * 100
        : null;
    const topDistrict = districts[0];
    const latestWeek = dashboardData?.weeklyTrend?.[dashboardData.weeklyTrend.length - 1] || {};
    const previousTrendWeek = dashboardData?.weeklyTrend?.[Math.max((dashboardData.weeklyTrend?.length || 1) - 2, 0)] || {};
    const weeklyDelta = Number(latestWeek[currentYearKey] || 0) - Number(previousTrendWeek[currentYearKey] || 0);
    const districtChartRows = selectedDistrictRows.map((item) => ({
        ...item,
        chartValue: districtMetric === "rate" ? Number(item.morbidity_rate.toFixed(1)) : item.total_cases
    }));
    const heatmapMax = Math.max(...(dashboardData?.districtWeekly || []).flatMap((item) => item.weeks), 1);
    const ageSexRows = (dashboardData?.ageSex || []).map((item) => ({
        ...item,
        total: Number(item.male || 0) + Number(item.female || 0) + Number(item.unknown || 0)
    }));
    const codeRows = useMemo(
        () => (dashboardData?.diseaseCodes || []).map((item) => ({
            ...item,
            percent: totalCases > 0 ? (Number(item.cases || 0) / totalCases) * 100 : 0
        })),
        [dashboardData?.diseaseCodes, totalCases]
    );
    const paginatedCodeRows = useMemo(
        () => paginateRows(codeRows, codePage, codePageSize),
        [codeRows, codePage, codePageSize]
    );

    useEffect(() => {
        setCodePage(1);
    }, [dashboardData, districtFilter]);

    if (loadingLiveData && !dashboardData) {
        return (
            <section className="rounded-xl border border-rose-100 bg-white p-8 text-center shadow-sm">
                <AppIcon icon="loader" className="mx-auto mb-3 h-10 w-10 animate-spin text-rose-600" />
                <p className="font-bold text-slate-700">กำลังโหลดข้อมูลไข้เลือดออกจากฐานข้อมูล...</p>
            </section>
        );
    }

    if (!dashboardData) {
        return (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
                <AppIcon icon="alert" className="mx-auto mb-3 h-10 w-10 text-amber-600" />
                <p className="font-bold text-amber-900">{loadError || "ยังไม่มีข้อมูล dashboard โรคไข้เลือดออก"}</p>
            </section>
        );
    }

    const summaryCards = [
        { label: "ผู้ป่วยสะสมปีปัจจุบัน", value: totalCases, unit: "ราย", icon: "thermometer", risk: totalCases >= 250 ? "ระบาด" : "เฝ้าระวังสูง" },
        { label: "ผู้ป่วยสัปดาห์ล่าสุด", value: totalNewCases, unit: "ราย", icon: "calendar", risk: totalNewCases >= 30 ? "ระบาด" : "เฝ้าระวัง" },
        { label: "เพิ่ม/ลดจากสัปดาห์ก่อน", value: weeklyDelta, unit: "ราย", icon: "activity", risk: weeklyDelta > 10 ? "ระบาด" : weeklyDelta > 0 ? "เฝ้าระวัง" : "ปกติ", signed: true },
        { label: "อัตราป่วยต่อแสน", value: morbidityRate, unit: "ต่อแสน", icon: "barChart", risk: morbidityRate >= 65 ? "ระบาด" : "เฝ้าระวัง", digits: 1 },
        { label: "จำนวนผู้เสียชีวิต", value: totalDeaths, unit: totalDeaths === null ? "ไม่มีข้อมูล" : "ราย", icon: "skull", risk: totalDeaths === null ? "ไม่มีข้อมูล" : totalDeaths > 0 ? "วิกฤต" : "ปกติ" },
        { label: "อัตราป่วยตาย", value: caseFatalityRate, unit: "%", icon: "alert", risk: caseFatalityRate > 0 ? "วิกฤต" : "ปกติ", digits: 2 },
        { label: "อำเภอผู้ป่วยสูงสุด", value: topDistrict?.district_name || "-", unit: `${formatNumber(topDistrict?.total_cases)} ราย`, icon: "mapPin", risk: topDistrict?.risk_level || "เฝ้าระวัง", textValue: true },
        { label: "อำเภอที่มีรายงาน", value: districts.filter((item) => item.total_cases > 0).length, unit: "อำเภอ", icon: "map", risk: "เฝ้าระวัง" }
    ];

    return (
        <section className="space-y-4">
            {showHeader && (
                <div className="rounded-xl border border-slate-200 bg-slate-950 p-4 text-white shadow-sm md:p-5">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
                        <div>
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-rose-500 px-3 py-1 text-xs font-black">EOC โรคระบาด</span>
                                <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-100">Communicable Disease</span>
                                <span className={`rounded-full border px-3 py-1 text-xs font-black ${getRiskClass(dashboardData.outbreak_level)}`}>{dashboardData.outbreak_level}</span>
                            </div>
                            <h2 className="text-2xl font-black md:text-3xl">EOC โรคไข้เลือดออก จังหวัดสตูล</h2>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
                                Dashboard สาธารณะสำหรับติดตามสถานการณ์ ภาพรวมแนวโน้ม และความรุนแรงระดับจังหวัด/อำเภอ โดยแสดงเฉพาะข้อมูลรวม ไม่แสดงข้อมูลส่วนบุคคลหรือพิกัดบ้านรายบุคคล
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <HeaderMetric label="เปิด EOC" value={formatDateTime(session?.opened_at || dashboardData.opened_at)} />
                            <HeaderMetric label="ระยะเวลา" value={getDurationText(session?.opened_at || dashboardData.opened_at)} />
                            <HeaderMetric label="ปีงบประมาณ" value={dashboardData.fiscal_year} />
                            <HeaderMetric label="อัปเดตล่าสุด" value={formatDateTime(dashboardData.last_updated)} />
                        </div>
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-[160px_1fr_1fr_auto]">
                        <select className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-bold outline-none">
                            <option>ปี {dashboardData.fiscal_year}</option>
                        </select>
                        <select
                            value={districtFilter}
                            onChange={(event) => setDistrictFilter(event.target.value)}
                            className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-bold outline-none"
                        >
                            <option value="all">ทุกอำเภอ</option>
                            {districts.map((item) => <option key={item.district_name} value={item.district_name}>{item.district_name}</option>)}
                        </select>
                        <select className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-bold outline-none">
                            <option>สัปดาห์ที่ {dashboardData.weeklyTrend?.[0]?.epi_week || "-"}-{dashboardData.latest_epi_week || "-"}</option>
                        </select>
                        <button type="button" className="rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-cyan-50">
                            Export CSV
                        </button>
                    </div>
                </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => <SummaryCard key={card.label} {...card} />)}
            </div>

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
                <ChartPanel title="แนวโน้มผู้ป่วยโรคไข้เลือดออก รายสัปดาห์ เปรียบเทียบรายปี">
                    <div className="h-[260px] sm:h-[340px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dashboardData.weeklyTrend} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="epi_week" tickFormatter={(value) => `W${value}`} tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                                <Tooltip content={<WeeklyTooltip />} />
                                <Legend />
                                {comparisonYearKeys.map((year) => (
                                    <Area key={year} type="monotone" dataKey={year} stroke={yearColors[year]} fill={yearColors[year]} fillOpacity={0.08} strokeWidth={2} dot={false} />
                                ))}
                                {dashboardData.weeklyTrend?.some((row) => Number(row.baseline || 0) > 0) && (
                                    <Area name="ค่าเฉลี่ยย้อนหลัง" type="monotone" dataKey="baseline" stroke={yearColors.baseline} fill={yearColors.baseline} fillOpacity={0.06} strokeDasharray="5 5" strokeWidth={2} dot={false} />
                                )}
                                <Area name={`ปีปัจจุบัน ${currentYearKey}`} type="monotone" dataKey={currentYearKey} stroke={yearColors["2569"]} fill={yearColors["2569"]} fillOpacity={0.16} strokeWidth={4} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </ChartPanel>

                <ChartPanel
                    title="จำนวนผู้ป่วยโรคไข้เลือดออกสะสม แยกรายอำเภอ"
                    action={
                        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                            <MetricToggle active={districtMetric === "cases"} onClick={() => setDistrictMetric("cases")}>จำนวน</MetricToggle>
                            <MetricToggle active={districtMetric === "rate"} onClick={() => setDistrictMetric("rate")}>อัตรา</MetricToggle>
                        </div>
                    }
                >
                    <div className="h-[280px] sm:h-[340px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={districtChartRows} layout="vertical" margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis type="number" tick={{ fontSize: 12 }} />
                                <YAxis type="category" dataKey="district_name" width={72} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(value, name, item) => [
                                    districtMetric === "rate" ? `${formatNumber(value, 1)} ต่อแสน` : `${formatNumber(value)} ราย`,
                                    item.payload.risk_level
                                ]} />
                                <Bar dataKey="chartValue" radius={[0, 8, 8, 0]}>
                                    {districtChartRows.map((entry) => <Cell key={entry.district_name} fill={getRiskFill(entry.risk_level)} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartPanel>
            </div>

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <ChartPanel title="Heatmap การระบาดรายสัปดาห์ แยกรายอำเภอ">
                    <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
                        <div className="min-w-[640px] sm:min-w-[720px]">
                            <div
                                className="mb-2 grid gap-2 text-xs font-black text-slate-500"
                                style={{ gridTemplateColumns: `96px repeat(${weekLabels.length}, minmax(42px, 1fr))` }}
                            >
                                <div className="sticky left-0 z-20 bg-white pr-2">อำเภอ</div>
                                {weekLabels.map((week) => <div key={week} className="text-center">{week}</div>)}
                            </div>
                            <div className="space-y-2">
                                {(dashboardData.districtWeekly || []).map((row) => (
                                    <div
                                        key={row.district_name}
                                        className="grid gap-2"
                                        style={{ gridTemplateColumns: `96px repeat(${weekLabels.length}, minmax(42px, 1fr))` }}
                                    >
                                        <div className="sticky left-0 z-10 truncate rounded-md bg-slate-50 px-2 py-2 text-xs font-bold text-slate-700 shadow-sm sm:text-sm">{row.district_name}</div>
                                        {row.weeks.map((value, index) => {
                                            const intensity = value / heatmapMax;
                                            return (
                                                <div
                                                    key={`${row.district_name}-${index}`}
                                                    className="rounded-md px-1.5 py-2 text-center text-[11px] font-black text-white sm:text-xs"
                                                    title={`${row.district_name} ${weekLabels[index]}: ${value} ราย`}
                                                    style={{ backgroundColor: `rgba(225, 29, 72, ${0.22 + intensity * 0.78})` }}
                                                >
                                                    {value}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="mt-2 text-xs font-semibold text-slate-500 sm:hidden">เลื่อนซ้าย-ขวาเพื่อดูทุกสัปดาห์</div>
                </ChartPanel>

                <ChartPanel title="ประเภทผู้ป่วยตามนิยามการเฝ้าระวัง">
                    <div className="h-[220px] sm:h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={dashboardData.patientTypes} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} paddingAngle={2}>
                                    {dashboardData.patientTypes.map((entry, index) => <Cell key={entry.name} fill={patientColors[index % patientColors.length]} />)}
                                </Pie>
                                <Tooltip formatter={(value) => `${formatNumber(value)} ราย`} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                        {dashboardData.patientTypes.map((entry, index) => (
                            <div key={entry.name} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: patientColors[index % patientColors.length] }} />
                                    <span className="truncate font-bold text-slate-700">{entry.name}</span>
                                </div>
                                <span className="ml-3 shrink-0 font-black text-slate-900">{formatNumber(entry.value)} ราย</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs font-semibold text-slate-500">ข้อมูลนี้เป็นภาพรวมตามนิยามเฝ้าระวัง ไม่ใช่ข้อมูลรายบุคคล</p>
                </ChartPanel>
            </div>

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
                <ChartPanel title="การกระจายผู้ป่วยตามกลุ่มอายุและเพศ">
                    <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
                        <div className="h-[300px] min-w-[560px] sm:h-[330px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ageSexRows} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="age_group" tick={{ fontSize: 11 }} interval={0} />
                                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                                    <Tooltip formatter={(value) => `${formatNumber(value)} ราย`} />
                                    <Legend />
                                    <Bar dataKey="male" name="ชาย" stackId="age" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="female" name="หญิง" stackId="age" fill="#f97316" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="mt-2 text-xs font-semibold text-slate-500 sm:hidden">เลื่อนซ้าย-ขวาเพื่อดูทุกกลุ่มอายุ</div>
                </ChartPanel>

                <ChartPanel title="รหัสโรคและกลุ่มโรคที่ใช้ในการเฝ้าระวัง">
                    <div className="grid gap-2 md:hidden">
                        {paginatedCodeRows.map((row) => (
                            <div key={row.disease_code} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="font-black text-rose-700">{row.disease_code}</div>
                                        <div className="mt-1 font-bold leading-5 text-slate-900">{row.disease_name_th}</div>
                                        <div className="mt-0.5 text-xs text-slate-500">{row.disease_name_en}</div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className="text-lg font-black text-slate-900">{formatNumber(row.cases)}</div>
                                        <div className="text-xs font-bold text-slate-500">ราย</div>
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">
                                    <div className="rounded-md bg-slate-50 px-2 py-1.5">สัดส่วน {formatNumber(row.percent, 1)}%</div>
                                    <div className="rounded-md bg-orange-50 px-2 py-1.5 text-orange-700">แนวโน้ม +{formatNumber(row.previous_week_change)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full min-w-[520px] text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-500">
                                <tr>
                                    {["รหัส", "ชื่อโรค", "English", "ผู้ป่วย", "%", "แนวโน้ม"].map((head) => (
                                        <th key={head} className="px-3 py-2 text-left font-black">{head}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedCodeRows.map((row) => (
                                    <tr key={row.disease_code} className="border-t border-slate-100">
                                        <td className="px-3 py-2 font-black text-rose-700">{row.disease_code}</td>
                                        <td className="px-3 py-2 font-bold text-slate-800">{row.disease_name_th}</td>
                                        <td className="px-3 py-2 text-slate-600">{row.disease_name_en}</td>
                                        <td className="px-3 py-2">{formatNumber(row.cases)}</td>
                                        <td className="px-3 py-2">{formatNumber(row.percent, 1)}</td>
                                        <td className="px-3 py-2 text-orange-700">+{formatNumber(row.previous_week_change)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls
                        page={codePage}
                        pageSize={codePageSize}
                        totalItems={codeRows.length}
                        onPageChange={setCodePage}
                        onPageSizeChange={setCodePageSize}
                    />
                    <div className="mt-3 rounded-lg bg-cyan-50 p-3 text-xs font-semibold leading-5 text-cyan-800">
                        กลุ่มโรค: {dashboardData.disease_group} • แหล่งข้อมูล: {dashboardData.source || "ฐานข้อมูล EOC"} • หน่วยรายงาน: สถานพยาบาล / ระบบเฝ้าระวังโรค / งานควบคุมโรค
                    </div>
                </ChartPanel>
            </div>

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <DistrictPublicTable rows={selectedDistrictRows} />
                <PublicAdvicePanel topDistrict={topDistrict} lastUpdated={dashboardData.last_updated} />
            </div>
        </section>
    );
}

function HeaderMetric({ label, value }) {
    return (
        <div className="rounded-lg bg-white/10 p-3">
            <div className="text-[11px] font-bold text-slate-300">{label}</div>
            <div className="mt-1 text-sm font-black text-white">{value}</div>
        </div>
    );
}

function SummaryCard({ label, value, unit, icon, risk, signed, digits = 0, textValue }) {
    const displayedValue = value === null || value === undefined
        ? "-"
        : textValue ? value : `${signed && Number(value) > 0 ? "+" : ""}${formatNumber(value, digits)}`;

    return (
        <div className={`rounded-xl border bg-white p-4 shadow-sm ${getRiskClass(risk)}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-xs font-black opacity-80">{label}</div>
                    <div className="mt-2 text-2xl font-black leading-tight">{displayedValue}</div>
                    <div className="mt-1 text-xs font-bold opacity-75">{unit}</div>
                </div>
                <div className="rounded-lg bg-white/70 p-2 shadow-sm">
                    <AppIcon icon={icon} className="h-5 w-5" />
                </div>
            </div>
        </div>
    );
}

function ChartPanel({ title, action, children }) {
    return (
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:rounded-xl sm:p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-black leading-6 text-slate-900 sm:text-base md:text-lg">{title}</h3>
                {action}
            </div>
            {children}
        </section>
    );
}

function MetricToggle({ active, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-md px-3 py-1.5 text-xs font-black transition ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-white"}`}
        >
            {children}
        </button>
    );
}

function WeeklyTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const current = payload.find((item) => item.dataKey === "2569");
    const previous = payload.find((item) => item.dataKey === "baseline");
    const delta = Number(current?.value || 0) - Number(previous?.value || 0);

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg">
            <div className="mb-2 font-black text-slate-900">สัปดาห์ที่ {label}</div>
            <div className="space-y-1">
                {payload.map((item) => (
                    <div key={item.dataKey} className="flex items-center justify-between gap-4">
                        <span style={{ color: item.color }}>{item.name || item.dataKey}</span>
                        <span className="font-bold">{formatNumber(item.value)} ราย</span>
                    </div>
                ))}
            </div>
            <div className={`mt-2 rounded-md px-2 py-1 text-xs font-black ${delta > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                เทียบค่าเฉลี่ยย้อนหลัง {delta > 0 ? "+" : ""}{formatNumber(delta)} ราย
            </div>
        </div>
    );
}

function DistrictPublicTable({ rows }) {
    return (
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:rounded-xl sm:p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-black leading-6 text-slate-900 sm:text-lg">ตารางสรุปข้อมูลสาธารณะรายอำเภอ</h3>
                <input
                    readOnly
                    value="ค้นหา/เรียงลำดับจากข้อมูลรวม"
                    className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 sm:block"
                />
            </div>
            <div className="grid gap-2 md:hidden">
                {rows.map((row) => (
                    <div key={row.district_name} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="font-black text-slate-900">{row.district_name}</div>
                                <div className="mt-1 text-xs font-semibold text-slate-500">กลุ่มอายุสูงสุด: {row.top_age_group}</div>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-black ${getRiskClass(row.risk_level)}`}>{row.risk_level || "ไม่มีข้อมูล"}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                            <MobileMetric label="สะสม" value={`${formatNumber(row.total_cases)} ราย`} />
                            <MobileMetric label="สัปดาห์ล่าสุด" value={`${formatNumber(row.new_cases)} ราย`} />
                            <MobileMetric label="ต่อแสน" value={row.morbidity_rate === null ? "ไม่มีข้อมูล" : formatNumber(row.morbidity_rate, 1)} />
                            <MobileMetric label="เสียชีวิต" value={row.deaths === null ? "ไม่มีข้อมูล" : `${formatNumber(row.deaths)} ราย`} />
                        </div>
                        <div className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-600">
                            อัตราป่วยตาย {row.case_fatality_rate === null ? "ไม่มีข้อมูล" : `${formatNumber(row.case_fatality_rate, 2)}%`} • แนวโน้ม {row.trend_status}
                        </div>
                    </div>
                ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[860px] text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                        <tr>
                            {["อำเภอ", "สะสม", "สัปดาห์ล่าสุด", "อัตราป่วยต่อแสน", "เสียชีวิต", "อัตราป่วยตาย", "กลุ่มอายุสูงสุด", "สถานะ", "แนวโน้ม"].map((head) => (
                                <th key={head} className="px-3 py-2 text-left font-black">{head}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.district_name} className="border-t border-slate-100">
                                <td className="px-3 py-2 font-black text-slate-900">{row.district_name}</td>
                                <td className="px-3 py-2">{formatNumber(row.total_cases)}</td>
                                <td className="px-3 py-2">{formatNumber(row.new_cases)}</td>
                                <td className="px-3 py-2">{formatNumber(row.morbidity_rate, 1)}</td>
                                <td className="px-3 py-2">{formatNumber(row.deaths)}</td>
                                <td className="px-3 py-2">{formatNumber(row.case_fatality_rate, 2)}%</td>
                                <td className="px-3 py-2">{row.top_age_group}</td>
                                <td className="px-3 py-2">
                                    <span className={`rounded-full border px-2 py-1 text-xs font-black ${getRiskClass(row.risk_level)}`}>{row.risk_level}</span>
                                </td>
                                <td className="px-3 py-2 font-bold text-slate-700">{row.trend_status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function MobileMetric({ label, value }) {
    return (
        <div className="rounded-md bg-slate-50 px-2 py-2">
            <div className="text-[11px] font-bold text-slate-500">{label}</div>
            <div className="mt-1 font-black text-slate-900">{value}</div>
        </div>
    );
}

function PublicAdvicePanel({ topDistrict, lastUpdated }) {
    return (
        <aside className="min-w-0 rounded-lg border border-cyan-200 bg-cyan-50 p-3 shadow-sm sm:rounded-xl sm:p-4">
            <div className="mb-3 flex items-center gap-2">
                <AppIcon icon="megaphone" className="h-5 w-5 text-cyan-700" />
                <h3 className="text-sm font-black text-cyan-950 sm:text-lg">คำแนะนำประชาชน</h3>
            </div>
            <div className="space-y-3 text-sm leading-6 text-cyan-950">
                <p>
                    จังหวัดสตูลอยู่ระหว่างเฝ้าระวังสถานการณ์โรคไข้เลือดออก ขอให้ประชาชนช่วยกันกำจัดแหล่งเพาะพันธุ์ยุงลาย ปิดภาชนะเก็บน้ำ เปลี่ยนน้ำแจกัน และรีบพบแพทย์เมื่อมีไข้สูง ปวดเมื่อย หรือมีจุดเลือดออก
                </p>
                <div className="rounded-lg bg-white/70 p-3">
                    <div className="text-xs font-black text-cyan-700">พื้นที่ควรเฝ้าระวัง</div>
                    <div className="mt-1 font-black">{topDistrict?.district_name || "ทุกอำเภอ"} ({formatNumber(topDistrict?.total_cases)} ราย)</div>
                </div>
                <ul className="space-y-2 font-semibold">
                    <li className="rounded-lg bg-white/60 px-3 py-2">สำรวจและทำลายแหล่งน้ำขังทุก 7 วัน</li>
                    <li className="rounded-lg bg-white/60 px-3 py-2">ใช้ยากันยุงหรือสวมเสื้อแขนยาวเมื่อต้องอยู่ในพื้นที่เสี่ยง</li>
                    <li className="rounded-lg bg-white/60 px-3 py-2">หลีกเลี่ยงการซื้อยากลุ่ม NSAIDs รับประทานเองเมื่อสงสัยไข้เลือดออก</li>
                    <li className="rounded-lg bg-white/60 px-3 py-2">ติดต่อหน่วยบริการใกล้บ้านหรือสายด่วน 1669 เมื่อมีอาการรุนแรง</li>
                </ul>
                <div className="rounded-lg border border-cyan-200 bg-white px-3 py-2 text-xs font-bold text-cyan-800">
                    อัปเดตประกาศล่าสุด {formatDateTime(lastUpdated)}
                </div>
            </div>
        </aside>
    );
}
