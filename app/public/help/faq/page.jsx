"use client";
import Link from 'next/link';
import PublicLayout from '@/components/layouts/PublicLayout';

export default function FAQPage() {
    const faqs = [
        {
            category: "การแจ้งเหตุ",
            icon: "🚨",
            questions: [
                {
                    q: "ฉันต้องลงทะเบียนก่อนแจ้งเหตุหรือไม่?",
                    a: "ไม่ต้องครับ คุณสามารถแจ้งเหตุได้ทันทีโดยไม่ต้องลงทะเบียน เพียงกรอกข้อมูลพื้นฐานเช่น ชื่อและเบอร์โทรศัพท์เพื่อให้เจ้าหน้าที่ติดต่อกลับได้"
                },
                {
                    q: "ใช้เวลานานแค่ไหนในการแจ้งเหตุ?",
                    a: "ใช้เวลาประมาณ 2-3 นาที หากคุณมีข้อมูลครบถ้วน (ที่อยู่, รูปภาพ, รายละเอียด)"
                },
                {
                    q: "ต้องแนบรูปภาพทุกครั้งหรือไม่?",
                    a: "ไม่จำเป็นครับ แต่รูปภาพจะช่วยให้เจ้าหน้าที่เข้าใจสถานการณ์ได้ดีและรวดเร็วขึ้น"
                },
                {
                    q: "สามารถแจ้งเหตุแทนคนอื่นได้หรือไม่?",
                    a: "ได้ครับ คุณสามารถแจ้งเหตุแทนผู้อื่นได้ แต่ควรระบุข้อมูลผู้ได้รับผลกระทบให้ชัดเจน"
                }
            ]
        },
        {
            category: "การติดตามสถานะ",
            icon: "🔍",
            questions: [
                {
                    q: "จะรู้ได้อย่างไรว่ารายงานของฉันถูกรับแล้ว?",
                    a: "หลังจากส่งรายงาน คุณจะได้รับเลขที่รายงาน (เช่น REP-2026-001) ทันที ซึ่งแสดงว่าระบบได้รับรายงานของคุณแล้ว"
                },
                {
                    q: "เจ้าหน้าที่จะติดต่อกลับภายในเวลาเท่าไหร่?",
                    a: "เจ้าหน้าที่จะตรวจสอบและติดต่อกลับภายใน 30 นาที สำหรับกรณีฉุกเฉินจะได้รับการติดต่อเร็วกว่านี้"
                },
                {
                    q: "สามารถตรวจสอบสถานะรายงานได้อย่างไร?",
                    a: "ปัจจุบันสามารถติดต่อสอบถามผ่านเบอร์ 074-711-555 พร้อมแจ้งเลขที่รายงาน (ระบบตรวจสอบออนไลน์กำลังพัฒนา)"
                }
            ]
        },
        {
            category: "ความปลอดภัยและความเป็นส่วนตัว",
            icon: "🔒",
            questions: [
                {
                    q: "ข้อมูลของฉันปลอดภัยหรือไม่?",
                    a: "ปลอดภัยครับ ข้อมูลทั้งหมดถูกเข้ารหัสและเก็บไว้อย่างปลอดภัย จะใช้เฉพาะเพื่อการประสานงานช่วยเหลือเท่านั้น"
                },
                {
                    q: "ใครบ้างที่เห็นรายงานของฉัน?",
                    a: "เฉพาะเจ้าหน้าที่ EOC ที่ได้รับมอบหมายเท่านั้นที่สามารถเข้าถึงข้อมูลส่วนตัวของคุณได้ ข้อมูลบนแผนที่สาธารณะจะไม่แสดงชื่อและเบอร์โทรศัพท์"
                },
                {
                    q: "สามารถลบรายงานที่แจ้งไปแล้วได้หรือไม่?",
                    a: "หากต้องการลบหรือแก้ไขรายงาน กรุณาติดต่อเจ้าหน้าที่ที่ 074-711-555 พร้อมแจ้งเลขที่รายงาน"
                }
            ]
        },
        {
            category: "ปัญหาทางเทคนิค",
            icon: "⚙️",
            questions: [
                {
                    q: "ทำไมแผนที่ไม่แสดงตำแหน่งของฉัน?",
                    a: "กรุณาตรวจสอบว่าได้เปิด Location Services (GPS) ในเบราว์เซอร์แล้ว หากยังไม่ได้ผล ให้กรอกที่อยู่ด้วยตนเอง"
                },
                {
                    q: "อัพโหลดรูปภาพไม่ได้ ต้องทำอย่างไร?",
                    a: "ตรวจสอบว่ารูปภาพมีขนาดไม่เกิน 5MB และเป็นไฟล์ .jpg, .jpeg หรือ .png หากยังไม่ได้ ลองเปลี่ยนรูปภาพหรือถ่ายรูปใหม่"
                },
                {
                    q: "ระบบช้า หรือโหลดไม่ขึ้น",
                    a: "ลองรีเฟรชหน้าเว็บ (F5) หรือเคลียร์ cache ของเบราว์เซอร์ หากยังไม่ได้ผล ลองใช้เบราว์เซอร์อื่น (Chrome, Safari, Firefox)"
                },
                {
                    q: "สามารถใช้งานบนมือถือได้หรือไม่?",
                    a: "ได้ครับ ระบบรองรับทั้ง iOS และ Android สามารถใช้งานผ่านเว็บเบราว์เซอร์บนมือถือได้เลย"
                }
            ]
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
                        ❓ คำถามที่พบบ่อย (FAQ)
                    </h1>
                    <p className="text-xl text-gray-600">
                        คำตอบสำหรับคำถามที่ผู้ใช้งานถามบ่อยที่สุด
                    </p>
                </div>

                {/* FAQ Categories */}
                <div className="space-y-8">
                    {faqs.map((category, catIndex) => (
                        <div key={catIndex} className="bg-white rounded-xl shadow-md p-6">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-gray-100">
                                <span className="text-4xl">{category.icon}</span>
                                <h2 className="text-2xl font-bold text-gray-800">
                                    {category.category}
                                </h2>
                            </div>

                            <div className="space-y-6">
                                {category.questions.map((faq, qIndex) => (
                                    <div key={qIndex} className="border-l-4 border-green-500 pl-4">
                                        <h3 className="font-bold text-gray-800 mb-2 text-lg">
                                            {faq.q}
                                        </h3>
                                        <p className="text-gray-600 leading-relaxed">
                                            {faq.a}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Still Have Questions */}
                <div className="mt-12 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-8 text-center">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">
                        ยังมีคำถามอื่นอีกหรือไม่?
                    </h2>
                    <p className="text-gray-600 mb-6">
                        หากคุณไม่พบคำตอบที่ต้องการ กรุณาติดต่อเราได้ตลอด 24 ชั่วโมง
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
