import EOCLayout from "@/components/layouts/EOCLayout";

export default function DashboardPage() {
    const stats = [
        { label: "เหตุการณ์ทั้งหมด", value: "24", icon: "📊", color: "blue" },
        { label: "กำลังดำเนินการ", value: "8", icon: "⚡", color: "yellow" },
        { label: "เหตุฉุกเฉิน", value: "3", icon: "🚨", color: "red" },
        { label: "แก้ไขแล้ว", value: "13", icon: "✅", color: "green" },
    ];

    const recentEvents = [
        { id: 1, title: "น้ำท่วมกรุงเทพฯ", status: "ฉุกเฉิน", time: "10 นาทีที่แล้ว" },
        { id: 2, title: "แผ่นดินไหวเชียงใหม่", status: "กำลังดำเนินการ", time: "1 ชั่วโมงที่แล้ว" },
        { id: 3, title: "ไฟป่าภูเก็ต", status: "ติดตาม", time: "2 ชั่วโมงที่แล้ว" },
    ];

    return (
        <EOCLayout>
            <div>
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">แดชบอร์ด EOC</h1>
                    <p className="text-gray-600 mt-1">ภาพรวมระบบบัญชาการเหตุการณ์ฉุกเฉิน</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    {stats.map((stat, idx) => (
                        <div key={idx} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                                    <p className="text-3xl font-bold text-gray-800">{stat.value}</p>
                                </div>
                                <div className="text-5xl">{stat.icon}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Recent Events */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">เหตุการณ์ล่าสุด</h2>
                        <div className="space-y-3">
                            {recentEvents.map((event) => (
                                <div key={event.id} className="border-l-4 border-green-600 bg-gray-50 p-4 rounded">
                                    <h3 className="font-semibold text-gray-800">{event.title}</h3>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-sm text-gray-600">{event.time}</span>
                                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                                            {event.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">แผนที่สรุป</h2>
                        <div className="bg-gray-100 h-64 rounded flex items-center justify-center">
                            <div className="text-center">
                                <div className="text-6xl mb-2">🗺️</div>
                                <p className="text-gray-600">แผนที่ตำแหน่งเหตุการณ์</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </EOCLayout>
    );
}
