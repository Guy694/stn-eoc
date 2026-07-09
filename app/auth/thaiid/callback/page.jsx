"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppIcon from "@/components/icons/AppIcon";

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
                            <AppIcon icon="loader" className="h-10 w-10 animate-spin text-green-700" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">กำลังเข้าสู่ระบบ...</h2>
                        <p className="text-gray-600">กรุณารอสักครู่</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AppIcon icon="checkCircle" className="h-10 w-10 text-green-700" />
                        </div>
                        <h2 className="text-2xl font-bold text-green-700 mb-2">เข้าสู่ระบบสำเร็จ!</h2>
                        <p className="text-gray-600">กำลังนำคุณไปยังหน้าหลัก...</p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AppIcon icon="xCircle" className="h-10 w-10 text-red-700" />
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
