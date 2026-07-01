"use client";
import { useCallback, useEffect, useState } from 'react';
import EOCLayout from '@/components/layouts/EOCLayout';
import Swal from 'sweetalert2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

export default function ITResourcesPage() {
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingResource, setEditingResource] = useState(null);
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [stats, setStats] = useState({ total: 0, online: 0, offline: 0, maintenance: 0, unknown: 0, byType: [], byIsp: [] });
    const [healthFacilities, setHealthFacilities] = useState([]);

    const resourceTypes = [
        { value: 'server', label: '🖥️ Server', color: 'bg-blue-100 text-blue-800' },
        { value: 'internet', label: '🌐 Internet', color: 'bg-green-100 text-green-800' },
        { value: 'network', label: '🔌 Network', color: 'bg-teal-100 text-teal-800' },
        { value: 'hardware', label: '💻 Hardware', color: 'bg-orange-100 text-orange-800' }
    ];

    const statusTypes = [
        { value: 'online', label: '🟢 Online', color: 'bg-green-100 text-green-800' },
        { value: 'offline', label: '🔴 Offline', color: 'bg-red-100 text-red-800' },
        { value: 'maintenance', label: '🟡 Maintenance', color: 'bg-yellow-100 text-yellow-800' },
        { value: 'unknown', label: '⚪ Unknown', color: 'bg-gray-100 text-gray-800' }
    ];

    const ispProviders = ['AIS', 'TRUE', 'DTAC', 'TOT', '3BB', 'CAT', 'NT', 'อื่นๆ'];
    const connectionTypes = ['Fiber', '4G', '5G', 'ADSL', 'VDSL', 'Leased Line', 'Satellite'];

    const [formData, setFormData] = useState({
        resource_type: 'internet',
        unit_name: '',
        isp_provider: '',
        connection_type: '',
        bandwidth: '',
        status: 'unknown',
        notes: ''
    });

    const fetchHealthFacilities = useCallback(async () => {
        try {
            const response = await fetch('/stn-eoc/api/common/health-facilities');
            const data = await response.json();
            if (data.success) {
                setHealthFacilities(data.data || []);
            }
        } catch (error) {
            console.error('Fetch health facilities error:', error);
        }
    }, []);

    const fetchResources = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterType) params.append('resource_type', filterType);
            if (filterStatus) params.append('status', filterStatus);

            const response = await fetch(`/stn-eoc/api/admin/it-resources?${params}`);
            const data = await response.json();

            if (data.success) {
                setResources(data.data);
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [filterStatus, filterType]);

    useEffect(() => {
        fetchResources();
        fetchHealthFacilities();
    }, [fetchHealthFacilities, fetchResources]);

    const resetForm = () => {
        setFormData({
            resource_type: 'internet',
            unit_name: '',
            isp_provider: '',
            connection_type: '',
            bandwidth: '',
            status: 'unknown',
            notes: ''
        });
        setEditingResource(null);
    };

    const handleEdit = (resource) => {
        setEditingResource(resource);
        setFormData({
            resource_type: resource.resource_type || 'internet',
            unit_name: resource.unit_name || '',
            isp_provider: resource.isp_provider || '',
            connection_type: resource.connection_type || '',
            bandwidth: resource.bandwidth || '',
            status: resource.status || 'unknown',
            notes: resource.notes || ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const url = editingResource
                ? `/stn-eoc/api/admin/it-resources?id=${editingResource.id}`
                : '/stn-eoc/api/admin/it-resources';
            const method = editingResource ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'สำเร็จ',
                    text: data.message,
                    timer: 1500,
                    showConfirmButton: false
                });
                setShowModal(false);
                resetForm();
                fetchResources();
            } else {
                Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: data.message });
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: error.message });
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'ยืนยันการลบ?',
            text: 'คุณต้องการลบข้อมูลนี้หรือไม่?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'ลบ',
            cancelButtonText: 'ยกเลิก'
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`/stn-eoc/api/admin/it-resources?id=${id}`, { method: 'DELETE' });
                const data = await response.json();

                if (data.success) {
                    Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1500, showConfirmButton: false });
                    fetchResources();
                }
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: error.message });
            }
        }
    };

    const getTypeLabel = (type) => resourceTypes.find(t => t.value === type)?.label || type;
    const getTypeColor = (type) => resourceTypes.find(t => t.value === type)?.color || 'bg-gray-100 text-gray-800';
    const getStatusLabel = (status) => statusTypes.find(s => s.value === status)?.label || status;
    const getStatusColor = (status) => statusTypes.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-800';

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <EOCLayout>
            <div className="p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        🖥️ จัดการทรัพยากร IT Support
                    </h1>
                    <p className="text-gray-600 mt-1">ข้อมูล Server, Internet และอุปกรณ์ IT ของหน่วยบริการ</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow p-4 text-center">
                        <div className="text-3xl font-bold text-gray-800">{stats.total}</div>
                        <div className="text-sm text-gray-600">ทั้งหมด</div>
                    </div>
                    <div className="bg-green-50 rounded-lg shadow p-4 text-center">
                        <div className="text-3xl font-bold text-green-600">{stats.online}</div>
                        <div className="text-sm text-green-700">🟢 Online</div>
                    </div>
                    <div className="bg-red-50 rounded-lg shadow p-4 text-center">
                        <div className="text-3xl font-bold text-red-600">{stats.offline}</div>
                        <div className="text-sm text-red-700">🔴 Offline</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg shadow p-4 text-center">
                        <div className="text-3xl font-bold text-yellow-600">{stats.maintenance}</div>
                        <div className="text-sm text-yellow-700">🟡 Maintenance</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg shadow p-4 text-center">
                        <div className="text-3xl font-bold text-gray-600">{stats.unknown}</div>
                        <div className="text-sm text-gray-700">⚪ Unknown</div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Status Pie Chart */}
                    <div className="bg-white rounded-lg shadow p-4">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">📊 สถานะทั้งหมด</h3>
                        <div className="h-64">
                            <Pie
                                data={{
                                    labels: ['🟢 Online', '🔴 Offline', '🟡 Maintenance', '⚪ Unknown'],
                                    datasets: [{
                                        data: [
                                            stats.online || 0,
                                            stats.offline || 0,
                                            stats.maintenance || 0,
                                            stats.unknown || 0
                                        ],
                                        backgroundColor: [
                                            'rgba(34, 197, 94, 0.8)',
                                            'rgba(239, 68, 68, 0.8)',
                                            'rgba(234, 179, 8, 0.8)',
                                            'rgba(156, 163, 175, 0.8)'
                                        ],
                                        borderColor: [
                                            'rgb(34, 197, 94)',
                                            'rgb(239, 68, 68)',
                                            'rgb(234, 179, 8)',
                                            'rgb(156, 163, 175)'
                                        ],
                                        borderWidth: 2
                                    }]
                                }}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { position: 'bottom' }
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* ISP Providers Bar Chart */}
                    <div className="bg-white rounded-lg shadow p-4">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">🌐 ผู้ให้บริการ Internet (ISP)</h3>
                        <div className="h-64">
                            {stats.byIsp && stats.byIsp.length > 0 ? (
                                <Bar
                                    data={{
                                        labels: stats.byIsp.map(item => item.isp_provider),
                                        datasets: [
                                            {
                                                label: 'Online',
                                                data: stats.byIsp.map(item => item.online || 0),
                                                backgroundColor: 'rgba(34, 197, 94, 0.8)',
                                                borderColor: 'rgb(34, 197, 94)',
                                                borderWidth: 1
                                            },
                                            {
                                                label: 'Offline',
                                                data: stats.byIsp.map(item => item.offline || 0),
                                                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                                                borderColor: 'rgb(239, 68, 68)',
                                                borderWidth: 1
                                            }
                                        ]
                                    }}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { position: 'top' }
                                        },
                                        scales: {
                                            y: { beginAtZero: true, ticks: { stepSize: 1 } }
                                        }
                                    }}
                                />
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-500">
                                    ยังไม่มีข้อมูล ISP
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Resource Types Bar Chart */}
                    <div className="bg-white rounded-lg shadow p-4">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">📦 แยกตามประเภททรัพยากร</h3>
                        <div className="h-64">
                            {stats.byType && stats.byType.length > 0 ? (
                                <Bar
                                    data={{
                                        labels: stats.byType.map(item => {
                                            const typeLabels = {
                                                server: '🖥️ Server',
                                                internet: '🌐 Internet',
                                                network: '🔌 Network',
                                                hardware: '💻 Hardware'
                                            };
                                            return typeLabels[item.resource_type] || item.resource_type;
                                        }),
                                        datasets: [{
                                            label: 'จำนวน',
                                            data: stats.byType.map(item => item.count || 0),
                                            backgroundColor: [
                                                'rgba(59, 130, 246, 0.8)',
                                                'rgba(34, 197, 94, 0.8)',
                                                'rgba(168, 85, 247, 0.8)',
                                                'rgba(249, 115, 22, 0.8)'
                                            ],
                                            borderColor: [
                                                'rgb(59, 130, 246)',
                                                'rgb(34, 197, 94)',
                                                'rgb(168, 85, 247)',
                                                'rgb(249, 115, 22)'
                                            ],
                                            borderWidth: 2
                                        }]
                                    }}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { display: false }
                                        },
                                        scales: {
                                            y: { beginAtZero: true, ticks: { stepSize: 1 } }
                                        }
                                    }}
                                />
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-500">
                                    ยังไม่มีข้อมูล
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filters and Add Button */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex flex-wrap gap-4">
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="px-4 py-2 border rounded-lg text-gray-700"
                            >
                                <option value="">ทุกประเภท</option>
                                {resourceTypes.map(type => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="px-4 py-2 border rounded-lg text-gray-700"
                            >
                                <option value="">ทุกสถานะ</option>
                                {statusTypes.map(status => (
                                    <option key={status.value} value={status.value}>{status.label}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={() => { resetForm(); setShowModal(true); }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        >
                            ➕ เพิ่มทรัพยากร
                        </button>
                    </div>
                </div>

                {/* Resources Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b border-blue-500 mx-auto"></div>
                        </div>
                    ) : resources.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <div className="text-5xl mb-4">📭</div>
                            <p>ยังไม่มีข้อมูลทรัพยากร IT</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ประเภท</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">หน่วยบริการ</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">รายละเอียด</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ตรวจสอบล่าสุด</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้รับผิดชอบ</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {resources.map((resource) => (
                                        <tr key={resource.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(resource.resource_type)}`}>
                                                    {getTypeLabel(resource.resource_type)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">{resource.unit_name}</div>
                                                {resource.unit_code && (
                                                    <div className="text-xs text-gray-500">{resource.unit_code}</div>
                                                )}
                                                {resource.location && (
                                                    <div className="text-xs text-gray-400">📍 {resource.location}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700">
                                                {resource.resource_type === 'server' ? (
                                                    <div>
                                                        {resource.server_name && <div>🖥️ {resource.server_name}</div>}
                                                        {resource.server_ip && <div className="text-xs text-gray-500">IP: {resource.server_ip}</div>}
                                                        {resource.server_os && <div className="text-xs text-gray-400">{resource.server_os}</div>}
                                                    </div>
                                                ) : resource.resource_type === 'internet' ? (
                                                    <div>
                                                        {resource.isp_provider && <div>🌐 {resource.isp_provider}</div>}
                                                        {resource.connection_type && <div className="text-xs text-gray-500">{resource.connection_type}</div>}
                                                        {resource.bandwidth && <div className="text-xs text-gray-400">{resource.bandwidth}</div>}
                                                    </div>
                                                ) : (
                                                    <div className="text-gray-400">-</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(resource.status)}`}>
                                                    {getStatusLabel(resource.status)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                {formatDate(resource.last_check)}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {resource.contact_person && <div>{resource.contact_person}</div>}
                                                {resource.contact_phone && <div className="text-xs text-gray-500">📞 {resource.contact_phone}</div>}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => handleEdit(resource)}
                                                        className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                                                    >
                                                        แก้ไข
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(resource.id)}
                                                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                                                    >
                                                        ลบ
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <h2 className="text-xl font-bold text-gray-800 mb-4">
                                    {editingResource ? '✏️ แก้ไขทรัพยากร IT' : '➕ เพิ่มทรัพยากร IT'}
                                </h2>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {/* Resource Type and Status */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ประเภททรัพยากร *</label>
                                            <select
                                                required
                                                value={formData.resource_type}
                                                onChange={(e) => setFormData({ ...formData, resource_type: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-lg text-gray-700"
                                            >
                                                {resourceTypes.map(type => (
                                                    <option key={type.value} value={type.value}>{type.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ *</label>
                                            <select
                                                required
                                                value={formData.status}
                                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-lg text-gray-700"
                                            >
                                                {statusTypes.map(status => (
                                                    <option key={status.value} value={status.value}>{status.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Unit Info */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">หน่วยบริการ *</label>
                                        <select
                                            required
                                            value={formData.unit_name}
                                            onChange={(e) => setFormData({ ...formData, unit_name: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg text-gray-700"
                                        >
                                            <option value="">-- เลือกหน่วยบริการ --</option>
                                            {healthFacilities.map(facility => (
                                                <option key={facility.id} value={facility.name}>{facility.name}</option>
                                            ))}
                                        </select>
                                    </div>



                                    {/* Internet Fields */}
                                    {formData.resource_type === 'internet' && (
                                        <div className="bg-green-50 p-4 rounded-lg space-y-4">
                                            <h3 className="font-medium text-green-800">🌐 ข้อมูล Internet</h3>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ให้บริการ (ISP)</label>
                                                    <select
                                                        value={formData.isp_provider}
                                                        onChange={(e) => setFormData({ ...formData, isp_provider: e.target.value })}
                                                        className="w-full px-3 py-2 border rounded-lg text-gray-700"
                                                    >
                                                        <option value="">-- เลือก --</option>
                                                        {ispProviders.map(isp => (
                                                            <option key={isp} value={isp}>{isp}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทการเชื่อมต่อ</label>
                                                    <select
                                                        value={formData.connection_type}
                                                        onChange={(e) => setFormData({ ...formData, connection_type: e.target.value })}
                                                        className="w-full px-3 py-2 border rounded-lg text-gray-700"
                                                    >
                                                        <option value="">-- เลือก --</option>
                                                        {connectionTypes.map(type => (
                                                            <option key={type} value={type}>{type}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">ความเร็ว</label>
                                                    <input
                                                        type="text"
                                                        value={formData.bandwidth}
                                                        onChange={(e) => setFormData({ ...formData, bandwidth: e.target.value })}
                                                        className="w-full px-3 py-2 border rounded-lg text-gray-700"
                                                        placeholder="100Mbps"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}



                                    {/* Notes */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            rows={3}
                                            className="w-full px-3 py-2 border rounded-lg text-gray-700"
                                        />
                                    </div>

                                    {/* Buttons */}
                                    <div className="flex justify-end gap-3 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => { setShowModal(false); resetForm(); }}
                                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                                        >
                                            ยกเลิก
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                        >
                                            {editingResource ? '💾 บันทึกการแก้ไข' : '➕ เพิ่มข้อมูล'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </EOCLayout>
    );
}
