"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function SplashScreen({ onComplete }) {
    const [isVisible, setIsVisible] = useState(true);
    const [isAnimating, setIsAnimating] = useState(true);

    useEffect(() => {
        // แสดง splash screen 2.5 วินาที
        const timer = setTimeout(() => {
            setIsAnimating(false);
            setTimeout(() => {
                setIsVisible(false);
                if (onComplete) onComplete();
            }, 500);
        }, 2500);

        return () => clearTimeout(timer);
    }, [onComplete]);

    if (!isVisible) return null;

    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-green-700 via-green-600 to-green-800 transition-opacity duration-500 ${isAnimating ? 'opacity-100' : 'opacity-0'
                }`}
        >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl"></div>
                <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white rounded-full blur-3xl opacity-20"></div>
            </div>

            {/* Main Content */}
            <div className="relative text-center">
                {/* Logo with Animation */}
                <div className="relative mb-8">
                    <div className="w-32 h-32 md:w-40 md:h-40 mx-auto relative animate-bounce-slow">
                        <Image
                            src="/img/eoc-icon.png"
                            alt="EOC Logo"
                            fill
                            className="object-contain drop-shadow-2xl"
                            priority
                        />
                    </div>
                    {/* Pulse Ring */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-40 h-40 md:w-48 md:h-48 rounded-full border-4 border-white/30 animate-ping"></div>
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 drop-shadow-lg animate-fade-in">
                    EOC จังหวัดสตูล
                </h1>
                <p className="text-lg md:text-xl text-green-100 mb-2 animate-fade-in-delay">
                    Emergency Operations Center
                </p>
                <p className="text-sm md:text-base text-green-200 animate-fade-in-delay-2">
                    ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน
                </p>

                {/* Loading Indicator */}
                <div className="mt-10 flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse-dot-1"></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse-dot-2"></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse-dot-3"></div>
                </div>
            </div>
        </div>
    );
}
