"use client";
import { useState } from 'react';
import AppIcon from './icons/AppIcon';

export default function ErrorMessage({
    title = "เกิดข้อผิดพลาด",
    message,
    technicalDetails,
    onRetry,
    onClose,
    showSupport = true
}) {
    const [showDetails, setShowDetails] = useState(false);

    const supportContact = {
        phone: "074-711-555",
        line: "@satun-eoc"
    };

    return (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 shadow-md">
            <div className="flex items-start gap-4">
                {/* Error Icon */}
                <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <AppIcon icon="alertCircle" className="h-6 w-6 text-red-600" />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-red-800 mb-2">{title}</h3>
                    <p className="text-red-700 mb-4">{message}</p>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3">
                        {onRetry && (
                            <button
                                onClick={onRetry}
                                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2"
                            >
                                <AppIcon icon="refresh" className="h-4 w-4" />
                                ลองอีกครั้ง
                            </button>
                        )}

                        {onClose && (
                            <button
                                onClick={onClose}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                            >
                                ปิด
                            </button>
                        )}
                    </div>

                    {/* Support Contact */}
                    {showSupport && (
                        <div className="mt-4 pt-4 border-t border-red-200">
                            <p className="text-sm text-red-700 mb-2">หากปัญหายังคงอยู่ กรุณาติดต่อ:</p>
                            <div className="flex flex-wrap gap-4 text-sm">
                                <a
                                    href={`tel:${supportContact.phone}`}
                                    className="text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                                >
                                    <AppIcon icon="phone" className="h-4 w-4" />
                                    {supportContact.phone}
                                </a>
                                <a
                                    href={`https://line.me/R/ti/p/${supportContact.line}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                                >
                                    <AppIcon icon="message" className="h-4 w-4" />
                                    LINE: {supportContact.line}
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Technical Details (Collapsible) */}
                    {technicalDetails && (
                        <div className="mt-4">
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="text-sm text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                            >
                                {showDetails ? '▼' : "circlePlay"} รายละเอียดทางเทคนิค
                            </button>
                            {showDetails && (
                                <div className="mt-2 bg-red-100 rounded p-3">
                                    <code className="text-xs text-red-800 font-mono break-all">
                                        {technicalDetails}
                                    </code>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper function to get friendly error messages
export function getFriendlyErrorMessage(error) {
    const errorMessages = {
        'Network Error': {
            title: 'ไม่สามารถเชื่อมต่อได้',
            message: 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตของคุณและลองอีกครั้ง'
        },
        'timeout': {
            title: 'หมดเวลาการเชื่อมต่อ',
            message: 'การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองอีกครั้ง'
        },
        '404': {
            title: 'ไม่พบข้อมูล',
            message: 'ไม่พบข้อมูลที่คุณต้องการ กรุณาตรวจสอบและลองอีกครั้ง'
        },
        '500': {
            title: 'เกิดข้อผิดพลาดของระบบ',
            message: 'ระบบมีปัญหาชั่วคราว กรุณาลองอีกครั้งในอีกสักครู่'
        },
        'validation': {
            title: 'ข้อมูลไม่ถูกต้อง',
            message: 'กรุณาตรวจสอบข้อมูลที่กรอกและลองอีกครั้ง'
        },
        'default': {
            title: 'เกิดข้อผิดพลาด',
            message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองอีกครั้ง'
        }
    };

    const errorString = error?.toString() || '';

    for (const [key, value] of Object.entries(errorMessages)) {
        if (errorString.includes(key)) {
            return value;
        }
    }

    return errorMessages.default;
}
