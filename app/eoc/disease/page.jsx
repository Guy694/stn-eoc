'use client';
import { useState } from "react";
import EOCLayout from "@/components/layouts/EOCLayout";
import DisasterSessionSelector from "@/components/DisasterSessionSelector";
import { getDisasterConfig } from "@/lib/disasterConfig";

export default function DiseasePage() {
    const [selectedSession, setSelectedSession] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [viewMode, setViewMode] = useState('realtime');

    const config = getDisasterConfig('disease');

    const handleSessionChange = (session, year) => {
        setSelectedSession(session);
        setSelectedYear(year);
    };

    return (
        <EOCLayout>
            <div className="container mx-auto p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-4 flex items-center gap-3">
                        <span className="text-4xl">{config.icon}</span>
                        {config.name}
                    </h1>

                    {/* View Mode Switcher */}
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setViewMode('realtime')}
                            className={`px-6 py-3 rounded-lg font-medium transition-all ${viewMode === 'realtime'
                                ? 'bg-red-500 text-white shadow-lg transform scale-105'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            <span className="mr-2">🔴</span>
                            โหมดเรียลไทม์
                        </button>
                        <button
                            onClick={() => setViewMode('historical')}
                            className={`px-6 py-3 rounded-lg font-medium transition-all ${viewMode === 'historical'
                                ? 'bg-purple-500 text-white shadow-lg transform scale-105'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            <span className="mr-2">📊</span>
                            โหมดข้อมูลย้อนหลัง
                        </button>
                    </div>

                    <p className="text-gray-600">
                        {viewMode === 'realtime'
                            ? 'ติดตามสถานการณ์โรคระบาดแบบเรียลไทม์ตั้งแต่เปิด EOC'
                            : 'ดูข้อมูลสรุปและประวัติการระบาดย้อนหลัง'
                        }
                    </p>
                </div>

                {/* Session Selector */}
                <DisasterSessionSelector
                    disasterType="disease"
                    currentMode={viewMode}
                    onSessionChange={handleSessionChange}
                />

                {/* Coming Soon Content */}
                <div className="bg-white rounded-lg shadow-md p-8 text-center mt-6">
                    <div className="text-6xl mb-4">{config.icon}</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                        ระบบจัดการโรคระบาด
                    </h2>
                    <p className="text-gray-600 mb-4">
                        กำลังพัฒนาระบบติดตามและจัดการสถานการณ์โรคระบาด
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                        <FeatureCard
                            icon="🤒"
                            title="ติดตามผู้ป่วย"
                            description="บันทึกและติดตามผู้ป่วยยืนยัน"
                        />
                        <FeatureCard
                            icon="📊"
                            title="วิเคราะห์การแพร่"
                            description="แสดงกราฟและแนวโน้มการระบาด"
                        />
                        <FeatureCard
                            icon="💉"
                            title="จัดการวัคซีน"
                            description="ติดตามการฉีดวัคซีนและการป้องกัน"
                        />
                    </div>
                </div>
            </div>
        </EOCLayout>
    );
}

function FeatureCard({ icon, title, description }) {
    return (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <div className="text-3xl mb-2">{icon}</div>
            <h3 className="font-bold text-gray-800 mb-1">{title}</h3>
            <p className="text-sm text-gray-600">{description}</p>
        </div>
    );
}
