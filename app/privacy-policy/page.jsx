'use client';

import EOCLayout from '@/components/layouts/EOCLayout';

export default function PrivacyPolicyPage() {
    return (
        <EOCLayout>
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl p-8 mb-8 shadow-xl">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="text-6xl">🔒</div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold">นโยบายความเป็นส่วนตัว</h1>
                            <p className="text-blue-100 mt-2">Personal Data Protection Act (PDPA)</p>
                        </div>
                    </div>
                    <p className="text-blue-100">
                        ระบบศูนย์ปฏิบัติการฉุกเฉิน (EOC) จังหวัดสตูล
                    </p>
                </div>

                {/* Content */}
                <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 space-y-8">
                    {/* Introduction */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span>📌</span> บทนำ
                        </h2>
                        <p className="text-gray-700 leading-relaxed">
                            ศูนย์ปฏิบัติการฉุกเฉิน จังหวัดสตูล (Satun Provincial Emergency Operations Centers (Satun Geo-EOC))
                            ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของท่านตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
                            นโยบายนี้อธิบายวิธีการที่เราเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของท่าน
                        </p>
                    </section>

                    {/* Data Collection */}
                    <section className="bg-blue-50 rounded-lg p-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span>📋</span> ข้อมูลที่เราเก็บรวบรวม
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-gray-800 mb-2">1. ข้อมูลส่วนบุคคล</h3>
                                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                                    <li>ชื่อ-นามสกุล</li>
                                    <li>เบอร์โทรศัพท์</li>
                                    <li>ที่อยู่ (หมู่บ้าน ตำบล อำเภอ)</li>
                                    <li>พิกัดทางภูมิศาสตร์ (GPS Coordinates)</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800 mb-2">2. ข้อมูลเหตุการณ์</h3>
                                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                                    <li>รายละเอียดเหตุการณ์ที่แจ้ง</li>
                                    <li>รูปภาพประกอบ</li>
                                    <li>วันเวลาที่เกิดเหตุ</li>
                                    <li>ระดับความเร่งด่วน</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800 mb-2">3. ข้อมูลการใช้งาน</h3>
                                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                                    <li>IP Address</li>
                                    <li>ประเภทและเวอร์ชันของเบราว์เซอร์</li>
                                    <li>Cookies และ Local Storage</li>
                                    <li>ประวัติการเข้าใช้งานระบบ</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* Purpose */}
                    <section className="bg-green-50 rounded-lg p-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span>✅</span> วัตถุประสงค์การใช้ข้อมูล
                        </h2>
                        <ul className="list-decimal list-inside space-y-2 text-gray-700">
                            <li>เพื่อติดต่อและให้ความช่วยเหลือในกรณีฉุกเฉิน</li>
                            <li>เพื่อประมวลผลและวิเคราะห์สถานการณ์ภัยพิบัติ</li>
                            <li>เพื่อจัดทำรายงานและสถิติเหตุการณ์</li>
                            <li>เพื่อปรับปรุงและพัฒนาระบบให้มีประสิทธิภาพ</li>
                            <li>เพื่อรายงานข้อมูลต่อหน่วยงานที่เกี่ยวข้อง</li>
                            <li>เพื่อปฏิบัติตามกฎหมายและระเบียบที่เกี่ยวข้อง</li>
                        </ul>
                    </section>

                    {/* Data Sharing */}
                    <section className="bg-orange-50 rounded-lg p-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span>🔄</span> การเปิดเผยข้อมูล
                        </h2>
                        <p className="text-gray-700 mb-4">
                            เราอาจเปิดเผยข้อมูลส่วนบุคคลของท่านให้แก่:
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                            <li>หน่วยงานราชการที่เกี่ยวข้องในการจัดการภัยพิบัติ</li>
                            <li>หน่วยกู้ชีพและหน่วยงานฉุกเฉิน</li>
                            <li>โรงพยาบาลและสถานพยาบาล</li>
                            <li>องค์กรปกครองส่วนท้องถิ่น</li>
                        </ul>
                        <p className="text-gray-700 mt-4">
                            <strong>หมายเหตุ:</strong> การเปิดเผยข้อมูลจะกระทำเฉพาะเท่าที่จำเป็นและเป็นไปตามกฎหมาย
                        </p>
                    </section>

                    {/* Security */}
                    <section className="bg-teal-50 rounded-lg p-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span>🔐</span> การรักษาความปลอดภัย
                        </h2>
                        <p className="text-gray-700 mb-4">
                            เราใช้มาตรการรักษาความปลอดภัยที่เหมาะสม ได้แก่:
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                            <li>การเข้ารหัสข้อมูล (Encryption)</li>
                            <li>การควบคุมการเข้าถึงข้อมูล (Access Control)</li>
                            <li>การสำรองข้อมูล (Backup) อย่างสม่ำเสมอ</li>
                            <li>การตรวจสอบและบันทึกการเข้าถึงระบบ (Audit Log)</li>
                            <li>การอบรมเจ้าหน้าที่เกี่ยวกับการคุ้มครองข้อมูล</li>
                        </ul>
                    </section>

                    {/* Data Retention */}
                    <section className="bg-yellow-50 rounded-lg p-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span>⏱️</span> ระยะเวลาเก็บรักษาข้อมูล
                        </h2>
                        <p className="text-gray-700">
                            เราจะเก็บรักษาข้อมูลส่วนบุคคลของท่านไว้เป็นระยะเวลา <strong>5 ปี</strong> นับจากวันที่เก็บรวบรวม
                            หรือตามระยะเวลาที่กฎหมายกำหนด หลังจากนั้นข้อมูลจะถูกลบหรือทำลายอย่างปลอดภัย
                        </p>
                    </section>

                    {/* User Rights */}
                    <section className="bg-sky-50 rounded-lg p-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span>👤</span> สิทธิของเจ้าของข้อมูล
                        </h2>
                        <p className="text-gray-700 mb-4">
                            ท่านมีสิทธิตามกฎหมายดังต่อไปนี้:
                        </p>
                        <div className="space-y-3">
                            <div className="flex gap-3">
                                <span className="text-blue-600 font-bold">1.</span>
                                <div>
                                    <strong className="text-gray-800">สิทธิในการเข้าถึงข้อมูล</strong>
                                    <p className="text-gray-700 text-sm">ขอเข้าถึงและขอรับสำเนาข้อมูลส่วนบุคคล</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <span className="text-blue-600 font-bold">2.</span>
                                <div>
                                    <strong className="text-gray-800">สิทธิในการแก้ไขข้อมูล</strong>
                                    <p className="text-gray-700 text-sm">ขอให้แก้ไขข้อมูลที่ไม่ถูกต้องหรือไม่สมบูรณ์</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <span className="text-blue-600 font-bold">3.</span>
                                <div>
                                    <strong className="text-gray-800">สิทธิในการลบข้อมูล</strong>
                                    <p className="text-gray-700 text-sm">ขอให้ลบข้อมูลส่วนบุคคล</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <span className="text-blue-600 font-bold">4.</span>
                                <div>
                                    <strong className="text-gray-800">สิทธิในการระงับการใช้ข้อมูล</strong>
                                    <p className="text-gray-700 text-sm">ขอให้ระงับการใช้ข้อมูลชั่วคราว</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <span className="text-blue-600 font-bold">5.</span>
                                <div>
                                    <strong className="text-gray-800">สิทธิในการคัดค้าน</strong>
                                    <p className="text-gray-700 text-sm">คัดค้านการประมวลผลข้อมูล</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <span className="text-blue-600 font-bold">6.</span>
                                <div>
                                    <strong className="text-gray-800">สิทธิในการถอนความยินยอม</strong>
                                    <p className="text-gray-700 text-sm">ถอนความยินยอมได้ตลอดเวลา</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Contact */}
                    <section className="bg-gray-50 rounded-lg p-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span>📞</span> ติดต่อเรา
                        </h2>
                        <p className="text-gray-700 mb-4">
                            หากท่านมีคำถามหรือต้องการใช้สิทธิของท่าน กรุณาติดต่อ:
                        </p>
                        <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                            <p className="font-bold text-gray-800 mb-2">ศูนย์ปฏิบัติการฉุกเฉิน (EOC) จังหวัดสตูล</p>
                            <p className="text-gray-700">📍 ศาลากลางจังหวัดสตูล</p>
                            <p className="text-gray-700">📞 โทรศัพท์: 074-711-501</p>
                            <p className="text-gray-700">📧 อีเมล: eoc@satun.go.th</p>
                            <p className="text-gray-700">🕐 เวลาทำการ: จันทร์-ศุกร์ 08:30-16:30 น.</p>
                        </div>
                    </section>

                    {/* Updates */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span>🔄</span> การปรับปรุงนโยบาย
                        </h2>
                        <p className="text-gray-700">
                            เราอาจปรับปรุงนโยบายความเป็นส่วนตัวนี้เป็นครั้งคราว
                            การเปลี่ยนแปลงที่สำคัญจะแจ้งให้ท่านทราบผ่านทางเว็บไซต์หรือช่องทางอื่นที่เหมาะสม
                        </p>
                        <p className="text-sm text-gray-500 mt-4">
                            <strong>วันที่มีผลบังคับใช้:</strong> 1 มกราคม พ.ศ. 2567<br />
                            <strong>ปรับปรุงล่าสุด:</strong> 16 มกราคม พ.ศ. 2569
                        </p>
                    </section>
                </div>
            </div>
        </EOCLayout>
    );
}
