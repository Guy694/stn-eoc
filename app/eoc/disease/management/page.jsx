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
    ShieldAlert,
    Users
} from "lucide-react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { EmptyPanel, PageHero } from "@/components/common/ThemePanels";
import { formatEocDisplayName } from "@/lib/eocDisplay";

const ACTIONS = [
    {
        title: "ภาพรวม EOC",
        description: "ดูสรุปจำนวนผู้ป่วย หน่วยบริการ และชนิดโรคของเหตุการณ์",
        href: "/eoc/disease/overview",
        icon: BarChart3,
        tone: "border-[#c9dcee] bg-[#edf5fc] text-[#083865]"
    },
    {
        title: "แผนที่และสถานการณ์",
        description: "ติดตามพื้นที่ที่มีรายงานโรคและเหตุการณ์จากประชาชน",
        href: "/eoc/disease/map",
        icon: Map,
        tone: "border-[#c9dcee] bg-[#edf5fc] text-[#083865]"
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
        href: "/eoc/disease/vulnerable-groups",
        icon: Users,
        tone: "border-violet-200 bg-violet-50 text-violet-800"
    },
    {
        title: "ข้อมูลหน่วยบริการ",
        description: "ตรวจสอบและจัดการโรงพยาบาล/สถานีอนามัยที่รายงานข้อมูล",
        href: "/admin/health-facilities",
        icon: BriefcaseMedical,
        tone: "border-[#c9dcee] bg-[#edf5fc] text-[#083865]"
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
        href: "/eoc/disease/records?tab=facility",
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
            <div className="w-full space-y-5">
                <PageHero
                    icon="disease"
                    eyebrow="โรคระบาด"
                    title={`จัดการ EOC ${eocName}`}
                    subtitle="ศูนย์รวมเมนูปฏิบัติการโรคระบาดสำหรับเจ้าหน้าที่ ตั้งแต่ภาพรวม แผนที่ สรุปรายวัน การบันทึกผู้ป่วย และข้อมูลสนับสนุน"
                    meta={(
                        <div className="flex flex-wrap gap-2 font-semibold">
                            <span className="rounded-full bg-white/15 px-3 py-1">
                                สถานะ: {activeSession ? "เปิด EOC" : "ยังไม่มี EOC ที่เปิดอยู่"}
                            </span>
                            {activeSession && (
                                <>
                                    <span className="rounded-full bg-white/15 px-3 py-1">ครั้งที่ {activeSession.session_number || activeSession.id}</span>
                                    <span className="rounded-full bg-white/15 px-3 py-1">เปิดเมื่อ {formatDateTime(activeSession.opened_at)}</span>
                                </>
                            )}
                        </div>
                    )}
                    aside={(
                        <div className="rounded-xl bg-white/10 p-4 ring-1 ring-white/15">
                            <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                                สรุปข้อมูลล่าสุด
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <MiniStat label="ผู้ป่วย" value={stats.total_patients} />
                                <MiniStat label="รายงาน" value={stats.total_reports} />
                                <MiniStat label="หน่วยบริการ" value={stats.affected_facilities} />
                                <MiniStat label="อำเภอ" value={stats.affected_districts} />
                            </div>
                        </div>
                    )}
                />

                {!loading && !activeSession && (
                    <EmptyPanel
                        icon="alert"
                        tone="amber"
                        title="ยังไม่มี EOC โรคระบาดที่เปิดอยู่"
                        text="สามารถเตรียมข้อมูลพื้นฐานหรือเปิด EOC จากหน้าจัดการ EOC กลางได้"
                        action={(
                            <Link href="/admin/eoc-management" className="inline-flex rounded-xl bg-[#0b4c86] px-4 py-2 text-sm font-semibold text-white hover:bg-[#083865]">
                                ไปหน้าเปิด/ปิด EOC
                            </Link>
                        )}
                    />
                )}

                <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {ACTIONS.map((action) => {
                        const Icon = action.icon;
                        return (
                            <Link
                                key={action.href}
                                href={action.href}
                                className="rounded-2xl border border-slate-200 bg-white p-4 font-[family-name:var(--font-kanit)] transition hover:border-sky-300 hover:shadow-[0_10px_24px_-18px_rgba(15,23,42,.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b4c86]"
                            >
                                <div className="flex items-start gap-3">
                                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${action.tone}`}>
                                        <Icon className="h-5 w-5" aria-hidden="true" />
                                    </span>
                                    <div>
                                        <h2 className="font-semibold text-slate-900">{action.title}</h2>
                                        <p className="mt-1 text-sm leading-6 text-slate-500">{action.description}</p>
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
        <div className="rounded-lg bg-white/10 p-3 text-center">
            <div className="text-2xl font-bold tabular-nums">{formatNumber(value)}</div>
            <div className="mt-1 text-xs font-medium text-blue-100">{label}</div>
        </div>
    );
}
