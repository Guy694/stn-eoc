"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import DisasterDashboard from "@/components/DisasterDashboard";

export default function DashboardPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [stats, setStats] = useState({
        activeEvents: 0,
        totalAffected: 0,
        teamsDeployed: 0,
        recentActivities: []
    });

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

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
                        color="from-red-500 to-orange-500"
                    />
                    <StatCard
                        icon="👥"
                        title="ผู้ได้รับผลกระทบ"
                        value={stats.totalAffected}
                        unit="คน"
                        color="from-blue-500 to-cyan-500"
                    />
                    <StatCard
                        icon="⚡"
                        title="ทีมปฏิบัติการ"
                        value={stats.teamsDeployed}
                        unit="ทีม"
                        color="from-green-500 to-emerald-500"
                    />
                    <StatCard
                        icon="📊"
                        title="รายงานวันนี้"
                        value={5}
                        unit="รายการ"
                        color="from-purple-500 to-pink-500"
                    />
                </div>

                {/* Quick Access based on Role */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">ระบบจัดการภัยพิบัติ (Disaster Management Modules)</h2>
                    <DisasterDashboard />
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

                {/* Recent Activities */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">📋 กิจกรรมล่าสุด</h2>
                    {stats.recentActivities.length > 0 ? (
                        <div className="space-y-3">
                            {stats.recentActivities.map((activity, index) => (
                                <div key={index} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                                    <span className="text-2xl">{activity.icon}</span>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-800">{activity.title}</p>
                                        <p className="text-sm text-gray-600">{activity.description}</p>
                                        <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <p className="text-4xl mb-2">📭</p>
                            <p>ยังไม่มีกิจกรรม</p>
                        </div>
                    )}
                </div>
            </div>
        </EOCLayout>
    );
}

// Stat Card Component
function StatCard({ icon, title, value, unit = "", color }) {
    return (
        <div className={`bg-linear-to-br ${color} text-white rounded-lg shadow-lg p-6 hover:scale-105 transition-transform`}>
            <div className="text-4xl mb-2">{icon}</div>
            <div className="text-3xl font-bold mb-1">
                {value} {unit && <span className="text-xl">{unit}</span>}
            </div>
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
