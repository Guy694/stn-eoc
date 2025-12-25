"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

// Component แยกสำหรับจัดการ error จาก ThaiID callback
function ThaiIDErrorHandler({ setError }) {
    const searchParams = useSearchParams();

    useEffect(() => {
        const errorType = searchParams.get('error');
        const errorMessage = searchParams.get('message');
        const pid = searchParams.get('pid');

        if (errorType) {
            switch (errorType) {
                case 'thaiid_auth_failed':
                    setError(`การยืนยันตัวตนผ่าน ThaiID ล้มเหลว: ${errorMessage || 'ไม่ทราบสาเหตุ'}`);
                    break;
                case 'no_code':
                    setError('ไม่ได้รับ authorization code จาก ThaiID');
                    break;
                case 'no_pid':
                    setError('ไม่สามารถดึงเลขบัตรประชาชนจาก ThaiID ได้');
                    break;
                case 'user_not_found':
                    setError(`ไม่พบผู้ใช้งานที่มีเลขบัตรประชาชน: ${pid || 'ไม่ระบุ'}\nกรุณาติดต่อผู้ดูแลระบบเพื่อลงทะเบียน`);
                    break;
                case 'callback_failed':
                    setError(`เกิดข้อผิดพลาด: ${errorMessage || 'การเข้าสู่ระบบผ่าน ThaiID ล้มเหลว'}`);
                    break;
                default:
                    setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบผ่าน ThaiID');
            }
        }
    }, [searchParams, setError]);

    return null;
}

function LoginForm() {
    const router = useRouter();
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        username: "",
        password: "",
    });
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const result = await login(formData.username, formData.password);

            if (result.success) {
                router.push("/dashboard");
            } else {
                setError(result.message || "เข้าสู่ระบบไม่สำเร็จ");
            }
        } catch (err) {
            setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-linear-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo and Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-green-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <span className="text-white font-bold text-4xl">E</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">เข้าสู่ระบบ EOC</h1>
                    <p className="text-gray-600">ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน จังหวัดสตูล</p>
                </div>

                {/* Login Form */}
                <div className="bg-white rounded-lg shadow-xl p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                <div className="flex items-center gap-2">
                                    <span>⚠️</span>
                                    <span>{error}</span>
                                </div>
                            </div>
                        )}

                        {/* Username */}
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                                ชื่อผู้ใช้
                            </label>
                            <input
                                type="text"
                                id="username"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                placeholder="กรอกชื่อผู้ใช้"
                                required
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                รหัสผ่าน
                            </label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                placeholder="กรอกรหัสผ่าน"
                                required
                            />
                        </div>

                        {/* Remember Me & Forgot Password */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                />
                                <span className="ml-2 text-sm text-gray-600">จดจำฉันไว้</span>
                            </label>
                            <a href="#" className="text-sm text-green-700 hover:text-green-800 font-medium">
                                ลืมรหัสผ่าน?
                            </a>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    กำลังเข้าสู่ระบบ...
                                </span>
                            ) : (
                                "เข้าสู่ระบบ"
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">หรือ</span>
                        </div>
                    </div>

                    {/* ThaiID Login Button */}
                    <button
                        type="button"
                        onClick={() => window.location.href = '/api/auth/thaiid/authorize'}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-3"
                    >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                        </svg>
                        <span>เข้าสู่ระบบด้วย ThaiID</span>
                    </button>

                    {/* Demo Credentials - Updated for Officer Table */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
                        <p className="text-xs text-green-800 font-semibold mb-2">🔑 บัญชีทดสอบ:</p>
                        <div className="space-y-1 text-xs text-green-700">
                            <p><strong>Admin:</strong> admin / password123</p>
                            <p><strong>MCATT:</strong> mcatt01 / password123</p>
                            <p><strong>SAT:</strong> sat01 / password123</p>
                            <p><strong>SeRHT:</strong> serht01 / password123</p>
                            <p><strong>Staff:</strong> staff01 / password123</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 italic">* รหัสผ่านเริ่มต้นสำหรับทุกบัญชี: password123</p>
                    </div>
                </div>

                {/* Public Access Link */}
                <div className="text-center mt-6">
                    <p className="text-gray-600 text-sm mb-2">หรือ</p>
                    <Link
                        href="/public/disaster-map"
                        className="text-green-700 hover:text-green-800 font-medium inline-flex items-center gap-2"
                    >
                        <span>🗺️</span>
                        <span>ดูแผนที่ภัยพิบัติสาธารณะ</span>
                    </Link>
                </div>

                {/* Footer */}
                <div className="text-center mt-8 text-sm text-gray-500">
                    <p>© 2025 EOC จังหวัดสตูล - ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน จังหวัดสตูล</p>
                </div>

                {/* ThaiID Error Handler with Suspense */}
                <Suspense fallback={null}>
                    <ThaiIDErrorHandler setError={setError} />
                </Suspense>
            </div>
        </div>
    );
}

// Main export component
export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-green-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-gray-600">กำลังโหลด...</p>
                </div>
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
