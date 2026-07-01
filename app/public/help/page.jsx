"use client";
import Link from 'next/link';
import PublicLayout from '@/components/layouts/PublicLayout';

export default function HelpCenterPage() {
    const helpCategories = [
        {
            title: "สำหรับประชาชน",
            icon: "👥",
            description: "คู่มือการใช้งานสำหรับประชาชนทั่วไป",
            link: "/public/help/citizen-guide",
            color: "from-blue-500 to-blue-600"
        },
        {
            title: "สำหรับเจ้าหน้าที่ EOC",
            icon: "👨‍💼",
            description: "คู่มือการใช้งานสำหรับเจ้าหน้าที่",
            link: "/public/help/eoc-guide",
            color: "from-green-500 to-green-600"
        },
        {
            title: "คำถามที่พบบ่อย (FAQ)",
            icon: "❓",
            description: "คำตอบสำหรับคำถามที่พบบ่อย",
            link: "/public/help/faq",
            color: "from-teal-500 to-teal-600"
        }
    ];

    return (
        <PublicLayout>
            <div className="container mx-auto px-4 py-8 max-w-6xl">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-800 mb-4">
                        📚 ศูนย์ช่วยเหลือ
                    </h1>
                    <p className="text-xl text-gray-600">
                        คู่มือการใช้งานระบบ EOC จังหวัดสตูล
                    </p>
                </div>

                {/* Help Categories */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    {helpCategories.map((category, index) => (
                        <Link
                            key={index}
                            href={category.link}
                            className="group"
                        >
                            <div className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden h-full hover:scale-105">
                                <div className={`bg-gradient-to-r ${category.color} p-6 text-center`}>
                                    <div className="text-6xl mb-3">{category.icon}</div>
                                    <h3 className="text-xl font-bold text-white">
                                        {category.title}
                                    </h3>
                                </div>
                                <div className="p-6">
                                    <p className="text-gray-600 text-center">
                                        {category.description}
                                    </p>
                                    <div className="mt-4 text-center">
                                        <span className="text-blue-600 group-hover:text-blue-800 font-semibold">
                                            อ่านเพิ่มเติม →
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Quick Links */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                        🔗 ลิงก์ด่วน
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Link
                            href="/public/report-incident"
                            className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow flex items-center gap-3"
                        >
                            <span className="text-3xl">🚨</span>
                            <div>
                                <h3 className="font-semibold text-gray-800">แจ้งเหตุภัยพิบัติ</h3>
                                <p className="text-sm text-gray-600">รายงานเหตุการณ์ฉุกเฉิน</p>
                            </div>
                        </Link>

                        <Link
                            href="/public/disaster-map"
                            className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow flex items-center gap-3"
                        >
                            <span className="text-3xl">🗺️</span>
                            <div>
                                <h3 className="font-semibold text-gray-800">แผนที่รายงาน</h3>
                                <p className="text-sm text-gray-600">ดูรายงานจากประชาชน</p>
                            </div>
                        </Link>

                        <Link
                            href="/login"
                            className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow flex items-center gap-3"
                        >
                            <span className="text-3xl">🔐</span>
                            <div>
                                <h3 className="font-semibold text-gray-800">เข้าสู่ระบบ</h3>
                                <p className="text-sm text-gray-600">สำหรับเจ้าหน้าที่</p>
                            </div>
                        </Link>

                        <div className="bg-white rounded-lg p-4 flex items-center gap-3">
                            <span className="text-3xl">📞</span>
                            <div>
                                <h3 className="font-semibold text-gray-800">ติดต่อฉุกเฉิน</h3>
                                <p className="text-sm text-gray-600">074-711-555</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contact Support */}
                <div className="mt-12 text-center bg-white rounded-xl shadow-md p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">
                        💬 ต้องการความช่วยเหลือเพิ่มเติม?
                    </h2>
                    <p className="text-gray-600 mb-6">
                        หากคุณไม่พบคำตอบที่ต้องการ กรุณาติดต่อเรา
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <a
                            href="tel:074-711-555"
                            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                        >
                            <span>📞</span>
                            <span>โทร 074-711-555</span>
                        </a>
                        <a
                            href="https://line.me/R/ti/p/@satun-eoc"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                        >
                            <span>💬</span>
                            <span>LINE: @satun-eoc</span>
                        </a>
                    </div>
                </div>
            </div>
        </PublicLayout>
    );
}
