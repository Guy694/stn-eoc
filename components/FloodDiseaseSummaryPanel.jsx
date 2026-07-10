"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";
import AppIcon from "@/components/icons/AppIcon";

function formatNumber(value) {
    return Number(value || 0).toLocaleString("th-TH");
}

function formatThaiDate(value) {
    if (!value) return "-";
    const date = new Date(String(value).includes("T") ? value : `${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function formatThaiShortDate(value) {
    if (!value) return "-";
    const date = new Date(String(value).includes("T") ? value : `${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short"
    });
}

function buildQuery(sessionId) {
    const params = new URLSearchParams();
    if (sessionId) params.set("session_id", sessionId);
    const query = params.toString();
    return `/stn-eoc/api/public/flood-disease-summary${query ? `?${query}` : ""}`;
}

export default function FloodDiseaseSummaryPanel({ sessionId, reportDate }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();

        async function fetchSummary() {
            setLoading(true);
            try {
                const response = await fetch(buildQuery(sessionId), {
                    signal: controller.signal
                });
                const result = await response.json();
                setData(result.success ? result.data : null);
            } catch (error) {
                if (error.name !== "AbortError") {
                    console.error("Error fetching flood disease summary:", error);
                    setData(null);
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        fetchSummary();
        return () => controller.abort();
    }, [reportDate, sessionId]);

    const summary = data?.summary || {};
    const maxDiseaseCases = useMemo(
        () => Math.max(...(data?.by_disease || []).map((item) => Number(item.new_cases || 0)), 1),
        [data?.by_disease]
    );
    const hasReports = Number(summary.total_reports || 0) > 0;
    const periodText = data?.period?.label
        || (data?.period?.start_date && data?.period?.end_date
            ? `${formatThaiDate(data.period.start_date)} - ${formatThaiDate(data.period.end_date)}`
            : formatThaiDate(reportDate || data?.report_date));

    return (
        <section className="rounded-xl border border-cyan-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div>
                    <p className="text-xs font-black uppercase tracking-wide text-cyan-700">Flood Health Surveillance</p>
                    <h2 className="mt-1 font-black text-blue-900">สถานการณ์โรคที่เกี่ยวข้องกับอุทกภัย</h2>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                        ข้อมูลรวมจากศูนย์พักพิงและพื้นที่น้ำท่วม ไม่ใช่ Dashboard โรคระบาดเชิงลึก
                    </p>
                </div>
                <div className="rounded-lg bg-cyan-50 px-3 py-2 text-right text-xs font-bold text-cyan-800">
                    <div>{data?.period ? "ช่วงข้อมูล" : "วันที่แสดงข้อมูล"}</div>
                    <div className="text-sm font-black">{periodText}</div>
                </div>
            </div>

            {loading ? (
                <div className="p-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {[1, 2, 3, 4].map((item) => (
                            <div key={item} className="h-24 animate-pulse rounded-lg bg-slate-100"></div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-4 p-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <MiniMetric icon="stethoscope" label="ผู้ป่วยรายใหม่" value={summary.total_new_cases} unit="ราย" tone="rose" />
                        <MiniMetric icon="hospital" label="ส่งต่อ/นอน รพ." value={summary.total_hospitalized} unit="ราย" tone="amber" />
                        <MiniMetric icon="checkCircle" label="หายแล้ว" value={summary.total_recovered} unit="ราย" tone="emerald" />
                        <MiniMetric icon="shelter" label="ศูนย์ที่มีรายงาน" value={summary.shelters_with_reports} unit="แห่ง" tone="cyan" />
                    </div>

                    {!hasReports ? (
                        <div className="rounded-lg border border-dashed border-cyan-200 bg-cyan-50 p-4 text-center">
                            <AppIcon icon="checkCircle" className="mx-auto mb-2 h-8 w-8 text-cyan-700" />
                            <p className="font-black text-cyan-900">ยังไม่มีรายงานโรคในศูนย์พักพิงสำหรับวันที่เลือก</p>
                            <p className="mt-1 text-sm text-cyan-800">ระบบยังคงเฝ้าระวังโรคที่พบบ่อยหลังน้ำท่วม เช่น อุจจาระร่วง ไข้หวัด โรคผิวหนัง และตาแดง</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.75fr)]">
                                <ChartCard
                                    title="แนวโน้มผู้ป่วยรายวันช่วงน้ำท่วม"
                                    subtitle={data?.data_source === "google_sheet_seed" ? "ข้อมูลจาก Google Sheet กระจายรายวันแบบจำลองสำหรับ session 3" : "ข้อมูลรวมตามวันที่รายงาน"}
                                >
                                    <div className="h-72">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={data?.daily_trend || []} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="floodDiseaseCases" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#0891b2" stopOpacity={0.35} />
                                                        <stop offset="95%" stopColor="#0891b2" stopOpacity={0.04} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="report_date" tickFormatter={formatThaiShortDate} tick={{ fontSize: 11 }} />
                                                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                                                <Tooltip content={<TrendTooltip />} />
                                                <Area type="monotone" dataKey="new_cases" name="ผู้ป่วยรายวัน" stroke="#0891b2" strokeWidth={3} fill="url(#floodDiseaseCases)" activeDot={{ r: 5 }} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </ChartCard>

                                <ChartCard
                                    title="จำนวนผู้ป่วยรวมแยกตามโรค"
                                    subtitle={`รวม ${formatNumber(summary.total_new_cases)} ราย • ล่าสุด ${formatThaiDate(summary.latest_report_date)}`}
                                >
                                    <div className="h-72">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={data?.by_disease || []} layout="vertical" margin={{ top: 6, right: 18, left: 8, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                                                <YAxis type="category" dataKey="disease_name" width={92} tick={{ fontSize: 11 }} />
                                                <Tooltip formatter={(value) => `${formatNumber(value)} ราย`} />
                                                <Bar dataKey="new_cases" name="ผู้ป่วย" fill="#e11d48" radius={[0, 8, 8, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </ChartCard>
                            </div>

                            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <h3 className="font-black text-slate-900">โรคที่พบในพื้นที่น้ำท่วม</h3>
                                        <span className="text-xs font-bold text-slate-500">รายงานล่าสุด {formatThaiDate(summary.latest_report_date)}</span>
                                    </div>
                                    <div className="space-y-3">
                                        {(data?.by_disease || []).map((item) => (
                                            <div key={item.disease_name} className="rounded-lg bg-white p-3 shadow-sm">
                                                <div className="mb-2 flex items-center justify-between gap-3">
                                                    <div className="font-black text-slate-800">{item.disease_name}</div>
                                                    <div className="text-sm font-black text-rose-700">{formatNumber(item.new_cases)} ราย</div>
                                                </div>
                                                <div className="h-2 rounded-full bg-slate-100">
                                                    <div
                                                        className="h-2 rounded-full bg-rose-500"
                                                        style={{ width: `${Math.max(8, (Number(item.new_cases || 0) / maxDiseaseCases) * 100)}%` }}
                                                    />
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                                                    <span>ส่งต่อ {formatNumber(item.hospitalized)} ราย</span>
                                                    <span>หายแล้ว {formatNumber(item.recovered)} ราย</span>
                                                    <span>{formatNumber(item.shelter_count)} หน่วยรายงาน</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                        <h3 className="mb-3 font-black text-slate-900">หน่วยรายงานที่ต้องติดตาม</h3>
                                        <div className="space-y-2">
                                            {(data?.by_shelter || []).map((item) => (
                                                <div key={`${item.sheltername}-${item.tambon}`} className="rounded-lg bg-white p-3 shadow-sm">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <div className="font-black text-slate-800">{item.sheltername}</div>
                                                            <div className="mt-0.5 text-xs font-semibold text-slate-500">
                                                                ต.{item.tambon || "-"} อ.{item.district_name || "-"}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-lg font-black text-rose-700">{formatNumber(item.new_cases)}</div>
                                                            <div className="text-[11px] font-bold text-slate-500">ราย</div>
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 text-xs font-semibold text-amber-700">ส่งต่อ/นอน รพ. {formatNumber(item.hospitalized)} ราย • พบ {formatNumber(item.disease_count)} โรค</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">
                        <div className="mb-1 flex items-center gap-2 font-black">
                            <AppIcon icon="shield" className="h-4 w-4 text-emerald-700" />
                            คำแนะนำด้านสุขภาพหลังน้ำท่วม
                        </div>
                        <p>
                            ดื่มน้ำสะอาด ล้างมือบ่อย ๆ หลีกเลี่ยงการเดินลุยน้ำโดยไม่จำเป็น รีบแจ้งเจ้าหน้าที่หากพบอาการท้องเสีย ไข้สูง ผื่นคัน ตาแดง หรือบาดแผลติดเชื้อในศูนย์พักพิง
                        </p>
                    </div>
                </div>
            )}
        </section>
    );
}

function ChartCard({ title, subtitle, children }) {
    return (
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="mb-3">
                <h3 className="font-black text-slate-900">{title}</h3>
                {subtitle && <p className="mt-0.5 text-xs font-semibold text-slate-500">{subtitle}</p>}
            </div>
            <div className="rounded-lg bg-white p-2 shadow-sm">
                {children}
            </div>
        </div>
    );
}

function TrendTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const value = payload.find((item) => item.dataKey === "new_cases")?.value || 0;

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg">
            <div className="font-black text-slate-900">{formatThaiDate(label)}</div>
            <div className="mt-1 font-bold text-cyan-700">ผู้ป่วย {formatNumber(value)} ราย</div>
        </div>
    );
}

function MiniMetric({ icon, label, value, unit, tone }) {
    const tones = {
        rose: "border-rose-200 bg-rose-50 text-rose-700",
        amber: "border-amber-200 bg-amber-50 text-amber-700",
        emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
        cyan: "border-cyan-200 bg-cyan-50 text-cyan-700"
    };

    return (
        <div className={`rounded-lg border p-3 ${tones[tone] || tones.cyan}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-xs font-black opacity-80">{label}</div>
                    <div className="mt-1 text-2xl font-black">{formatNumber(value)}</div>
                    <div className="text-xs font-bold opacity-75">{unit}</div>
                </div>
                <div className="rounded-lg bg-white/75 p-2 shadow-sm">
                    <AppIcon icon={icon} className="h-5 w-5" />
                </div>
            </div>
        </div>
    );
}
