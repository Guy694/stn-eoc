"use client";
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import PublicLayout from "@/components/layouts/PublicLayout";
import DailyVillageFloodTimeline from "@/components/DailyVillageFloodTimeline";
import { disasterEvents, satunDistricts, filterEventsByDays } from "@/data/satunData";

// Import HybridDisasterMap แบบ dynamic
const HybridDisasterMap = dynamic(() => import("@/components/HybridDisasterMap"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-600">กำลังโหลดแผนที่...</p>
            </div>
        </div>
    ),
});

export default function DroughtMapPage() {
    const [polygons, setPolygons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [colorMode, setColorMode] = useState('risk');

    const [filters, setFilters] = useState({
        severity: "all",
        dateRange: "all",
        district: "all",
        tambon: "all",
        village: "all",
        status: "all",
    });

    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedPolygon, setSelectedPolygon] = useState(null);
    const [tambonOptions, setTambonOptions] = useState([]);
    const [villageOptions, setVillageOptions] = useState([]);

    // โหลดข้อมูล polygon
    useEffect(() => {
        fetch('/api/common/village-polygons')
            .then(res => res.json())
            .then(data => {
                setPolygons(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error loading polygons:', err);
                setLoading(false);
            });
    }, []);

    // อัพเดตตัวเลือกตำบลเมื่อเลือกอำเภอ
    useEffect(() => {
        if (filters.district !== "all") {
            const district = satunDistricts.find((d) => d.name === filters.district);
            setTambonOptions(district?.tambons || []);
            setFilters((prev) => ({ ...prev, tambon: "all", village: "all" }));
        } else {
            setTambonOptions([]);
            setFilters((prev) => ({ ...prev, tambon: "all", village: "all" }));
        }
    }, [filters.district]);

    // อัพเดตตัวเลือกหมู่บ้านเมื่อเลือกตำบล
    useEffect(() => {
        if (filters.tambon !== "all") {
            const tambon = tambonOptions.find((t) => t.name === filters.tambon);
            setVillageOptions(tambon?.villages || []);
            setFilters((prev) => ({ ...prev, village: "all" }));
        } else {
            setVillageOptions([]);
            setFilters((prev) => ({ ...prev, village: "all" }));
        }
    }, [filters.tambon, tambonOptions]);

    const handleFilterChange = (filterName, value) => {
        setFilters((prev) => ({ ...prev, [filterName]: value }));
    };

    // สร้างข้อมูล drought events (ตัวอย่าง - ควรมาจาก database จริง)
    const droughtEvents = useMemo(() => {
        // ในที่นี้จะสร้างข้อมูลตัวอย่าง เพราะยังไม่มีข้อมูลภัยแล้งใน satunData
        const mockDroughtEvents = [
            {
                id: 101,
                type: "ภัยแล้ง",
                severity: "สูง",
                district: "ทุ่งหว้า",
                tambon: "ทุ่งหว้า",
                village: "หมู่ 2",
                lat: 6.8654,
                lng: 99.8234,
                date: "2025-12-01",
                description: "ขาดแคลนน้ำเพื่อการเกษตร แหล่งน้ำแห้งขอด",
                affected: 120,
                status: "กำลังดำเนินการ",
            },
            {
                id: 102,
                type: "ภัยแล้ง",
                severity: "ปานกลาง",
                district: "มะนัง",
                tambon: "ปาล์มพัฒนา",
                village: "หมู่ 1",
                lat: 6.7123,
                lng: 99.7456,
                date: "2025-11-28",
                description: "ระดับน้ำในอ่างเก็บน้ำต่ำกว่าเกณฑ์",
                affected: 85,
                status: "กำลังดำเนินการ",
            },
            {
                id: 103,
                type: "ภัยแล้ง",
                severity: "สูงมาก",
                district: "ควนกาหลง",
                tambon: "ทุ่งนุ้ย",
                village: "หมู่ 2",
                lat: 6.7865,
                lng: 99.8567,
                date: "2025-11-25",
                description: "ภัยแล้งรุนแรง พืชผลเสียหาย ขาดแคลนน้ำอุปโภคบริโภค",
                affected: 200,
                status: "กำลังดำเนินการ",
            },
        ];

        let events = [...mockDroughtEvents];

        if (filters.dateRange !== "all") {
            events = filterEventsByDays(events, parseInt(filters.dateRange));
        }

        if (filters.severity !== "all") {
            events = events.filter((e) => e.severity === filters.severity);
        }

        if (filters.district !== "all") {
            events = events.filter((e) => e.district === filters.district);
        }

        if (filters.tambon !== "all") {
            events = events.filter((e) => e.tambon === filters.tambon);
        }

        if (filters.village !== "all") {
            events = events.filter((e) => e.village === filters.village);
        }

        if (filters.status !== "all") {
            events = events.filter((e) => e.status === filters.status);
        }

        return events;
    }, [filters]);

    // กรอง polygon ตาม filter
    const filteredPolygons = useMemo(() => {
        if (filters.district === "all") return polygons;
        return polygons.filter(p => p.distname === filters.district);
    }, [polygons, filters.district]);

    // สถิติ
    const stats = useMemo(() => {
        const severeCases = droughtEvents.filter(e => e.severity === "สูง" || e.severity === "สูงมาก").length;
        const affectedPeople = droughtEvents.reduce((sum, e) => sum + e.affected, 0);
        const activeEvents = droughtEvents.filter(e => e.status === "กำลังดำเนินการ").length;

        return {
            total: droughtEvents.length,
            severe: severeCases,
            affected: affectedPeople,
            active: activeEvents,
        };
    }, [droughtEvents]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg">กำลังโหลดข้อมูล...</p>
                </div>
            </div>
        );
    }

    return (
        <PublicLayout>
            <div className="container mx-auto p-6">
                {/* Page Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                        <span className="text-4xl">☀️</span>
                        แผนที่พื้นที่เสี่ยงภัยแล้ง
                    </h1>
                    <p className="text-gray-600">
                        ติดตามสถานการณ์ภัยแล้งและพื้นที่ขาดแคลนน้ำในจังหวัดสตูล
                    </p>
                </div>

                {/* Stats Bar */}
                <div className="bg-white shadow-md rounded-lg p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <StatCard
                            label="พื้นที่ประสบภัย"
                            value={stats.total}
                            icon="📊"
                            color="orange"
                        />
                        <StatCard
                            label="ความรุนแรงสูง"
                            value={stats.severe}
                            icon="⚠️"
                            color="red"
                        />
                        <StatCard
                            label="ผู้ได้รับผลกระทบ"
                            value={stats.affected.toLocaleString()}
                            icon="👥"
                            color="yellow"
                            unit="คน"
                        />
                        <StatCard
                            label="กำลังดำเนินการ"
                            value={stats.active}
                            icon="🔄"
                            color="green"
                        />
                    </div>
                </div>

                {/* Filter Panel */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">🔍 ฟิลเตอร์ข้อมูล</h2>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        {/* ช่วงเวลา */}
                        <FilterSelect
                            label="ช่วงเวลา"
                            value={filters.dateRange}
                            onChange={(e) => handleFilterChange("dateRange", e.target.value)}
                            options={[
                                { value: "all", label: "ทั้งหมด" },
                                { value: "1", label: "วันนี้" },
                                { value: "7", label: "7 วัน" },
                                { value: "30", label: "30 วัน" },
                            ]}
                        />

                        {/* ความรุนแรง */}
                        <FilterSelect
                            label="ความรุนแรง"
                            value={filters.severity}
                            onChange={(e) => handleFilterChange("severity", e.target.value)}
                            options={[
                                { value: "all", label: "ทั้งหมด" },
                                { value: "สูงมาก", label: "สูงมาก" },
                                { value: "สูง", label: "สูง" },
                                { value: "ปานกลาง", label: "ปานกลาง" },
                                { value: "ต่ำ", label: "ต่ำ" },
                            ]}
                        />

                        {/* อำเภอ */}
                        <FilterSelect
                            label="อำเภอ"
                            value={filters.district}
                            onChange={(e) => handleFilterChange("district", e.target.value)}
                            options={[
                                { value: "all", label: "ทั้งหมด" },
                                ...satunDistricts.map(d => ({ value: d.name, label: d.name }))
                            ]}
                        />

                        {/* ตำบล */}
                        <FilterSelect
                            label="ตำบล"
                            value={filters.tambon}
                            onChange={(e) => handleFilterChange("tambon", e.target.value)}
                            options={[
                                { value: "all", label: "ทั้งหมด" },
                                ...tambonOptions.map(t => ({ value: t.name, label: t.name }))
                            ]}
                            disabled={filters.district === "all"}
                        />

                        {/* หมู่บ้าน */}
                        <FilterSelect
                            label="หมู่บ้าน"
                            value={filters.village}
                            onChange={(e) => handleFilterChange("village", e.target.value)}
                            options={[
                                { value: "all", label: "ทั้งหมด" },
                                ...villageOptions.map(v => ({ value: v, label: v }))
                            ]}
                            disabled={filters.tambon === "all"}
                        />

                        {/* สถานะ */}
                        <FilterSelect
                            label="สถานะ"
                            value={filters.status}
                            onChange={(e) => handleFilterChange("status", e.target.value)}
                            options={[
                                { value: "all", label: "ทั้งหมด" },
                                { value: "กำลังดำเนินการ", label: "กำลังดำเนินการ" },
                                { value: "เสร็จสิ้น", label: "เสร็จสิ้น" },
                            ]}
                        />
                    </div>
                </div>

                {/* Color Mode Controls */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <label className="font-semibold text-gray-700">แสดงสีตาม:</label>
                            <div className="flex gap-2">
                                <ColorModeButton
                                    active={colorMode === 'risk'}
                                    onClick={() => setColorMode('risk')}
                                    label="ความเสี่ยง"
                                />
                                <ColorModeButton
                                    active={colorMode === 'district'}
                                    onClick={() => setColorMode('district')}
                                    label="อำเภอ"
                                />
                                <ColorModeButton
                                    active={colorMode === 'population'}
                                    onClick={() => setColorMode('population')}
                                    label="ประชากร"
                                />
                            </div>
                        </div>
                        <div className="text-sm text-gray-600">
                            พบ {droughtEvents.length} พื้นที่ประสบภัย
                        </div>
                    </div>
                </div>

                {/* Map Container */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden" style={{ height: '600px' }}>
                    <HybridDisasterMap
                        polygons={filteredPolygons}
                        events={droughtEvents}
                        colorMode={colorMode}
                        disasterType="drought"
                        onPolygonClick={setSelectedPolygon}
                        onEventClick={setSelectedEvent}
                    />
                </div>

                {/* Daily Village Flood Timeline - เพิ่มด้านล่างแผนที่ */}
                <div className="mt-6">
                    <DailyVillageFloodTimeline
                        startDate="2025-12-01"
                        polygons={polygons}
                    />
                </div>
            </div>
        </PublicLayout>
    );
}

// Component สำหรับแสดงสถิติ
function StatCard({ label, value, icon, color, unit = "" }) {
    const colorClasses = {
        orange: 'bg-orange-50 text-orange-700',
        red: 'bg-red-50 text-red-700',
        yellow: 'bg-yellow-50 text-yellow-700',
        green: 'bg-green-50 text-green-700',
    };

    return (
        <div className={`${colorClasses[color]} p-4 rounded-lg`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium opacity-80">{label}</p>
                    <p className="text-2xl font-bold mt-1">{value} {unit}</p>
                </div>
                <div className="text-3xl">{icon}</div>
            </div>
        </div>
    );
}

// Component สำหรับ Filter Select
function FilterSelect({ label, value, onChange, options, disabled = false }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}
            </label>
            <select
                value={value}
                onChange={onChange}
                disabled={disabled}
                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

// Component สำหรับปุ่ม Color Mode
function ColorModeButton({ active, onClick, label }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${active
                ? 'bg-orange-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
        >
            {label}
        </button>
    );
}
