"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import EOCLayout from "@/components/layouts/EOCLayout";
import { formatEocDisplayName } from "@/lib/eocDisplay";

const PublicIncidentMap = dynamic(() => import("@/components/PublicIncidentMap"), {
    ssr: false,
    loading: () => (
        <div className="flex h-[620px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
            กำลังโหลดแผนที่...
        </div>
    )
});

function getTodayDateKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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

export default function DiseaseMapPage() {
    const [selectedDate, setSelectedDate] = useState(getTodayDateKey());
    const [activeSession, setActiveSession] = useState(null);
    const [loadingSession, setLoadingSession] = useState(true);
    const [mapLayers, setMapLayers] = useState({
        floodAreas: false,
        diseaseReports: true,
        district: true,
        tambon: false,
        village: false,
        labels: true,
        incidents: true,
        traffic: false,
        shelters: false,
        hospitals: true,
        waterways: false,
        hillshade: false
    });

    useEffect(() => {
        const loadActiveSession = async () => {
            setLoadingSession(true);
            try {
                const response = await fetch("/stn-eoc/api/eoc/disease/area-status");
                const result = await response.json();
                if (result.hasActiveSession && result.activeSession) {
                    setActiveSession(result.activeSession);
                } else {
                    setActiveSession(null);
                }
            } catch (error) {
                console.error("Error loading disease active session:", error);
                setActiveSession(null);
            } finally {
                setLoadingSession(false);
            }
        };

        loadActiveSession();
    }, []);

    const eocName = activeSession
        ? formatEocDisplayName({ eoc_type: "disease", ...activeSession })
        : "โรคระบาด";

    return (
        <EOCLayout>
            <div className="mx-auto max-w-[1600px] space-y-4">
                <section className="relative overflow-hidden rounded-2xl bg-[#0b4c86] p-5 font-[family-name:var(--font-kanit)] text-white shadow-[0_18px_36px_-24px_rgba(11,76,134,.9)] sm:p-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-sm font-bold text-blue-100">{eocName}</p>
                            <h1 className="text-2xl font-semibold text-white md:text-3xl">แผนที่และสถานการณ์โรคระบาด</h1>
                            <p className="mt-1 text-sm text-blue-100">
                                ติดตามรายงานโรคระบาดจากหน่วยบริการร่วมกับรายงานเหตุการณ์จากประชาชน
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-blue-100">
                                <span className="rounded-full bg-white/15 px-3 py-1 text-blue-100">
                                    {activeSession ? "เปิด EOC อยู่" : loadingSession ? "กำลังตรวจสอบสถานะ" : "ยังไม่มี EOC ที่เปิดอยู่"}
                                </span>
                                {activeSession && (
                                    <span className="rounded-full bg-white/10 px-3 py-1">
                                        ครั้งที่ {activeSession.session_number || activeSession.id} เปิดเมื่อ {formatDateTime(activeSession.opened_at)}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                            <label className="block">
                                <span className="mb-1 block text-xs font-bold text-blue-100">วันที่</span>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(event) => setSelectedDate(event.target.value)}
                                    className="h-10 rounded-lg border border-white/25 bg-white/10 px-3 text-sm font-semibold text-white outline-none [color-scheme:dark] focus:border-white"
                                />
                            </label>
                            <Link href="/eoc/disease/records" className="flex h-10 items-center justify-center rounded-lg bg-white px-4 text-sm font-bold text-[#0b4c86] hover:bg-blue-50 sm:self-end">
                                บันทึกรายงานผู้ป่วย
                            </Link>
                        </div>
                    </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <PublicIncidentMap
                        disasterType="disease"
                        sessionId={activeSession?.id || null}
                        startDate={selectedDate}
                        endDate={selectedDate}
                        chrome="full"
                        heightClass="h-[620px]"
                        layers={mapLayers}
                        onLayersChange={setMapLayers}
                    />
                </section>
            </div>
        </EOCLayout>
    );
}
