"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function PendingApprovalPage() {
    const router = useRouter();
    const { user, logout } = useAuth();

    useEffect(() => {
        // ถ้า approved แล้ว redirect ไป dashboard
        if (user && user.isApproved) {
            router.push('/dashboard');
        }
    }, [user, router]);

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
                <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="h-10 w-10 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>

                <h2 className="text-2xl font-bold text-gray-800 mb-4">รอการอนุมัติ</h2>

                <div className="text-left bg-gray-50 rounded-lg p-4 mb-6">
                    <p className="text-gray-700 mb-2">
                        <span className="font-semibold">ชื่อ:</span> {user?.thaiIdData?.name || user?.fullName}
                    </p>
                    <p className="text-gray-700 mb-2">
                        <span className="font-semibold">ตำแหน่ง:</span> {user?.position || '-'}
                    </p>
                    <p className="text-gray-700 mb-2">
                        <span className="font-semibold">หน่วยงาน:</span> {user?.department || '-'}
                    </p>
                    <p className="text-gray-700">
                        <span className="font-semibold">สิทธิ์ที่ขอ:</span> {user?.requested_role || '-'}
                    </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <p className="text-yellow-800 text-sm">
                        ⏳ คำขอของคุณอยู่ระหว่างการพิจารณาจากผู้ดูแลระบบ
                    </p>
                    <p className="text-yellow-700 text-sm mt-2">
                        คุณจะได้รับการแจ้งเตือนทางอีเมลเมื่อได้รับการอนุมัติ
                    </p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => router.push('/auth/thaiid/registration')}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                        แก้ไขข้อมูล
                    </button>

                    <button
                        onClick={handleLogout}
                        className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                        ออกจากระบบ
                    </button>
                </div>

                <div className="mt-6 text-sm text-gray-600">
                    <p>หากมีข้อสงสัย กรุณาติดต่อ:</p>
                    <p className="font-semibold text-green-700">admin@eoc.satun.go.th</p>
                </div>
            </div>
        </div>
    );
}
