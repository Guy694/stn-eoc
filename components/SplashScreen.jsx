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
            className={`fixed inset-0 z-[9999] flex items-center justify-center bg-green-950 transition-opacity duration-500 ${isAnimating ? 'opacity-100' : 'opacity-0'
                }`}
        >
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-black/20">
                <div className="absolute inset-x-0 top-0 h-px bg-white/20"></div>
            </div>

            {/* Main Content */}
            <div className="relative text-center">
                {/* Logo with Animation */}
                <div className="relative mb-8">
                    <div className="w-32 h-32 md:w-40 md:h-40 mx-auto relative animate-float-soft">
                        <Image
                            src="/stn-eoc/img/logo.png"
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
                <p className="text-lg md:text-xl text-green-50 mb-2 animate-fade-in-delay">
                    Satun Geo-EOC Intelligence Platform
                </p>
                <p className="text-sm md:text-base text-green-100 animate-fade-in-delay-2">
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
