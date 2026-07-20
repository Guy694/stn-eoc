"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppIcon from "@/components/icons/AppIcon";

export default function ThaiDRegistrationPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [initialLoad, setInitialLoad] = useState(true);

    const [formData, setFormData] = useState({
        title: '',
        given_name: '',
        family_name: '',
        position: '',
        department: '',
        requested_role: 'staff',
        phone: '',
        email: ''
    });

    useEffect(() => {
        // รอ auth loading เสร็จ
        if (!authLoading) {
            setInitialLoad(false);
            // ถ้า user approved แล้ว redirect ไป dashboard
            if (user && user.isApproved) {
                router.push('/dashboard');
            } else if (!user) {
                // ถ้าไม่มี user ให้กลับไป login
                router.push('/login');
            } else if (user) {
                // Prefill ข้อมูลถ้ามี
                setFormData(prev => ({
                    ...prev,
                    title: user.title || user.thaiIdData?.title || '',
                    given_name: user.givenName || user.thaiIdData?.given_name || '',
                    family_name: user.familyName || user.thaiIdData?.family_name || '',
                    position: user.position || '',
                    department: user.department || '',
                    requested_role: user.requested_role || 'staff',
                    phone: user.phone || '',
                    email: user.email || ''
                }));
            }
        }
    }, [user, authLoading, router]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/stn-eoc/api/auth/thaiid/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                // Redirect ไปหน้ารอการอนุมัติ
                router.push('/auth/thaiid/pending');
            } else {
                setError(data.message || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Registration error:', error);
            setError('เกิดข้อผิดพลาดในการส่งข้อมูล');
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || initialLoad) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b border-green-700 mx-auto"></div>
                <p className="mt-4 text-gray-600">กำลังตรวจสอบข้อมูล...</p>
            </div>
        </div>;
    }

    if (!user) {
        return null; // จะ redirect ไป login อยู่แล้วใน useEffect
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 py-12 px-4">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg shadow-xl p-8">
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AppIcon icon="user" className="h-10 w-10 text-green-700" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">ยินดีต้อนรับ</h1>
                        <p className="text-xl text-green-700 mb-2">
                            {user.givenName || user.thaiIdData?.given_name || user.username}
                        </p>
                        <p className="text-gray-600">กรุณากรอกข้อมูลเพื่อขอสิทธิ์เข้าใช้งานระบบ</p>
                    </div>

                    {error && (
                        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* คำนำหน้า */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2">
                                คำนำหน้า
                            </label>
                            <select
                                className="text-gray-600 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            >
                                <option value="">ไม่ระบุ</option>
                                <option value="นาย">นาย</option>
                                <option value="นาง">นาง</option>
                                <option value="นางสาว">นางสาว</option>
                                <option value="ดร.">ดร.</option>
                                <option value="ผศ.ดร.">ผศ.ดร.</option>
                                <option value="รศ.ดร.">รศ.ดร.</option>
                                <option value="ศ.ดร.">ศ.ดร.</option>
                            </select>
                        </div>

                        {/* ชื่อ */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2">
                                ชื่อ <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                className="text-gray-600 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="เช่น สมชาย"
                                value={formData.given_name}
                                onChange={(e) => setFormData({ ...formData, given_name: e.target.value })}
                            />
                        </div>

                        {/* นามสกุล */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2">
                                นามสกุล <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                className="text-gray-600 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="เช่น ใจดี"
                                value={formData.family_name}
                                onChange={(e) => setFormData({ ...formData, family_name: e.target.value })}
                            />
                        </div>

                        {/* ตำแหน่งที่ปฏิบัติงาน */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2">
                                ตำแหน่งที่ปฏิบัติงาน <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                className="text-gray-600 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="เช่น นักวิชาการสาธารณสุข"
                                value={formData.position}
                                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                            />
                        </div>

                        {/* หน่วยงาน */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2">
                                หน่วยงาน <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                className="text-gray-600 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="เช่น สำนักงานสาธารณสุขจังหวัดสตูล"
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                            />
                        </div>

                        {/* สิทธิ์ที่ต้องการ */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2">
                                สิทธิ์การเข้าใช้งานที่ต้องการ <span className="text-red-500">*</span>
                            </label>
                            <select
                                required
                                className="text-gray-600 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                value={formData.requested_role}
                                onChange={(e) => setFormData({ ...formData, requested_role: e.target.value })}
                            >
                                <option value="staff">เจ้าหน้าที่ทั่วไป (Staff)</option>
                                <option value="SeRHT">ทีม SeRHT</option>
                                <option value="SAT">ทีม SAT</option>
                                <option value="MCATT">ทีม MCATT</option>
                            </select>
                            <p className="mt-2 text-sm text-gray-600">
                                หมายเหตุ: สิทธิ์ผู้ดูแลระบบต้องติดต่อขออนุมัติโดยตรง
                            </p>
                        </div>

                        {/* เบอร์โทรศัพท์ */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2">
                                เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="tel"
                                required
                                className="text-gray-600 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="เช่น 074-123456"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>

                        {/* อีเมล */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2">
                                อีเมล <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="email"
                                required
                                className="text-gray-600 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="เช่น example@satun.go.th"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        {/* ปุ่มส่ง */}
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {loading ? 'กำลังส่งข้อมูล...' : 'ส่งคำขอเข้าใช้งาน'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-600">
                        <p>ข้อมูลของคุณจะถูกส่งไปยังผู้ดูแลระบบเพื่อพิจารณาอนุมัติ</p>
                        <p className="mt-1">คุณจะได้รับการแจ้งเตือนผ่านอีเมลเมื่อได้รับการอนุมัติ</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
