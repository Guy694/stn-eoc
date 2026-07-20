"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import SessionTeamsList from './SessionTeamsList';
import AppIcon from "@/components/icons/AppIcon";

export default function FloodSessionSelector({
    onSessionChange,
    currentMode = 'realtime', // 'realtime' หรือ 'historical'
    showTeams = true // แสดงข้อมูลทีมหรือไม่
}) {
    const [years, setYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [yearSummary, setYearSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const selectedSessionIdRef = useRef(null);

    const selectSession = useCallback((session, year) => {
        if (!session) return;
        if (selectedSessionIdRef.current === session.id) return;

        selectedSessionIdRef.current = session.id;
        setSelectedSession((current) => {
            if (current?.id === session.id) return current;
            return session;
        });
        onSessionChange?.(session, year);
    }, [onSessionChange]);

    const fetchAvailableYears = useCallback(async () => {
        try {
            const response = await fetch('/stn-eoc/api/eoc/flood/sessions-summary');
            const data = await response.json();
            if (data.success) {
                setYears(data.availableYears || []);
                // เลือกปีปัจจุบันโดยอัตโนมัติ
                const currentYear = new Date().getFullYear();
                const hasCurrentYear = data.availableYears?.includes(currentYear);
                if (hasCurrentYear) {
                    setSelectedYear(currentYear);
                } else if (data.availableYears?.length > 0) {
                    setSelectedYear(data.availableYears[0]);
                }
            }
        } catch (error) {
            console.error('Error fetching years:', error);
        }
    }, []);

    const fetchYearData = useCallback(async (year) => {
        setLoading(true);
        try {
            const response = await fetch(`/stn-eoc/api/eoc/flood/sessions-summary?year=${year}`);
            const data = await response.json();
            if (data.success) {
                setSessions(data.sessions || []);
                setYearSummary(data.summary || null);

                // เลือก session แรก (active หรือล่าสุด) โดยอัตโนมัติ
                const activeSessions = data.sessions?.filter(s => s.status === 'active') || [];
                if (activeSessions.length > 0) {
                    selectSession(activeSessions[0], year);
                } else if (data.sessions?.length > 0) {
                    selectSession(data.sessions[0], year);
                }
            }
        } catch (error) {
            console.error('Error fetching year data:', error);
        } finally {
            setLoading(false);
        }
    }, [selectSession]);

    // โหลดรายการปีที่มีข้อมูล
    useEffect(() => {
        fetchAvailableYears();
    }, [fetchAvailableYears]);

    // โหลดข้อมูลเมื่อเลือกปี
    useEffect(() => {
        if (selectedYear) {
            fetchYearData(selectedYear);
        }
    }, [fetchYearData, selectedYear]);

    const handleSessionChange = (session) => {
        selectSession(session, selectedYear);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDuration = (hours) => {
        if (!hours) return '-';
        const days = Math.floor(hours / 24);
        const remainingHours = Math.floor(hours % 24);
        return `${days} วัน ${remainingHours} ชม.`;
    };

    if (currentMode === 'realtime') {
        // โหมดเรียลไทม์ - แสดงเฉพาะ session ที่ active
        const activeSessions = sessions.filter(s => s.status === 'active');

        return (
            <div className="bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6 mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold mb-1"><AppIcon icon="siren" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> สถานการณ์ปัจจุบัน (Real-time)</h3>
                        {activeSessions.length > 0 ? (
                            <div className="space-y-2">
                                {activeSessions.map(session => (
                                    <div key={session.id} className="bg-white/10 rounded p-3 backdrop-blur-sm">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl animate-pulse"><AppIcon icon="statusRed" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></span>
                                            <div>
                                                <p className="font-medium">
                                                    EOC Session #{session.session_number} - {new Date().getFullYear()}
                                                </p>
                                                <p className="text-sm opacity-90">
                                                    เปิดเมื่อ: {formatDate(session.opened_at)}
                                                </p>
                                                <p className="text-sm opacity-90">
                                                    ระยะเวลา: {formatDuration(session.duration_hours || calculateDuration(session.opened_at))}
                                                </p>
                                                {session.open_reason && (
                                                    <p className="text-sm opacity-90 mt-1">
                                                        เหตุผล: {session.open_reason}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white/10 rounded p-3 backdrop-blur-sm">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl"><AppIcon icon="checkCircle" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></span>
                                    <div>
                                        <p className="font-medium">ไม่มี EOC ที่เปิดอยู่ในขณะนี้</p>
                                        <p className="text-sm opacity-90">สถานการณ์ปกติ</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    {yearSummary && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="bg-white/10 rounded p-3 backdrop-blur-sm">
                                <p className="text-2xl font-bold">{yearSummary.total_sessions || 0}</p>
                                <p className="text-sm opacity-90">ครั้งในปีนี้</p>
                            </div>
                            <div className="bg-white/10 rounded p-3 backdrop-blur-sm">
                                <p className="text-2xl font-bold">{yearSummary.total_data_entries || 0}</p>
                                <p className="text-sm opacity-90">บันทึกข้อมูล</p>
                            </div>
                            <div className="bg-white/10 rounded p-3 backdrop-blur-sm">
                                <p className="text-2xl font-bold">{yearSummary.total_villages || 0}</p>
                                <p className="text-sm opacity-90">หมู่บ้านที่ได้รับผลกระทบ</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // โหมดข้อมูลย้อนหลัง
    return (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
                <AppIcon icon="barChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ข้อมูลย้อนหลัง (Historical Data)
            </h3>

            {/* เลือกปี */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        เลือกปี
                    </label>
                    <select
                        value={selectedYear || ''}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-700"
                    >
                        <option value="">-- เลือกปี --</option>
                        {years.map(year => (
                            <option key={year} value={year}>
                                พ.ศ. {year + 543}
                            </option>
                        ))}
                    </select>
                </div>

                {/* เลือก Session */}
                {sessions.length > 0 ? (
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            เลือก EOC Session ({sessions.length} sessions)
                        </label>
                        <select
                            value={selectedSession?.id || ''}
                            onChange={(e) => {
                                const session = sessions.find(s => s.id === parseInt(e.target.value));
                                handleSessionChange(session);
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-700"
                        >
                            <option value="">-- เลือก Session --</option>
                            {sessions.map(session => (
                                <option key={session.id} value={session.id}>
                                    Session #{session.session_number} - {formatDate(session.opened_at)}
                                    {session.status === 'active' ? "(กำลังดำเนินการ)" : ` ถึง ${formatDate(session.closed_at)} (ปิดแล้ว)`}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : selectedYear && !loading && (
                    <div className="md:col-span-2">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                            <p className="text-gray-600"><AppIcon icon="file" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ไม่พบ EOC Session ในปี {selectedYear + 543}</p>
                            <p className="text-sm text-gray-500 mt-1">ลองเลือกปีอื่น</p>
                        </div>
                    </div>
                )}
            </div>

            {/* แสดงสรุปของปี */}
            {loading ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b border-teal-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
                </div>
            ) : yearSummary && (
                <div className="bg-teal-50 rounded-lg p-4">
                    <h4 className="font-semibold text-teal-800 mb-3">
                        สรุปข้อมูลปี {selectedYear + 543}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <SummaryItem
                            label="EOC Sessions"
                            value={yearSummary.total_sessions || 0}
                            icon="circleDot"
                            subtext={`ปิดแล้ว: ${yearSummary.closed_sessions || 0}, ดำเนินการ: ${yearSummary.active_sessions || 0}`}
                        />
                        <SummaryItem
                            label="รวมเวลา"
                            value={formatDuration(yearSummary.total_hours)}
                            icon="timer"
                        />
                        <SummaryItem
                            label="กิจกรรม"
                            value={yearSummary.total_activities || 0}
                            icon="clipboard"
                        />
                        <SummaryItem
                            label="บันทึกข้อมูล"
                            value={yearSummary.total_data_entries || 0}
                            icon="file"
                        />
                        <SummaryItem
                            label="หมู่บ้าน"
                            value={yearSummary.total_villages || 0}
                            icon="home"
                        />
                        <SummaryItem
                            label="อำเภอ"
                            value={yearSummary.total_districts || 0}
                            icon="mapPin"
                        />
                    </div>
                </div>
            )}

            {/* แสดงรายละเอียด Session ที่เลือก */}
            {selectedSession && (
                <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                {selectedSession.status === 'active' ? (
                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                        <AppIcon icon="checkCircle" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> กำลังดำเนินการ
                                    </span>
                                ) : (
                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">
                                        <AppIcon icon="check" className="inline-block h-4 w-4" /> ปิดแล้ว
                                    </span>
                                )}
                                <span className="text-gray-700">EOC Session #{selectedSession.session_number}</span>
                            </h4>
                            <div className="space-y-1 text-sm text-gray-600">
                                <p><strong>เปิด:</strong> {formatDate(selectedSession.opened_at)} โดย {selectedSession.opened_by_name}</p>
                                {selectedSession.closed_at && (
                                    <p><strong>ปิด:</strong> {formatDate(selectedSession.closed_at)} โดย {selectedSession.closed_by_name}</p>
                                )}
                                <p><strong>ระยะเวลา:</strong> {formatDuration(selectedSession.duration_hours)}</p>
                                {selectedSession.open_reason && (
                                    <p><strong>เหตุผลการเปิด:</strong> {selectedSession.open_reason}</p>
                                )}
                                {selectedSession.summary && (
                                    <p><strong>สรุป:</strong> {selectedSession.summary}</p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center ml-4">
                            <div className="bg-white rounded p-2 border border-gray-200">
                                <p className="text-lg font-bold text-blue-600">{selectedSession.total_activities || 0}</p>
                                <p className="text-xs text-gray-600">กิจกรรม</p>
                            </div>
                            <div className="bg-white rounded p-2 border border-gray-200">
                                <p className="text-lg font-bold text-green-600">{selectedSession.total_data_entries || 0}</p>
                                <p className="text-xs text-gray-600">บันทึก</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* แสดงข้อมูลทีมและสมาชิก (ถ้าเปิดใช้งาน) */}
            {showTeams && selectedSession && (
                <div className="mt-4">
                    <SessionTeamsList sessionId={selectedSession.id} showTitle={true} />
                </div>
            )}
        </div>
    );
}

// Helper component
function SummaryItem({ label, value, icon, subtext }) {
    return (
        <div className="bg-white rounded p-3 border border-teal-200">
            <div className="flex items-center gap-2 mb-1">
                <AppIcon icon={icon} className="h-5 w-5" />
                <span className="text-xs text-gray-600">{label}</span>
            </div>
            <p className="text-lg font-bold text-teal-700">{value}</p>
            {subtext && (
                <p className="text-xs text-gray-500 mt-1">{subtext}</p>
            )}
        </div>
    );
}

// Helper function
function calculateDuration(startDate) {
    const start = new Date(startDate);
    const now = new Date();
    const diffMs = now - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours;
}
