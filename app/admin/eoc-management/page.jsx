"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useEOC } from "@/context/EOCContext";
import EOCLayout from "@/components/layouts/EOCLayout";

export default function EOCManagementPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { eocStatus, toggleEOC, getEOCDisplayName, refreshStatus } = useEOC();
    const [updating, setUpdating] = useState({});
    const [descriptions, setDescriptions] = useState({});
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'admin')) {
            router.push("/dashboard");
        }
    }, [user, authLoading, router]);

    const eocTypes = ['flood', 'drought', 'tsunami', 'earthquake', 'disease'];

    const handleToggle = async (eocType) => {
        setUpdating(prev => ({ ...prev, [eocType]: true }));
        setMessage({ type: '', text: '' });

        const currentStatus = eocStatus[eocType]?.is_active || false;
        const newStatus = !currentStatus;

        try {
            const result = await toggleEOC(
                eocType,
                newStatus,
                descriptions[eocType] || ''
            );

            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                setDescriptions(prev => ({ ...prev, [eocType]: '' }));
                await refreshStatus();
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setUpdating(prev => ({ ...prev, [eocType]: false }));
        }
    };

    const getStatusBadge = (isActive) => {
        if (isActive) {
            return (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    เปิดใช้งาน
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                ปิดใช้งาน
            </span>
        );
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">กำลังโหลด...</p>
                </div>
            </div>
        );
    }

    if (!user || user.role !== 'admin') {
        return null;
    }

    return (
        <EOCLayout>
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">จัดการศูนย์ EOC</h1>
                        <p className="text-gray-600">เปิด/ปิดการทำงานของศูนย์ EOC แต่ละประเภท</p>
                    </div>
                    <Link
                        href="/admin/eoc-sessions"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        ดูประวัติ EOC
                    </Link>
                </div>

                {/* Message */}
                {message.text && (
                    <div className={`mb-6 p-4 rounded-lg ${message.type === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* EOC Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {eocTypes.map(eocType => {
                        const status = eocStatus[eocType] || {};
                        const isActive = status.is_active || false;

                        return (
                            <div key={eocType} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-xl font-semibold text-gray-800">
                                            EOC {getEOCDisplayName(eocType)}
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {status.description || 'ไม่มีรายละเอียด'}
                                        </p>
                                    </div>
                                    {getStatusBadge(isActive)}
                                </div>

                                {/* Details */}
                                {isActive && status.activated_at && (
                                    <div className="bg-green-50 rounded-md p-3 mb-4 text-sm">
                                        <p className="text-gray-700">
                                            <span className="font-medium">เปิดเมื่อ:</span>{' '}
                                            {new Date(status.activated_at).toLocaleString('th-TH')}
                                        </p>
                                        {status.activated_by_name && (
                                            <p className="text-gray-700 mt-1">
                                                <span className="font-medium">โดย:</span>{' '}
                                                {status.activated_by_name}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {!isActive && status.deactivated_at && (
                                    <div className="bg-gray-50 rounded-md p-3 mb-4 text-sm">
                                        <p className="text-gray-700">
                                            <span className="font-medium">ปิดเมื่อ:</span>{' '}
                                            {new Date(status.deactivated_at).toLocaleString('th-TH')}
                                        </p>
                                        {status.deactivated_by_name && (
                                            <p className="text-gray-700 mt-1">
                                                <span className="font-medium">โดย:</span>{' '}
                                                {status.deactivated_by_name}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Description Input */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        รายละเอียด/เหตุผล
                                    </label>
                                    <textarea
                                        value={descriptions[eocType] || ''}
                                        onChange={(e) => setDescriptions(prev => ({
                                            ...prev,
                                            [eocType]: e.target.value
                                        }))}
                                        placeholder={`ระบุรายละเอียดหรือเหตุผลในการ${isActive ? 'ปิด' : 'เปิด'} EOC`}
                                        rows={2}
                                        className=" text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>

                                {/* Toggle Button */}
                                <button
                                    onClick={() => handleToggle(eocType)}
                                    disabled={updating[eocType]}
                                    className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${isActive
                                        ? 'bg-red-600 text-white hover:bg-red-700'
                                        : 'bg-green-600 text-white hover:bg-green-700'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {updating[eocType] ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            กำลังดำเนินการ...
                                        </span>
                                    ) : (
                                        isActive ? '🔴 ปิด EOC' : '🟢 เปิด EOC'
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Active EOCs Summary */}
                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-blue-900 mb-3">
                        📊 สรุป EOC ที่เปิดใช้งาน
                    </h3>
                    <div className="space-y-2">
                        {eocTypes.filter(type => eocStatus[type]?.is_active).length > 0 ? (
                            eocTypes
                                .filter(type => eocStatus[type]?.is_active)
                                .map(type => (
                                    <div key={type} className="flex items-center gap-2 text-blue-800">
                                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                        <span className="font-medium">EOC {getEOCDisplayName(type)}</span>
                                        <span className="text-sm text-blue-600">
                                            (เปิดเมื่อ: {new Date(eocStatus[type].activated_at).toLocaleString('th-TH')})
                                        </span>
                                    </div>
                                ))
                        ) : (
                            <p className="text-blue-700">ไม่มี EOC ที่เปิดใช้งานในขณะนี้</p>
                        )}
                    </div>
                </div>
            </div>
        </EOCLayout>
    );
}
