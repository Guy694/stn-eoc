"use client";
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { showWarning, showSuccess, showError, showConfirm } from '@/lib/sweetAlert';
import EOCLayout from '@/components/layouts/EOCLayout';
import DailyDiseaseChart from '@/components/DailyDiseaseChart';
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

export default function DiseaseReportsPage() {
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState([]);
    const [facilities, setFacilities] = useState([]);
    const [diseaseList, setDiseaseList] = useState([]); // รายการโรคจาก database
    const [sessions, setSessions] = useState([]); // EOC sessions ทั้งหมด
    const [selectedSession, setSelectedSession] = useState(null); // session ที่เลือก
    const [summary, setSummary] = useState({
        today: [],
        cumulative: [],
        byDisease: []
    });
    const [showModal, setShowModal] = useState(false);
    const [editingReport, setEditingReport] = useState(null);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterDistrict, setFilterDistrict] = useState('');
    const [showOtherInput, setShowOtherInput] = useState(false); // แสดง input โรคอื่นๆ
    const [customDisease, setCustomDisease] = useState(''); // ชื่อโรคที่กรอกเอง

    const [formData, setFormData] = useState({
        report_date: new Date().toISOString().split('T')[0],
        health_facility_id: '',
        disease_name: '',
        patient_count: 0,
        notes: ''
    });

    // รวมรายการโรคจาก database + อื่นๆ
    const allDiseases = (() => {
        const diseases = diseaseList.map(d => d.name || d);
        // ลบ "อื่นๆ" ออกก่อน แล้วเพิ่มไว้ท้ายสุด
        const filtered = diseases.filter(d => d !== 'อื่นๆ');
        console.log('allDiseases computed:', [...filtered, 'อื่นๆ']);
        return [...filtered, 'อื่นๆ'];
    })();

    // ดึงรายการโรคจาก database
    useEffect(() => {
        const fetchDiseases = async () => {
            try {
                const response = await fetch('/api/common/diseases');
                const result = await response.json();
                console.log('Diseases API result:', result);
                if (result.success) {
                    setDiseaseList(result.data || []);
                }
            } catch (error) {
                console.error('Fetch diseases error:', error);
                // ใช้รายการ default ถ้าดึงไม่ได้
                setDiseaseList([
                    { name: 'ไข้เลือดออก' },
                    { name: 'โควิด-19' },
                    { name: 'มือเท้าปาก' },
                    { name: 'ไข้หวัดใหญ่' },
                    { name: 'อุจจาระร่วง' },
                    { name: 'โรคผิวหนัง' }
                ]);
            }
        };
        fetchDiseases();
    }, []);

    useEffect(() => {
        fetchSessions();
        fetchFacilities();
    }, []);

    useEffect(() => {
        if (selectedSession) {
            fetchReports();
        }
    }, [selectedSession, filterDate]);

    const fetchSessions = async () => {
        try {
            const response = await fetch('/api/eoc/sessions?limit=100');
            const result = await response.json();
            if (result.success) {
                const sessionsList = Array.isArray(result.data) ? result.data : [];
                setSessions(sessionsList);
                // เลือก active session แรก หรือ session ล่าสุด
                const activeSession = sessionsList.find(s => s.status === 'active') || sessionsList[0];
                if (activeSession) {
                    setSelectedSession(activeSession);
                }
            }
        } catch (error) {
            console.error('Fetch sessions error:', error);
        }
    };

    const fetchFacilities = async () => {
        try {
            const response = await fetch('/api/admin/health-facilities');
            const result = await response.json();
            if (result.success) {
                setFacilities(Array.isArray(result.data) ? result.data : []);
            }
        } catch (error) {
            console.error('Fetch facilities error:', error);
        }
    };

    const fetchReports = async () => {
        if (!selectedSession) return;

        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('session_id', selectedSession.id);
            if (filterDate) params.append('date', filterDate);

            const response = await fetch(`/api/admin/disease-reports?${params}`);
            const result = await response.json();

            if (result.success) {
                setReports(Array.isArray(result.data) ? result.data : []);
                setSummary(result.summary || { today: [], cumulative: [], byDisease: [] });
                // หมายเหตุ: ไม่ต้อง setDiseaseList ที่นี่ เพราะดึงจาก /api/common/diseases แล้ว
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

        console.log('Selected session:', selectedSession);
        console.log('Session ID:', selectedSession.id);

        // ถ้าเลือก "อื่นๆ" ให้ใช้ชื่อโรคที่กรอกเอง และเพิ่มเข้า database
        let diseaseName = formData.disease_name;
        if (showOtherInput && customDisease.trim()) {
            diseaseName = customDisease.trim();
            // เพิ่มโรคใหม่เข้า database (ถ้ายังไม่มี)
            try {
                const addDiseaseRes = await fetch('/api/common/diseases', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: diseaseName })
                });
                const addResult = await addDiseaseRes.json();
                if (addResult.success) {
                    console.log('Added new disease:', diseaseName);
                    fetchDiseases(); // รีเฟรชรายการโรค
                } else if (addResult.existing_name) {
                    console.log('Disease already exists:', addResult.existing_name);
                    diseaseName = addResult.existing_name; // ใช้ชื่อที่มีอยู่แล้ว
                }
            } catch (err) {
                console.log('Could not add disease to database:', err);
            }
        }

        const submitData = {
            ...formData,
            session_id: selectedSession.id,
            disease_name: diseaseName,
            patient_count: parseInt(formData.patient_count) || 0
        };

        // ตรวจสอบข้อมูล
        if (!submitData.report_date || !submitData.health_facility_id ||
            !submitData.disease_name || submitData.disease_name === 'อื่นๆ') {
            showWarning('กรุณากรอกข้อมูลให้ครบถ้วน');
            return;
        }


        if (!submitData.session_id) {
            showError('ไม่พบ Session ID กรุณาเลือก EOC Session ใหม่');
            return;
        }

        console.log('Submitting data:', submitData);

        try {
            const url = editingReport
                ? `/api/admin/disease-reports?id=${editingReport.id}`
                : '/api/admin/disease-reports';

            const response = await fetch(url, {
                method: editingReport ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submitData)
            });

            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);

            let result;
            try {
                const text = await response.text();
                console.log('Response text:', text);
                result = JSON.parse(text);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                showError('เกิดข้อผิดพลาดในการติดต่อเซิร์ฟเวอร์');
                return;
            }

            console.log('Parsed result:', result);

            if (result.success) {
                showSuccess(editingReport ? 'แก้ไขข้อมูลสำเร็จ' : 'บันทึกข้อมูลสำเร็จ');
                setShowModal(false);
                resetForm();
                fetchReports();
            } else {
                const errorMsg = result.message || result.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
                showError(errorMsg);
                console.error('Error details:', result);
            }
        } catch (error) {
            console.error('Submit error:', error);
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            showError('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + (error.message || 'Unknown error'));
        }
    };

    const handleEdit = (report) => {
        setEditingReport(report);
        const isOther = !commonDiseases.includes(report.disease_name) && report.disease_name !== 'อื่นๆ';

        setFormData({
            report_date: report.report_date,
            health_facility_id: report.health_facility_id,
            disease_name: isOther ? 'อื่นๆ' : report.disease_name,
            patient_count: report.patient_count,
            notes: report.notes || ''
        });

        if (isOther) {
            setShowOtherInput(true);
            setCustomDisease(report.disease_name);
        } else {
            setShowOtherInput(false);
            setCustomDisease('');
        }

        setShowModal(true);
    };

    const handleDelete = async (report) => {
        const result = await showConfirm(
            'ยืนยันการลบ',
            `คุณต้องการลบรายงาน "${report.disease_name}" ของ ${report.facility_name} ใช่หรือไม่?`,
            'warning'
        );

        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/admin/disease-reports?id=${report.id}`, {
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
            health_facility_id: '',
            disease_name: '',
            patient_count: 0,
            notes: ''
        });
        setEditingReport(null);
        setShowOtherInput(false);
        setCustomDisease('');
    };

    const handleDiseaseChange = (value) => {
        setFormData({ ...formData, disease_name: value });
        if (value === 'อื่นๆ') {
            setShowOtherInput(true);
        } else {
            setShowOtherInput(false);
            setCustomDisease('');
        }
    };

    // เตรียมข้อมูลกราฟตามอำเภอ
    const getDistrictChartData = () => {
        const districts = [...new Set(summary.today.map(s => s.district_name))];
        const diseases = [...new Set(summary.today.map(s => s.disease_name))];

        const datasets = diseases.map((disease, index) => {
            const colors = [
                'rgba(255, 99, 132, 0.8)',
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 206, 86, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(153, 102, 255, 0.8)',
                'rgba(255, 159, 64, 0.8)'
            ];

            return {
                label: disease,
                data: districts.map(district => {
                    const record = summary.today.find(
                        s => s.district_name === district && s.disease_name === disease
                    );
                    return record ? record.today_patients : 0;
                }),
                backgroundColor: colors[index % colors.length]
            };
        });

        return {
            labels: districts,
            datasets
        };
    };

    // เตรียมข้อมูลกราฟรายโรค
    const getDiseaseChartData = () => {
        const colors = [
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(153, 102, 255, 0.8)',
            'rgba(255, 159, 64, 0.8)'
        ];

        return {
            labels: summary.byDisease.map(d => d.disease_name),
            datasets: [{
                data: summary.byDisease.map(d => d.cumulative_total),
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        };
    };

    const filteredReports = filterDistrict
        ? reports.filter(r => r.district_name === filterDistrict)
        : reports;

    const districts = [...new Set(facilities.map(f => f.district_name))].sort();

    // สร้างตารางสรุปรายโรคแบบ 7 อำเภอ
    const getDistrictSummaryTable = () => {
        const mainDistricts = ['เมืองสตูล', 'ควนโดน', 'ควนกาหลง', 'ท่าแพ', 'ละงู', 'มะนัง', 'ทุ่งหว้า'];

        // สร้าง object สำหรับเก็บข้อมูลแต่ละโรค แต่ละอำเภอ
        const diseaseData = {};

        // รวมข้อมูลจาก summary
        summary.today.forEach(item => {
            if (!diseaseData[item.disease_name]) {
                diseaseData[item.disease_name] = {
                    today: {},
                    cumulative: {}
                };
            }
            diseaseData[item.disease_name].today[item.district_name] = parseInt(item.today_patients || 0);
        });

        summary.cumulative.forEach(item => {
            if (!diseaseData[item.disease_name]) {
                diseaseData[item.disease_name] = {
                    today: {},
                    cumulative: {}
                };
            }
            diseaseData[item.disease_name].cumulative[item.district_name] = parseInt(item.cumulative_patients || 0);
        });

        // คำนวณยอดรวม
        const calculateTotal = (data, type) => {
            return mainDistricts.reduce((sum, district) => {
                return sum + (data[district]?.[type] || 0);
            }, 0);
        };

        return { diseaseData, mainDistricts };
    };

    const { diseaseData, mainDistricts } = useMemo(() => getDistrictSummaryTable(), [summary]);

    return (
        <EOCLayout>

            <div className="container mx-auto px-4">
                {/* Header */}
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                            <span className="text-4xl">🦠</span>
                            สถานการณ์โรครายวัน
                        </h1>
                        <p className="text-gray-600">บันทึกและติดตามสถานการณ์โรคจากหน่วยบริการ</p>
                    </div>
                    <button
                        onClick={() => {
                            resetForm();
                            setShowModal(true);
                        }}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                        <span className="text-xl">➕</span>
                        เพิ่มรายงานโรค
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
                            เลือก EOC Session ที่ต้องการดูรายงานโรค
                        </p>
                    </div>
                ) : (
                    <>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                                <div className="text-sm text-gray-600 mb-1">รายงานวันนี้</div>
                                <div className="text-2xl font-bold text-gray-800">
                                    {summary.today.reduce((sum, s) => sum + parseInt(s.today_patients || 0), 0)} คน
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
                                <div className="text-sm text-gray-600 mb-1">สะสมทั้งหมด</div>
                                <div className="text-2xl font-bold text-red-600">
                                    {summary.cumulative.reduce((sum, s) => sum + parseInt(s.cumulative_patients || 0), 0)} คน
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
                                <div className="text-sm text-gray-600 mb-1">โรคที่รายงาน</div>
                                <div className="text-2xl font-bold text-green-600">{summary.byDisease.length} โรค</div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
                                <div className="text-sm text-gray-600 mb-1">หน่วยบริการ</div>
                                <div className="text-2xl font-bold text-purple-600">{facilities.length} แห่ง</div>
                            </div>
                        </div>

                        {/* Daily Trend Chart */}
                        <div className="mb-6">
                            <DailyDiseaseChart sessionId={selectedSession?.id} />
                        </div>

                        {/* Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* กราฟแท่งตามอำเภอ */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-xl font-bold text-gray-800 mb-4">📊 สถานการณ์แยกตามอำเภอ (วันนี้)</h3>
                                {summary.today.length > 0 ? (
                                    <Bar
                                        data={getDistrictChartData()}
                                        options={{
                                            responsive: true,
                                            plugins: {
                                                legend: { position: 'top' },
                                                title: {
                                                    display: true,
                                                    font: {
                                                        size: 18,
                                                        weight: 'bold',
                                                        family: 'Kanit'
                                                    },
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
                                            },
                                            plugins: {
                                                tooltip: {
                                                    callbacks: {
                                                        title: function (tooltipItem) {
                                                            const date = tooltipItem[0].label;
                                                            return `ข้อมูล ณ`;
                                                        }
                                                    }
                                                },
                                                titleFont: {
                                                    size: 14,
                                                    family: 'Kanit'
                                                },
                                                bodyFont: {
                                                    size: 13,
                                                    family: 'Kanit'
                                                },
                                            }
                                        }}
                                    />
                                ) : (
                                    <div className="text-center py-8 text-gray-500">ยังไม่มีข้อมูลวันนี้</div>
                                )}
                            </div>

                            {/* กราฟวงกลมรายโรค */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-xl font-bold text-gray-800 mb-4">🥧 สัดส่วนผู้ป่วยรายโรค (สะสม)</h3>
                                {summary.byDisease.length > 0 ? (
                                    <Pie
                                        data={getDiseaseChartData()}
                                        options={{
                                            responsive: true,
                                            plugins: {
                                                legend: {
                                                    position: 'right', font: {
                                                        size: 18,
                                                        weight: 'bold',
                                                        family: 'Kanit'
                                                    }
                                                },
                                            }
                                        }}
                                    />
                                ) : (
                                    <div className="text-center py-8 text-gray-500">ยังไม่มีข้อมูล</div>
                                )}
                            </div>
                        </div>

                        {/* ตารางสรุปรายโรคแบบ 7 อำเภอ */}
                        <div className="bg-white rounded-lg shadow p-6 mb-6">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">📋 ตารางสรุปรายโรคตามอำเภอ</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse border border-gray-300 text-sm">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-green-600 to-green-800 text-white">
                                            <th className="border border-gray-300 px-3 py-2" rowSpan="2">โรค</th>
                                            {mainDistricts.map(district => (
                                                <th key={district} className="border border-gray-300 px-3 py-2" colSpan="2">
                                                    {district}
                                                </th>
                                            ))}
                                            <th className="border border-gray-300 px-3 py-2" rowSpan="2">รวม<br />วันนี้</th>
                                            <th className="border border-gray-300 px-3 py-2" rowSpan="2">สะสม</th>
                                        </tr>
                                        <tr className="bg-green-500 text-white">
                                            {mainDistricts.map(district => (
                                                <React.Fragment key={`${district}-sub`}>
                                                    <th className="border border-gray-300 px-2 py-1 text-xs">วันนี้</th>
                                                    <th className="border border-gray-300 px-2 py-1 text-xs">สะสม</th>
                                                </React.Fragment>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.keys(diseaseData).length > 0 ? (
                                            <>
                                                {Object.entries(diseaseData).map(([disease, data], idx) => {
                                                    const rowTodayTotal = mainDistricts.reduce((sum, dist) =>
                                                        sum + (data.today[dist] || 0), 0
                                                    );
                                                    const rowCumulativeTotal = mainDistricts.reduce((sum, dist) =>
                                                        sum + (data.cumulative[dist] || 0), 0
                                                    );

                                                    return (
                                                        <tr key={disease} className={idx % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                                                            <td className=" border border-gray-300 px-3 py-2 font-medium text-gray-800">
                                                                {disease}
                                                            </td>
                                                            {mainDistricts.map(district => {
                                                                const todayValue = data.today[district] || 0;
                                                                const isPositive = todayValue > 0;
                                                                const isNegative = todayValue < 0;
                                                                return (
                                                                    <React.Fragment key={`${disease}-${district}`}>
                                                                        <td className={`border border-gray-300 px-2 py-1 text-center font-semibold ${isPositive ? 'text-red-600 bg-red-50' :
                                                                            isNegative ? 'text-green-600 bg-green-50' :
                                                                                'text-gray-600'
                                                                            }`}>
                                                                            {todayValue !== 0 ? (isPositive ? `+${todayValue}` : todayValue) : 0}
                                                                        </td>
                                                                        <td className="text-gray-600 border border-gray-300 px-2 py-1 text-center">
                                                                            {data.cumulative[district] || 0}
                                                                        </td>
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                            <td className={`border border-gray-300 px-3 py-2 text-center font-bold ${rowTodayTotal > 0 ? 'text-red-600 bg-red-100' :
                                                                rowTodayTotal < 0 ? 'text-green-600 bg-green-100' :
                                                                    'text-gray-800 bg-yellow-100'
                                                                }`}>
                                                                {rowTodayTotal !== 0 ? (rowTodayTotal > 0 ? `+${rowTodayTotal}` : rowTodayTotal) : 0}
                                                            </td>
                                                            <td className="text-gray-800 border border-gray-300 px-3 py-2 text-center font-bold bg-green-100">
                                                                {rowCumulativeTotal}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {/* แถวรวม */}
                                                <tr className="bg-blue-900 text-white font-bold">
                                                    <td className="border border-gray-300 px-3 py-2">รวม</td>
                                                    {mainDistricts.map(district => {
                                                        const districtTodayTotal = Object.values(diseaseData).reduce((sum, data) =>
                                                            sum + (data.today[district] || 0), 0
                                                        );
                                                        const districtCumulativeTotal = Object.values(diseaseData).reduce((sum, data) =>
                                                            sum + (data.cumulative[district] || 0), 0
                                                        );
                                                        return (
                                                            <React.Fragment key={`total-${district}`}>
                                                                <td className="border border-gray-300 px-2 py-2 text-center">
                                                                    {districtTodayTotal}
                                                                </td>
                                                                <td className="border border-gray-300 px-2 py-2 text-center">
                                                                    {districtCumulativeTotal}
                                                                </td>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                    <td className="border border-gray-300 px-3 py-2 text-center">
                                                        {Object.values(diseaseData).reduce((sum, data) =>
                                                            sum + mainDistricts.reduce((s, d) => s + (data.today[d] || 0), 0), 0
                                                        )}
                                                    </td>
                                                    <td className="border border-gray-300 px-3 py-2 text-center">
                                                        {Object.values(diseaseData).reduce((sum, data) =>
                                                            sum + mainDistricts.reduce((s, d) => s + (data.cumulative[d] || 0), 0), 0
                                                        )}
                                                    </td>
                                                </tr>
                                            </>
                                        ) : (
                                            <tr>
                                                <td colSpan={mainDistricts.length * 2 + 3} className="text-center py-8 text-gray-500">
                                                    ยังไม่มีข้อมูล
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-4 text-sm text-gray-600">
                                <p>📝 หมายเหตุ: ข้อมูลจากโรงพยาบาลชุมชนและสถานีอนามัยจะถูกรวมไปยังโรงพยาบาลประจำอำเภอ</p>
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
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">หน่วยบริการ</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">อำเภอ</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">โรค</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">จำนวนผู้ป่วย</th>
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
                                                    <td className="px-6 py-4 text-sm text-gray-900">{report.facility_name}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{report.district_name}</td>
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{report.disease_name}</td>
                                                    <td className="px-6 py-4 text-sm">
                                                        <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-bold">
                                                            {report.patient_count} คน
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
                                                {editingReport ? 'แก้ไขรายงานโรค' : 'เพิ่มรายงานโรค'}
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
                                                    หน่วยบริการ *
                                                </label>
                                                <select
                                                    value={formData.health_facility_id}
                                                    onChange={(e) => setFormData({ ...formData, health_facility_id: e.target.value })}
                                                    className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                                    required
                                                >
                                                    <option value="">เลือกหน่วยบริการ</option>
                                                    {facilities.map(facility => (
                                                        <option key={facility.id} value={facility.id}>
                                                            {facility.name} ({facility.district_name})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    โรค *
                                                </label>
                                                <select
                                                    value={formData.disease_name}
                                                    onChange={(e) => handleDiseaseChange(e.target.value)}
                                                    className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2 mb-2"
                                                    required
                                                >
                                                    <option value="">เลือกโรค</option>
                                                    {allDiseases.map(disease => (
                                                        <option key={disease} value={disease}>{disease}</option>
                                                    ))}
                                                </select>
                                                {showOtherInput && (
                                                    <input
                                                        type="text"
                                                        placeholder="ระบุชื่อโรค"
                                                        value={customDisease}
                                                        onChange={(e) => setCustomDisease(e.target.value)}
                                                        className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                                        required
                                                    />
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    จำนวนผู้ป่วย (คน) * <span className="text-gray-400 text-xs">(ใส่ค่าลบเพื่อลดจำนวน)</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    value={formData.patient_count}
                                                    onChange={(e) => setFormData({ ...formData, patient_count: parseInt(e.target.value) || 0 })}
                                                    className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2"
                                                    required
                                                    placeholder="เช่น 10 หรือ -5"
                                                />
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
                                                    placeholder="ระบุหมายเหตุเพิ่มเติม..."
                                                />
                                            </div>

                                            <div className="flex gap-3 pt-4">
                                                <button
                                                    type="submit"
                                                    className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold"
                                                >
                                                    {editingReport ? '💾 บันทึกการแก้ไข' : '➕ บันทึก'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowModal(false);
                                                        resetForm();
                                                    }}
                                                    className="px-6 py-3 bg-red-500 rounded-lg hover:bg-gray-50"
                                                >
                                                    ยกเลิก
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
