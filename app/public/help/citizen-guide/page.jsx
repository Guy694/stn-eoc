"use client";
import Link from 'next/link';
import PublicLayout from '@/components/layouts/PublicLayout';
import AppIcon from "@/components/icons/AppIcon";

export default function CitizenGuidePage() {
    const steps = [
        {
            title: "1. เข้าสู่หน้าแจ้งเหตุ",
            icon: "earth",
            description: "เข้าไปที่เว็บไซต์ EOC สตูล และคลิกปุ่ม 'แจ้งเหตุภัยพิบัติ'",
            details: [
                "เปิดเว็บเบราว์เซอร์ (Chrome, Safari, Firefox)",
                "พิมพ์ URL หรือคลิกลิงก์ที่ได้รับ",
                "คลิกปุ่มสีแดง 'แจ้งเหตุภัยพิบัติ'"
            ]
        },
        {
            title: "2. เลือกประเภทการรายงาน",
            icon: "file",
            description: "เลือกว่าต้องการรายงานเรื่องอะไร",
            details: [
                "ขอความช่วยเหลือ (อุทกภัยน้ำท่วม) - สำหรับพื้นที่อุทกภัยน้ำท่วม ต้องการความช่วยเหลือ",
                "รายงานการจราจร - สำหรับรายงานสภาพถนน การสัญจร"
            ]
        },
        {
            title: "3. กรอกข้อมูลส่วนตัว",
            icon: "user",
            description: "กรอกข้อมูลของคุณเพื่อให้เจ้าหน้าที่ติดต่อกลับได้",
            details: [
                "ชื่อ-นามสกุล (ต้องกรอก)",
                "เบอร์โทรศัพท์ (ต้องกรอก)",
                "ข้อมูลจะถูกเก็บเป็นความลับ"
            ]
        },
        {
            title: "4. ระบุสถานที่เกิดเหตุ",
            icon: "mapPin",
            description: "บอกตำแหน่งที่เกิดเหตุให้ชัดเจน",
            details: [
                "คลิกบนแผนที่เพื่อระบุตำแหน่ง",
                "หรือกรอกที่อยู่: หมู่บ้าน, ตำบล, อำเภอ",
                "ระบบจะบันทึกพิกัด GPS อัตโนมัติ"
            ]
        },
        {
            title: "5. อธิบายสถานการณ์",
            icon: "message",
            description: "บอกรายละเอียดสิ่งที่เกิดขึ้น",
            details: [
                "อธิบายสถานการณ์ให้ชัดเจน",
                "ระบุความรุนแรง: ต่ำ, ปานกลาง, สูง",
                "ระบุจำนวนผู้ได้รับผลกระทบ (ถ้ามี)"
            ]
        },
        {
            title: "6. แนบรูปภาพ (ถ้ามี)",
            icon: "camera",
            description: "ถ่ายรูปสถานการณ์เพื่อประกอบการรายงาน",
            details: [
                "คลิกปุ่ม 'เลือกรูปภาพ'",
                "เลือกรูปจากแกลเลอรี่ หรือถ่ายรูปใหม่",
                "รูปภาพช่วยให้เจ้าหน้าที่เข้าใจสถานการณ์ได้ดีขึ้น"
            ]
        },
        {
            title: "7. ส่งรายงาน",
            icon: "checkCircle",
            description: "ตรวจสอบข้อมูลและส่งรายงาน",
            details: [
                "ตรวจสอบข้อมูลทั้งหมดให้ถูกต้อง",
                "คลิกปุ่ม 'ส่งรายงาน'",
                "รอรับเลขที่รายงาน (เก็บไว้เพื่อตรวจสอบสถานะ)"
            ]
        },
        {
            title: "8. ติดตามสถานะ",
            icon: "search",
            description: "ตรวจสอบความคืบหน้าของรายงาน",
            details: [
                "บันทึกเลขที่รายงานที่ได้รับ",
                "เจ้าหน้าที่จะตรวจสอบภายใน 30 นาที",
                "คุณจะได้รับการติดต่อกลับทางโทรศัพท์"
            ]
        }
    ];

    const tips = [
        {
            icon: "siren",
            title: "รายงานทันที",
            description: "อย่ารอช้า รายงานทันทีที่พบเหตุการณ์"
        },
        {
            icon: "camera",
            title: "ถ่ายรูปชัดเจน",
            description: "ถ่ายรูปให้เห็นสถานการณ์ชัดเจน"
        },
        {
            icon: "phone",
            title: "เปิดเครื่องโทรศัพท์",
            description: "เปิดเครื่องเพื่อให้เจ้าหน้าที่ติดต่อกลับได้"
        },
        {
            icon: "circleDot",
            title: "เก็บเลขที่รายงาน",
            description: "บันทึกเลขที่รายงานเพื่อตรวจสอบสถานะ"
        }
    ];

    return (
        <PublicLayout>
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/public/help"
                        className="text-blue-600 hover:text-blue-800 font-medium mb-4 inline-block"
                    >
                        ← กลับไปศูนย์ช่วยเหลือ
                    </Link>
                    <h1 className="text-4xl font-bold text-gray-800 mb-4">
                        <AppIcon icon="users" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> คู่มือสำหรับประชาชน
                    </h1>
                    <p className="text-xl text-gray-600">
                        วิธีการแจ้งเหตุภัยพิบัติผ่านระบบ EOC
                    </p>
                </div>

                {/* Steps */}
                <div className="space-y-6 mb-12">
                    {steps.map((step, index) => (
                        <div
                            key={index}
                            className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6"
                        >
                            <div className="flex items-start gap-4">
                                <AppIcon icon={step.icon} className="h-12 w-12 flex-shrink-0" />
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                                        {step.title}
                                    </h3>
                                    <p className="text-gray-600 mb-3">{step.description}</p>
                                    <ul className="space-y-2">
                                        {step.details.map((detail, idx) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <AppIcon icon="check" className="mt-1 h-4 w-4 text-green-600" />
                                                <span className="text-gray-700">{detail}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Tips */}
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-8 mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                        <AppIcon icon="lightbulb" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> เคล็ดลับการรายงาน
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tips.map((tip, index) => (
                            <div key={index} className="bg-white rounded-lg p-4 flex items-start gap-3">
                                <AppIcon icon={tip.icon} className="h-8 w-8" />
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-1">{tip.title}</h3>
                                    <p className="text-sm text-gray-600">{tip.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CTA */}
                <div className="text-center bg-white rounded-xl shadow-md p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">
                        พร้อมแจ้งเหตุแล้วหรือยัง?
                    </h2>
                    <Link
                        href="/public/report-incident"
                        className="inline-block bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                        <span className="text-2xl mr-2"><AppIcon icon="siren" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></span>
                        แจ้งเหตุภัยพิบัติ
                    </Link>
                </div>
            </div>
        </PublicLayout>
    );
}
