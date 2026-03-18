"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useEOC } from "@/context/EOCContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import CitizenDashboard from "@/components/CitizenDashboard";

// กำหนดเหตุการณ์ที่ระบบรองรับ
const EOC_MODULES = [
    {
        key: 'flood',
        name: 'น้ำท่วม',
        icon: '🌊',
        description: 'ระบบติดตามสถานการณ์น้ำท่วม พื้นที่ประสบภัย ศูนย์อพยพ',
        path: '/eoc/flood',
        gradient: 'from-blue-500 to-cyan-500',
        bgLight: 'bg-blue-50',
        borderActive: 'border-blue-500',
        textColor: 'text-blue-700',
    },
    {
        key: 'accident',
        name: 'อุบัติเหตุช่วงเทศกาล',
        icon: '🚗',
        description: 'ระบบติดตามอุบัติเหตุ 7 วันอันตราย ปีใหม่ / สงกรานต์',
        path: '/eoc/festival-accidents',
        gradient: 'from-red-500 to-orange-500',
        bgLight: 'bg-red-50',
        borderActive: 'border-red-500',
        textColor: 'text-red-700',
    },
    {
        key: 'drought',
        name: 'ภัยแล้ง',
        icon: '☀️',
        description: 'ระบบติดตามสถานการณ์ภัยแล้ง พื้นที่ขาดแคลนน้ำ',
        path: '#',
        gradient: 'from-amber-500 to-yellow-500',
        bgLight: 'bg-amber-50',
        borderActive: 'border-amber-500',
        textColor: 'text-amber-700',
        comingSoon: true,
    },
];

export default function DashboardPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const { eocStatus, loading: eocLoading } = useEOC();

    // Redirect if not logged in
    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">กำลังโหลด...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <EOCLayout>
            <div className="p-6">
                {user.role === 'citizen' ? (
                    <CitizenDashboard />
                ) : (
                    <>
                        {/* Welcome */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-gray-800 mb-2">
                                ยินดีต้อนรับ, {`${user.title || ''} ${user.givenName || ''} ${user.familyName || ''}`.trim() || user.username}
                            </h1>
                            <p className="text-gray-600">
                                สิทธิ์การเข้าถึง: <span className="font-semibold text-green-600">{user.roleDisplay}</span>
                                {user.department && ` | ${user.department}`}
                                {user.position && ` | ${user.position}`}
                            </p>
                        </div>

                        {/* EOC Event Modules */}
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-6">เหตุการณ์ต่างๆ</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {EOC_MODULES.map(mod => {
                                    const status = eocStatus[mod.key];
                                    const isActive = status?.is_active || false;

                                    return (
                                        <EventModuleCard
                                            key={mod.key}
                                            module={mod}
                                            isActive={isActive}
                                            eocLoading={eocLoading}
                                            sessionInfo={status}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </EOCLayout>
    );
}

function EventModuleCard({ module, isActive, eocLoading, sessionInfo }) {
    const content = (
        <div
            className={`relative bg-white rounded-2xl shadow-md border-2 overflow-hidden transition-all duration-300 ${
                module.comingSoon
                    ? 'border-gray-200 opacity-70 cursor-default'
                    : isActive
                        ? `${module.borderActive} shadow-lg hover:shadow-xl hover:-translate-y-1`
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-lg hover:-translate-y-1'
            }`}
        >
            {/* Gradient strip */}
            <div className={`h-2 bg-gradient-to-r ${module.gradient}`} />

            <div className="p-6">
                {/* Icon & Status */}
                <div className="flex items-start justify-between mb-4">
                    <span className="text-5xl">{module.icon}</span>
                    {eocLoading ? (
                        <div className="animate-pulse bg-gray-200 rounded-full h-7 w-20"></div>
                    ) : module.comingSoon ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
                            เร็วๆ นี้
                        </span>
                    ) : isActive ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            เปิดใช้งาน
                        </span>
                    ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
                            ปิดอยู่
                        </span>
                    )}
                </div>

                {/* Title & Description */}
                <h3 className="text-xl font-bold text-gray-800 mb-2">{module.name}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{module.description}</p>

                {/* Session info when active */}
                {isActive && sessionInfo?.session_number && (
                    <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400">
                        Session #{sessionInfo.session_number}
                        {sessionInfo.activated_at && (
                            <> · เปิดเมื่อ {new Date(sessionInfo.activated_at).toLocaleDateString('th-TH')}</>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    if (module.comingSoon) {
        return content;
    }

    return (
        <Link href={module.path} className="block">
            {content}
        </Link>
    );
}

