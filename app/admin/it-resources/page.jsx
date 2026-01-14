"use client";
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import Swal from 'sweetalert2';

export default function ITResourcesPage() {
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingResource, setEditingResource] = useState(null);
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [stats, setStats] = useState({ total: 0, online: 0, offline: 0, maintenance: 0, unknown: 0 });

    const resourceTypes = [
        { value: 'server', label: '🖥️ Server', color: 'bg-blue-100 text-blue-800' },
        { value: 'internet', label: '🌐 Internet', color: 'bg-green-100 text-green-800' },
        { value: 'network', label: '🔌 Network', color: 'bg-purple-100 text-purple-800' },
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
        resource_type: 'server',
        unit_name: '',
        unit_code: '',
        location: '',
        server_name: '',
        server_ip: '',
        server_os: '',
        isp_provider: '',
        connection_type: '',
        bandwidth: '',
        status: 'unknown',
        notes: '',
        contact_person: '',
        contact_phone: ''
    });

    useEffect(() => {
        fetchResources();
    }, [filterType, filterStatus]);

    const fetchResources = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterType) params.append('resource_type', filterType);
            if (filterStatus) params.append('status', filterStatus);

            const response = await fetch(`/api/admin/it-resources?${params}`);
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
    };

    const resetForm = () => {
        setFormData({
            resource_type: 'server',
            unit_name: '',
            unit_code: '',
            location: '',
            server_name: '',
            server_ip: '',
            server_os: '',
            isp_provider: '',
            connection_type: '',
            bandwidth: '',
            status: 'unknown',
            notes: '',
            contact_person: '',
            contact_phone: ''
        });
        setEditingResource(null);
    };

    const handleEdit = (resource) => {
        setEditingResource(resource);
        setFormData({
            resource_type: resource.resource_type || 'server',
            unit_name: resource.unit_name || '',
            unit_code: resource.unit_code || '',
            location: resource.location || '',
            server_name: resource.server_name || '',
            server_ip: resource.server_ip || '',
            server_os: resource.server_os || '',
            isp_provider: resource.isp_provider || '',
            connection_type: resource.connection_type || '',
            bandwidth: resource.bandwidth || '',
            status: resource.status || 'unknown',
            notes: resource.notes || '',
            contact_person: resource.contact_person || '',
            contact_phone: resource.contact_phone || ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const url = editingResource
                ? `/api/admin/it-resources?id=${editingResource.id}`
                : '/api/admin/it-resources';
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
                const response = await fetch(`/api/admin/it-resources?id=${id}`, { method: 'DELETE' });
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
        <AdminLayout>
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
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
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
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อหน่วยบริการ *</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.unit_name}
                                                onChange={(e) => setFormData({ ...formData, unit_name: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-lg text-gray-700"
                                                placeholder="เช่น รพ.สต.ควนกาหลง"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">รหัสหน่วยบริการ</label>
                                            <input
                                                type="text"
                                                value={formData.unit_code}
                                                onChange={(e) => setFormData({ ...formData, unit_code: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-lg text-gray-700"
                                                placeholder="เช่น PCU-KKL"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">ที่ตั้ง</label>
                                        <input
                                            type="text"
                                            value={formData.location}
                                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg text-gray-700"
                                            placeholder="เช่น อ.ควนกาหลง"
                                        />
                                    </div>

                                    {/* Server Fields */}
                                    {formData.resource_type === 'server' && (
                                        <div className="bg-blue-50 p-4 rounded-lg space-y-4">
                                            <h3 className="font-medium text-blue-800">🖥️ ข้อมูล Server</h3>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ Server</label>
                                                    <input
                                                        type="text"
                                                        value={formData.server_name}
                                                        onChange={(e) => setFormData({ ...formData, server_name: e.target.value })}
                                                        className="w-full px-3 py-2 border rounded-lg text-gray-700"
                                                        placeholder="Main Server"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
                                                    <input
                                                        type="text"
                                                        value={formData.server_ip}
                                                        onChange={(e) => setFormData({ ...formData, server_ip: e.target.value })}
                                                        className="w-full px-3 py-2 border rounded-lg text-gray-700"
                                                        placeholder="192.168.1.1"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">OS</label>
                                                    <input
                                                        type="text"
                                                        value={formData.server_os}
                                                        onChange={(e) => setFormData({ ...formData, server_os: e.target.value })}
                                                        className="w-full px-3 py-2 border rounded-lg text-gray-700"
                                                        placeholder="Windows Server 2019"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

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

                                    {/* Contact Info */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ผู้รับผิดชอบ</label>
                                            <input
                                                type="text"
                                                value={formData.contact_person}
                                                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-lg text-gray-700"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์ติดต่อ</label>
                                            <input
                                                type="text"
                                                value={formData.contact_phone}
                                                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-lg text-gray-700"
                                            />
                                        </div>
                                    </div>

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
        </AdminLayout>
    );
}
