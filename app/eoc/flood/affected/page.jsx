"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { showWarning, showSuccess, showError, showConfirm } from '@/lib/sweetAlert';
import EOCLayout from '@/components/layouts/EOCLayout';
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

export default function AffectedPersonsPage() {
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [summary, setSummary] = useState({
        today: [],
        cumulative: [],
        province: {}
    });
    const [showModal, setShowModal] = useState(false);
    const [editingReport, setEditingReport] = useState(null);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterDistrict, setFilterDistrict] = useState('');

    const [formData, setFormData] = useState({
        report_date: new Date().toISOString().split('T')[0],
        district_name: '',
        tambon: '',
        deaths: 0,
        missing: 0,
        injured: 0,
        affected: 0,
        notes: ''
    });

    // รายการอำเภอในจังหวัดสตูล
    const districts = ['สตูล', 'ควนโดน', 'ควนกาหลง', 'ท่าแพ', 'ละงู', 'มะนัง', 'ทุ่งหว้า'];

    useEffect(() => {
        fetchSessions();
    }, []);

    useEffect(() => {
        if (selectedSession) {
            fetchReports();
        }
    }, [selectedSession, filterDate]);

    const fetchSessions = async () => {
        try {
            const response = await fetch('/stn-eoc/api/eoc/sessions?limit=100');
            const result = await response.json();
            if (result.success) {
                const sessionsList = Array.isArray(result.data) ? result.data : [];
                setSessions(sessionsList);
                const activeSession = sessionsList.find(s => s.status === 'active') || sessionsList[0];
                if (activeSession) {
                    setSelectedSession(activeSession);
                }
            }
        } catch (error) {
            console.error('Fetch sessions error:', error);
        }
    };

    const fetchReports = async () => {
        if (!selectedSession) return;

        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('session_id', selectedSession.id);
            if (filterDate) params.append('date', filterDate);

            const response = await fetch(`/stn-eoc/api/eoc/flood/affected?${params}`);
            const result = await response.json();

            if (result.success) {
                setReports(Array.isArray(result.data) ? result.data : []);
                setSummary(result.summary || { today: [], cumulative: [], province: {} });
            } else {
                showError(result.message);
            }
        } catch (error) {
            console.error('Fetch reports error:', error);
            showError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedSession) {
            showWarning('กรุณาเลือก EOC Session');
            return;
        }

        const submitData = {
            ...formData,
            session_id: selectedSession.id,
            deaths: parseInt(formData.deaths) || 0,
            missing: parseInt(formData.missing) || 0,
            injured: parseInt(formData.injured) || 0,
            affected: parseInt(formData.affected) || 0
        };

        if (!submitData.report_date || !submitData.district_name) {
            showWarning('กรุณากรอกวันที่และอำเภอ');
            return;
        }

        if (submitData.deaths < 0 || submitData.missing < 0 || submitData.injured < 0 || submitData.affected < 0) {
            showWarning('จำนวนผู้ได้รับผลกระทบต้องเป็นจำนวนบวก');
            return;
        }

        try {
            const url = editingReport
                ? `/stn-eoc/api/eoc/flood/affected?id=${editingReport.id}`
                : '/stn-eoc/api/eoc/flood/affected';

            const response = await fetch(url, {
                method: editingReport ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submitData)
            });

            const result = await response.json();

            if (result.success) {
                showSuccess(editingReport ? 'แก้ไขข้อมูลสำเร็จ' : 'บันทึกข้อมูลสำเร็จ');
                setShowModal(false);
                resetForm();
                fetchReports();
            } else {
                showError(result.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
            }
        } catch (error) {
            console.error('Submit error:', error);
            showError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }
    };

    const handleEdit = (report) => {
        setEditingReport(report);
        setFormData({
            report_date: report.report_date,
            district_name: report.district_name,
            tambon: report.tambon || '',
            deaths: report.deaths,
            missing: report.missing,
            injured: report.injured,
            affected: report.affected,
            notes: report.notes || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (report) => {
        const result = await showConfirm(
            'ยืนยันการลบ',
            `คุณต้องการลบรายงานของ ${report.district_name} ใช่หรือไม่?`,
            'warning'
        );

        if (result.isConfirmed) {
            try {
                const response = await fetch(`/stn-eoc/api/eoc/flood/affected?id=${report.id}`, {
                    method: 'DELETE'
                });

                const result = await response.json();
                if (result.success) {
                    showSuccess('ลบข้อมูลสำเร็จ');
                    fetchReports();
                } else {
                    showError(result.message);
                }
            } catch (error) {
                console.error('Delete error:', error);
                showError('เกิดข้อผิดพลาดในการลบข้อมูล');
            }
        }
    };

    const resetForm = () => {
        setFormData({
            report_date: new Date().toISOString().split('T')[0],
            district_name: '',
            tambon: '',
            deaths: 0,
            missing: 0,
            injured: 0,
            affected: 0,
            notes: ''
        });
        setEditingReport(null);
    };

    const filteredReports = filterDistrict
        ? reports.filter(r => r.district_name === filterDistrict)
        : reports;

    // เตรียมข้อมูลกราฟรายอำเภอ
    const getDistrictChartData = () => {
        return {
            labels: districts,
            datasets: [
                {
                    label: 'ผู้เสียชีวิต',
                    data: districts.map(district => {
                        const record = summary.today.find(s => s.district_name === district);
                        return record ? record.today_deaths : 0;
                    }),
                    backgroundColor: 'rgb(220, 38, 38)',
                },
                {
                    label: 'ผู้สูญหาย',
                    data: districts.map(district => {
                        const record = summary.today.find(s => s.district_name === district);
                        return record ? record.today_missing : 0;
                    }),
                    backgroundColor: 'rgb(234, 179, 8)',
                },
                {
                    label: 'ผู้ได้รับบาดเจ็บ',
                    data: districts.map(district => {
                        const record = summary.today.find(s => s.district_name === district);
                        return record ? record.today_injured : 0;
                    }),
                    backgroundColor: 'rgb(249, 115, 22)',
                },
                {
                    label: 'ผู้ได้รับผลกระทบ',
                    data: districts.map(district => {
                        const record = summary.today.find(s => s.district_name === district);
                        return record ? record.today_affected : 0;
                    }),
                    backgroundColor: 'rgb(59, 130, 246)',
                }
            ]
        };
    };

    return (
        <EOCLayout>
            <div className="container mx-auto px-4">
                {/* Header */}
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                            <span className="text-4xl">👥</span>
                            ข้อมูลผู้ได้รับผลกระทบรายวัน
                        </h1>
                        <p className="text-gray-600">บันทึกและติดตามข้อมูลผู้เสียชีวิต ผู้สูญหาย ผู้บาดเจ็บ และผู้ได้รับผลกระทบ</p>
                    </div>
                    <button
                        onClick={() => {
                            resetForm();
                            setShowModal(true);
                        }}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                        <span className="text-xl">➕</span>
                        เพิ่มรายงาน
                    </button>
                </div>

                {/* Session Selector */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-md p-4 mb-6 border border-blue-200">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">📋</span>
                            <label className="text-sm font-medium text-gray-700">เลือก EOC Session:</label>
                        </div>
                        <select
                            value={selectedSession?.id || ''}
                            onChange={(e) => {
                                const session = sessions.find(s => s.id === parseInt(e.target.value));
                                setSelectedSession(session);
                            }}
                            className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">เลือก EOC Session</option>
                            {sessions.map(session => (
                                <option key={session.id} value={session.id}>
                                    #{session.session_number} - {session.eoc_type} - {new Date(session.opened_at).toLocaleDateString('th-TH')}
                                    {session.status === 'active' ? ' (เปิดอยู่)' : ' (ปิดแล้ว)'}
                                </option>
                            ))}
                        </select>
                        {selectedSession && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-blue-300">
                                <span className={`w-2 h-2 rounded-full ${selectedSession.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                <span className="text-sm font-medium text-gray-700">
                                    {selectedSession.eoc_type}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {!selectedSession ? (
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-8 text-center">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">กรุณาเลือก EOC Session</h3>
                        <p className="text-gray-600">
                            เลือก EOC Session ที่ต้องการดูรายงานผู้ได้รับผลกระทบ
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-600">
                                <div className="text-sm text-gray-600 mb-1">ผู้เสียชีวิต</div>
                                <div className="text-2xl font-bold text-red-600">
                                    {summary.province.province_deaths || 0} คน
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
                                <div className="text-sm text-gray-600 mb-1">ผู้สูญหาย</div>
                                <div className="text-2xl font-bold text-yellow-600">
                                    {summary.province.province_missing || 0} คน
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
                                <div className="text-sm text-gray-600 mb-1">ผู้ได้รับบาดเจ็บ</div>
                                <div className="text-2xl font-bold text-orange-600">
                                    {summary.province.province_injured || 0} คน
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                                <div className="text-sm text-gray-600 mb-1">ผู้ได้รับผลกระทบ</div>
                                <div className="text-2xl font-bold text-blue-600">
                                    {summary.province.province_affected || 0} คน
                                </div>
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="bg-white rounded-lg shadow p-6 mb-6">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">📊 สถานการณ์แยกตามอำเภอ</h3>
                            {summary.today.length > 0 ? (
                                <Bar
                                    data={getDistrictChartData()}
                                    options={{
                                        responsive: true,
                                        plugins: {
                                            legend: { position: 'top' },
                                            title: {
                                                display: true,
                                                text: `ข้อมูล ณ วันที่ ${new Date(filterDate).toLocaleDateString('th-TH')}`
                                            }
                                        },
                                        scales: {
                                            x: {
                                                grid: {
                                                    display: false
                                                },
                                                ticks: {
                                                    font: {
                                                        family: 'Kanit'
                                                    }
                                                }
                                            },
                                            y: {
                                                beginAtZero: true,
                                                ticks: {
                                                    font: {
                                                        family: 'Kanit'
                                                    },
                                                    callback: function (value) {
                                                        return value + ' คน';
                                                    }
                                                },
                                                grid: {
                                                    color: 'rgba(0, 0, 0, 0.05)'
                                                }
                                            }
                                        }
                                    }}
                                />
                            ) : (
                                <div className="text-center py-8 text-gray-500">ยังไม่มีข้อมูลวันนี้</div>
                            )}
                        </div>

                        {/* Summary Table */}
                        <div className="bg-white rounded-lg shadow p-6 mb-6">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">📋 ตารางสรุปรายอำเภอ</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse border border-gray-300 text-sm">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-green-600 to-green-800 text-white">
                                            <th className="border border-gray-300 px-3 py-2" rowSpan="2">อำเภอ</th>
                                            <th className="border border-gray-300 px-3 py-2" colSpan="4">วันนี้</th>
                                            <th className="border border-gray-300 px-3 py-2" colSpan="4">สะสม</th>
                                        </tr>
                                        <tr className="bg-green-500 text-white text-xs">
                                            <th className="border border-gray-300 px-2 py-1">เสียชีวิต</th>
                                            <th className="border border-gray-300 px-2 py-1">สูญหาย</th>
                                            <th className="border border-gray-300 px-2 py-1">บาดเจ็บ</th>
                                            <th className="border border-gray-300 px-2 py-1">ได้รับผลกระทบ</th>
                                            <th className="border border-gray-300 px-2 py-1">เสียชีวิต</th>
                                            <th className="border border-gray-300 px-2 py-1">สูญหาย</th>
                                            <th className="border border-gray-300 px-2 py-1">บาดเจ็บ</th>
                                            <th className="border border-gray-300 px-2 py-1">ได้รับผลกระทบ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {districts.map((district, idx) => {
                                            const todayData = summary.today.find(s => s.district_name === district) || {};
                                            const cumulativeData = summary.cumulative.find(s => s.district_name === district) || {};
                                            return (
                                                <tr key={district} className={idx % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                                                    <td className="border border-gray-300 px-3 py-2 font-medium text-gray-800">
                                                        {district}
                                                    </td>
                                                    <td className="border border-gray-300 px-2 py-1 text-center text-red-700 font-semibold">
                                                        {todayData.today_deaths || 0}
                                                    </td>
                                                    <td className="border border-gray-300 px-2 py-1 text-center text-yellow-700 font-semibold">
                                                        {todayData.today_missing || 0}
                                                    </td>
                                                    <td className="border border-gray-300 px-2 py-1 text-center text-orange-700 font-semibold">
                                                        {todayData.today_injured || 0}
                                                    </td>
                                                    <td className="border border-gray-300 px-2 py-1 text-center text-blue-700 font-semibold">
                                                        {todayData.today_affected || 0}
                                                    </td>
                                                    <td className="border border-gray-300 px-2 py-1 text-center text-gray-600">
                                                        {cumulativeData.cumulative_deaths || 0}
                                                    </td>
                                                    <td className="border border-gray-300 px-2 py-1 text-center text-gray-600">
                                                        {cumulativeData.cumulative_missing || 0}
                                                    </td>
                                                    <td className="border border-gray-300 px-2 py-1 text-center text-gray-600">
                                                        {cumulativeData.cumulative_injured || 0}
                                                    </td>
                                                    <td className="border border-gray-300 px-2 py-1 text-center text-gray-600">
                                                        {cumulativeData.cumulative_affected || 0}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {/* Total Row */}
                                        <tr className="bg-blue-900 text-white font-bold">
                                            <td className="border border-gray-300 px-3 py-2">รวม</td>
                                            <td className="border border-gray-300 px-2 py-2 text-center">
                                                {summary.today.reduce((sum, s) => sum + (s.today_deaths || 0), 0)}
                                            </td>
                                            <td className="border border-gray-300 px-2 py-2 text-center">
                                                {summary.today.reduce((sum, s) => sum + (s.today_missing || 0), 0)}
                                            </td>
                                            <td className="border border-gray-300 px-2 py-2 text-center">
                                                {summary.today.reduce((sum, s) => sum + (s.today_injured || 0), 0)}
                                            </td>
                                            <td className="border border-gray-300 px-2 py-2 text-center">
                                                {summary.today.reduce((sum, s) => sum + (s.today_affected || 0), 0)}
                                            </td>
                                            <td className="border border-gray-300 px-2 py-2 text-center">
                                                {summary.cumulative.reduce((sum, s) => sum + (s.cumulative_deaths || 0), 0)}
                                            </td>
                                            <td className="border border-gray-300 px-2 py-2 text-center">
                                                {summary.cumulative.reduce((sum, s) => sum + (s.cumulative_missing || 0), 0)}
                                            </td>
                                            <td className="border border-gray-300 px-2 py-2 text-center">
                                                {summary.cumulative.reduce((sum, s) => sum + (s.cumulative_injured || 0), 0)}
                                            </td>
                                            <td className="border border-gray-300 px-2 py-2 text-center">
                                                {summary.cumulative.reduce((sum, s) => sum + (s.cumulative_affected || 0), 0)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="bg-white rounded-lg shadow p-4 mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        วันที่
                                    </label>
                                    <input
                                        type="date"
                                        value={filterDate}
                                        onChange={(e) => setFilterDate(e.target.value)}
                                        className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        อำเภอ
                                    </label>
                                    <select
                                        value={filterDistrict}
                                        onChange={(e) => setFilterDistrict(e.target.value)}
                                        className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                    >
                                        <option value="">ทั้งหมด</option>
                                        {districts.map(district => (
                                            <option key={district} value={district}>{district}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <button
                                        onClick={() => {
                                            setFilterDate(new Date().toISOString().split('T')[0]);
                                            setFilterDistrict('');
                                        }}
                                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                                    >
                                        ล้างตัวกรอง
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Reports Table */}
                        <div className="bg-white rounded-lg shadow">
                            {loading ? (
                                <div className="flex justify-center items-center py-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
                                </div>
                            ) : filteredReports.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    ยังไม่มีรายงานในวันนี้
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">อำเภอ</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ตำบล</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">เสียชีวิต</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">สูญหาย</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">บาดเจ็บ</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">ได้รับผลกระทบ</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">หมายเหตุ</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">การดำเนินการ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {filteredReports.map((report) => (
                                                <tr key={report.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 text-sm text-gray-900">
                                                        {new Date(report.report_date).toLocaleDateString('th-TH')}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-900">{report.district_name}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{report.tambon || '-'}</td>
                                                    <td className="px-6 py-4 text-sm text-center">
                                                        <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-bold">
                                                            {report.deaths}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-center">
                                                        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full font-bold">
                                                            {report.missing}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-center">
                                                        <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full font-bold">
                                                            {report.injured}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-center">
                                                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-bold">
                                                            {report.affected}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                        {report.notes || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium">
                                                        <button
                                                            onClick={() => handleEdit(report)}
                                                            className="text-blue-600 hover:text-blue-900 mr-3"
                                                        >
                                                            ✏️ แก้ไข
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(report)}
                                                            className="text-red-600 hover:text-red-900"
                                                        >
                                                            🗑️ ลบ
                                                        </button>
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
                            <div className="fixed inset-0 backdrop-blur-md bg-white/30 flex items-center justify-center z-50 p-4">
                                <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                                    <div className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <h2 className="text-2xl font-bold text-gray-800">
                                                {editingReport ? 'แก้ไขรายงาน' : 'เพิ่มรายงาน'}
                                            </h2>
                                            <button
                                                onClick={() => {
                                                    setShowModal(false);
                                                    resetForm();
                                                }}
                                                className="text-gray-400 hover:text-gray-600"
                                            >
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>

                                        <form onSubmit={handleSubmit} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        วันที่รายงาน *
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={formData.report_date}
                                                        onChange={(e) => setFormData({ ...formData, report_date: e.target.value })}
                                                        className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                                        required
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        อำเภอ *
                                                    </label>
                                                    <select
                                                        value={formData.district_name}
                                                        onChange={(e) => setFormData({ ...formData, district_name: e.target.value })}
                                                        className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                                        required
                                                    >
                                                        <option value="">เลือกอำเภอ</option>
                                                        {districts.map(district => (
                                                            <option key={district} value={district}>{district}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    ตำบล
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.tambon}
                                                    onChange={(e) => setFormData({ ...formData, tambon: e.target.value })}
                                                    className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                                    placeholder="ระบุตำบล (ถ้ามี)"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        ผู้เสียชีวิต (คน)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={formData.deaths}
                                                        onChange={(e) => setFormData({ ...formData, deaths: e.target.value })}
                                                        className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        ผู้สูญหาย (คน)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={formData.missing}
                                                        onChange={(e) => setFormData({ ...formData, missing: e.target.value })}
                                                        className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        ผู้บาดเจ็บ (คน)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={formData.injured}
                                                        onChange={(e) => setFormData({ ...formData, injured: e.target.value })}
                                                        className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        ผู้ได้รับผลกระทบ (คน)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={formData.affected}
                                                        onChange={(e) => setFormData({ ...formData, affected: e.target.value })}
                                                        className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    หมายเหตุ
                                                </label>
                                                <textarea
                                                    value={formData.notes}
                                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                                    rows={3}
                                                    className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                                    placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
                                                />
                                            </div>

                                            <div className="flex justify-end gap-3 mt-6">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowModal(false);
                                                        resetForm();
                                                    }}
                                                    className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                                                >
                                                    ยกเลิก
                                                </button>
                                                <button
                                                    type="submit"
                                                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                                >
                                                    {editingReport ? 'บันทึกการแก้ไข' : 'บันทึก'}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </EOCLayout>
    );
}
