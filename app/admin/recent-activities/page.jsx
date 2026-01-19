"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import EOCLayout from "@/components/layouts/EOCLayout";

export default function RecentActivitiesPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [activities, setActivities] = useState([]);
    const [activitiesLoading, setActivitiesLoading] = useState(true);

    // Redirect if not logged in or not admin
    useEffect(() => {
        if (!loading && (!user || user.role !== 'admin')) {
            router.push("/dashboard");
        }
    }, [user, loading, router]);

    // Fetch recent activities
    useEffect(() => {
        const fetchActivities = async () => {
            try {
                setActivitiesLoading(true);
                const response = await fetch('/api/dashboard/summary');
                const result = await response.json();

                if (result.success) {
                    setActivities(result.data.recentActivities || []);
                }
            } catch (error) {
                console.error('Error fetching recent activities:', error);
            } finally {
                setActivitiesLoading(false);
            }
        };

        if (user && user.role === 'admin') {
            fetchActivities();
            // Refresh data every 30 seconds
            const interval = setInterval(fetchActivities, 30000);
            return () => clearInterval(interval);
        }
    }, [user]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">กำลังโหลด...</p>
                </div>
            </div>
        );
    }

    if (!user || user.role !== 'admin') {
        return null;
    }

    return (
        <EOCLayout>
            <div className="p-6">
                {/* Page Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">📋 กิจกรรมล่าสุด</h1>
                    <p className="text-gray-600">ติดตามกิจกรรมและการเปลี่ยนแปลงในระบบ</p>
                </div>

                {/* Recent Activities Section */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    {activitiesLoading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                            <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
                        </div>
                    ) : activities.length > 0 ? (
                        <div className="space-y-3">
                            {activities.map((activity, index) => (
                                <div
                                    key={activity.id || index}
                                    className="flex items-start gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0"
                                >
                                    <span className="text-3xl flex-shrink-0">{activity.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold text-gray-800 text-lg">{activity.title}</p>
                                            <span className="text-xs text-gray-400 flex-shrink-0">โดย {activity.user}</span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">{activity.description}</p>
                                        <p className="text-xs text-gray-500">{activity.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <p className="text-6xl mb-4">📭</p>
                            <p className="text-xl font-medium mb-2">ยังไม่มีกิจกรรม</p>
                            <p className="text-sm">กิจกรรมต่างๆ ในระบบจะแสดงที่นี่</p>
                        </div>
                    )}
                </div>

                {/* Info Box */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">ℹ️</span>
                        <div>
                            <h3 className="font-semibold text-blue-900 mb-1">เกี่ยวกับกิจกรรมล่าสุด</h3>
                            <p className="text-sm text-blue-800">
                                หน้านี้แสดงกิจกรรมล่าสุดในระบบ เช่น การเปิด/ปิด EOC, การบันทึกข้อมูล,
                                การอัปเดตสถานะต่างๆ และกิจกรรมสำคัญอื่นๆ ข้อมูลจะอัปเดตอัตโนมัติทุก 30 วินาที
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </EOCLayout>
    );
}
