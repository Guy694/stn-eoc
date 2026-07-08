"use client";
import { useCallback, useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

// ชื่อ EOC Type แบบภาษาไทย
const EOC_TYPE_LABELS = {
    flood: "อุทกภัยน้ำท่วม",
    disease: "โรคระบาด",
    'festival-accidents': "อุบัติเหตุ"
};

// สี Chart สำหรับแต่ละประเภท
const EOC_TYPE_COLORS = {
    flood: { bg: "rgba(59, 130, 246, 0.6)", border: "rgb(59, 130, 246)" },
    disease: { bg: "rgba(168, 85, 247, 0.6)", border: "rgb(168, 85, 247)" },
    'festival-accidents': { bg: "rgba(249, 115, 22, 0.6)", border: "rgb(249, 115, 22)" }
};

export default function EOCTypeChart() {
    const [selectedYear, setSelectedYear] = useState('all');
    const [chartData, setChartData] = useState(null);
    const [availableYears, setAvailableYears] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchEOCStats = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/stn-eoc/api/stats/eoc-types?year=${selectedYear}`);
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "ไม่สามารถดึงข้อมูลได้");
            }

            // แสดงข้อความถ้าไม่มีข้อมูล
            if (result.message) {
                console.warn(result.message);
            }

            setAvailableYears(result.availableYears || []);

            // จัดเตรียมข้อมูลสำหรับ Chart
            const labels = Object.keys(EOC_TYPE_LABELS);
            const data = labels.map(type => result.data[type] || 0);
            const backgroundColors = labels.map(type => EOC_TYPE_COLORS[type].bg);
            const borderColors = labels.map(type => EOC_TYPE_COLORS[type].border);

            setChartData({
                labels: labels.map(type => EOC_TYPE_LABELS[type]),
                datasets: [
                    {
                        label: `จำนวนครั้งที่เกิด EOC ${selectedYear === 'all' ? '(ทั้งหมด)' : `(ปี ${selectedYear})`}`,
                        data: data,
                        backgroundColor: backgroundColors,
                        borderColor: borderColors,
                        borderWidth: 2
                    }
                ]
            });
        } catch (err) {
            console.error("Error fetching EOC stats:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        fetchEOCStats();
    }, [fetchEOCStats]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
            },
            title: {
                display: true,
                text: `สถิติการเกิด EOC แยกตามประเภทภัยพิบัติ ${selectedYear === 'all' ? '(ทั้งหมด)' : `ปี ${selectedYear}`}`,
                font: {
                    size: 18,
                    family: 'Prompt, sans-serif'
                }
            },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        return `${context.dataset.label}: ${context.parsed.y} ครั้ง`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    stepSize: 1,
                    font: {
                        family: 'Prompt, sans-serif'
                    }
                }
            },
            x: {
                ticks: {
                    font: {
                        family: 'Prompt, sans-serif'
                    }
                }
            }
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b border-blue-600"></div>
                    <span className="ml-3 text-gray-600">กำลังโหลดข้อมูล...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-center py-8">
                    <p className="text-red-600">❌ เกิดข้อผิดพลาด: {error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            {/* Header with Year Filter */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">📊 สถิติการเกิด EOC แยกตามประเภท</h2>
                <div className="flex items-center gap-2">
                    <label htmlFor="year-filter" className="text-gray-700 font-medium">
                        เลือกปี:
                    </label>
                    <select
                        id="year-filter"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value="all">ทั้งหมด</option>
                        {availableYears.map(year => (
                            <option key={year} value={year}>
                                ปี {year}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Chart */}
            <div className="h-96">
                {chartData && <Bar data={chartData} options={chartOptions} />}
            </div>

            {/* Summary Stats */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(EOC_TYPE_LABELS).map(([type, label]) => {
                    const count = chartData?.datasets[0]?.data[Object.keys(EOC_TYPE_LABELS).indexOf(type)] || 0;
                    return (
                        <div key={type} className="text-center p-4 bg-gray-50 rounded-lg border">
                            <div className="text-3xl mb-2">
                                {type === 'flood' && '🌊'}
                                {type === 'festival-accidents' && '🚗'}
                                {type === 'disease' && '🦠'}
                            </div>
                            <div className="text-2xl font-bold text-gray-800">{count}</div>
                            <div className="text-sm text-gray-600">{label}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
