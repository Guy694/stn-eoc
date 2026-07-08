"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function FloatingReportButton() {
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(() => (
        typeof window !== 'undefined' && localStorage.getItem('help_request_floating_hidden') === 'true'
    ));

    useEffect(() => {
        // Show button after page loads
        const timer = setTimeout(() => setIsVisible(true), 1000);
        return () => clearTimeout(timer);
    }, []);

    const hideButton = () => {
        setIsDismissed(true);
        localStorage.setItem('help_request_floating_hidden', 'true');
    };

    if (!isVisible || isDismissed) return null;

    return (
        <div className="fixed bottom-24 left-4 z-[1050] md:bottom-6 md:left-6">
            <button
                type="button"
                onClick={hideButton}
                className="absolute -right-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white bg-slate-800 text-sm font-black leading-none text-white shadow-lg hover:bg-slate-950"
                aria-label="ซ่อนปุ่มแจ้งขอความช่วยเหลือ"
                title="ซ่อนปุ่มแจ้งขอความช่วยเหลือ"
            >
                ×
            </button>
            <Link
                href="/public/report-incident"
                className="block rounded-full bg-red-600 px-4 py-3 text-white shadow-2xl transition hover:scale-105 hover:bg-red-700 md:px-5 md:py-4"
            >
                <div className="flex items-center gap-3">
                    <span className="text-2xl md:text-3xl">🆘</span>
                    <div>
                        <p className="text-sm font-black md:text-base">ขอความช่วยเหลือ</p>
                        <p className="hidden text-xs text-white/90 md:block">แจ้งตำแหน่งให้เจ้าหน้าที่</p>
                    </div>
                </div>
            </Link>
        </div>
    );
}
