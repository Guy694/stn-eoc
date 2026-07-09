"use client";
import Link from 'next/link';
import PublicLayout from '@/components/layouts/PublicLayout';

export default function EOCGuidePage() {
    const modules = [
        {
            title: "Dashboard & สถิติ",
            icon: "📊",
            features: [
                "ดูภาพรวมรายงานทั้งหมด",
                "สถิติรายวัน/รายสัปดาห์/รายเดือน",
                "กราฟแนวโน้มการเกิดเหตุ",
                "จำนวนรายงานที่รอดำเนินการ"
            ]
        },
        {
            title: "จัดการรายงาน",
            icon: "📝",
            features: [
                "ตรวจสอบและยืนยันรายงาน",
                "อัพเดทสถานะการดำเนินการ",
                "เพิ่มหมายเหตุเจ้าหน้าที่",
                "มอบหมายงานให้ทีม"
            ]
        },
        {
            title: "แผนที่และพื้นที่",
            icon: "🗺️",
            features: [
                "ดูรายงานบนแผนที่",
                "กรองตามพื้นที่",
                "วิเคราะห์จุดเสี่ยง",
                "ส่งออกข้อมูลพิกัด"
            ]
        },
        {
            title: "ศูนย์พักพิง",
            icon: "🏠",
            features: [
                "จัดการข้อมูลศูนย์พักพิง",
                "บันทึกจำนวนผู้อพยพ",
                "ติดตามเสบียงและอุปกรณ์",
                "รายงานสถานะศูนย์"
            ]
        }
    ];

    const workflows = [
        {
            title: "1. เข้าสู่ระบบ",
            steps: [
                "เข้าไปที่ /login",
                "กรอก Username และ Password",
                "คลิก 'เข้าสู่ระบบ'",
                "ระบบจะนำไปยัง Dashboard"
            ]
        },
        {
            title: "2. ตรวจสอบรายงานใหม่",
            steps: [
                "ดูรายการรายงานที่ 'รอตรวจสอบ'",
                "คลิกเพื่อดูรายละเอียด",
                "ตรวจสอบข้อมูล รูปภาพ และพิกัด",
                "ตัดสินใจ: อนุมัติ หรือ ปฏิเสธ"
            ]
        },
        {
            title: "3. อนุมัติรายงาน",
            steps: [
                "คลิกปุ่ม 'อนุมัติ'",
                "เลือกระดับความรุนแรง",
                "เพิ่มหมายเหตุ (ถ้ามี)",
                "บันทึก - รายงานจะแสดงบนแผนที่สาธารณะ"
            ]
        },
        {
            title: "4. อัพเดทสถานะ",
            steps: [
                "เปิดรายงานที่ต้องการอัพเดท",
                "เลือกสถานะใหม่: กำลังดำเนินการ/เสร็จสิ้น",
                "เพิ่มรายละเอียดการดำเนินการ",
                "บันทึก - ประชาชนจะได้รับการแจ้งเตือน"
            ]
        },
        {
            title: "5. จัดการศูนย์พักพิง",
            steps: [
                "ไปที่เมนู 'ศูนย์พักพิง'",
                "คลิก 'เพิ่มศูนย์ใหม่' หรือแก้ไขศูนย์เดิม",
                "กรอกข้อมูล: ชื่อ, ที่อยู่, ความจุ",
                "บันทึก - ข้อมูลจะแสดงบนแผนที่"
            ]
        },
        {
            title: "6. ส่งออกรายงาน",
            steps: [
                "เลือกช่วงเวลาที่ต้องการ",
                "เลือกประเภทรายงาน",
                "คลิก 'Export to Excel'",
                "ไฟล์จะถูกดาวน์โหลดอัตโนมัติ"
            ]
        }
    ];

    const tips = [
        {
            icon: "⚡",
            title: "ตรวจสอบรายงานทันที",
            description: "ตรวจสอบรายงานใหม่ภายใน 30 นาที เพื่อให้ประชาชนได้รับความช่วยเหลือรวดเร็ว"
        },
        {
            icon: "✅",
            title: "ยืนยันข้อมูลให้ถูกต้อง",
            description: "ตรวจสอบพิกัด รูปภาพ และรายละเอียดก่อนอนุมัติเพื่อความแม่นยำ"
        },
        {
            icon: "📝",
            title: "เพิ่มหมายเหตุ",
            description: "เพิ่มหมายเหตุเจ้าหน้าที่เพื่อให้ทีมอื่นเข้าใจบริบทได้ดีขึ้น"
        },
        {
            icon: "🔄",
            title: "อัพเดทสถานะสม่ำเสมอ",
            description: "อัพเดทสถานะการดำเนินการเพื่อให้ประชาชนทราบความคืบหน้า"
        }
    ];

    return (
        <PublicLayout>
            <div className="container mx-auto px-4 py-8 max-w-5xl">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/public/help"
                        className="text-blue-600 hover:text-blue-800 font-medium mb-4 inline-block"
                    >
                        ← กลับไปศูนย์ช่วยเหลือ
                    </Link>
                    <h1 className="text-4xl font-bold text-gray-800 mb-4">
                        👨‍💼 คู่มือสำหรับเจ้าหน้าที่ EOC
                    </h1>
                    <p className="text-xl text-gray-600">
                        คู่มือการใช้งานระบบสำหรับเจ้าหน้าที่ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข
                    </p>
                </div>

                {/* Modules Overview */}
                <div className="mb-12">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">
                        📦 โมดูลหลักของระบบ
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {modules.map((module, index) => (
                            <div key={index} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="text-4xl">{module.icon}</span>
                                    <h3 className="text-xl font-bold text-gray-800">{module.title}</h3>
                                </div>
                                <ul className="space-y-2">
                                    {module.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                            <span className="text-green-600 mt-1">✓</span>
                                            <span className="text-gray-700">{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Workflows */}
                <div className="mb-12">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">
                        🔄 ขั้นตอนการทำงาน
                    </h2>
                    <div className="space-y-4">
                        {workflows.map((workflow, index) => (
                            <div key={index} className="bg-white rounded-xl shadow-md p-6">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">
                                    {workflow.title}
                                </h3>
                                <ol className="space-y-2">
                                    {workflow.steps.map((step, idx) => (
                                        <li key={idx} className="flex items-start gap-3">
                                            <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                                {idx + 1}
                                            </span>
                                            <span className="text-gray-700 pt-0.5">{step}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Best Practices */}
                <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-8 mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                        💡 แนวทางปฏิบัติที่ดี
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tips.map((tip, index) => (
                            <div key={index} className="bg-white rounded-lg p-4 flex items-start gap-3">
                                <span className="text-3xl flex-shrink-0">{tip.icon}</span>
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-1">{tip.title}</h3>
                                    <p className="text-sm text-gray-600">{tip.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Login CTA */}
                <div className="text-center bg-white rounded-xl shadow-md p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">
                        พร้อมเริ่มทำงานแล้วหรือยัง?
                    </h2>
                    <Link
                        href="/login"
                        className="inline-block bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                        <span className="text-2xl mr-2">🔐</span>
                        เข้าสู่ระบบ
                    </Link>
                </div>
            </div>
        </PublicLayout>
    );
}
