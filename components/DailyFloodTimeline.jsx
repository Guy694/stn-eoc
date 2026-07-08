"use client";
import { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import { showError, showSuccess } from "@/lib/sweetAlert";

export default function DailyFloodTimeline({ startDate, polygons }) {
    const [selectedDate, setSelectedDate] = useState(null);
    const [dates, setDates] = useState([]);
    const [floodData, setFloodData] = useState(null);
    const [loading, setLoading] = useState(false);
    const mapRef = useRef(null);

    useEffect(() => {
        // สร้างรายการวันที่ตั้งแต่เปิด EOC จนถึงปัจจุบัน
        // แปลง startDate เป็น local date components
        const startDateObj = new Date(startDate);
        const start = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate());

        // ใช้วันที่ปัจจุบัน (local timezone)
        const todayObj = new Date();
        const today = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate());

        const dateList = [];

        for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
            dateList.push(new Date(d));
        }

        setDates(dateList);
        setSelectedDate(dateList[dateList.length - 1]); // เลือกวันล่าสุด
    }, [startDate]);

    // ดึงข้อมูลจาก API เมื่อเลือกวันที่
    useEffect(() => {
        if (!selectedDate) return;

        const fetchFloodData = async () => {
            setLoading(true);
            try {
                const dateStr = selectedDate.toISOString().split('T')[0];
                const response = await fetch(`/stn-eoc/api/eoc/flood/daily-flood?date=${dateStr}`);
                const data = await response.json();
                setFloodData(data);
            } catch (error) {
                console.error('Error fetching flood data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchFloodData();
    }, [selectedDate]);    // สีตามระดับอุทกภัยน้ำท่วม (เหมือนภาพตัวอย่าง)
    const getFloodColor = (level) => {
        const colors = {
            'severe': '#DC2626', // แดงเข้ม - อุทกภัยน้ำท่วมหนัก
            'moderate': '#FBBF24', // เหลือง - อุทกภัยน้ำท่วมปานกลาง
            'mild': '#34D399', // เขียวอ่อน - อุทกภัยน้ำท่วมเล็กน้อย
            'safe': '#10B981', // เขียว - ปลอดภัย
            'nodata': '#E5E7EB', // เทา - ไม่มีข้อมูล
        };
        return colors[level] || colors.nodata;
    };

    const getFloodLabel = (level) => {
        const labels = {
            'severe': 'อุทกภัยน้ำท่วมสูง',
            'moderate': 'อุทกภัยน้ำท่วมปานกลาง',
            'mild': 'อุทกภัยน้ำท่วมต่ำ',
            'safe': 'ปลอดภัย',
            'nodata': 'ไม่มีข้อมูล',
        };
        return labels[level] || labels.nodata;
    };

    // ดาวน์โหลดเป็นภาพ
    const downloadMap = async () => {
        if (!mapRef.current) return;

        try {
            const canvas = await html2canvas(mapRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
            });

            const link = document.createElement('a');
            const dateStr = selectedDate ? selectedDate.toLocaleDateString('th-TH') : 'map';
            link.download = `flood-map-${dateStr}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Error downloading map:', error);
            showError('เกิดข้อผิดพลาดในการดาวน์โหลดภาพ');
        }
    };

    // บันทึกภาพลงเซิร์ฟเวอร์
    const saveMapToServer = async () => {
        if (!mapRef.current || !selectedDate) return;

        try {
            const canvas = await html2canvas(mapRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
            });

            // แปลง canvas เป็น blob
            canvas.toBlob(async (blob) => {
                const formData = new FormData();
                formData.append('image', blob, 'flood-map.png');
                formData.append('date', selectedDate.toISOString().split('T')[0]);
                formData.append('officer_id', '1'); // ใช้ officer_id จริงจาก session

                const response = await fetch('/stn-eoc/api/eoc/flood/daily-flood/upload', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    showSuccess('✅ บันทึกภาพแผนที่สำเร็จ');
                } else {
                    showError('❌ เกิดข้อผิดพลาด: ' + result.error);
                }
            }, 'image/png');

        } catch (error) {
            console.error('Error saving map:', error);
            showError('เกิดข้อผิดพลาดในการบันทึกภาพ');
        }
    };    // แปลง districts array เป็น object สำหรับการแสดงผล
    const districtLevels = {};
    if (floodData && floodData.districts) {
        floodData.districts.forEach(d => {
            districtLevels[d.name] = d.level;
        });
    }

    // อำเภอทั้งหมดของสตูล
    const districts = [
        { name: 'เมืองสตูล', position: 'top-1/2 left-1/2' },
        { name: 'ควนโดน', position: 'top-1/4 left-1/3' },
        { name: 'ควนกาหลง', position: 'top-1/3 right-1/4' },
        { name: 'ท่าแพ', position: 'top-2/3 left-1/4' },
        { name: 'ละงู', position: 'bottom-1/4 left-1/2' },
        { name: 'ทุ่งหว้า', position: 'top-1/2 right-1/3' },
        { name: 'มะนัง', position: 'bottom-1/3 right-1/4' },
    ];

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    📅 แผนที่สถานการณ์อุทกภัยน้ำท่วมรายวัน
                </h2>
                <p className="text-gray-600">
                    ติดตามสถานการณ์อุทกภัยน้ำท่วมตั้งแต่เปิด EOC - {dates.length} วัน
                </p>
            </div>

            {/* Timeline Selector */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                    <label className="font-semibold text-gray-700">เลือกวันที่:</label>
                    <div className="flex gap-2">
                        <button
                            onClick={saveMapToServer}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            บันทึกลงระบบ
                        </button>
                        <button
                            onClick={downloadMap}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
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
                                            weekday: 'short',
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
            <div ref={mapRef} className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl p-8">
                {/* Header */}
                <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">
                        สถานการณ์อุทกภัยน้ำท่วม จังหวัดสตูล
                    </h3>
                    <p className="text-lg text-gray-600">
                        {selectedDate ? `ข้อมูลวันที่: ${selectedDate.toLocaleDateString('th-TH', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        })}` : ''}
                    </p>
                </div>

                {/* Map Container */}
                <div className="relative bg-white rounded-lg shadow-inner p-8 mb-6" style={{ minHeight: '500px' }}>
                    {/* Simple Map Visualization */}
                    <div className="relative w-full h-[500px]">
                        <svg viewBox="0 0 400 500" className="w-full h-full">
                            {/* สตูล Province Outline (simplified) */}
                            <g>
                                {/* เมืองสตูล */}
                                <path
                                    d="M 180 200 L 220 180 L 240 200 L 230 240 L 200 250 L 170 230 Z"
                                    fill={getFloodColor(districtLevels['เมืองสตูล'])}
                                    stroke="#333"
                                    strokeWidth="2"
                                />

                                {/* ควนโดน */}
                                <path
                                    d="M 150 120 L 200 100 L 220 130 L 180 160 L 140 150 Z"
                                    fill={getFloodColor(districtLevels['ควนโดน'])}
                                    stroke="#333"
                                    strokeWidth="2"
                                />

                                {/* ควนกาหลง */}
                                <path
                                    d="M 240 140 L 280 120 L 300 160 L 270 180 L 240 170 Z"
                                    fill={getFloodColor(districtLevels['ควนกาหลง'])}
                                    stroke="#333"
                                    strokeWidth="2"
                                />

                                {/* ท่าแพ */}
                                <path
                                    d="M 120 280 L 170 260 L 180 300 L 140 320 L 110 300 Z"
                                    fill={getFloodColor(districtLevels['ท่าแพ'])}
                                    stroke="#333"
                                    strokeWidth="2"
                                />

                                {/* ละงู */}
                                <path
                                    d="M 180 360 L 220 340 L 240 380 L 210 400 L 170 390 Z"
                                    fill={getFloodColor(districtLevels['ละงู'])}
                                    stroke="#333"
                                    strokeWidth="2"
                                />

                                {/* ทุ่งหว้า */}
                                <path
                                    d="M 260 220 L 300 200 L 320 240 L 290 270 L 250 260 Z"
                                    fill={getFloodColor(districtLevels['ทุ่งหว้า'])}
                                    stroke="#333"
                                    strokeWidth="2"
                                />

                                {/* มะนัง */}
                                <path
                                    d="M 260 320 L 300 300 L 320 340 L 290 370 L 250 350 Z"
                                    fill={getFloodColor(districtLevels['มะนัง'])}
                                    stroke="#333"
                                    strokeWidth="2"
                                />

                                {/* Labels */}
                                <text x="200" y="220" textAnchor="middle" className="text-xs font-semibold" fill="#1F2937">เมืองสตูล</text>
                                <text x="175" y="130" textAnchor="middle" className="text-xs font-semibold" fill="#1F2937">ควนโดน</text>
                                <text x="270" y="155" textAnchor="middle" className="text-xs font-semibold" fill="#1F2937">ควนกาหลง</text>
                                <text x="145" y="295" textAnchor="middle" className="text-xs font-semibold" fill="#1F2937">ท่าแพ</text>
                                <text x="205" y="375" textAnchor="middle" className="text-xs font-semibold" fill="#1F2937">ละงู</text>
                                <text x="285" y="240" textAnchor="middle" className="text-xs font-semibold" fill="#1F2937">ทุ่งหว้า</text>
                                <text x="285" y="340" textAnchor="middle" className="text-xs font-semibold" fill="#1F2937">มะนัง</text>
                            </g>
                        </svg>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-4 flex-wrap">
                    <LegendItem color="#DC2626" label="อุทกภัยน้ำท่วมสูง" />
                    <LegendItem color="#FBBF24" label="อุทกภัยน้ำท่วมปานกลาง" />
                    <LegendItem color="#34D399" label="อุทกภัยน้ำท่วมต่ำ" />
                    <LegendItem color="#10B981" label="ปลอดภัย" />
                    <LegendItem color="#E5E7EB" label="ไม่มีข้อมูล" />
                </div>

                {/* Statistics */}
                {floodData && floodData.summary && (
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatBox
                            label="อุทกภัยน้ำท่วมสูง"
                            value={floodData.summary.severeCount}
                            color="bg-red-100 text-red-700"
                        />
                        <StatBox
                            label="อุทกภัยน้ำท่วมปานกลาง"
                            value={floodData.summary.moderateCount}
                            color="bg-yellow-100 text-yellow-700"
                        />
                        <StatBox
                            label="อุทกภัยน้ำท่วมต่ำ"
                            value={floodData.summary.mildCount}
                            color="bg-green-100 text-green-700"
                        />
                        <StatBox
                            label="ผู้ได้รับผลกระทบ"
                            value={floodData.summary.totalPopulation.toLocaleString()}
                            color="bg-blue-100 text-blue-700"
                        />
                    </div>
                )}
            </div>

            {/* District Details */}
            {floodData && floodData.districts && (
                <div className="mt-6">
                    <h4 className="font-semibold text-gray-800 mb-3">รายละเอียดแต่ละอำเภอ:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {floodData.districts.map((district) => (
                            <div key={district.name} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                                <div
                                    className="w-8 h-8 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: getFloodColor(district.level) }}
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-gray-800">{district.name}</div>
                                    <div className="text-sm text-gray-600">{getFloodLabel(district.level)}</div>
                                    {district.population > 0 && (
                                        <div className="text-xs text-gray-500">
                                            ผู้ได้รับผลกระทบ: {district.population.toLocaleString()} คน
                                        </div>
                                    )}
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

function StatBox({ label, value, color }) {
    return (
        <div className={`${color} p-4 rounded-lg text-center`}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm">{label}</div>
        </div>
    );
}
