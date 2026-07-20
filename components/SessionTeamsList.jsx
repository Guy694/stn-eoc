// ========================================
// Component: แสดงรายชื่อทีมงานและสมาชิกใน Session
// Path: components/SessionTeamsList.jsx
// สำหรับใช้ในโหมดข้อมูลย้อนหลัง
// ========================================

'use client';

import { useCallback, useEffect, useState } from 'react';
import AppIcon from './icons/AppIcon';

export default function SessionTeamsList({ sessionId, showTitle = true }) {
    const [loading, setLoading] = useState(true);
    const [teams, setTeams] = useState([]);
    const [session, setSession] = useState(null);
    const [error, setError] = useState('');

    const fetchTeams = useCallback(async () => {
        if (!sessionId) return;

        try {
            setLoading(true);
            setError('');
            const response = await fetch(`/stn-eoc/api/eoc/sessions/${sessionId}/teams`);
            const data = await response.json();

            if (data.success) {
                setSession(data.session);
                setTeams(data.teams);
            } else {
                setError(data.message);
            }
        } catch (err) {
            console.error('Error fetching teams:', err);
            setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
        } finally {
            setLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        fetchTeams();
    }, [fetchTeams]);

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b border-teal-500"></div>
                    <span className="ml-3 text-gray-600">กำลังโหลดข้อมูลทีม...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-center text-red-500 py-4">
                    <span className="inline-flex items-center gap-2">
                        <AppIcon icon="xCircle" className="h-5 w-5" />
                        {error}
                    </span>
                </div>
            </div>
        );
    }

    if (!teams || teams.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-center text-gray-500 py-8">
                    <AppIcon icon="users" className="mx-auto mb-2 h-10 w-10" />
                    <p>ไม่มีข้อมูลทีมงานในเซสชันนี้</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* {showTitle && (
                <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg shadow-md p-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <AppIcon icon="users" className="h-7 w-7" />
                        ทีมงานที่เปิดใช้งาน
                        <span className="ml-2 px-3 py-1 bg-white/20 rounded-full text-sm">
                            {teams.length} ทีม
                        </span>
                    </h3>
                    {session && (
                        <p className="text-sm mt-1 opacity-90">
                            {session.eoc_name} - Session #{session.session_number}
                        </p>
                    )}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {teams.map((team) => (
                    <TeamCard key={team.session_team_id} team={team} />
                ))}
            </div> */}
        </div>
    );
}

// ========================================
// Team Card Component
// ========================================
function TeamCard({ team }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div
            className={`bg-white rounded-lg shadow-md border overflow-hidden transition-all hover:shadow-lg`}
            style={{ borderLeftColor: getColorClass(team.color) }}
        >
            {/* Team Header */}
            <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                        <AppIcon icon={team.icon || 'users'} className="h-8 w-8 text-blue-600" />
                        <div className="flex-1">
                            <h4 className="font-semibold text-gray-800 text-sm">
                                {team.team_name_th}
                            </h4>
                            <p className="text-xs text-gray-500">
                                {team.team_code}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Team Lead */}
                {team.team_lead_name && (
                    <div className="mb-3 bg-gray-50 rounded p-2">
                        <p className="text-xs text-gray-600 mb-1">หัวหน้าทีม:</p>
                        <div className="flex items-center gap-2">
                            <span className="text-lg"><AppIcon icon="userCog" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">
                                    {team.team_lead_name} {team.team_lead_family_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {team.team_lead_role || 'เจ้าหน้าที่'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Member Count */}
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">
                        สมาชิก: <strong>{team.member_count}</strong> คน
                    </span>
                    {team.members && team.members.length > 0 && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                        >
                            {expanded ? '▼ ซ่อน' : "ดูรายชื่อ"}
                        </button>
                    )}
                </div>

                {/* Members List */}
                {expanded && team.members && team.members.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-2">
                            รายชื่อสมาชิก:
                        </p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {team.members.map((member, index) => (
                                <div
                                    key={member.id}
                                    className="flex items-start gap-2 bg-gray-50 rounded p-2 text-xs"
                                >
                                    <span className="text-gray-400 font-mono min-w-[20px]">
                                        {index + 1}.
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-800 truncate">
                                            {member.full_name}
                                        </p>
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <span className="truncate">
                                                {member.role_in_team}
                                            </span>
                                            {member.officer_role && (
                                                <>
                                                    <span>•</span>
                                                    <span className="truncate">
                                                        {member.officer_role}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Description (if exists) */}
                {team.description && !expanded && (
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                        {team.description}
                    </p>
                )}
            </div>
        </div>
    );
}

// Helper function to get color
function getColorClass(color) {
    const colorMap = {
        'purple': '#9333ea',
        'blue': '#3b82f6',
        'red': '#ef4444',
        'orange': '#f97316',
        'green': '#22c55e',
        'yellow': '#eab308',
        'teal': '#14b8a6',
        'indigo': '#6366f1',
        'pink': '#ec4899',
        'gray': '#6b7280'
    };
    return colorMap[color] || '#6b7280';
}
