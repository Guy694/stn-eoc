// ========================================
// Component: จัดการทีมงานใน EOC Session
// Path: components/EOCTeamManager.jsx
// ========================================

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function EOCTeamManager({ sessionId, eocType, onTeamUpdated }) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState(null);
    const [teams, setTeams] = useState([]);
    const [availableTeams, setAvailableTeams] = useState([]);
    const [availableOfficers, setAvailableOfficers] = useState([]);

    // Modal states
    const [showAddTeamModal, setShowAddTeamModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [selectedSessionTeam, setSelectedSessionTeam] = useState(null);

    useEffect(() => {
        if (sessionId) {
            loadSessionTeams();
            loadAvailableTeams();
            loadAvailableOfficers();
        }
    }, [sessionId]);

    const loadSessionTeams = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/admin/eoc-sessions/${sessionId}/teams`);
            const data = await response.json();

            if (data.success) {
                setSession(data.session);
                setTeams(data.teams);
            }
        } catch (error) {
            console.error('Error loading teams:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAvailableTeams = async () => {
        try {
            const response = await fetch('/api/admin/eoc-teams?active=true');
            const data = await response.json();
            if (data.success) {
                setAvailableTeams(data.teams);
            }
        } catch (error) {
            console.error('Error loading available teams:', error);
        }
    };

    const loadAvailableOfficers = async () => {
        try {
            const response = await fetch('/api/admin/officers?active=true');
            const data = await response.json();
            if (data.success) {
                setAvailableOfficers(data.officers);
            }
        } catch (error) {
            console.error('Error loading officers:', error);
        }
    };

    const handleAddTeam = async (teamId, teamLeadId) => {
        try {
            const response = await fetch(`/api/admin/eoc-sessions/${sessionId}/teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teamId,
                    teamLeadOfficerId: teamLeadId,
                    assignedBy: user.id
                })
            });

            const data = await response.json();
            if (data.success) {
                await loadSessionTeams();
                setShowAddTeamModal(false);
                if (onTeamUpdated) onTeamUpdated();
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error('Error adding team:', error);
            alert('เกิดข้อผิดพลาด');
        }
    };

    const handleRemoveTeam = async (teamId) => {
        if (!confirm('ต้องการถอดทีมนี้ออกจาก Session หรือไม่?')) return;

        try {
            const response = await fetch(
                `/api/admin/eoc-sessions/${sessionId}/teams?teamId=${teamId}`,
                { method: 'DELETE' }
            );

            const data = await response.json();
            if (data.success) {
                await loadSessionTeams();
                if (onTeamUpdated) onTeamUpdated();
            }
        } catch (error) {
            console.error('Error removing team:', error);
        }
    };

    const handleAddMember = async (sessionTeamId, officerId, roleInTeam) => {
        try {
            console.log('Adding member:', { sessionTeamId, officerId, roleInTeam, assignedBy: user.id });

            const response = await fetch(
                `/api/admin/eoc-teams/${sessionTeamId}/members`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        officerId,
                        roleInTeam,
                        assignedBy: user.id
                    })
                }
            );

            const data = await response.json();
            console.log('Add member response:', data);

            if (data.success) {
                alert('เพิ่มสมาชิกสำเร็จ');
                await loadSessionTeams();
                setShowAddMemberModal(false);
                setSelectedSessionTeam(null);
            } else {
                alert(data.message || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error adding member:', error);
            alert('เกิดข้อผิดพลาด: ' + error.message);
        }
    };

    const handleRemoveMember = async (sessionTeamId, memberId) => {
        if (!confirm('ต้องการถอดสมาชิกคนนี้ออกจากทีมหรือไม่?')) return;

        try {
            const response = await fetch(
                `/api/admin/eoc-teams/${sessionTeamId}/members?memberId=${memberId}`,
                { method: 'DELETE' }
            );

            const data = await response.json();
            if (data.success) {
                await loadSessionTeams();
            }
        } catch (error) {
            console.error('Error removing member:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!session) {
        return <div className="text-center p-8">ไม่พบข้อมูล Session</div>;
    }

    // Filter available teams (exclude already assigned)
    const assignedTeamIds = teams.map(t => t.team_id);
    const unassignedTeams = availableTeams.filter(t => !assignedTeamIds.includes(t.id));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">
                            จัดการทีมงาน EOC {session.eoc_name}
                        </h2>
                        <p className="text-gray-600">
                            Session #{session.session_number} • เปิดเมื่อ: {new Date(session.opened_at).toLocaleString('th-TH')}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAddTeamModal(true)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                        disabled={session.status !== 'active'}
                    >
                        ➕ เพิ่มทีม
                    </button>
                </div>
            </div>

            {/* Teams List */}
            <div className="grid gap-6">
                {teams.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
                        ยังไม่มีทีมงานในเซสชันนี้
                    </div>
                ) : (
                    teams.map((team) => (
                        <TeamCard
                            key={team.session_team_id}
                            team={team}
                            sessionStatus={session.status}
                            onRemoveTeam={handleRemoveTeam}
                            onAddMember={() => {
                                setSelectedSessionTeam(team);
                                setShowAddMemberModal(true);
                            }}
                            onRemoveMember={handleRemoveMember}
                        />
                    ))
                )}
            </div>

            {/* Add Team Modal */}
            {showAddTeamModal && (
                <AddTeamModal
                    availableTeams={unassignedTeams}
                    availableOfficers={availableOfficers}
                    onSubmit={handleAddTeam}
                    onClose={() => setShowAddTeamModal(false)}
                />
            )}

            {/* Add Member Modal */}
            {showAddMemberModal && selectedSessionTeam && (
                <AddMemberModal
                    team={selectedSessionTeam}
                    availableOfficers={availableOfficers}
                    currentMembers={selectedSessionTeam.members}
                    onSubmit={handleAddMember}
                    onClose={() => {
                        setShowAddMemberModal(false);
                        setSelectedSessionTeam(null);
                    }}
                />
            )}
        </div>
    );
}

