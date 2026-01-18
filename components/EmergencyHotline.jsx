"use client";
import Link from 'next/link';

export default function EmergencyHotline() {
    return (
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white py-4 px-6 rounded-xl shadow-2xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                        <span className="text-4xl">📞</span>
                    </div>
                    <div>
                        <p className="font-bold text-xl mb-1">สายด่วนฉุกเฉิน EOC</p>
                        <p className="text-sm opacity-90">โทรได้ตลอด 24 ชั่วโมง ทุกวัน</p>
                    </div>
                </div>
                <a
                    href="tel:074-711-555"
                    className="bg-white text-red-600 px-8 py-4 rounded-lg font-bold text-2xl hover:bg-gray-100 transition-all hover:scale-105 shadow-lg"
                >
                    074-711-555
                </a>
            </div>
        </div>
    );
}
