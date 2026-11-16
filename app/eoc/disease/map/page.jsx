"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import EOCLayout from "@/components/layouts/EOCLayout";
import { PageHero, heroInputClass, heroPrimaryButtonClass } from "@/components/common/ThemePanels";
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
            <div className="w-full space-y-4">
                <PageHero
                    icon="map"
                    eyebrow={`โรคระบาด · ${eocName}`}
                    title="แผนที่และสถานการณ์โรคระบาด"
                    subtitle="ติดตามรายงานโรคระบาดจากหน่วยบริการร่วมกับรายงานเหตุการณ์จากประชาชน"
                    meta={(
                        <div className="flex flex-wrap gap-2 font-semibold">
                            <span className="rounded-full bg-white/15 px-3 py-1">
                                {activeSession ? "เปิด EOC อยู่" : loadingSession ? "กำลังตรวจสอบสถานะ" : "ยังไม่มี EOC ที่เปิดอยู่"}
                            </span>
                            {activeSession && (
                                <span className="rounded-full bg-white/10 px-3 py-1">
                                    ครั้งที่ {activeSession.session_number || activeSession.id} เปิดเมื่อ {formatDateTime(activeSession.opened_at)}
                                </span>
                            )}
                        </div>
                    )}
                    actions={(
                        <>
                            <label className="flex items-center gap-2 text-sm font-medium text-blue-100">
                                วันที่
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(event) => setSelectedDate(event.target.value)}
                                    className={heroInputClass}
                                />
                            </label>
                            <Link href="/eoc/disease/records" className={heroPrimaryButtonClass}>
                                บันทึกรายงานผู้ป่วย
                            </Link>
                        </>
                    )}
                />

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
