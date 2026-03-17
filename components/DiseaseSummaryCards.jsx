'use client';
import { useEffect, useState } from 'react';

export default function DiseaseSummaryCards({ sessionId }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!sessionId) {
            setLoading(false);
            return;
        }

        const fetchStats = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/stn-eoc/api/eoc/disease/daily-stats?session_id=${sessionId}`);
                const data = await response.json();

                if (data.success) {
                    setStats(data.summary);
                }
            } catch (error) {
                console.error('Error fetching disease stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [sessionId]);

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                        <div className="h-8 bg-gray-300 rounded w-1/2"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (!stats) {
        return null;
    }

    const cards = [
        {
            icon: '🤒',
            title: 'ผู้ป่วยทั้งหมด',
            value: stats.total_patients.toLocaleString(),
            suffix: 'คน',
            bgColor: 'bg-red-50',
            iconColor: 'text-red-500',
            textColor: 'text-red-700'
        },
        {
            icon: '📋',
            title: 'รายงานทั้งหมด',
            value: stats.total_reports.toLocaleString(),
            suffix: 'รายงาน',
            bgColor: 'bg-blue-50',
            iconColor: 'text-blue-500',
            textColor: 'text-blue-700'
        },
        {
            icon: '🦠',
            title: 'โรคที่พบ',
            value: stats.diseases_count.toLocaleString(),
            suffix: 'โรค',
            bgColor: 'bg-purple-50',
            iconColor: 'text-purple-500',
            textColor: 'text-purple-700'
        },
        {
            icon: '🏥',
            title: 'หน่วยบริการ',
            value: stats.facilities_count.toLocaleString(),
            suffix: 'แห่ง',
            bgColor: 'bg-green-50',
            iconColor: 'text-green-500',
            textColor: 'text-green-700'
        }
    ];

    return (
        <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {cards.map((card, index) => (
                    <div
                        key={index}
                        className={`${card.bgColor} rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-3xl ${card.iconColor}`}>{card.icon}</span>
                        </div>
                        <h3 className="text-sm font-medium text-gray-600 mb-1">
                            {card.title}
                        </h3>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-3xl font-bold ${card.textColor}`}>
                                {card.value}
                            </span>
                            <span className="text-sm text-gray-500">{card.suffix}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Date Range Info */}
            {stats.date_range && (
                <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">📅</span>
                        <div>
                            <p className="font-medium text-amber-900">ช่วงเวลารายงาน</p>
                            <p className="text-sm text-amber-700">
                                {new Date(stats.date_range.start).toLocaleDateString('th-TH', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                                {' ถึง '}
                                {new Date(stats.date_range.end).toLocaleDateString('th-TH', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                                {' '}
                                <span className="font-medium">
                                    ({stats.date_range.days} วัน)
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
