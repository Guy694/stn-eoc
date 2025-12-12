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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">กำลังโหลดแผนที่...</p>
            </div>
        </div>
    ),
});

export default function FloodMapPage() {
    const [polygons, setPolygons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [colorMode, setColorMode] = useState('risk');
    const [showColors, setShowColors] = useState(true);
    const [gistdaData, setGistdaData] = useState(null);
    const [floodFreqData, setFloodFreqData] = useState(null);
    const [showGistdaLayer, setShowGistdaLayer] = useState(true);
    const [showFloodFreqLayer, setShowFloodFreqLayer] = useState(true);
    const [activeMapTab, setActiveMapTab] = useState('current'); // 'current' or 'frequency'
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

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

    // โหลดข้อมูล GISTDA
    useEffect(() => {
        fetchGistdaData();
        fetchFloodFreqData();
    }, []);

    const fetchGistdaData = async (days = '30') => {
        try {
            const response = await fetch(`/api/eoc/gistda/flood?days=${days}&limit=100`);
            const data = await response.json();
            if (data.success || data.useMockData) {
                setGistdaData(data.useMockData ? data.data : data);
            }
        } catch (err) {
            console.error('Error loading GISTDA data:', err);
        }
    };

    const fetchFloodFreqData = async () => {
        try {
            const response = await fetch('/api/eoc/gistda/flood-freq?limit=100');
            const data = await response.json();
            if (data.success || data.useMockData) {
                setFloodFreqData(data.data);
            }
        } catch (err) {
            console.error('Error loading flood frequency data:', err);
        }
    };

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

    // กรองข้อมูลเฉพาะน้ำท่วม
    const floodEvents = useMemo(() => {
        let events = disasterEvents.filter(e => e.type === "น้ำท่วม");

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
        const severeCases = floodEvents.filter(e => e.severity === "สูง" || e.severity === "สูงมาก").length;
        const affectedPeople = floodEvents.reduce((sum, e) => sum + e.affected, 0);
        const activeEvents = floodEvents.filter(e => e.status === "กำลังดำเนินการ").length;

        return {
            total: floodEvents.length,
            severe: severeCases,
            affected: affectedPeople,
            active: activeEvents,
        };
    }, [floodEvents]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg">กำลังโหลดข้อมูล...</p>
                </div>
            </div>
        );
    }

    return (
        <PublicLayout>
            <div className="container mx-auto p-6">
                {/* Page Header with Tabs */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-4 flex items-center gap-3">
                        <span className="text-4xl">💧</span>
                        แผนที่พื้นที่เสี่ยงน้ำท่วม
                    </h1>

                    {/* Tabs */}
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setActiveMapTab('current')}
                            className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeMapTab === 'current'
                                ? 'bg-blue-500 text-white shadow-md'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            <span className="mr-2">🌊</span>
                            สถานการณ์ปัจจุบัน
                        </button>
                        <button
                            onClick={() => setActiveMapTab('frequency')}
                            className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeMapTab === 'frequency'
                                ? 'bg-purple-500 text-white shadow-md'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            <span className="mr-2">🔄</span>
                            พื้นที่น้ำท่วมซ้ำซาก
                        </button>
                    </div>

                    <p className="text-gray-600">
                        {activeMapTab === 'current'
                            ? 'ติดตามสถานการณ์น้ำท่วมปัจจุบันและพื้นที่เสี่ยงในจังหวัดสตูล'
                            : 'พื้นที่ที่มีประวัติน้ำท่วมซ้ำซากตามข้อมูล GISTDA'
                        }
                    </p>
                </div>

                {/* Stats Bar */}
                <div className="bg-white shadow-md rounded-lg p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <StatCard
                            label="เหตุการณ์ทั้งหมด"
                            value={stats.total}
                            icon="📊"
                            color="blue"
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
                            color="orange"
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

                    {/* ช่วงวันที่ */}
                    <div className="mb-4 pb-4 border-b">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    วันที่เริ่มต้น
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    วันที่สิ้นสุด
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <button
                                    onClick={() => {
                                        setStartDate('');
                                        setEndDate('');
                                    }}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                                >
                                    ล้างวันที่
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        {/* ช่วงเวลา */}
                        <FilterSelect
                            label="ช่วงเวลา"
                            value={filters.dateRange}
                            onChange={(e) => {
                                handleFilterChange("dateRange", e.target.value);
                                if (e.target.value !== "all") {
                                    fetchGistdaData(e.target.value);
                                }
                            }}
                            options={[
                                { value: "all", label: "ทั้งหมด" },
                                { value: "1", label: "1 วัน" },
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
                                ...satunDistricts.map((d, idx) => ({ value: d.name, label: d.name, key: `district-${idx}` }))
                            ]}
                        />

                        {/* ตำบล */}
                        <FilterSelect
                            label="ตำบล"
                            value={filters.tambon}
                            onChange={(e) => handleFilterChange("tambon", e.target.value)}
                            options={[
                                { value: "all", label: "ทั้งหมด" },
                                ...tambonOptions.map((t, idx) => ({ value: t.name, label: t.name, key: `tambon-${idx}` }))
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
                                ...villageOptions.map((v, idx) => ({ value: v, label: v, key: `village-${idx}` }))
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
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showColors}
                                        onChange={(e) => setShowColors(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="font-semibold text-gray-700">แสดงสีตาม:</span>
                                </label>
                            </div>
                            <div className="flex gap-2">
                                <ColorModeButton
                                    active={colorMode === 'risk'}
                                    onClick={() => setColorMode('risk')}
                                    label="ความเสี่ยง"
                                    disabled={!showColors}
                                />
                                <ColorModeButton
                                    active={colorMode === 'district'}
                                    onClick={() => setColorMode('district')}
                                    label="อำเภอ"
                                    disabled={!showColors}
                                />
                                <ColorModeButton
                                    active={colorMode === 'population'}
                                    onClick={() => setColorMode('population')}
                                    label="ประชากร"
                                    disabled={!showColors}
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {activeMapTab === 'current' ? (
                                <>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showGistdaLayer}
                                            onChange={(e) => setShowGistdaLayer(e.target.checked)}
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">
                                            แสดงข้อมูล GISTDA
                                        </span>
                                    </label>
                                    <div className="text-sm text-gray-600">
                                        พบ {floodEvents.length} เหตุการณ์
                                    </div>
                                </>
                            ) : (
                                <>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showFloodFreqLayer}
                                            onChange={(e) => setShowFloodFreqLayer(e.target.checked)}
                                            className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">
                                            แสดงพื้นที่น้ำท่วมซ้ำซาก
                                        </span>
                                    </label>
                                    <div className="text-sm text-gray-600">
                                        พบ {floodFreqData?.features?.length || 0} พื้นที่
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Map Container */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden" style={{ height: '600px' }}>
                    {activeMapTab === 'current' ? (
                        <HybridDisasterMap
                            polygons={filteredPolygons}
                            events={floodEvents}
                            colorMode={colorMode}
                            showColors={showColors}
                            disasterType="flood"
                            onPolygonClick={setSelectedPolygon}
                            onEventClick={setSelectedEvent}
                            gistdaData={showGistdaLayer ? gistdaData : null}
                            startDate={startDate}
                            endDate={endDate}
                        />
                    ) : (
                        <HybridDisasterMap
                            polygons={filteredPolygons}
                            events={[]}
                            colorMode="district"
                            showColors={false}
                            disasterType="flood"
                            onPolygonClick={setSelectedPolygon}
                            floodFreqData={showFloodFreqLayer ? floodFreqData : null}
                        />
                    )}
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
        blue: 'bg-blue-50 text-blue-700',
        red: 'bg-red-50 text-red-700',
        orange: 'bg-orange-50 text-orange-700',
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
                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
                {options.map((opt, idx) => (
                    <option key={opt.key || opt.value || idx} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

// Component สำหรับปุ่ม Color Mode
function ColorModeButton({ active, onClick, label, disabled = false }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${disabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : active
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
        >
            {label}
        </button>
    );
}
