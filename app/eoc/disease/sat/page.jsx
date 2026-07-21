"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import EOCLayout from "@/components/layouts/EOCLayout";
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

export default function SatDashboardPage() {
    const [data, setData] = useState(null);
    const [selectedDate, setSelectedDate] = useState(getTodayDateKey());
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // TODO: Replace with actual SAT API endpoint when available
            const response = await fetch(`/stn-eoc/api/eoc/disease/daily-risk?date=${selectedDate}`);
            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error("Error fetching SAT dashboard:", error);
            setData({ success: false, message: "เกิดข้อผิดพลาดในการโหลดข้อมูล" });
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) {
        return (
            <EOCLayout title="แดชบอร์ด SAT">
                <div className="flex min-h-[20rem] items-center justify-center">
                    <div className="animate-spin rounded-full border-4 border-b-primary h-12 w-12"></div>
                </div>
            </EOCLayout>
        );
    }

    if (!data?.success) {
        return (
            <EOCLayout title="แดชบอร์ด SAT">
                <div className="p-6">
                    <p className="text-red-500">{data?.message || "ไม่สามารถโหลดข้อมูลได้"}</p>
                </div>
            </EOCLayout>
        );
    }

    const activeSession = data?.activeSession;
    const stats = data?.totalStats || {};
    const activeDiseaseEocName = activeSession
        ? `${formatEocDisplayName(activeSession.eoc_type, activeSession.session_number)} ${activeSession.event_name}`
        : "-";

    return (
        <EOCLayout title="แดชบอร์ด SAT">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">สรุปสถานการณ์โรคระบาด (SAT)</h1>
                        <p className="text-muted-foreground">
                            เซสชันที่ทำงาน: {activeDiseaseEocName}
                        </p>
                    </div>
                    <div className="flex space-x-4 mt-4 md:mt-0">
                        <label className="flex items-center space-x-2 rtl:reverse">
                            <span className="text-sm font-medium">เลือกวันที่:</span>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="border-input hover:border-primary/50 focus:border-primary focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </label>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="border rounded-lg p-4">
                        <h3 className="text-sm font-medium text-muted-foreground">ผู้ป่วยสะสม</h3>
                        <p className="mt-1 text-2xl font-bold">{stats.total_cases?.toLocaleString() || "0"}</p>
                    </div>
                    <div className="border rounded-lg p-4">
                        <h3 className="text-sm font-medium text-muted-foreground">ผู้ป่วยใหม่</h3>
                        <p className="mt-1 text-2xl font-bold">{stats.new_cases?.toLocaleString() || "0"}</p>
                    </div>
                    <div className="border rounded-lg p-4">
                        <h3 className="text-sm font-medium text-muted-foreground">ผู้ป่วยหายสะสม</h3>
                        <p className="mt-1 text-2xl font-bold">{stats.recovered?.toLocaleString() || "0"}</p>
                    </div>
                    <div className="border rounded-lg p-4">
                        <h3 className="text-sm font-medium text-muted-foreground">ผู้เสียชีวิตสะสม</h3>
                        <p className="mt-1 text-2xl font-bold">{stats.deaths?.toLocaleString() || "0"}</p>
                    </div>
                </div>

                {/* Additional SAT-specific sections can be added here */}
                <div className="border rounded-lg p-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">สรุปสถานการณ์ SAT</h3>
                    <p className="text-muted-foreground">
                        ข้อมูล SAT จะแสดงที่นี่เมื่อมีการพัฒนา API สำหรับ SAT โดยเฉพาะ
                    </p>
                </div>
            </div>
        </EOCLayout>
    );
}