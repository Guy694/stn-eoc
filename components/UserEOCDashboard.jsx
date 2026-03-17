// ========================================
// Component: Dashboard แสดงทีมที่ user รับผิดชอบ
// Path: components/UserEOCDashboard.jsx
// ========================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function UserEOCDashboard() {
    const { user } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            loadAssignments();
        }
    }, [user]);

    const loadAssignments = async () => {
        try {
            setLoading(true);
            const response = await fetch('/stn-eoc/api/user/my-assignments', {
                headers: {
                    'x-user-id': user.id.toString()
                }
            });
            const data = await response.json();

            if (data.success) {
                setAssignments(data.assignments || []);
            }
        } catch (error) {
            console.error('Error loading assignments:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (assignments.length === 0) {
        return (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
                <div className="text-4xl mb-3">⚠️</div>
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                    ยังไม่มีการมอบหมายงาน
                </h3>
                <p className="text-yellow-700">
                    คุณยังไม่ได้รับมอบหมายให้ปฏิบัติงานใน EOC Session ใด
                    <br />
                    กรุณาติดต่อผู้ดูแลระบบเพื่อรับมอบหมายทีมงาน
                </p>
            </div>
        );
    }

    // จัดกลุ่ม assignments ตาม session
    const groupedBySession = assignments.reduce((acc, assignment) => {
        const key = `${assignment.session_id}-${assignment.eoc_type}`;
        if (!acc[key]) {
            acc[key] = {
                session_id: assignment.session_id,
                eoc_type: assignment.eoc_type,
                eoc_name: getEOCName(assignment.eoc_type),
                session_number: assignment.session_number,
                teams: []
            };
        }
        acc[key].teams.push(assignment);
        return acc;
    }, {});

    const sessions = Object.values(groupedBySession);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">
                    📌 EOC ที่คุณรับผิดชอบ
                </h2>
                <button
                    onClick={loadAssignments}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm"
                >
                    🔄 รีเฟรช
                </button>
            </div>

            {sessions.map((session) => (
                <div
                    key={`${session.session_id}-${session.eoc_type}`}
                    className="bg-white rounded-lg shadow-md border-l-4 border-blue-500 overflow-hidden"
                >
                    {/* Session Header */}
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
                        <h3 className="text-xl font-bold">
                            {getEOCIcon(session.eoc_type)} {session.eoc_name} #{session.session_number}
                        </h3>
                        <p className="text-blue-100 text-sm mt-1">
                            Session ID: {session.session_id} • Status: Active
                        </p>
                    </div>

                    {/* Teams & Modules */}
                    <div className="p-6 space-y-6">
                        {session.teams.map((team, idx) => (
                            <div key={idx} className="space-y-3">
                                {/* Team Info */}
                                <div className="flex items-center space-x-3 pb-2 border-b">
                                    <span className="text-2xl">{getTeamIcon(team.team_code)}</span>
                                    <div>
                                        <h4 className="font-semibold text-gray-800">
                                            {team.team_name_th}
                                        </h4>
                                        <p className="text-sm text-gray-600">
                                            {team.team_code} • {team.role_in_team || 'สมาชิก'}
                                        </p>
                                    </div>
                                </div>

                                {/* Modules */}
                                {team.modules && team.modules.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {team.modules.map((module) => (
                                            <Link
                                                key={module.module_code}
                                                href={module.route_path}
                                                className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition group"
                                            >
                                                <span className="text-3xl group-hover:scale-110 transition">
                                                    {module.icon || '📄'}
                                                </span>
                                                <div className="flex-1">
                                                    <div className="font-medium text-gray-800 group-hover:text-blue-600">
                                                        {module.module_name_th}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {getPermissionBadges(module)}
                                                    </div>
                                                </div>
                                                <span className="text-gray-400 group-hover:text-blue-600">
                                                    →
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-500 py-4 bg-gray-50 rounded">
                                        ไม่มี Modules ที่กำหนดสำหรับทีมนี้
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// Helper Functions
function getEOCName(eocType) {
    const names = {
        flood: 'น้ำท่วม',
        drought: 'ภัยแล้ง',
        disease: 'โรคระบาด',
        tsunami: 'คลื่นสึนามิ',
        earthquake: 'แผ่นดินไหว'
    };
    return names[eocType] || eocType;
}

function getEOCIcon(eocType) {
    const icons = {
        flood: '💧',
        drought: '🌵',
        disease: '🦠',
        tsunami: '🌊',
        earthquake: '🏚️'
    };
    return icons[eocType] || '⚠️';
}

function getTeamIcon(teamCode) {
    const icons = {
        RISKCOM: '📢',
        MCAT: '📊',
        SAT: '🚑',
        SeRHT: '🚁',
        MEDICAL: '⚕️',
        LOGISTICS: '📦',
        SHELTER: '🏕️'
    };
    return icons[teamCode] || '👥';
}

function getPermissionBadges(module) {
    const badges = [];

    if (module.can_create) badges.push('✏️ สร้าง');
    if (module.can_edit) badges.push('📝 แก้ไข');
    if (module.can_delete) badges.push('🗑️ ลบ');
    if (module.can_approve) badges.push('✅ อนุมัติ');

    if (badges.length === 0) {
        if (module.can_view) {
            return '👁️ ดูอย่างเดียว';
        }
        return 'ไม่มีสิทธิ์';
    }

    return badges.join(' • ');
}
