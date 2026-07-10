"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { showWarning, showSuccess, showError, showConfirm } from '@/lib/sweetAlert';
import EOCLayout from '@/components/layouts/EOCLayout';
import PaginationControls, { paginateRows } from '@/components/common/PaginationControls';
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
import { Bar } from 'react-chartjs-2';

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
    const [viewMode, setViewMode] = useState('range');
    const [filterDate, setFilterDate] = useState('2025-11-30');
    const [filterStartDate, setFilterStartDate] = useState('2025-11-20');
    const [filterEndDate, setFilterEndDate] = useState('2025-11-30');
    const [filterDistrict, setFilterDistrict] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const impactGroups = [
        {
            title: 'ประชาชน',
            fields: [
                ['citizen_property', 'ทรัพย์สิน'],
                ['citizen_injured', 'บาดเจ็บ'],
                ['citizen_deaths', 'เสียชีวิต'],
                ['citizen_missing', 'สูญหาย'],
            ],
        },
        {
            title: 'อสม.',
            fields: [
                ['volunteer_property', 'ทรัพย์สิน'],
                ['volunteer_injured', 'บาดเจ็บ'],
                ['volunteer_deaths', 'เสียชีวิต'],
                ['volunteer_missing', 'สูญหาย'],
            ],
        },
        {
            title: 'บุคลากร',
            fields: [
                ['staff_property', 'ทรัพย์สิน'],
                ['staff_injured', 'บาดเจ็บ'],
                ['staff_deaths', 'เสียชีวิต'],
                ['staff_missing', 'สูญหาย'],
            ],
        },
    ];
    const assistanceFields = [
        ['medicine_support', 'จ่ายยา/เวชภัณฑ์'],
        ['evacuated', 'อพยพ'],
        ['not_evacuated', 'ไม่อพยพ'],
    ];
    const impactFieldKeys = [
        ...impactGroups.flatMap(group => group.fields.map(([key]) => key)),
        ...assistanceFields.map(([key]) => key),
    ];

    const [formData, setFormData] = useState({
        report_date: filterEndDate,
        district_name: '',
        tambon: '',
        deaths: 0,
        missing: 0,
        injured: 0,
        affected: 0,
        ...Object.fromEntries(impactFieldKeys.map(key => [key, 0])),
        notes: ''
    });

    // รายการอำเภอในจังหวัดสตูล
    const districts = ['ควนโดน', 'เมืองสตูล', 'ท่าแพ', 'มะนัง', 'ควนกาหลง', 'ละงู', 'ทุ่งหว้า'];
    const toNumber = (value) => Number(value) || 0;
    const formatNumber = (value) => toNumber(value).toLocaleString('th-TH');
    const reportRangeLabel = useMemo(() => {
        if (viewMode === 'daily') {
            return new Date(filterDate).toLocaleDateString('th-TH');
        }
        if (filterStartDate && filterEndDate) {
            return `${new Date(filterStartDate).toLocaleDateString('th-TH')} - ${new Date(filterEndDate).toLocaleDateString('th-TH')}`;
        }
        return 'ทุกช่วงวันที่';
    }, [filterDate, filterEndDate, filterStartDate, viewMode]);

    const fetchSessions = useCallback(async () => {
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
    }, []);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    const fetchReports = useCallback(async () => {
        if (!selectedSession) return;

        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('session_id', selectedSession.id);
            if (viewMode === 'daily' && filterDate) {
                params.append('date', filterDate);
            } else if (filterStartDate && filterEndDate) {
                params.append('start_date', filterStartDate);
                params.append('end_date', filterEndDate);
            }

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
    }, [filterDate, filterEndDate, filterStartDate, selectedSession, viewMode]);

    useEffect(() => {
        if (selectedSession) {
            fetchReports();
        }
    }, [fetchReports, selectedSession]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedSession) {
            showWarning('กรุณาเลือก EOC Session');
            return;
        }

        const submitData = {
            ...formData,
            session_id: selectedSession.id,
            ...Object.fromEntries(impactFieldKeys.map(key => [key, parseInt(formData[key]) || 0])),
        };
        submitData.deaths = submitData.citizen_deaths + submitData.volunteer_deaths + submitData.staff_deaths;
        submitData.missing = submitData.citizen_missing + submitData.volunteer_missing + submitData.staff_missing;
        submitData.injured = submitData.citizen_injured + submitData.volunteer_injured + submitData.staff_injured;
        submitData.affected = submitData.citizen_property + submitData.volunteer_property + submitData.staff_property;

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
            ...Object.fromEntries(impactFieldKeys.map(key => [key, report[key] || 0])),
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
            report_date: filterEndDate,
            district_name: '',
            tambon: '',
            deaths: 0,
            missing: 0,
            injured: 0,
            affected: 0,
            ...Object.fromEntries(impactFieldKeys.map(key => [key, 0])),
            notes: ''
        });
        setEditingReport(null);
    };

    const filteredReports = filterDistrict
        ? reports.filter(r => r.district_name === filterDistrict)
        : reports;
    const paginatedReports = useMemo(
        () => paginateRows(filteredReports, currentPage, pageSize),
        [filteredReports, currentPage, pageSize]
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [filterDate, filterDistrict, filterEndDate, filterStartDate, selectedSession, viewMode]);

    const summaryPrefix = viewMode === 'daily' ? 'today' : 'cumulative';
    const summaryRows = viewMode === 'daily' ? summary.today : summary.cumulative;
    const summaryTitle = viewMode === 'daily'
        ? `ประจำวันที่ ${reportRangeLabel}`
        : `สะสมช่วงวันที่ ${reportRangeLabel}`;

    // เตรียมข้อมูลกราฟรายอำเภอ
    const getDistrictChartData = () => {
        return {
            labels: districts,
            datasets: [
                {
                    label: 'ผู้เสียชีวิต',
                    data: districts.map(district => {
                        const record = summaryRows.find(s => s.district_name === district);
                        return record ? record[`${summaryPrefix}_deaths`] : 0;
                    }),
                    backgroundColor: 'rgb(220, 38, 38)',
                },
                {
                    label: 'ผู้สูญหาย',
                    data: districts.map(district => {
                        const record = summaryRows.find(s => s.district_name === district);
                        return record ? record[`${summaryPrefix}_missing`] : 0;
                    }),
                    backgroundColor: 'rgb(234, 179, 8)',
                },
                {
                    label: 'ผู้ได้รับบาดเจ็บ',
                    data: districts.map(district => {
                        const record = summaryRows.find(s => s.district_name === district);
                        return record ? record[`${summaryPrefix}_injured`] : 0;
                    }),
                    backgroundColor: 'rgb(249, 115, 22)',
                },
                {
                    label: 'ผู้ได้รับผลกระทบ',
                    data: districts.map(district => {
                        const record = summaryRows.find(s => s.district_name === district);
                        return record ? record[`${summaryPrefix}_affected`] : 0;
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
                            ข้อมูลผู้ได้รับผลกระทบย้อนหลัง
                        </h1>
                        <p className="text-gray-600">บันทึกและติดตามข้อมูลย้อนหลังตามช่วงวันที่รายงาน</p>
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
                <div className="bg-gradient-to-r from-blue-50 to-sky-50 rounded-lg shadow-md p-4 mb-6 border border-blue-200">
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
                            <div className="bg-white rounded-lg shadow p-4 border border-red-600">
                                <div className="text-sm text-gray-600 mb-1">ผู้เสียชีวิต</div>
                                <div className="text-2xl font-bold text-red-600">
                                    {formatNumber(summary.province.province_deaths)} คน
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-4 border border-yellow-500">
                                <div className="text-sm text-gray-600 mb-1">ผู้สูญหาย</div>
                                <div className="text-2xl font-bold text-yellow-600">
                                    {formatNumber(summary.province.province_missing)} คน
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-4 border border-orange-500">
                                <div className="text-sm text-gray-600 mb-1">ผู้ได้รับบาดเจ็บ</div>
                                <div className="text-2xl font-bold text-orange-600">
                                    {formatNumber(summary.province.province_injured)} คน
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-4 border border-blue-500">
                                <div className="text-sm text-gray-600 mb-1">ผู้ได้รับผลกระทบ</div>
                                <div className="text-2xl font-bold text-blue-600">
                                    {formatNumber(summary.province.province_affected)} คน
                                </div>
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="bg-white rounded-lg shadow p-6 mb-6">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">📊 สถานการณ์แยกตามอำเภอ</h3>
                            {summaryRows.length > 0 ? (
                                <Bar
                                    data={getDistrictChartData()}
                                    options={{
                                        responsive: true,
                                        plugins: {
                                            legend: { position: 'top' },
                                            title: {
                                                display: true,
                                                text: `ข้อมูล${summaryTitle}`
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
                                <div className="text-center py-8 text-gray-500">ยังไม่มีข้อมูลในช่วงวันที่ที่เลือก</div>
                            )}
                        </div>

                        {/* Summary Tables */}
                        <div className="space-y-6 mb-6">
                            {[
                                { title: summaryTitle, rows: summaryRows, prefix: summaryPrefix },
                            ].map(section => (
                                <div key={section.prefix} className="bg-white rounded-lg shadow p-6">
                                    <h3 className="text-xl font-bold text-gray-800 mb-4">📋 ตารางสรุปรายอำเภอ - {section.title}</h3>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full border-collapse border border-gray-300 text-sm">
                                            <thead>
                                                <tr className="bg-gradient-to-r from-green-700 to-green-900 text-white">
                                                    <th className="border border-gray-300 px-3 py-2" rowSpan="2">อำเภอ</th>
                                                    {impactGroups.map(group => (
                                                        <th key={group.title} className="border border-gray-300 px-3 py-2" colSpan="4">{group.title}</th>
                                                    ))}
                                                    <th className="border border-gray-300 px-3 py-2" colSpan="3">การช่วยเหลือ</th>
                                                </tr>
                                                <tr className="bg-green-500 text-white text-xs">
                                                    {impactGroups.map(group => group.fields.map(([, label]) => (
                                                        <th key={`${group.title}-${label}`} className="border border-gray-300 px-2 py-1 whitespace-nowrap">{label}</th>
                                                    )))}
                                                    {assistanceFields.map(([, label]) => (
                                                        <th key={label} className="border border-gray-300 px-2 py-1 whitespace-nowrap">{label}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {districts.map((district, idx) => {
                                                    const row = section.rows.find(s => s.district_name === district) || {};
                                                    return (
                                                        <tr key={`${section.prefix}-${district}`} className={idx % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                                                            <td className="border border-gray-300 px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                                                                {district}
                                                            </td>
                                                            {impactGroups.map(group => group.fields.map(([key]) => (
                                                                <td key={`${district}-${section.prefix}-${key}`} className="border border-gray-300 px-2 py-1 text-center text-gray-700">
                                                                    {formatNumber(row[`${section.prefix}_${key}`])}
                                                                </td>
                                                            )))}
                                                            {assistanceFields.map(([key]) => (
                                                                <td key={`${district}-${section.prefix}-${key}`} className="border border-gray-300 px-2 py-1 text-center text-gray-700">
                                                                    {formatNumber(row[`${section.prefix}_${key}`])}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    );
                                                })}
                                                <tr className="bg-blue-900 text-white font-bold">
                                                    <td className="border border-gray-300 px-3 py-2">รวม</td>
                                                    {impactGroups.map(group => group.fields.map(([key]) => (
                                                        <td key={`${section.prefix}-total-${key}`} className="border border-gray-300 px-2 py-2 text-center">
                                                            {formatNumber(section.rows.reduce((sum, row) => sum + toNumber(row[`${section.prefix}_${key}`]), 0))}
                                                        </td>
                                                    )))}
                                                    {assistanceFields.map(([key]) => (
                                                        <td key={`${section.prefix}-total-${key}`} className="border border-gray-300 px-2 py-2 text-center">
                                                            {formatNumber(section.rows.reduce((sum, row) => sum + toNumber(row[`${section.prefix}_${key}`]), 0))}
                                                        </td>
                                                    ))}
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Filters */}
                        <div className="bg-white rounded-lg shadow p-4 mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        รูปแบบ
                                    </label>
                                    <div className="inline-flex w-full rounded-lg border border-gray-300 overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => setViewMode('range')}
                                            className={`flex-1 px-3 py-2 text-sm font-medium ${viewMode === 'range' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                        >
                                            ช่วง
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setViewMode('daily')}
                                            className={`flex-1 px-3 py-2 text-sm font-medium border-l border-gray-300 ${viewMode === 'daily' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                        >
                                            รายวัน
                                        </button>
                                    </div>
                                </div>
                                {viewMode === 'daily' ? (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            วันที่รายงาน
                                        </label>
                                        <input
                                            type="date"
                                            value={filterDate}
                                            onChange={(e) => setFilterDate(e.target.value)}
                                            className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                ) : (
                                    <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        ตั้งแต่วันที่
                                    </label>
                                    <input
                                        type="date"
                                        value={filterStartDate}
                                        onChange={(e) => setFilterStartDate(e.target.value)}
                                        className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        ถึงวันที่
                                    </label>
                                    <input
                                        type="date"
                                        value={filterEndDate}
                                        onChange={(e) => setFilterEndDate(e.target.value)}
                                        className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                    />
                                </div>
                                    </>
                                )}
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
                                            setViewMode('range');
                                            setFilterDate('2025-11-30');
                                            setFilterStartDate('2025-11-20');
                                            setFilterEndDate('2025-11-30');
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
                                    <div className="animate-spin rounded-full h-12 w-12 border-b border-green-500"></div>
                                </div>
                            ) : filteredReports.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    ยังไม่มีรายงานในช่วงวันที่ที่เลือก
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
                                                {impactGroups.map(group => group.fields.map(([key, label]) => (
                                                    <th key={key} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                                        {group.title}: {label}
                                                    </th>
                                                )))}
                                                {assistanceFields.map(([key, label]) => (
                                                    <th key={key} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                                        {label}
                                                    </th>
                                                ))}
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">หมายเหตุ</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">การดำเนินการ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {paginatedReports.map((report) => (
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
                                                    {impactGroups.map(group => group.fields.map(([key]) => (
                                                        <td key={key} className="px-4 py-4 text-sm text-center text-gray-700">
                                                            {report[key] || 0}
                                                        </td>
                                                    )))}
                                                    {assistanceFields.map(([key]) => (
                                                        <td key={key} className="px-4 py-4 text-sm text-center text-gray-700">
                                                            {report[key] || 0}
                                                        </td>
                                                    ))}
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
                            <PaginationControls
                                page={currentPage}
                                pageSize={pageSize}
                                totalItems={filteredReports.length}
                                onPageChange={setCurrentPage}
                                onPageSizeChange={setPageSize}
                            />
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

                                            {impactGroups.map(group => (
                                                <div key={group.title} className="border border-gray-200 rounded-lg p-4">
                                                    <h3 className="font-bold text-gray-800 mb-3">{group.title}</h3>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                        {group.fields.map(([key, label]) => (
                                                            <div key={key}>
                                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                                    {label}
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={formData[key]}
                                                                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                                                                    className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}

                                            <div className="border border-gray-200 rounded-lg p-4">
                                                <h3 className="font-bold text-gray-800 mb-3">การช่วยเหลือ</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    {assistanceFields.map(([key, label]) => (
                                                        <div key={key}>
                                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                                {label}
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={formData[key]}
                                                                onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                                                                className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                                            />
                                                        </div>
                                                    ))}
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
