"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import EOCLayout from "@/components/layouts/EOCLayout";

// Import PolygonMap แบบ dynamic เพื่อหลีกเลี่ยง SSR
const PolygonMap = dynamic(() => import("@/components/PolygonMap"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">กำลังโหลดแผนที่...</p>
            </div>
        </div>
    ),
});

export default function VillageMapPage() {
    const [polygons, setPolygons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [colorMode, setColorMode] = useState('district'); // 'district' หรือ 'population'
    const [stats, setStats] = useState({
        totalVillages: 0,
        totalHouseholds: 0,
        totalBuildings: 0,
        districts: []
    });

    useEffect(() => {
        // โหลดข้อมูล polygon
        fetch('/api/common/village-polygons')
            .then(res => res.json())
            .then(data => {
                setPolygons(data);
                calculateStats(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error loading polygons:', err);
                setLoading(false);
            });
    }, []);

    const calculateStats = (data) => {
        const totalHouseholds = data.reduce((sum, p) => sum + p.num_hh, 0);
        const totalBuildings = data.reduce((sum, p) => sum + p.num_build, 0);
        const districtsSet = new Set(data.map(p => p.distname));

        setStats({
            totalVillages: data.length,
            totalHouseholds,
            totalBuildings,
            districts: Array.from(districtsSet)
        });
    };

    const handlePolygonClick = (polygon) => {
        console.log('Selected polygon:', polygon);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg">กำลังโหลดข้อมูลหมู่บ้าน...</p>
                </div>
            </div>
        );
    }

    return (
        <EOCLayout>
            {/* Header */}
            <div className="bg-white shadow-sm border-b -mx-6 -mt-6 mb-4">
                <div className="px-4 sm:px-6 lg:px-8 py-6">
                    <h1 className="text-3xl font-bold text-gray-900">
                        แผนที่หมู่บ้านจังหวัดสตูล
                    </h1>
                    <p className="mt-1 text-gray-600">
                        ข้อมูลพื้นที่และประชากรแบบ Polygon
                    </p>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="bg-white shadow-sm border-b -mx-6 mb-4">
                <div className="px-4 sm:px-6 lg:px-8 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <StatCard
                            label="จำนวนหมู่บ้าน"
                            value={stats.totalVillages.toLocaleString()}
                            icon="🏘️"
                            color="blue"
                        />
                        <StatCard
                            label="จำนวนครัวเรือน"
                            value={stats.totalHouseholds.toLocaleString()}
                            icon="👨‍👩‍👧‍👦"
                            color="green"
                        />
                        <StatCard
                            label="จำนวนอาคาร"
                            value={stats.totalBuildings.toLocaleString()}
                            icon="🏠"
                            color="orange"
                        />
                        <StatCard
                            label="จำนวนอำเภอ"
                            value={stats.districts.length}
                            icon="📍"
                            color="purple"
                        />
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white shadow-sm border-b -mx-6 mb-4">
                <div className="px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <label className="font-semibold text-gray-700">
                                แสดงสีตาม:
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setColorMode('district')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${colorMode === 'district'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        }`}
                                >
                                    อำเภอ
                                </button>
                                <button
                                    onClick={() => setColorMode('population')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${colorMode === 'population'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        }`}
                                >
                                    จำนวนครัวเรือน
                                </button>
                            </div>
                        </div>
                        <div className="text-sm text-gray-600">
                            คลิกที่พื้นที่เพื่อดูรายละเอียด
                        </div>
                    </div>
                </div>
            </div>

            {/* Map Container */}
            <div className="h-[calc(100vh-280px)] min-h-[500px]">
                <PolygonMap
                    polygons={polygons}
                    colorMode={colorMode}
                    onPolygonClick={handlePolygonClick}
                />
            </div>
        </EOCLayout>
    );
}

// Component สำหรับแสดงสถิติ
function StatCard({ label, value, icon, color }) {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-700',
        green: 'bg-green-50 text-green-700',
        orange: 'bg-orange-50 text-orange-700',
        purple: 'bg-purple-50 text-purple-700',
    };

    return (
        <div className={`${colorClasses[color]} p-4 rounded-lg`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium opacity-80">{label}</p>
                    <p className="text-2xl font-bold mt-1">{value}</p>
                </div>
                <div className="text-3xl">{icon}</div>
            </div>
        </div>
    );
}
