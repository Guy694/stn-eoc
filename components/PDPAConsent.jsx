'use client';

import { useState, useEffect } from 'react';

export default function PDPAConsent() {
    const [showConsent, setShowConsent] = useState(false);

    useEffect(() => {
        // ตรวจสอบว่าผู้ใช้ยอมรับ PDPA แล้วหรือยัง
        const consent = localStorage.getItem('pdpa_consent');
        if (!consent) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setShowConsent(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('pdpa_consent', JSON.stringify({
            accepted: true,
            timestamp: new Date().toISOString()
        }));
        setShowConsent(false);
    };

    const handleDecline = () => {
        // ถ้าไม่ยอมรับ ให้แสดงข้อความและไม่ให้ใช้งานระบบ
        alert('คุณจำเป็นต้องยอมรับนโยบายความเป็นส่วนตัวเพื่อใช้งานระบบ');
    };

    if (!showConsent) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-t-2xl md:rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="p-6 md:p-8">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="text-4xl">🔒</div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">นโยบายความเป็นส่วนตัว</h2>
                            <p className="text-sm text-gray-600">Personal Data Protection Act (PDPA)</p>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="space-y-4 text-gray-700 text-sm md:text-base mb-6">
                        <p className="font-semibold text-blue-900">
                            ระบบศูนย์ปฏิบัติการฉุกเฉิน (EOC) จังหวัดสตูล ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของท่าน
                        </p>

                        <div className="border-t border-gray-200 pt-4">
                            <h3 className="font-bold text-gray-800 mb-2">📋 ข้อมูลที่เราเก็บรวบรวม</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                <li>ชื่อ-นามสกุล และเบอร์โทรศัพท์</li>
                                <li>ที่อยู่และตำแหน่งพิกัด (GPS)</li>
                                <li>รูปภาพและข้อมูลเหตุการณ์ที่แจ้ง</li>
                                <li>ข้อมูลการใช้งานเว็บไซต์ (Cookies)</li>
                            </ul>
                        </div>

                        <div className="border-t border-gray-200 pt-4">
                            <h3 className="font-bold text-gray-800 mb-2">✅ วัตถุประสงค์การใช้ข้อมูล</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                <li>ติดต่อและให้ความช่วยเหลือในกรณีฉุกเฉิน</li>
                                <li>ประมวลผลและวิเคราะห์สถานการณ์ภัยพิบัติ</li>
                                <li>ปรับปรุงและพัฒนาระบบให้มีประสิทธิภาพ</li>
                                <li>รายงานสถิติและข้อมูลต่อหน่วยงานที่เกี่ยวข้อง</li>
                            </ul>
                        </div>

                        <div className="border-t border-gray-200 pt-4">
                            <h3 className="font-bold text-gray-800 mb-2">🔐 การรักษาความปลอดภัย</h3>
                            <p className="text-sm max-w-prose">
                                เราใช้มาตรการรักษาความปลอดภัยที่เหมาะสมเพื่อป้องกันการเข้าถึง การใช้ หรือการเปิดเผยข้อมูลโดยไม่ได้รับอนุญาต
                                ข้อมูลของท่านจะถูกเก็บไว้เฉพาะระยะเวลาที่จำเป็นตามวัตถุประสงค์
                            </p>
                        </div>

                        <div className="border-t border-gray-200 pt-4">
                            <h3 className="font-bold text-gray-800 mb-2">👤 สิทธิของเจ้าของข้อมูล</h3>
                            <p className="text-sm mb-2">ท่านมีสิทธิ์:</p>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                <li>เข้าถึงและขอสำเนาข้อมูลส่วนบุคคล</li>
                                <li>แก้ไขข้อมูลที่ไม่ถูกต้อง</li>
                                <li>ลบหรือระงับการใช้ข้อมูล</li>
                                <li>คัดค้านการประมวลผลข้อมูล</li>
                                <li>ถอนความยินยอมได้ตลอดเวลา</li>
                            </ul>
                        </div>

                        <div className="border-t border-gray-200 pt-4">
                            <h3 className="font-bold text-gray-800 mb-2">📞 ติดต่อเรา</h3>
                            <p className="text-sm max-w-prose">
                                หากมีข้อสงสัยเกี่ยวกับนโยบายนี้ กรุณาติดต่อ:<br />
                                <strong>ศูนย์ปฏิบัติการฉุกเฉิน (EOC) จังหวัดสตูล</strong><br />
                                โทร: 074-711-501<br />
                                อีเมล: eoc@satun.go.th
                            </p>
                        </div>

                        <p className="text-xs text-gray-500 italic max-w-prose">
                            นโยบายนี้มีผลบังคับใช้ตั้งแต่วันที่ 1 มกราคม 2567 และอาจมีการปรับปรุงเป็นครั้งคราว
                        </p>
                    </div>

                    {/* Consent Checkbox */}
                    <div className="border-t border-yellow-300 pt-4 mb-6">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                id="pdpa-accept"
                                className="mt-1 w-5 h-5 text-blue-600 rounded"
                            />
                            <span className="text-sm text-gray-700">
                                ข้าพเจ้ายอมรับและเข้าใจนโยบายความเป็นส่วนตัวนี้ และยินยอมให้ระบบ EOC
                                เก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของข้าพเจ้าตามวัตถุประสงค์ที่ระบุไว้
                            </span>
                        </label>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col md:flex-row gap-3">
                        <button
                            onClick={handleDecline}
                            className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                        >
                            ไม่ยอมรับ
                        </button>
                        <button
                            onClick={() => {
                                const checkbox = document.getElementById('pdpa-accept');
                                if (checkbox && checkbox.checked) {
                                    handleAccept();
                                } else {
                                    alert('กรุณาทำเครื่องหมายยอมรับนโยบายความเป็นส่วนตัว');
                                }
                            }}
                            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg"
                        >
                            ยอมรับและดำเนินการต่อ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
