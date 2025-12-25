"use client";
import { useState, useEffect } from 'react';
import EOCLayout from "@/components/layouts/EOCLayout";

export default function FloodDailyRiskPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [availableDates, setAvailableDates] = useState([]);
    const [showAllDates, setShowAllDates] = useState(false);

    useEffect(() => {
        fetchRiskData();
        fetchAvailableDates();
    }, [selectedDate]);

    const fetchAvailableDates = async () => {
        try {
            // สมมติว่ามี active session เริ่มต้นที่ 2025-12-20
            const startDate = new Date('2025-12-20');
            const today = new Date();
            const dates = [];

            for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
                dates.push(new Date(d).toISOString().split('T')[0]);
            }

            setAvailableDates(dates.reverse()); // แสดงวันล่าสุดก่อน
        } catch (error) {
            console.error('Error fetching dates:', error);
        }
    };

    const fetchRiskData = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/eoc/flood/daily-risk?date=${selectedDate}`);
            const result = await response.json();
            if (result.success) {
                setData(result);
            }
        } catch (error) {
            console.error('Error fetching risk data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getRiskColor = (level) => {
        const colors = {
            'สูงมาก': 'bg-red-100 border-red-400 text-red-800',
            'สูง': 'bg-red-100 border-red-400 text-red-800',
            'ปานกลาง': 'bg-yellow-100 border-yellow-400 text-yellow-800',
            'ต่ำ': 'bg-blue-100 border-blue-400 text-blue-800',
            'ไม่มี': 'bg-green-100 border-green-400 text-green-800',
            // รองรับภาษาอังกฤษสำหรับ mock data
            'severe': 'bg-red-100 border-red-400 text-red-800',
            'moderate': 'bg-yellow-100 border-yellow-400 text-yellow-800',
            'mild': 'bg-blue-100 border-blue-400 text-blue-800',
            'safe': 'bg-green-100 border-green-400 text-green-800'
        };
        return colors[level] || 'bg-gray-100 border-gray-400 text-gray-800';
    };

    const getRiskIcon = (level) => {
        const icons = {
            'สูงมาก': '🔴',
            'สูง': '🔴',
            'ปานกลาง': '🟡',
            'ต่ำ': '🔵',
            'ไม่มี': '🟢',
            // รองรับภาษาอังกฤษ
            'severe': '🔴',
            'moderate': '🟡',
            'mild': '🔵',
            'safe': '🟢'
        };
        return icons[level] || '⚪';
    };

    const getRiskLabel = (level) => {
        const labels = {
            'สูงมาก': 'น้ำท่วมสูงมาก',
            'สูง': 'น้ำท่วมสูง',
            'ปานกลาง': 'น้ำท่วมปานกลาง',
            'ต่ำ': 'น้ำท่วมต่ำ',
            'ไม่มี': 'ไม่มีน้ำท่วม / ปกติ',
            // รองรับภาษาอังกฤษ
            'severe': 'รุนแรงมาก',
            'moderate': 'ปานกลาง',
            'mild': 'เล็กน้อย',
            'safe': 'ปลอดภัย'
        };
        return labels[level] || level;
    };

    if (loading) {
        return (
            <EOCLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            </EOCLayout>
        );
    }

    if (!data) {
        return (
            <EOCLayout>
                <div className="container mx-auto p-6">
                    <div className="text-center py-12">
                        <p className="text-gray-600">ไม่พบข้อมูล</p>
                    </div>
                </div>
            </EOCLayout>
        );
    }

    const stats = data.totalStats || {};
    const formatDate = new Date(selectedDate).toLocaleDateString('th-TH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    return (
        <EOCLayout>
            <div className="container mx-auto p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                        <span className="text-4xl">📊</span>
                        สรุปความเสี่ยงน้ำท่วมรายวัน
                    </h1>
                    <p className="text-gray-600">แสดงข้อมูลวันที่: {formatDate}</p>
                </div>

                {/* Date Selector */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <label className="block text-sm font-medium text-gray-700">
                            เลือกวันที่ต้องการดู:
                        </label>
                        <button
                            onClick={() => setShowAllDates(!showAllDates)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                            {showAllDates ? '🔼 ซ่อนลิสวันที่' : '📅 แสดงลิสวันที่ทั้งหมด'}
                        </button>
                    </div>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-700 w-full md:w-auto"
                    />

                    {/* Available Dates List */}
                    {showAllDates && availableDates.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                            <h3 className="font-semibold text-gray-700 mb-3">📋 วันที่มีข้อมูล ({availableDates.length} วัน):</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 max-h-96 overflow-y-auto">
                                {availableDates.map((date, index) => {
                                    const dateObj = new Date(date);
                                    const isSelected = date === selectedDate;
                                    const thaiDate = dateObj.toLocaleDateString('th-TH', {
                                        weekday: 'short',
                                        day: 'numeric',
                                        month: 'short'
                                    });

                                    return (
                                        <button
                                            key={date}
                                            onClick={() => {
                                                setSelectedDate(date);
                                                setShowAllDates(false);
                                            }}
                                            className={`p-3 rounded-lg text-sm transition-all ${isSelected
                                                ? 'bg-blue-600 text-white shadow-lg font-bold'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            <div className="font-medium">วันที่ {availableDates.length - index}</div>
                                            <div className="text-xs mt-1">{thaiDate}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Active EOC Session Info */}
                {data.activeSession && (
                    <div className="bg-linear-to-r from-red-500 to-orange-500 text-white rounded-lg shadow-lg p-6 mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold mb-2">
                                    🚨 EOC Session #{data.activeSession.session_number}/2025 - กำลังดำเนินการ
                                </h3>
                                <p className="opacity-90 mb-1">
                                    เปิดเมื่อ: {new Date(data.activeSession.opened_at).toLocaleDateString('th-TH', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                                <p className="opacity-90">
                                    เหตุผล: {data.activeSession.open_reason}
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="bg-white/20 rounded p-3 backdrop-blur-sm">
                                    <p className="text-2xl font-bold">{data.activeSession.days_open}</p>
                                    <p className="text-sm">วัน</p>
                                </div>
                                <div className="bg-white/20 rounded p-3 backdrop-blur-sm">
                                    <p className="text-2xl font-bold">{data.activeSession.total_activities}</p>
                                    <p className="text-sm">กิจกรรม</p>
                                </div>
                                <div className="bg-white/20 rounded p-3 backdrop-blur-sm">
                                    <p className="text-2xl font-bold">{data.activeSession.total_data_entries}</p>
                                    <p className="text-sm">บันทึก</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Total Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <StatCard
                        icon="🗺️"
                        label="อำเภอ"
                        value={stats.affected_districts || 0}
                        color="purple"
                    />
                    <StatCard
                        icon="📍"
                        label="ตำบล"
                        value={stats.affected_tambons || 0}
                        color="blue"
                    />
                    <StatCard
                        icon="🏘️"
                        label="หมู่บ้าน"
                        value={stats.affected_villages || 0}
                        color="green"
                    />
                    <StatCard
                        icon="🏠"
                        label="ครัวเรือน"
                        value={(stats.total_households || 0).toLocaleString()}
                        color="orange"
                    />
                    <StatCard
                        icon="👥"
                        label="ประชากร"
                        value={(stats.total_population || 0).toLocaleString()}
                        color="red"
                    />
                </div>

                {/* Risk Level Summary */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">สรุปตามระดับความเสี่ยง</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {data.riskSummary?.map((item, index) => (
                            <div
                                key={index}
                                className={`${getRiskColor(item.flood_level)} border-2 rounded-lg p-4`}
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-3xl">{getRiskIcon(item.flood_level)}</span>
                                    <h3 className="font-bold text-lg">{getRiskLabel(item.flood_level)}</h3>
                                </div>
                                <div className="space-y-1 text-sm">
                                    <p><strong>หมู่บ้าน:</strong> {item.village_count} แห่ง</p>
                                    <p><strong>ครัวเรือน:</strong> {(item.total_households || 0).toLocaleString()}</p>
                                    <p><strong>ประชากร:</strong> {(item.total_population || 0).toLocaleString()} คน</p>
                                    <p><strong>ระดับน้ำเฉลี่ย:</strong> {Math.round(item.avg_water_level || 0)} ซม.</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* District Summary */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">สรุปตามอำเภอ</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        อำเภอ
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        หมู่บ้าน
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ครัวเรือน
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ประชากร
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        สถานะ
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {data.districtSummary?.map((district, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {district.district}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">
                                            {district.village_count}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">
                                            {(district.total_households || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">
                                            {(district.total_population || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {district.has_severe ? (
                                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                    🔴 รุนแรง
                                                </span>
                                            ) : district.has_moderate ? (
                                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                    🟡 ปานกลาง
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                    🔵 เล็กน้อย
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Detailed List */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">รายละเอียดแต่ละพื้นที่</h2>
                    <div className="space-y-3">
                        {data.details?.map((item, index) => (
                            <div
                                key={index}
                                className={`${getRiskColor(item.flood_level)} border-l-4 p-4 rounded-r-lg`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg mb-1">
                                            {getRiskIcon(item.flood_level)} {item.village}
                                        </h3>
                                        <p className="text-sm opacity-90 mb-2">
                                            📍 {item.district} › {item.tambon}
                                        </p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                            <div>
                                                <strong>ระดับน้ำ:</strong> {item.water_level_cm} ซม.
                                            </div>
                                            <div>
                                                <strong>ครัวเรือน:</strong> {item.affected_households}
                                            </div>
                                            <div>
                                                <strong>ประชากร:</strong> {item.affected_population} คน
                                            </div>
                                            <div>
                                                <strong>สถานะ:</strong> {item.status}
                                            </div>
                                        </div>
                                        {item.notes && (
                                            <p className="text-sm mt-2 opacity-80">
                                                💬 {item.notes}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </EOCLayout>
    );
}

function StatCard({ icon, label, value, color }) {
    const colorClasses = {
        purple: 'bg-purple-50 border-purple-200 text-purple-700',
        blue: 'bg-blue-50 border-blue-200 text-blue-700',
        green: 'bg-green-50 border-green-200 text-green-700',
        orange: 'bg-orange-50 border-orange-200 text-orange-700',
        red: 'bg-red-50 border-red-200 text-red-700'
    };

    return (
        <div className={`${colorClasses[color]} border-2 rounded-lg p-4 text-center`}>
            <div className="text-3xl mb-2">{icon}</div>
            <p className="text-2xl font-bold mb-1">{value}</p>
            <p className="text-sm opacity-80">{label}</p>
        </div>
    );
}
