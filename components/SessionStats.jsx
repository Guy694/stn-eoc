"use client";
import { useCallback, useEffect, useState } from 'react';
import AppIcon from './icons/AppIcon';
import { MetricCard } from "@/components/common/MetricCards";

export default function SessionStats({ session, year }) {
    const [floodData, setFloodData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const calculateStats = useCallback((data) => {
        // คำนวณสถิติจากข้อมูลจริง
        const uniqueVillages = new Set();
        const uniqueTambons = new Set();
        const uniqueDistricts = new Set();
        let totalPopulation = 0;
        let severeCount = 0;
        let moderateCount = 0;
        let mildCount = 0;

        data.forEach(record => {
            uniqueVillages.add(`${record.district}-${record.tambon}-${record.village}`);
            uniqueTambons.add(`${record.district}-${record.tambon}`);
            uniqueDistricts.add(record.district);
            totalPopulation += record.affected_population || 0;

            const level = record.flood_level || record.severity_level;
            if (level === 'severe' || level === 'สูง' || level === 'สูงมาก') {
                severeCount++;
            } else if (level === 'moderate' || level === 'ปานกลาง') {
                moderateCount++;
            } else if (level === 'mild' || level === 'ต่ำ') {
                mildCount++;
            }
        });

        return {
            totalVillages: uniqueVillages.size,
            totalTambons: uniqueTambons.size,
            totalDistricts: uniqueDistricts.size,
            totalPopulation,
            severeCount,
            moderateCount,
            mildCount,
            totalRecords: data.length
        };
    }, []);

    const fetchSessionFloodData = useCallback(async () => {
        if (!session || !year) return;

        setLoading(true);
        setError('');
        try {
            // ดึงข้อมูลอุทกภัยน้ำท่วมในช่วง session
            const endDate = session.closed_at
                ? new Date(session.closed_at).toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0];

            // เรียก API ดึงข้อมูล daily flood ในช่วงเวลานั้น
            const response = await fetch(
                `/stn-eoc/api/eoc/flood/daily-flood-village?date=${endDate}`
            );

            if (!response.ok) {
                throw new Error('ไม่สามารถโหลดข้อมูลจากฐานข้อมูลได้');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'ไม่สามารถโหลดข้อมูลจากฐานข้อมูลได้');
            }

            const records = Array.isArray(data) ? data : data.villages || [];
            const stats = calculateStats(records);
            setFloodData(stats);
        } catch (error) {
            console.error('Error fetching session flood data:', error);
            setFloodData(null);
            setError(error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ');
        } finally {
            setLoading(false);
        }
    }, [calculateStats, session, year]);

    useEffect(() => {
        fetchSessionFloodData();
    }, [fetchSessionFloodData]);

    if (!session) {
        return null;
    }

    if (loading) {
        return (
            <div className="border border-slate-200 bg-white rounded-2xl p-6 mb-6">
                <div className="text-center py-4">
                    <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-[3px] border-[#0b4c86]/20 border-t-[#0b4c86] motion-reduce:animate-none"></div>
                    <p className="text-slate-600 text-sm">กำลังโหลดสถิติ...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-2xl p-6 mb-6 border border-red-200">
                <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
        );
    }

    return (
        <div className="bg-linear-to-r from-teal-50 to-blue-50 shadow-md rounded-lg p-6 mb-6 border border-[#c9dcee]">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <AppIcon icon="barChart" className="h-5 w-5 text-[#0b4c86]" />
                สถิติสรุป - เหตุการณ์ครั้งที่ {session.session_number} (พ.ศ. {year + 543})
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <StatsCard
                    label="หมู่บ้าน"
                    value={floodData?.totalVillages || 0}
                    icon="home"
                    color="blue"
                />
                <StatsCard
                    label="ตำบล"
                    value={floodData?.totalTambons || 0}
                    icon="mapPin"
                    color="green"
                />
                <StatsCard
                    label="อำเภอ"
                    value={floodData?.totalDistricts || 0}
                    icon="map"
                    color="purple"
                />
                <StatsCard
                    label="ประชากร"
                    value={floodData?.totalPopulation?.toLocaleString() || 0}
                    icon="users"
                    color="orange"
                    subLabel="คน"
                />
                <StatsCard
                    label="รุนแรง"
                    value={floodData?.severeCount || 0}
                    icon="statusRed"
                    color="red"
                />
                <StatsCard
                    label="ปานกลาง"
                    value={floodData?.moderateCount || 0}
                    icon="statusYellow"
                    color="yellow"
                />
                <StatsCard
                    label="เล็กน้อย"
                    value={floodData?.mildCount || 0}
                    icon="statusGreen"
                    color="green"
                />
            </div>

            <div className="mt-4 pt-4 border-t border-[#c9dcee]">
                <div className="flex items-center justify-between text-sm text-slate-600">
                    <div className="flex items-center gap-4">
                        <span>
                            <strong>ระยะเวลา:</strong> {formatDuration(session.duration_hours)}
                        </span>
                        <span>
                            <strong>บันทึกข้อมูล:</strong> {floodData?.totalRecords || 0} รายการ
                        </span>
                        <span>
                            <strong>กิจกรรม:</strong> {session.total_activities || 0} รายการ
                        </span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${session.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                        <span className="inline-flex items-center gap-1.5">
                            <AppIcon icon={session.status === 'active' ? "statusGreen" : "statusBlack"} className="h-3 w-3" />
                            {session.status === 'active' ? 'กำลังดำเนินการ' : 'ปิดแล้ว'}
                        </span>
                    </span>
                </div>
            </div>
        </div>
    );
}

function StatsCard({ label, value, icon, color, subLabel = '' }) {
    const tone = { blue: 'blue', purple: 'blue', green: 'green', orange: 'amber', yellow: 'amber', red: 'red' }[color] || 'slate';
    return <MetricCard icon={icon} label={label} value={value} note={subLabel || null} tone={tone} compact />;
}

function formatDuration(hours) {
    if (!hours) return '-';
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days} วัน ${remainingHours} ชม.`;
}
