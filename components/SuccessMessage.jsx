"use client";
import { useEffect, useState } from 'react';

export default function SuccessMessage({
    title = "สำเร็จ!",
    message,
    referenceNumber,
    nextActions = [],
    onClose,
    autoDismiss = true,
    dismissDelay = 5000
}) {
    const [isVisible, setIsVisible] = useState(true);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        setIsAnimating(true);

        if (autoDismiss && dismissDelay) {
            const timer = setTimeout(() => {
                handleClose();
            }, dismissDelay);
            return () => clearTimeout(timer);
        }
    }, [autoDismiss, dismissDelay]);

    const handleClose = () => {
        setIsAnimating(false);
        setTimeout(() => {
            setIsVisible(false);
            if (onClose) onClose();
        }, 300);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div
                className={`bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all duration-300 ${isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
                    }`}
            >
                {/* Animated Checkmark */}
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-8 text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4 animate-bounce-slow">
                        <svg
                            className="w-12 h-12 text-green-600 animate-draw-check"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
                </div>

                {/* Content */}
                <div className="p-6">
                    {message && (
                        <p className="text-gray-700 text-center mb-4">{message}</p>
                    )}

                    {referenceNumber && (
                        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-4">
                            <p className="text-sm text-gray-600 mb-1">เลขที่รายงาน</p>
                            <p className="text-2xl font-bold text-green-700 font-mono">{referenceNumber}</p>
                            <p className="text-xs text-gray-500 mt-1">กรุณาเก็บเลขนี้ไว้เพื่อตรวจสอบสถานะ</p>
                        </div>
                    )}

                    {nextActions.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm font-semibold text-gray-700 mb-2">ขั้นตอนถัดไป:</p>
                            {nextActions.map((action, index) => (
                                <div key={index} className="flex items-start gap-2">
                                    <span className="text-green-600 mt-0.5">✓</span>
                                    <p className="text-sm text-gray-600">{action}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={handleClose}
                        className="w-full mt-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 hover:shadow-lg"
                    >
                        เข้าใจแล้ว
                    </button>
                </div>
            </div>
        </div>
    );
}