// ========================================
// Team Card Component
// ========================================
function TeamCard({ team, sessionStatus, onRemoveTeam, onAddMember, onRemoveMember }) {
    const [expanded, setExpanded] = useState(true);

    return (
        <div className={`bg-white rounded-lg shadow-md border-l-4 border-${team.color}-500`}>
            {/* Team Header */}
            <div className="p-4 border-b">
                <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <span className="text-3xl">{team.icon}</span>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">
                                {team.team_name_th}
                            </h3>
                            <p className="text-sm text-gray-600">
                                {team.team_code} • {team.member_count} คน
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded"
                        >
                            {expanded ? '🔽' : '▶️'}
                        </button>
                        {sessionStatus === 'active' && (
                            <>
                                <button
                                    onClick={onAddMember}
                                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                                >
                                    ➕ เพิ่มสมาชิก
                                </button>
                                <button
                                    onClick={() => onRemoveTeam(team.team_id)}
                                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                >
                                    ❌ ถอดทีม
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Team Members */}
            {expanded && (
                <div className="p-4">
                    {team.members && team.members.length > 0 ? (
                        <table className="text-gray-600 w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-2">ชื่อ-สกุล</th>
                                    <th className="text-left py-2">Username</th>
                                    <th className="text-left py-2">บทบาทในทีม</th>
                                    <th className="text-left py-2">สถานะ</th>
                                    <th className="text-left py-2">เข้าร่วมเมื่อ</th>
                                    {sessionStatus === 'active' && <th className="text-center py-2">จัดการ</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {team.members.map((member) => (
                                    <tr key={member.id} className={`border-b ${!member.is_active ? 'opacity-50' : ''}`}>
                                        <td className="py-2">{member.full_name}</td>
                                        <td className="py-2">{member.username}</td>
                                        <td className="py-2">
                                            <span className={`px-2 py-1 rounded text-sm ${member.role_in_team === 'หัวหน้าทีม'
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {member.role_in_team}
                                            </span>
                                        </td>
                                        <td className="py-2">
                                            {member.is_active ? (
                                                <span className="text-green-600">✓ ปฏิบัติงาน</span>
                                            ) : (
                                                <span className="text-red-600">✗ ถอดออก</span>
                                            )}
                                        </td>
                                        <td className="py-2 text-sm text-gray-600">
                                            {new Date(member.assigned_at).toLocaleDateString('th-TH')}
                                        </td>
                                        {sessionStatus === 'active' && (
                                            <td className="py-2 text-center">
                                                {member.is_active && (
                                                    <button
                                                        onClick={() => onRemoveMember(team.session_team_id, member.id)}
                                                        className="px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm"
                                                    >
                                                        ถอดออก
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center text-gray-500 py-4">
                            ยังไม่มีสมาชิกในทีมนี้
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ========================================
// Add Team Modal
// ========================================
function AddTeamModal({ availableTeams, availableOfficers, onSubmit, onClose }) {
    const [selectedTeam, setSelectedTeam] = useState('');
    const [selectedLead, setSelectedLead] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedTeam) {
            alert('กรุณาเลือกทีม');
            return;
        }
        onSubmit(parseInt(selectedTeam), selectedLead ? parseInt(selectedLead) : null);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-gray-600 text-xl font-bold mb-4">เพิ่มทีมเข้า Session</h3>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                เลือกทีม
                            </label>
                            <select
                                value={selectedTeam}
                                onChange={(e) => setSelectedTeam(e.target.value)}
                                className="text-gray-600 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                <option value="">-- เลือกทีม --</option>
                                {availableTeams.map((team) => (
                                    <option key={team.id} value={team.id}>
                                        {team.icon} {team.team_name_th} ({team.team_code})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                หัวหน้าทีม (ไม่บังคับ)
                            </label>
                            <select
                                value={selectedLead}
                                onChange={(e) => setSelectedLead(e.target.value)}
                                className="text-gray-600 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">-- ไม่ระบุ --</option>
                                {Array.isArray(availableOfficers) && availableOfficers.map((officer) => (
                                    <option key={officer.id} value={officer.id}>
                                        {officer.full_name} ({officer.username})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-red-500 rounded-lg hover:bg-gray-100"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                        >
                            เพิ่มทีม
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ========================================
// Add Member Modal
// ========================================
function AddMemberModal({ team, availableOfficers, currentMembers, onSubmit, onClose }) {
    const [selectedOfficer, setSelectedOfficer] = useState('');
    const [roleInTeam, setRoleInTeam] = useState('สมาชิก');

    const currentMemberIds = Array.isArray(currentMembers) ? currentMembers.filter(m => m.is_active).map(m => m.officer_id) : [];
    const availableForAdd = Array.isArray(availableOfficers) ? availableOfficers.filter(o => !currentMemberIds.includes(o.id)) : [];

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedOfficer) {
            alert('กรุณาเลือกเจ้าหน้าที่');
            return;
        }
        onSubmit(team.session_team_id, parseInt(selectedOfficer), roleInTeam);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-xl text-gray-600 font-bold mb-4">
                    เพิ่มสมาชิกเข้าทีม {team.team_name_th}
                </h3>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                เลือกเจ้าหน้าที่
                            </label>
                            <select
                                value={selectedOfficer}
                                onChange={(e) => setSelectedOfficer(e.target.value)}
                                className="text-gray-600  w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                <option value="">-- เลือกเจ้าหน้าที่ --</option>
                                {availableForAdd.map((officer) => (
                                    <option key={officer.id} value={officer.id}>
                                        {officer.full_name} ({officer.username})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                บทบาทในทีม
                            </label>
                            <select
                                value={roleInTeam}
                                onChange={(e) => setRoleInTeam(e.target.value)}
                                className="text-gray-600 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="เจ้าหน้าที่">เจ้าหน้าที่</option>
                                {/* <option value="รองหัวหน้าทีม">รองหัวหน้าทีม</option>
                                <option value="หัวหน้าทีม">หัวหน้าทีม</option> */}
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                            เพิ่มสมาชิก
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
