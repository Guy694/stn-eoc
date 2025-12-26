"use client";
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import PublicLayout from "@/components/layouts/PublicLayout";
import { disasterEvents, satunDistricts, filterEventsByDays } from "@/data/satunData";

// Import DisasterMap แบบ dynamic เพื่อหลีกเลี่ยง SSR error
const DisasterMap = dynamic(() => import("@/components/DisasterMap"), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded-lg">
            <div className="text-center">
                <div className="text-4xl mb-2">🗺️</div>
                <p className="text-gray-600">กำลังโหลดแผนที่...</p>
            </div>
        </div>
    ),
});

export default function DisasterMapPage() {
    const [filters, setFilters] = useState({
        disasterType: "all",
        severity: "all",
        dateRange: "all",
        district: "all",
        tambon: "all",
        village: "all",
        status: "all",
    });

    const [selectedEvent, setSelectedEvent] = useState(null);
    const [tambonOptions, setTambonOptions] = useState([]);
    const [villageOptions, setVillageOptions] = useState([]);

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

    // กรองข้อมูลตามฟิลเตอร์
    const filteredEvents = useMemo(() => {
        let events = [...disasterEvents];

        // กรองตามวันที่
        if (filters.dateRange !== "all") {
            events = filterEventsByDays(events, parseInt(filters.dateRange));
        }

        // กรองตามประเภทภัย
        if (filters.disasterType !== "all") {
            events = events.filter((e) => e.type === filters.disasterType);
        }

        // กรองตามความรุนแรง
        if (filters.severity !== "all") {
            events = events.filter((e) => e.severity === filters.severity);
        }

        // กรองตามอำเภอ
        if (filters.district !== "all") {
            events = events.filter((e) => e.district === filters.district);
        }

        // กรองตามตำบล
        if (filters.tambon !== "all") {
            events = events.filter((e) => e.tambon === filters.tambon);
        }

        // กรองตามหมู่บ้าน
        if (filters.village !== "all") {
            events = events.filter((e) => e.village === filters.village);
        }

        // กรองตามสถานะ
        if (filters.status !== "all") {
            events = events.filter((e) => e.status === filters.status);
        }

        return events;
    }, [filters]);

    return (
        <PublicLayout>
            <div className="container mx-auto p-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">แผนที่ภัยพิบัติ</h1>
                    <p className="text-gray-600">ติดตามสถานการณ์ภัยพิบัติและเหตุการณ์ฉุกเฉินแบบเรียลไทม์</p>
                </div>

                {/* Filter Panel */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">🔍 ฟิลเตอร์ข้อมูล - จังหวัดสตูล</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* ช่วงเวลา */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                ช่วงเวลา
                            </label>
                            <select
                                value={filters.dateRange}
                                onChange={(e) => handleFilterChange("dateRange", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            >
                                <option value="all">ทั้งหมด</option>
                                <option value="1">วันนี้</option>
                                <option value="7">7 วันย้อนหลัง</option>
                                <option value="30">30 วันย้อนหลัง</option>
                                <option value="90">90 วันย้อนหลัง</option>
                            </select>
                        </div>

                        {/* ประเภทภัย */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                ประเภทภัยพิบัติ
                            </label>
                            <select
                                value={filters.disasterType}
                                onChange={(e) => handleFilterChange("disasterType", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            >
                                <option value="all">ทั้งหมด</option>
                                <option value="น้ำท่วม">น้ำท่วม</option>
                                <option value="แผ่นดินไหว">แผ่นดินไหว</option>
                                <option value="ไฟป่า">ไฟป่า</option>
                                <option value="พายุ">พายุ</option>
                                <option value="ดินถ่ม">ดินถ่ม</option>
                            </select>
                        </div>

                        {/* ระดับความรุนแรง */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                ระดับความรุนแรง
                            </label>
                            <select
                                value={filters.severity}
                                onChange={(e) => handleFilterChange("severity", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            >
                                <option value="all">ทั้งหมด</option>
                                <option value="สูง">สูง</option>
                                <option value="ปานกลาง">ปานกลาง</option>
                                <option value="ต่ำ">ต่ำ</option>
                            </select>
                        </div>

                        {/* สถานะ */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                สถานะ
                            </label>
                            <select
                                value={filters.status}
                                onChange={(e) => handleFilterChange("status", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            >
                                <option value="all">ทั้งหมด</option>
                                <option value="ฉุกเฉิน">ฉุกเฉิน</option>
                                <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
                                <option value="ติดตาม">ติดตาม</option>
                                <option value="แก้ไขแล้ว">แก้ไขแล้ว</option>
                            </select>
                        </div>
                    </div>

                    {/* ฟิลเตอร์พื้นที่ - แถวที่ 2 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        {/* อำเภอ */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                📍 อำเภอ
                            </label>
                            <select
                                value={filters.district}
                                onChange={(e) => handleFilterChange("district", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            >
                                <option value="all">ทั้งหมด</option>
                                {satunDistricts.map((district) => (
                                    <option key={district.id} value={district.name}>
                                        {district.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* ตำบล */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                📍 ตำบล
                            </label>
                            <select
                                value={filters.tambon}
                                onChange={(e) => handleFilterChange("tambon", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                disabled={filters.district === "all"}
                            >
                                <option value="all">ทั้งหมด</option>
                                {tambonOptions.map((tambon) => (
                                    <option key={tambon.id} value={tambon.name}>
                                        {tambon.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* หมู่บ้าน */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                📍 หมู่บ้าน
                            </label>
                            <select
                                value={filters.village}
                                onChange={(e) => handleFilterChange("village", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                disabled={filters.tambon === "all"}
                            >
                                <option value="all">ทั้งหมด</option>
                                {villageOptions.map((village, index) => (
                                    <option key={index} value={village}>
                                        {village}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <p className="text-sm text-gray-600">
                            พบ <span className="font-semibold text-green-700">{filteredEvents.length}</span> เหตุการณ์
                        </p>
                        <button
                            onClick={() =>
                                setFilters({
                                    disasterType: "all",
                                    severity: "all",
                                    dateRange: "all",
                                    district: "all",
                                    tambon: "all",
                                    village: "all",
                                    status: "all",
                                })
                            }
                            className="text-sm text-green-700 hover:text-green-800 font-medium"
                        >
                            ล้างฟิลเตอร์ทั้งหมด
                        </button>
                    </div>
                </div>

                {/* Map Container */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* แผนที่ */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-md overflow-hidden">
                            <div className="bg-linear-to-r from-green-600 to-green-700 text-white px-6 py-4">
                                <h3 className="text-lg font-semibold">🗺️ แผนที่แสดงตำแหน่งเหตุการณ์ - จังหวัดสตูล</h3>
                            </div>
                            <div className="h-[600px]">
                                <DisasterMap events={filteredEvents} onEventClick={setSelectedEvent} />
                            </div>
                        </div>
                    </div>

                    {/* รายการเหตุการณ์ */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow-md overflow-hidden">
                            <div className="bg-green-700 text-white px-6 py-4">
                                <h3 className="text-lg font-semibold">📋 รายการเหตุการณ์</h3>
                            </div>
                            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                                {filteredEvents.length === 0 ? (
                                    <p className="text-center text-gray-500 py-8">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</p>
                                ) : (
                                    filteredEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            className={`border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${selectedEvent?.id === event.id
                                                ? "border-green-500 bg-green-50"
                                                : "border-gray-200"
                                                }`}
                                            onClick={() => setSelectedEvent(event)}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <h4 className="font-semibold text-gray-800">{event.type}</h4>
                                                <span
                                                    className={`px-2 py-1 text-xs rounded-full ${event.severity === "สูง"
                                                        ? "bg-red-100 text-red-700"
                                                        : event.severity === "ปานกลาง"
                                                            ? "bg-yellow-100 text-yellow-700"
                                                            : "bg-green-100 text-green-700"
                                                        }`}
                                                >
                                                    {event.severity}
                                                </span>
                                            </div>
                                            <div className="space-y-1 text-sm text-gray-600">
                                                <p>📍 ต.{event.tambon} อ.{event.district}</p>
                                                <p>🏘️ {event.village}</p>
                                                <p>📅 {event.date}</p>
                                                <p className="text-xs text-gray-500 mt-2">{event.description}</p>
                                                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                                                    <span className="text-xs text-orange-600 font-semibold">
                                                        👥 {event.affected} คน
                                                    </span>
                                                    <span
                                                        className={`text-xs px-2 py-1 rounded ${event.status === "ฉุกเฉิน"
                                                            ? "bg-red-100 text-red-700"
                                                            : event.status === "กำลังดำเนินการ"
                                                                ? "bg-blue-100 text-blue-700"
                                                                : event.status === "ติดตาม"
                                                                    ? "bg-yellow-100 text-yellow-700"
                                                                    : "bg-gray-100 text-gray-700"
                                                            }`}
                                                    >
                                                        {event.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* สถิติด่วน */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">เหตุการณ์ทั้งหมด</p>
                                <p className="text-3xl font-bold text-gray-800">{disasterEvents.length}</p>
                            </div>
                            <div className="text-4xl">📊</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">ระดับสูง</p>
                                <p className="text-3xl font-bold text-red-600">
                                    {disasterEvents.filter((d) => d.severity === "สูง").length}
                                </p>
                            </div>
                            <div className="text-4xl">🚨</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">ระดับปานกลาง</p>
                                <p className="text-3xl font-bold text-yellow-600">
                                    {disasterEvents.filter((d) => d.severity === "ปานกลาง").length}
                                </p>
                            </div>
                            <div className="text-4xl">⚠️</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">ระดับต่ำ</p>
                                <p className="text-3xl font-bold text-green-600">
                                    {disasterEvents.filter((d) => d.severity === "ต่ำ").length}
                                </p>
                            </div>
                            <div className="text-4xl">✅</div>
                        </div>
                    </div>
                </div>
            </div>
        </PublicLayout>
    );
}
