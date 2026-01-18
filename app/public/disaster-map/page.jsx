"use client";
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import PublicLayout from "@/components/layouts/PublicLayout";
import { satunDistricts } from "@/data/satunData";
import SkeletonLoader, { StatsSkeleton } from "@/components/SkeletonLoader";
import { NoReportsEmptyState } from "@/components/EmptyState";
import ErrorMessage, { getFriendlyErrorMessage } from "@/components/ErrorMessage";

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
        reportType: "all",
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

    // Real incident data from API
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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

    // Fetch real incident data from API
    useEffect(() => {
        const fetchIncidents = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/public/verified-incidents');
                const result = await response.json();

                if (result.success) {
                    // Map API data to expected format
                    const mappedData = result.data
                        .filter(incident => {
                            // Only include incidents with valid coordinates
                            return incident.latitude && incident.longitude &&
                                !isNaN(incident.latitude) && !isNaN(incident.longitude);
                        })
                        .map(incident => {
                            // Map urgency to severity
                            let severity = "ต่ำ";
                            if (incident.urgency === 'critical' || incident.urgency === 'high') {
                                severity = "สูง";
                            } else if (incident.urgency === 'medium') {
                                severity = "ปานกลาง";
                            }

                            // Format date
                            let formattedDate = 'ไม่ระบุวันที่';
                            const dateValue = incident.occurredAt || incident.createdAt;
                            if (dateValue) {
                                const date = new Date(dateValue);
                                if (!isNaN(date.getTime())) {
                                    formattedDate = date.toLocaleDateString('th-TH', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    });
                                }
                            }

                            return {
                                id: incident.id,
                                type: incident.disasterType || 'น้ำท่วม',
                                reportType: incident.reportType, // 'help_request' or 'traffic_report'
                                severity: severity,
                                district: incident.district || 'ไม่ระบุ',
                                tambon: incident.subDistrict || 'ไม่ระบุ',
                                village: incident.village || 'ไม่ระบุ',
                                date: formattedDate,
                                description: incident.description || 'ไม่มีรายละเอียด',
                                affected: incident.affectedPeople || 0,
                                status: incident.status || 'รอตรวจสอบ',
                                // For map display
                                lat: parseFloat(incident.latitude),
                                lng: parseFloat(incident.longitude),
                                position: [parseFloat(incident.latitude), parseFloat(incident.longitude)],
                                // Additional info
                                reporter: `${incident.firstName} ${incident.lastName}`,
                                phone: incident.phone,
                                waterLevel: incident.waterLevel,
                                travelStatus: incident.travelStatus,
                                photoPath: incident.photoPath
                            };
                        });
                    setIncidents(mappedData);
                } else {
                    setError(result.message || 'ไม่สามารถโหลดข้อมูลได้');
                }
            } catch (err) {
                console.error('Error fetching incidents:', err);
                setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
            } finally {
                setLoading(false);
            }
        };

        fetchIncidents();
    }, []);

    const handleFilterChange = (filterName, value) => {
        setFilters((prev) => ({ ...prev, [filterName]: value }));
    };

    // กรองข้อมูลตามฟิลเตอร์
    const filteredEvents = useMemo(() => {
        let events = [...incidents];

        // กรองตามวันที่
        if (filters.dateRange !== "all") {
            const days = parseInt(filters.dateRange);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            events = events.filter(e => {
                const eventDate = new Date(e.date);
                return eventDate >= cutoffDate;
            });
        }

        // กรองตามประเภทการรายงาน
        if (filters.reportType !== "all") {
            events = events.filter((e) => e.reportType === filters.reportType);
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
    }, [filters, incidents]);

    return (
        <PublicLayout>
            <div className="container mx-auto p-6">
                <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">รายงานจากประชาชน (ยืนยันแล้ว)</h1>
                        <p className="text-gray-600">แผนที่แสดงรายงานเหตุการณ์จากประชาชนที่ผ่านการยืนยันจากเจ้าหน้าที่</p>
                    </div>
                    <Link
                        href="/public/report-incident"
                        className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 md:px-6 py-3 md:py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center gap-2 justify-center md:justify-start min-h-[48px] touch-manipulation"
                    >
                        <span className="text-2xl">🚨</span>
                        <span>แจ้งเหตุภัยพิบัติ</span>
                    </Link>
                </div>

                {/* Loading State */}
                {loading && (
                    <>
                        <StatsSkeleton count={4} />
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <SkeletonLoader type="map" />
                            </div>
                            <div>
                                <SkeletonLoader type="list" count={3} />
                            </div>
                        </div>
                    </>
                )}

                {/* Error State */}
                {error && (
                    <ErrorMessage
                        {...getFriendlyErrorMessage(error)}
                        technicalDetails={error}
                        onRetry={() => window.location.reload()}
                        onClose={() => setError(null)}
                    />
                )}


                {/* Map Container */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* แผนที่ */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-md overflow-hidden">
                            <div className="bg-linear-to-r from-green-600 to-green-700 text-white px-6 py-4">
                                <h3 className="text-lg font-semibold">🗺️ แผนที่รายงานจากประชาชน - จังหวัดสตูล</h3>
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
                                    <NoReportsEmptyState
                                        onReport={() => window.location.href = '/public/report-incident'}
                                    />
                                ) : (
                                    filteredEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            className={`border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer min-h-[80px] touch-manipulation ${selectedEvent?.id === event.id
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
                                <p className="text-3xl font-bold text-gray-800">{incidents.length}</p>
                            </div>
                            <div className="text-4xl">📊</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">ระดับสูง</p>
                                <p className="text-3xl font-bold text-red-600">
                                    {incidents.filter((d) => d.severity === "สูง").length}
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
                                    {incidents.filter((d) => d.severity === "ปานกลาง").length}
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
                                    {incidents.filter((d) => d.severity === "ต่ำ").length}
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
