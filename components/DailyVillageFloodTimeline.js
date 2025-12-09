"use client";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import html2canvas from "html2canvas";

// Import Leaflet แบบ dynamic
const MapContainer = dynamic(
    () => import('react-leaflet').then((mod) => mod.MapContainer),
    { ssr: false }
);
const TileLayer = dynamic(
    () => import('react-leaflet').then((mod) => mod.TileLayer),
    { ssr: false }
);
const Polygon = dynamic(
    () => import('react-leaflet').then((mod) => mod.Polygon),
    { ssr: false }
);
const Popup = dynamic(
    () => import('react-leaflet').then((mod) => mod.Popup),
    { ssr: false }
);

export default function DailyVillageFloodTimeline({ startDate, polygons }) {
    const [selectedDate, setSelectedDate] = useState(null);
    const [dates, setDates] = useState([]);
    const [floodData, setFloodData] = useState(null);
    const [loading, setLoading] = useState(false);
    const mapRef = useRef(null);

    useEffect(() => {
        const start = new Date(startDate);
        const today = new Date();
        const dateList = [];

        for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
            dateList.push(new Date(d));
        }

        setDates(dateList);
        setSelectedDate(dateList[dateList.length - 1]);
    }, [startDate]);

    useEffect(() => {
        if (!selectedDate) return;

        const fetchFloodData = async () => {
            setLoading(true);
            try {
                const dateStr = selectedDate.toISOString().split('T')[0];
                const response = await fetch(`/api/daily-flood-village?date=${dateStr}`);
                const data = await response.json();
                setFloodData(data);
            } catch (error) {
                console.error('Error fetching flood data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchFloodData();
    }, [selectedDate]);

    const getFloodColor = (level) => {
        const colors = {
            'severe': '#DC2626',
            'moderate': '#FBBF24',
            'mild': '#34D399',
            'safe': '#10B981',
            'nodata': '#E5E7EB',
        };
        return colors[level] || colors.nodata;
    };

    const getFloodLabel = (level) => {
        const labels = {
            'severe': 'น้ำท่วมหนัก',
            'moderate': 'น้ำท่วมปานกลาง',
            'mild': 'น้ำท่วมเล็กน้อย',
            'safe': 'ปลอดภัย',
            'nodata': 'ไม่มีข้อมูล',
        };
        return labels[level] || labels.nodata;
    };

    const downloadMap = async () => {
        if (!mapRef.current) return;

        try {
            const canvas = await html2canvas(mapRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
            });

            const link = document.createElement('a');
            const dateStr = selectedDate ? selectedDate.toISOString().split('T')[0] : 'map';
            link.download = `village-flood-map-${dateStr}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Error downloading map:', error);
            alert('เกิดข้อผิดพลาดในการดาวน์โหลดภาพ');
        }
    };

    const saveMapToServer = async () => {
        if (!mapRef.current || !selectedDate) return;

        try {
            const canvas = await html2canvas(mapRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
            });

            canvas.toBlob(async (blob) => {
                const formData = new FormData();
                formData.append('image', blob, 'village-flood-map.png');
                formData.append('date', selectedDate.toISOString().split('T')[0]);
                formData.append('officer_id', '1');

                const response = await fetch('/api/daily-flood/upload', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    alert('✅ บันทึกภาพแผนที่สำเร็จ');
                } else {
                    alert('❌ เกิดข้อผิดพลาด: ' + result.error);
                }
            }, 'image/png');

        } catch (error) {
            console.error('Error saving map:', error);
            alert('เกิดข้อผิดพลาดในการบันทึกภาพ');
        }
    };

    // สร้าง map ระหว่าง villcode กับ flood level
    const villageFloodLevels = {};
    if (floodData && floodData.villages) {
        floodData.villages.forEach(v => {
            villageFloodLevels[v.villcode] = v.level;
        });
    }

    // จัดกลุ่ม polygon ตามระดับน้ำท่วม
    const getPolygonsByLevel = () => {
        const grouped = {
            severe: [],
            moderate: [],
            mild: [],
            safe: []
        };

        polygons.forEach(poly => {
            const level = villageFloodLevels[poly.villcode] || 'safe';
            if (grouped[level]) {
                grouped[level].push(poly);
            }
        });

        return grouped;
    };

    const polygonGroups = getPolygonsByLevel();

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    📅 แผนที่สถานการณ์น้ำท่วมรายวัน (ระดับหมู่บ้าน)
                </h2>
                <p className="text-gray-600">
                    ติดตามสถานการณ์น้ำท่วมแบบเรียลไทม์ตั้งแต่เปิด EOC - {dates.length} วัน
                </p>
            </div>

            {/* Timeline Selector */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <label className="font-semibold text-gray-700">เลือกวันที่:</label>
                    <div className="flex gap-2">
                        <button
                            onClick={saveMapToServer}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            บันทึกลงระบบ
                        </button>
                        <button
                            onClick={downloadMap}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            ดาวน์โหลดภาพ
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <div className="flex gap-2 pb-2">
                        {dates.map((date, index) => {
                            const isSelected = selectedDate?.toDateString() === date.toDateString();
                            return (
                                <button
                                    key={index}
                                    onClick={() => setSelectedDate(date)}
                                    className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium transition-all ${isSelected
                                            ? 'bg-blue-600 text-white shadow-lg'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    <div className="text-sm">วันที่ {index + 1}</div>
                                    <div className="text-xs">
                                        {date.toLocaleDateString('th-TH', {
                                            day: 'numeric',
                                            month: 'short'
                                        })}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Map Display */}
            <div ref={mapRef} className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl p-6">
                {/* Header */}
                <div className="text-center mb-4">
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">
                        สถานการณ์น้ำท่วม จังหวัดสตูล (ระดับหมู่บ้าน)
                    </h3>
                    <p className="text-lg text-gray-600">
                        {selectedDate ? selectedDate.toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'long'
                        }) : ''}
                    </p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-96">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                            <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Leaflet Map */}
                        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6" style={{ height: '600px' }}>
                            <MapContainer
                                center={[6.6238, 100.0673]}
                                zoom={10}
                                style={{ height: '100%', width: '100%' }}
                            >
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                />

                                {/* วาด polygon ตามระดับความรุนแรง (วาดจากเบาไปหนัก) */}
                                {polygonGroups.safe.map((poly, idx) => (
                                    <Polygon
                                        key={`safe-${idx}`}
                                        positions={poly.coordinates}
                                        pathOptions={{
                                            fillColor: getFloodColor('safe'),
                                            fillOpacity: 0.6,
                                            color: '#333',
                                            weight: 1,
                                        }}
                                    >
                                        <Popup>
                                            <div className="text-sm">
                                                <strong>{poly.villname}</strong><br />
                                                อำเภอ: {poly.distname}<br />
                                                ตำบล: {poly.tambname}<br />
                                                สถานะ: {getFloodLabel('safe')}<br />
                                                ประชากร: {poly.population?.toLocaleString() || 'N/A'}
                                            </div>
                                        </Popup>
                                    </Polygon>
                                ))}

                                {polygonGroups.mild.map((poly, idx) => (
                                    <Polygon
                                        key={`mild-${idx}`}
                                        positions={poly.coordinates}
                                        pathOptions={{
                                            fillColor: getFloodColor('mild'),
                                            fillOpacity: 0.7,
                                            color: '#333',
                                            weight: 1.5,
                                        }}
                                    >
                                        <Popup>
                                            <div className="text-sm">
                                                <strong>{poly.villname}</strong><br />
                                                อำเภอ: {poly.distname}<br />
                                                ตำบล: {poly.tambname}<br />
                                                สถานะ: {getFloodLabel('mild')}<br />
                                                ประชากร: {poly.population?.toLocaleString() || 'N/A'}
                                            </div>
                                        </Popup>
                                    </Polygon>
                                ))}

                                {polygonGroups.moderate.map((poly, idx) => (
                                    <Polygon
                                        key={`moderate-${idx}`}
                                        positions={poly.coordinates}
                                        pathOptions={{
                                            fillColor: getFloodColor('moderate'),
                                            fillOpacity: 0.75,
                                            color: '#333',
                                            weight: 2,
                                        }}
                                    >
                                        <Popup>
                                            <div className="text-sm">
                                                <strong>{poly.villname}</strong><br />
                                                อำเภอ: {poly.distname}<br />
                                                ตำบล: {poly.tambname}<br />
                                                สถานะ: {getFloodLabel('moderate')}<br />
                                                ประชากร: {poly.population?.toLocaleString() || 'N/A'}
                                            </div>
                                        </Popup>
                                    </Polygon>
                                ))}

                                {polygonGroups.severe.map((poly, idx) => (
                                    <Polygon
                                        key={`severe-${idx}`}
                                        positions={poly.coordinates}
                                        pathOptions={{
                                            fillColor: getFloodColor('severe'),
                                            fillOpacity: 0.8,
                                            color: '#333',
                                            weight: 2.5,
                                        }}
                                    >
                                        <Popup>
                                            <div className="text-sm">
                                                <strong>{poly.villname}</strong><br />
                                                อำเภอ: {poly.distname}<br />
                                                ตำบล: {poly.tambname}<br />
                                                สถานะ: {getFloodLabel('severe')}<br />
                                                ประชากร: {poly.population?.toLocaleString() || 'N/A'}
                                            </div>
                                        </Popup>
                                    </Polygon>
                                ))}
                            </MapContainer>
                        </div>

                        {/* Legend */}
                        <div className="flex justify-center gap-4 flex-wrap mb-6">
                            <LegendItem color="#DC2626" label="น้ำท่วมหนัก" />
                            <LegendItem color="#FBBF24" label="น้ำท่วมปานกลาง" />
                            <LegendItem color="#34D399" label="น้ำท่วมเล็กน้อย" />
                            <LegendItem color="#10B981" label="ปลอดภัย" />
                            <LegendItem color="#E5E7EB" label="ไม่มีข้อมูล" />
                        </div>

                        {/* Statistics */}
                        {floodData && floodData.summary && (
                            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatBox
                                    label="น้ำท่วมหนัก"
                                    value={floodData.summary.severeCount}
                                    color="bg-red-100 text-red-700"
                                    unit="หมู่บ้าน"
                                />
                                <StatBox
                                    label="น้ำท่วมปานกลาง"
                                    value={floodData.summary.moderateCount}
                                    color="bg-yellow-100 text-yellow-700"
                                    unit="หมู่บ้าน"
                                />
                                <StatBox
                                    label="น้ำท่วมเล็กน้อย"
                                    value={floodData.summary.mildCount}
                                    color="bg-green-100 text-green-700"
                                    unit="หมู่บ้าน"
                                />
                                <StatBox
                                    label="ผู้ได้รับผลกระทบ"
                                    value={floodData.summary.totalPopulation.toLocaleString()}
                                    color="bg-blue-100 text-blue-700"
                                    unit="คน"
                                />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Village Details */}
            {!loading && floodData && floodData.villages && floodData.villages.length > 0 && (
                <div className="mt-6">
                    <h4 className="font-semibold text-gray-800 mb-3">
                        รายละเอียดหมู่บ้านที่ได้รับผลกระทบ ({floodData.villages.length} หมู่บ้าน):
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {floodData.villages.map((village) => (
                            <div key={village.villcode} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors">
                                <div
                                    className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center"
                                    style={{ backgroundColor: getFloodColor(village.level) }}
                                >
                                    <span className="text-white text-xs font-bold">
                                        {village.level === 'severe' ? '!!!' : village.level === 'moderate' ? '!!' : '!'}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-800 truncate">{village.name}</div>
                                    <div className="text-sm text-gray-600">อ.{village.district}</div>
                                    <div className="text-xs text-gray-500 flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${village.level === 'severe' ? 'bg-red-200 text-red-800' :
                                                village.level === 'moderate' ? 'bg-yellow-200 text-yellow-800' :
                                                    'bg-green-200 text-green-800'
                                            }`}>
                                            {getFloodLabel(village.level)}
                                        </span>
                                        <span>👥 {village.population.toLocaleString()} คน</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function LegendItem({ color, label }) {
    return (
        <div className="flex items-center gap-2">
            <div
                className="w-6 h-6 rounded border-2 border-gray-300"
                style={{ backgroundColor: color }}
            />
            <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
    );
}

function StatBox({ label, value, color, unit = "" }) {
    return (
        <div className={`${color} p-4 rounded-lg text-center`}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm">
                {label}
                {unit && <span className="text-xs ml-1">({unit})</span>}
            </div>
        </div>
    );
}
