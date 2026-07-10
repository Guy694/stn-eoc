"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import EOCLayout from "@/components/layouts/EOCLayout";
import DiseaseOutbreakDashboard from "@/components/DiseaseOutbreakDashboard";
import { formatEocDisplayName } from "@/lib/eocDisplay";

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

function getTodayDateKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function DiseasePage() {
    const [data, setData] = useState(null);
    const [selectedDate, setSelectedDate] = useState(getTodayDateKey());
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/stn-eoc/api/eoc/disease/daily-risk?date=${selectedDate}`);
            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error("Error fetching disease overview:", error);
            setData({ success: false, message: "เกิดข้อผิดพลาดในการโหลดข้อมูล" });
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const activeSession = data?.activeSession;
    const stats = data?.totalStats || {};
    const activeDiseaseEocName = activeSession
        ? formatEocDisplayName({ eoc_type: "disease", ...activeSession })
        : "โรคระบาด";

    return (
        <EOCLayout>
            <div className="container mx-auto p-4 md:p-6">
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-sm font-bold text-teal-700">{activeDiseaseEocName}</p>
                        <h1 className="text-2xl font-black text-gray-900 md:text-3xl">ภาพรวมสถานการณ์{activeDiseaseEocName}</h1>
                        <p className="mt-1 text-sm text-gray-600">
                            ติดตามข้อมูลผู้ป่วย รายงานจากหน่วยบริการ และชนิดโรคของ EOC Session
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Link href="/eoc/disease/records" className="rounded-lg bg-teal-600 px-4 py-2 text-center text-sm font-bold text-white hover:bg-teal-700">
                            บันทึกรายงานผู้ป่วย
                        </Link>
                        <Link href="/eoc/disease/daily-risk" className="rounded-lg border border-teal-200 bg-white px-4 py-2 text-center text-sm font-bold text-teal-700 hover:bg-teal-50">
                            สรุปรายวัน
                        </Link>
                    </div>
                </div>

                {loading ? (
                    <div className="rounded-xl bg-white p-10 text-center shadow-sm">
                        <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-teal-500 border-t-transparent"></div>
                        <p className="text-gray-600">กำลังโหลดข้อมูลโรคระบาด...</p>
                    </div>
                ) : !data?.success ? (
                    <div className="rounded-xl border border-dashed border-teal-200 bg-teal-50 p-6 text-center">
                        <h2 className="text-xl font-black text-teal-900">พร้อมใช้งานเมื่อเปิด EOC โรคระบาด</h2>
                        <p className="mt-2 text-sm text-teal-800">
                            {data?.message || "ยังไม่มี EOC Session โรคระบาดที่เปิดอยู่"}
                        </p>
                        <Link href="/admin/eoc-management" className="mt-4 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700">
                            ไปหน้าเปิด EOC
                        </Link>
                    </div>
                ) : (
                    <>
                        {activeSession && (
                            <section className="mb-6 rounded-xl bg-gradient-to-r from-teal-600 to-rose-500 p-5 text-white shadow-sm">
                                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px] md:items-center">
                                    <div>
                                        <div className="text-sm font-semibold text-white/85">Session #{activeSession.session_number}</div>
                                        <h2 className="mt-1 text-2xl font-black">
                                            {activeDiseaseEocName}
                                        </h2>
                                        <p className="mt-2 text-sm text-white/90">เปิดเมื่อ {formatDateTime(activeSession.opened_at)}</p>
                                        {activeSession.open_reason && (
                                            <p className="mt-1 text-sm text-white/90">เหตุผล: {activeSession.open_reason}</p>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <MiniStat label="วัน" value={activeSession.days_open || 0} />
                                        <MiniStat label="กิจกรรม" value={activeSession.total_activities || 0} />
                                        <MiniStat label="บันทึก" value={activeSession.total_data_entries || 0} />
                                    </div>
                                </div>
                            </section>
                        )}

                        <section className="mb-6">
                            <DiseaseOutbreakDashboard session={activeSession} />
                        </section>

                        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
                            <StatCard label="อำเภอที่พบรายงาน" value={stats.affected_districts || 0} />
                            <StatCard label="หน่วยบริการ" value={stats.affected_facilities || 0} />
                            <StatCard label="ชนิดโรคในรายงาน" value={stats.diseases_count || 0} />
                            <StatCard label="จำนวนรายงาน" value={stats.total_reports || 0} />
                            <StatCard label="ผู้ป่วยรวม" value={stats.total_patients || 0} strong />
                        </section>

                        <section className="mb-6 rounded-xl bg-white p-4 shadow-sm">
                            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <h2 className="text-lg font-black text-gray-900">ข้อมูลประจำวันที่เลือก</h2>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(event) => setSelectedDate(event.target.value)}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-teal-500 focus:outline-none"
                                />
                            </div>
                            <div className="grid gap-4 lg:grid-cols-2">
                                <SummaryList
                                    title="สรุปตามโรค"
                                    emptyText="ยังไม่มีรายงานโรคในวันนี้"
                                    rows={data.diseaseSummary || []}
                                    renderRow={(item) => (
                                        <>
                                            <span className="font-bold text-gray-800">{item.disease_name}</span>
                                            <span className="text-sm text-gray-600">{Number(item.total_patients || 0).toLocaleString()} ราย</span>
                                        </>
                                    )}
                                />
                                <SummaryList
                                    title="สรุปตามอำเภอ"
                                    emptyText="ยังไม่มีรายงานแยกตามอำเภอ"
                                    rows={data.districtSummary || []}
                                    renderRow={(item) => (
                                        <>
                                            <span className="font-bold text-gray-800">{item.district || "-"}</span>
                                            <span className="text-sm text-gray-600">{Number(item.total_patients || 0).toLocaleString()} ราย</span>
                                        </>
                                    )}
                                />
                            </div>
                        </section>
                    </>
                )}
            </div>
        </EOCLayout>
    );
}

function MiniStat({ label, value }) {
    return (
        <div className="rounded-lg bg-white/20 p-3 backdrop-blur-sm">
            <div className="text-2xl font-black">{Number(value || 0).toLocaleString()}</div>
            <div className="text-xs font-semibold text-white/85">{label}</div>
        </div>
    );
}

function StatCard({ label, value, strong = false }) {
    return (
        <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold text-gray-500">{label}</div>
            <div className={`mt-2 text-3xl font-black ${strong ? "text-rose-600" : "text-teal-700"}`}>
                {Number(value || 0).toLocaleString()}
            </div>
        </div>
    );
}

function SummaryList({ title, rows, emptyText, renderRow }) {
    return (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <h3 className="mb-3 font-black text-gray-900">{title}</h3>
            {rows.length === 0 ? (
                <p className="rounded-lg bg-white p-4 text-center text-sm text-gray-500">{emptyText}</p>
            ) : (
                <div className="space-y-2">
                    {rows.map((item, index) => (
                        <div key={item.disease_name || item.district || index} className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                            {renderRow(item)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
