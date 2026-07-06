'use client';
import { useEffect, useState, useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

// Color palette for different diseases
const COLORS = [
    { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgb(239, 68, 68)' },      // Red
    { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgb(59, 130, 246)' },    // Blue
    { bg: 'rgba(16, 185, 129, 0.2)', border: 'rgb(16, 185, 129)' },    // Green
    { bg: 'rgba(245, 158, 11, 0.2)', border: 'rgb(245, 158, 11)' },    // Amber
    { bg: 'rgba(168, 85, 247, 0.2)', border: 'rgb(168, 85, 247)' },    // Purple
    { bg: 'rgba(236, 72, 153, 0.2)', border: 'rgb(236, 72, 153)' },    // Pink
    { bg: 'rgba(20, 184, 166, 0.2)', border: 'rgb(20, 184, 166)' },    // Teal
    { bg: 'rgba(251, 146, 60, 0.2)', border: 'rgb(251, 146, 60)' }     // Orange
];

export default function DailyDiseaseChart({ sessionId }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (sessionId) params.set('session_id', sessionId);
                const url = `/stn-eoc/api/eoc/disease/daily-stats${params.toString() ? `?${params.toString()}` : ''}`;
                const response = await fetch(url);
                const result = await response.json();

                if (result.success) {
                    setData(result);
                } else {
                    setError(result.message || 'ไม่สามารถดึงข้อมูลได้');
                }
            } catch (err) {
                console.error('Error fetching chart data:', err);
                setError('เกิดข้อผิดพลาดในการดึงข้อมูล');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [sessionId]);

    // Transform data for Chart.js
    const chartData = useMemo(() => {
        if (!data || !data.daily_data || !data.diseases) {
            return null;
        }

        // สร้าง labels (วันที่)
        const labels = data.daily_data.map(day => {
            const date = new Date(day.date);
            return date.toLocaleDateString('th-TH', {
                day: 'numeric',
                month: 'short'
            });
        });

        // สร้าง datasets สำหรับแต่ละโรค
        const datasets = data.diseases.map((disease, index) => {
            const color = COLORS[index % COLORS.length];

            // ดึงข้อมูลของโรคนี้สำหรับแต่ละวัน
            const diseaseData = data.daily_data.map(day => {
                const diseaseInfo = day.diseases.find(d => d.disease_name === disease);
                return diseaseInfo ? diseaseInfo.patient_count : 0;
            });

            return {
                label: disease,
                data: diseaseData,
                borderColor: color.border,
                backgroundColor: color.bg,
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: color.border,
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            };
        });

        return {
            labels,
            datasets
        };
    }, [data]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    padding: 15,
                    font: {
                        size: 12,
                        family: 'Kanit'
                    }
                }
            },
            title: {
                display: true,
                text: 'แนวโน้มผู้ป่วยรายวัน',
                font: {
                    size: 18,
                    weight: 'bold',
                    family: 'Kanit'
                },
                padding: {
                    top: 10,
                    bottom: 20
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleFont: {
                    size: 14,
                    family: 'Kanit'
                },
                bodyFont: {
                    size: 13,
                    family: 'Kanit'
                },
                padding: 12,
                callbacks: {
                    label: function (context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        label += context.parsed.y + ' คน';
                        return label;
                    },
                    footer: function (tooltipItems) {
                        let total = 0;
                        tooltipItems.forEach(item => {
                            total += item.parsed.y;
                        });
                        return 'รวม: ' + total + ' คน';
                    }
                }
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
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b border-red-500 mx-auto mb-4"></div>
                        <p className="text-gray-600">กำลังโหลดข้อมูลกราฟ...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="text-center py-12">
                    <span className="text-6xl">⚠️</span>
                    <p className="text-gray-600 mt-4">{error}</p>
                </div>
            </div>
        );
    }

    if (!chartData || !data) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="text-center py-12">
                    <span className="text-6xl">📊</span>
                    <p className="text-gray-600 mt-4">ไม่มีข้อมูลสำหรับแสดงกราฟ</p>
                </div>
            </div>
        );
    }

    if (data.summary.total_patients === 0) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="text-center py-12">
                    <span className="text-6xl">📋</span>
                    <h3 className="text-xl font-bold text-gray-700 mt-4">
                        ยังไม่มีรายงานโรคในช่วงนี้
                    </h3>
                    <p className="text-gray-500 mt-2">
                        เมื่อมีการบันทึกรายงานโรค กราฟจะแสดงที่นี่
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="h-96">
                <Line data={chartData} options={options} />
            </div>

            {/* Disease breakdown */}
            {data.disease_stats && data.disease_stats.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">
                        สรุปตามโรค
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.disease_stats.map((disease, index) => {
                            const color = COLORS[index % COLORS.length];
                            return (
                                <div
                                    key={disease.disease_name}
                                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                                    style={{ borderLeftWidth: '4px', borderLeftColor: color.border }}
                                >
                                    <h4 className="font-bold text-gray-800 mb-2">
                                        {disease.disease_name}
                                    </h4>
                                    <div className="space-y-1 text-sm text-gray-600">
                                        <p>
                                            <span className="font-medium">ผู้ป่วย:</span>{' '}
                                            <span className="text-red-600 font-bold">
                                                {disease.total_patients.toLocaleString()}
                                            </span> คน
                                        </p>
                                        <p>
                                            <span className="font-medium">รายงาน:</span>{' '}
                                            {disease.report_count} ครั้ง
                                        </p>
                                        <p>
                                            <span className="font-medium">หน่วยบริการ:</span>{' '}
                                            {disease.facilities_count} แห่ง
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
