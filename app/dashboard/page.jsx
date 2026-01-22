"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import DisasterDashboard from "@/components/DisasterDashboard";
import EOCTypeChart from "@/components/EOCTypeChart";
import UserEOCDashboard from "@/components/UserEOCDashboard";
import CitizenDashboard from "@/components/CitizenDashboard";

export default function DashboardPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [stats, setStats] = useState({
        activeEvents: 0,
        totalAffected: 0,
        teamsDeployed: 0,
        todayReports: 0,
        recentActivities: [],
        announcements: []
    });
    const [statsLoading, setStatsLoading] = useState(true);

    // Redirect if not logged in
    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    // Fetch dashboard data
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setStatsLoading(true);
                const response = await fetch('/api/dashboard/summary');
                const result = await response.json();

                if (result.success) {
                    setStats({
                        activeEvents: result.data.activeEOCs || 0,
                        totalAffected: result.data.totalAffected || 0,
                        teamsDeployed: result.data.activeTeams || 0,
                        todayReports: result.data.todayReports || 0,
                        recentActivities: result.data.recentActivities || [],
                        announcements: result.data.announcements || []
                    });
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setStatsLoading(false);
            }
        };

        if (user) {
            fetchDashboardData();
            // Refresh data every 30 seconds
            const interval = setInterval(fetchDashboardData, 30000);
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

    if (!user) {
        return null;
    }

    return (
        <EOCLayout>
            <div className="p-6">
                {/* Citizen Dashboard - Different experience for citizens */}
                {user.role === 'citizen' ? (
                    <CitizenDashboard />
                ) : (
                    <>
                        {/* Welcome Section */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-gray-800 mb-2">
                                ยินดีต้อนรับ, {`${user.title || ''} ${user.givenName || ''} ${user.familyName || ''}`.trim() || user.username}
                            </h1>
                            <p className="text-gray-600">
                                สิทธิ์การเข้าถึง: <span className="font-semibold text-green-600">{user.roleDisplay}</span>
                                {user.department && ` | ${user.department}`}
                                {user.position && ` | ${user.position}`}
                            </p>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <StatCard
                                icon="🚨"
                                title="เหตุการณ์ที่กำลังดำเนินการ"
                                value={stats.activeEvents}
                                color={stats.activeEvents > 0 ? "from-red-500 to-orange-500" : "from-green-500 to-emerald-500"}
                                loading={statsLoading}
                            />
                            <StatCard
                                icon="👥"
                                title="ผู้ได้รับผลกระทบ"
                                value={stats.totalAffected}
                                unit="คน"
                                color={stats.totalAffected > 0 ? "from-blue-500 to-cyan-500" : "from-gray-400 to-gray-300"}
                                loading={statsLoading}
                            />
                            <StatCard
                                icon="⚡"
                                title="ทีมปฏิบัติการ"
                                value={stats.teamsDeployed}
                                unit="ทีม"
                                color={stats.teamsDeployed > 0 ? "from-purple-500 to-pink-500" : "from-gray-400 to-gray-300"}
                                loading={statsLoading}
                            />
                            <StatCard
                                icon="📊"
                                title="รายงานวันนี้"
                                value={stats.todayReports}
                                unit="รายการ"
                                color={stats.todayReports > 0 ? "from-amber-500 to-yellow-500" : "from-gray-400 to-gray-300"}
                                loading={statsLoading}
                            />
                        </div>

                        {/* Announcements Section */}
                        {stats.announcements.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold text-gray-800 mb-4">📢 ประกาศล่าสุด</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {stats.announcements.map((announcement) => (
                                        <div
                                            key={announcement.id}
                                            className={`bg-white rounded-lg shadow-md p-5 border-l-4 ${announcement.priority === 'high' ? 'border-red-500' :
                                                announcement.priority === 'medium' ? 'border-yellow-500' : 'border-blue-500'
                                                }`}
                                        >
                                            <h3 className="font-bold text-lg text-gray-800 mb-2">{announcement.title}</h3>
                                            <p className="text-sm text-gray-600 line-clamp-2">{announcement.content}</p>
                                            <p className="text-xs text-gray-400 mt-2">
                                                {new Date(announcement.created_at).toLocaleDateString('th-TH')}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quick Access based on Role */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-800 mb-4">ระบบจัดการภัยพิบัติ (Disaster Management Modules)</h2>
                            <DisasterDashboard />
                        </div>

                        {/* UserEOCDashboard for Officers only */}
                        {user.role !== 'admin' && user.role !== 'citizen' && (
                            <div className="mb-8">
                                <UserEOCDashboard />
                            </div>
                        )}

                        {/* EOC Statistics Chart */}
                        <div className="mb-8">
                            <EOCTypeChart />
                        </div>

                        {/* Legacy Quick Access */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-800 mb-4">🔗 เมนูเพิ่มเติม</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <QuickAccessCard
                                    icon="🏘️"
                                    title="แผนที่หมู่บ้าน"
                                    description="ดูข้อมูลหมู่บ้านทั้งหมด"
                                    link="/eoc/village-map"
                                    color="bg-green-50 hover:bg-green-100 border-green-200"
                                />

                                {/* สำหรับ admin และ eoc_manager */}
                                {user.permissions?.admin?.view && (
                                    <>
                                        <QuickAccessCard
                                            icon="👮"
                                            title="จัดการเจ้าหน้าที่"
                                            description="ข้อมูลเจ้าหน้าที่ทั้งหมด"
                                            link="/admin/officers"
                                            color="bg-purple-50 hover:bg-purple-100 border-purple-200"
                                        />
                                        <QuickAccessCard
                                            icon="📝"
                                            title="บันทึกข้อมูลน้ำท่วม"
                                            description="บันทึกเหตุการณ์น้ำท่วมรายปี"
                                            link="/admin/flood-records"
                                            color="bg-indigo-50 hover:bg-indigo-100 border-indigo-200"
                                        />
                                    </>
                                )}

                                {/* สำหรับ eoc_staff และ local_officer */}
                                {(user.role === 'eoc_staff' || user.role === 'local_officer') && (
                                    <QuickAccessCard
                                        icon="➕"
                                        title="บันทึกข้อมูลใหม่"
                                        description="บันทึกข้อมูลภัยพิบัติ"
                                        link="/admin/flood-records"
                                        color="bg-teal-50 hover:bg-teal-100 border-teal-200"
                                    />
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </EOCLayout>
    );
}

// Stat Card Component with dynamic colors and loading state
function StatCard({ icon, title, value, unit = "", color, loading = false }) {
    return (
        <div className={`bg-gradient-to-br ${color} text-white rounded-lg shadow-lg p-6 hover:scale-105 transition-transform`}>
            <div className="text-4xl mb-2">{icon}</div>
            {loading ? (
                <div className="h-10 flex items-center">
                    <div className="animate-pulse bg-white/30 rounded h-8 w-20"></div>
                </div>
            ) : (
                <div className="text-3xl font-bold mb-1">
                    {value.toLocaleString()} {unit && <span className="text-xl">{unit}</span>}
                </div>
            )}
            <div className="text-sm opacity-90">{title}</div>
        </div>
    );
}

// Quick Access Card Component
function QuickAccessCard({ icon, title, description, link, color }) {
    return (
        <a
            href={link}
            className={`${color} border rounded-lg shadow-md p-6 transition-all hover:shadow-lg block`}
        >
            <div className="text-4xl mb-3">{icon}</div>
            <h3 className="font-bold text-lg text-gray-800 mb-1">{title}</h3>
            <p className="text-sm text-gray-600">{description}</p>
        </a>
    );
}
