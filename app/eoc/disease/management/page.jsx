"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
    Activity,
    BarChart3,
    Bell,
    BriefcaseMedical,
    ClipboardList,
    FileChartColumn,
    Map,
    MonitorCog,
    ShieldAlert,
    Users
} from "lucide-react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { formatEocDisplayName } from "@/lib/eocDisplay";

const ACTIONS = [
    {
        title: "ภาพรวม EOC",
        description: "ดูสรุปจำนวนผู้ป่วย หน่วยบริการ และชนิดโรคของ session",
        href: "/eoc/disease/overview",
        icon: BarChart3,
        tone: "border-teal-200 bg-teal-50 text-teal-800"
    },
    {
        title: "แผนที่และสถานการณ์",
        description: "ติดตามพื้นที่ที่มีรายงานโรคและเหตุการณ์จากประชาชน",
        href: "/eoc/disease/map",
        icon: Map,
        tone: "border-cyan-200 bg-cyan-50 text-cyan-800"
    },
    {
        title: "สรุปสถานการณ์รายวัน",
        description: "ดูภาพรวมรายวัน แยกตามโรค อำเภอ และระดับความเสี่ยง",
        href: "/eoc/disease/daily-risk",
        icon: FileChartColumn,
        tone: "border-rose-200 bg-rose-50 text-rose-800"
    },
    {
        title: "บันทึกรายงานผู้ป่วย",
        description: "เพิ่ม/แก้ไขข้อมูลผู้ป่วยจากหน่วยบริการในพื้นที่",
        href: "/eoc/disease/records",
        icon: ClipboardList,
        tone: "border-emerald-200 bg-emerald-50 text-emerald-800"
    },
    {
        title: "ข้อมูลกลุ่มเปราะบาง",
        description: "ใช้ฐานข้อมูลกลางประกอบการติดตามและช่วยเหลือผู้เสี่ยง",
        href: "/eoc/vulnerable-groups",
        icon: Users,
        tone: "border-violet-200 bg-violet-50 text-violet-800"
    },
    {
        title: "ข้อมูลหน่วยบริการ",
        description: "ตรวจสอบและจัดการโรงพยาบาล/สถานีอนามัยที่รายงานข้อมูล",
        href: "/admin/health-facilities",
        icon: BriefcaseMedical,
        tone: "border-blue-200 bg-blue-50 text-blue-800"
    },
    {
        title: "ประกาศข่าวสาร",
        description: "เผยแพร่ประกาศและคำแนะนำด้านสาธารณสุข",
        href: "/admin/announcements",
        icon: Bell,
        tone: "border-amber-200 bg-amber-50 text-amber-800"
    },
    {
        title: "รายงานโรคระบาด",
        description: "จัดการรายงานโรคระบาดจากหน่วยบริการแบบละเอียด",
        href: "/admin/disease-reports",
        icon: Activity,
        tone: "border-slate-200 bg-slate-50 text-slate-800"
    }
];

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

function formatNumber(value) {
    return Number(value || 0).toLocaleString("th-TH");
}

export default function DiseaseManagementPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const today = new Date().toISOString().slice(0, 10);
                const response = await fetch(`/stn-eoc/api/eoc/disease/daily-risk?date=${today}`);
                const result = await response.json();
                setData(result);
            } catch (error) {
                console.error("Error loading disease management data:", error);
                setData({ success: false });
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const activeSession = data?.activeSession || null;
    const stats = data?.totalStats || {};
    const eocName = useMemo(
        () => activeSession ? formatEocDisplayName({ eoc_type: "disease", ...activeSession }) : "โรคระบาด",
        [activeSession]
    );

    return (
        <EOCLayout>
            <div className="mx-auto max-w-7xl space-y-5">
                <section className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-700 to-rose-600 p-5 text-white shadow-sm">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-teal-100">
                                <MonitorCog className="h-4 w-4" />
                                Officer EOC Management Dashboard
                            </div>
                            <h1 className="mt-2 text-2xl font-black md:text-3xl">จัดการ EOC {eocName}</h1>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/90">
                                ศูนย์รวมเมนูปฏิบัติการโรคระบาดสำหรับเจ้าหน้าที่ ตั้งแต่ภาพรวม แผนที่ สรุปรายวัน การบันทึกผู้ป่วย และข้อมูลสนับสนุน
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                                <span className="rounded-full bg-white/15 px-3 py-1">
                                    สถานะ: {activeSession ? "เปิด EOC" : "ยังไม่มี EOC ที่เปิดอยู่"}
                                </span>
                                {activeSession && (
                                    <>
                                        <span className="rounded-full bg-white/15 px-3 py-1">Session #{activeSession.session_number || activeSession.id}</span>
                                        <span className="rounded-full bg-white/15 px-3 py-1">เปิดเมื่อ {formatDateTime(activeSession.opened_at)}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-white/20 bg-white/15 p-4 backdrop-blur">
                            <div className="flex items-center gap-2 text-sm font-black text-white">
                                <ShieldAlert className="h-4 w-4" />
                                สรุปข้อมูลล่าสุด
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <MiniStat label="ผู้ป่วย" value={stats.total_patients} />
                                <MiniStat label="รายงาน" value={stats.total_reports} />
                                <MiniStat label="หน่วยบริการ" value={stats.affected_facilities} />
                                <MiniStat label="อำเภอ" value={stats.affected_districts} />
                            </div>
                        </div>
                    </div>
                </section>

                {!loading && !activeSession && (
                    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                        <h2 className="font-black">ยังไม่มี EOC โรคระบาดที่เปิดอยู่</h2>
                        <p className="mt-1 text-sm">สามารถเตรียมข้อมูลพื้นฐานหรือเปิด EOC จากหน้าจัดการ EOC กลางได้</p>
                        <Link href="/admin/eoc-management" className="mt-3 inline-flex rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700">
                            ไปหน้าเปิด/ปิด EOC
                        </Link>
                    </section>
                )}

                <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {ACTIONS.map((action) => {
                        const Icon = action.icon;
                        return (
                            <Link
                                key={action.href}
                                href={action.href}
                                className={`rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${action.tone}`}
                            >
                                <div className="flex items-start gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/70">
                                        <Icon className="h-5 w-5" />
                                    </span>
                                    <div>
                                        <h2 className="font-black">{action.title}</h2>
                                        <p className="mt-1 text-sm leading-6 opacity-80">{action.description}</p>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </section>
            </div>
        </EOCLayout>
    );
}

function MiniStat({ label, value }) {
    return (
        <div className="rounded-lg bg-white/15 p-3 text-center">
            <div className="text-2xl font-black">{formatNumber(value)}</div>
            <div className="mt-1 text-xs font-semibold text-white/80">{label}</div>
        </div>
    );
}
