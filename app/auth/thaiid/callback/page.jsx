"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function ThaiIDCallbackPage() {
    const router = useRouter();
    const { setUser } = useAuth();
    const [status, setStatus] = useState('processing'); // processing, success, error

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // ดึงข้อมูล session จาก cookie ผ่าน API
                const response = await fetch('/stn-eoc/api/auth/session/');
                const data = await response.json();

                if (data.success && data.user) {
                    // เซ็ต user ใน AuthContext
                    setUser(data.user);
                    setStatus('success');

                    // ตรวจสอบสถานะการอนุมัติ
                    if (data.user.isApproved === false) {
                        // ถ้ายังไม่ได้รับการอนุมัติ -> ไปหน้า pending
                        setTimeout(() => {
                            router.push('/auth/thaiid/pending');
                        }, 1000);
                    } else if (data.user.isNewUser) {
                        // ถ้าเป็น user ใหม่ -> ไปหน้ากรอกข้อมูล
                        setTimeout(() => {
                            router.push('/auth/thaiid/registration');
                        }, 1000);
                    } else {
                        // ถ้าปกติ -> ไป dashboard
                        setTimeout(() => {
                            router.push('/dashboard');
                        }, 1000);
                    }
                } else {
                    setStatus('error');
                }
            } catch (error) {
                console.error('Callback processing error:', error);
                setStatus('error');
            }
        };

        handleCallback();
    }, [router, setUser]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
                {status === 'processing' && (
                    <>
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="animate-spin h-10 w-10 text-green-700" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">กำลังเข้าสู่ระบบ...</h2>
                        <p className="text-gray-600">กรุณารอสักครู่</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="h-10 w-10 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-green-700 mb-2">เข้าสู่ระบบสำเร็จ!</h2>
                        <p className="text-gray-600">กำลังนำคุณไปยังหน้าหลัก...</p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="h-10 w-10 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-red-700 mb-2">เกิดข้อผิดพลาด</h2>
                        <p className="text-gray-600 mb-4">ไม่สามารถเข้าสู่ระบบได้</p>
                        <button
                            onClick={() => router.push('/login')}
                            className="bg-green-700 hover:bg-green-800 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                        >
                            กลับไปหน้า Login
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
