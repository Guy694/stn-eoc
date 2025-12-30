"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useEOC } from "@/context/EOCContext";

export default function Sidebar() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const { user, canAccessResources, canAccessReports } = useAuth();
    const { eocStatus, getEOCDisplayName } = useEOC();

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Close sidebar when clicking outside on mobile
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (isMobile && isOpen && !e.target.closest('aside') && !e.target.closest('.sidebar-toggle')) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, isMobile]);

    // ถ้าไม่มีการ login ไม่แสดง sidebar
    if (!user) {
        return null;
    }

    const allMenuItems = [
        {
            title: "แดชบอร์ด",
            items: [
                { name: "ภาพรวม", path: "/dashboard", icon: "📊" },
            ],
        },
        {
            title: "ศูนย์ EOC",
            items: [
                { name: "แผนที่น้ำท่วม", path: "/eoc/flood", icon: "💧", eocType: "flood" },
                { name: "แผนที่ภัยแล้ง", path: "/eoc/drought", icon: "🌵", eocType: "drought" },
                { name: "แผนที่สึนามิ", path: "/eoc/tsunami", icon: "🌊", eocType: "tsunami" },
                { name: "แผนที่แผ่นดินไหว", path: "/eoc/earthquake", icon: "🏚️", eocType: "earthquake" },
                { name: "แผนที่โรคระบาด", path: "/eoc/disease", icon: "🦠", eocType: "disease" },
            ],
        },

        {
            title: "ผู้ดูแลระบบ",
            requiresAdmin: true,
            items: [
                { name: "จัดการเจ้าหน้าที่", path: "/admin/officers", icon: "👮" },
                { name: "จัดการสถานพยาบาล", path: "/admin/health-facilities", icon: "🏥" },
                { name: "จัดการข้อมูลหมู่บ้าน", path: "/admin/village-polygons", icon: "🗺️" },
                { name: "จัดการ EOC", path: "/admin/eoc-management", icon: "⚙️" },
            ],
        },
        {
            title: "จัดการเหตุการณ์",
            items: [
                { name: "เหตุการณ์ทั้งหมด", path: "/events", icon: "🚨" },
                { name: "เหตุการณ์ใหม่", path: "/events/new", icon: "➕" },
                { name: "กำลังดำเนินการ", path: "/events/active", icon: "⚡" },
            ],
        },
        {
            title: "ทรัพยากร",
            requiresAdmin: true,
            items: [
                { name: "บุคลากร", path: "/resources/personnel", icon: "👥" },
                { name: "ยานพาหนะ", path: "/resources/vehicles", icon: "🚑" },
                { name: "อุปกรณ์", path: "/resources/equipment", icon: "🛠️" },
            ],
        },
        {
            title: "รายงาน",
            requiresAdmin: true,
            items: [
                { name: "สร้างรายงาน", path: "/reports/create", icon: "📝" },
                { name: "รายงานทั้งหมด", path: "/reports", icon: "📄" },
            ],
        },
    ];

    // เมนูสำหรับ pending user (รอการอนุมัติ)
    const pendingUserMenu = [
        {
            title: "เจ้าหน้าที่",
            items: [
                { name: "ข้อมูลส่วนตัว", path: "/auth/thaiid/registration", icon: "👤" },
                { name: "สถานะคำขอ", path: "/auth/thaiid/pending", icon: "⏳" },
            ],
        },
    ];

    // กรองเมนูตาม role และสถานะการอนุมัติ
    const menuItems = user.isApproved === false ? pendingUserMenu : allMenuItems.filter(section => {
        if (section.title === "ทรัพยากร") {
            return canAccessResources();
        }
        if (section.title === "รายงาน") {
            return canAccessReports();
        }
        return true;
    });

    return (
        <>
            {/* Mobile Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="sidebar-toggle lg:hidden fixed bottom-6 right-6 z-50 bg-green-700 text-white p-4 rounded-full shadow-lg hover:bg-green-600 transition-colors"
                aria-label="Toggle sidebar"
            >
                <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    {isOpen ? (
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    ) : (
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6h16M4 12h16M4 18h16"
                        />
                    )}
                </svg>
            </button>

            {/* Overlay for mobile */}
            {isMobile && isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed lg:static
                    top-0 left-0
                    
                    w-64
                    bg-gray-50 border-r border-gray-200
                    overflow-y-auto
                    z-40
                    transform transition-transform duration-300 ease-in-out
                    ${isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
                `}
            >
                <div className="p-4">
                    {/* Mobile Header */}
                    <div className="lg:hidden flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                        <h2 className="font-semibold text-gray-800">เมนู</h2>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>

                    {/* Menu Items */}
                    {menuItems.map((section, idx) => (
                        <div key={idx} className="mb-6">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
                                {section.title}
                            </h3>
                            <ul className="space-y-1">
                                {section.items.map((item) => (
                                    <li key={item.path}>
                                        <Link
                                            href={item.path}
                                            onClick={() => isMobile && setIsOpen(false)}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${pathname === item.path
                                                ? "bg-green-100 text-green-800 font-medium"
                                                : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                        >
                                            <span className="text-lg">{item.icon}</span>
                                            <span className="flex-1">{item.name}</span>
                                            {item.eocType && eocStatus[item.eocType] && (
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${eocStatus[item.eocType].is_active
                                                    ? "bg-green-500 text-white"
                                                    : "bg-gray-300 text-gray-700"
                                                    }`}>
                                                    {eocStatus[item.eocType].is_active ? "เปิด" : "ปิด"}
                                                </span>
                                            )}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </aside>
        </>
    );
}
