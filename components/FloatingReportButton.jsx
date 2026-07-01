"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function FloatingReportButton() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Show button after page loads
        const timer = setTimeout(() => setIsVisible(true), 1000);
        return () => clearTimeout(timer);
    }, []);

    if (!isVisible) return null;

    return (
        <Link
            href="/public/report-incident"
            className="fixed bottom-6 right-6 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-4 rounded-full shadow-2xl hover:shadow-3xl transition-all hover:scale-110 z-50 animate-float-soft"
        >
            <div className="flex items-center gap-3">
                <span className="text-3xl">🚨</span>
                <div className="hidden md:block">
                    <p className="font-bold text-lg">แจ้งเหตุด่วน</p>
                    <p className="text-xs opacity-90">คลิกเพื่อรายงาน</p>
                </div>
            </div>
        </Link>
    );
}
