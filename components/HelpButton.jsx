"use client";
import { useState } from 'react';
import Link from 'next/link';
import AppIcon from './icons/AppIcon';

export default function HelpButton() {
    const [isOpen, setIsOpen] = useState(false);

    const helpLinks = [
        {
            title: "คู่มือประชาชน",
            icon: "users",
            href: "/public/help/citizen-guide",
            description: "วิธีแจ้งเหตุ"
        },
        {
            title: "คำถามที่พบบ่อย",
            icon: "help",
            href: "/public/help/faq",
            description: "FAQ"
        },
        {
            title: "ศูนย์ช่วยเหลือ",
            icon: "book",
            href: "/public/help",
            description: "คู่มือทั้งหมด"
        }
    ];

    return (
        <>
            {/* Help Menu */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 bg-white rounded-xl shadow-2xl p-4 w-64 z-40 animate-scale-in">
                    <div className="space-y-2">
                        {helpLinks.map((link, index) => (
                            <Link
                                key={index}
                                href={link.href}
                                className="block p-3 hover:bg-gray-50 rounded-lg transition-colors"
                                onClick={() => setIsOpen(false)}
                            >
                                <div className="flex items-center gap-3">
                                    <AppIcon icon={link.icon} className="h-6 w-6 text-blue-600" />
                                    <div>
                                        <div className="font-semibold text-gray-800 text-sm">
                                            {link.title}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {link.description}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}

                        {/* Contact */}
                        <div className="pt-3 border-t border-gray-200">
                            <a
                                href="tel:074-711-555"
                                className="block p-3 hover:bg-gray-50 rounded-lg transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <AppIcon icon="phone" className="h-6 w-6 text-red-600" />
                                    <div>
                                        <div className="font-semibold text-gray-800 text-sm">
                                            ติดต่อฉุกเฉิน
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            074-711-555
                                        </div>
                                    </div>
                                </div>
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Help Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 z-50 ${isOpen
                        ? 'bg-red-600 hover:bg-red-700 rotate-45'
                        : 'bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:scale-110'
                    }`}
                aria-label={isOpen ? 'ปิดความช่วยเหลือ' : 'เปิดความช่วยเหลือ'}
            >
                {isOpen ? (
                    <AppIcon icon="x" className="h-8 w-8 text-white" />
                ) : (
                    <AppIcon icon="help" className="h-8 w-8 text-white" />
                )}
            </button>

            {/* Tooltip */}
            {!isOpen && (
                <div className="fixed bottom-6 right-24 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg z-40 animate-fade-in-up pointer-events-none">
                    ต้องการความช่วยเหลือ?
                    <div className="absolute top-1/2 -right-1 transform -translate-y-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                </div>
            )}
        </>
    );
}
