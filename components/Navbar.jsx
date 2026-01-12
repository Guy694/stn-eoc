"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const { canAccessResources, canAccessReports } = useAuth();

    const allNavItems = [
        { name: "หน้าหลัก", path: "/dashboard" },
        // { name: "แผนที่ภัยพิบัติ", path: "/public/disaster-map" },
        { name: "แผนที่น้ำท่วม", path: "/eoc/flood" },
        // { name: "แผนที่หมู่บ้าน", path: "/eoc/village-map" },
        { name: "โรคระบาด", path: "/eoc/disease" },
        { name: "รายงานเหตุการณ์", path: "/reports", requiresAdmin: true },
        // { name: "ทรัพยากร", path: "/resources", requiresAdmin: true },
        // { name: "การแจ้งเตือน", path: "/alerts" },
    ];

    // กรองเมนูตาม role
    const navItems = allNavItems.filter(item => {
        if (item.name === "ทรัพยากร") {
            return canAccessResources();
        }
        if (item.name === "รายงานเหตุการณ์") {
            return canAccessReports();
        }
        return true;
    });

    return (
        <nav className="bg-green-700 text-white border-b border-green-600">
            <div className="container mx-auto px-4">
                {/* Desktop & Mobile Header */}
                <div className="flex items-center justify-between lg:hidden py-3">
                    <span className="font-semibold">เมนู</span>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-2 rounded-lg hover:bg-green-600 transition-colors"
                        aria-label="Toggle menu"
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
                </div>

                {/* Desktop Menu */}
                <ul className="hidden lg:flex gap-1 overflow-x-auto">
                    {navItems.map((item) => (
                        <li key={item.path} className="flex-shrink-0">
                            <Link
                                href={item.path}
                                className={`block px-4 xl:px-6 py-3 hover:bg-green-600 transition-colors whitespace-nowrap ${pathname === item.path ? "bg-green-600 border-b-2 border-white" : ""
                                    }`}
                            >
                                {item.name}
                            </Link>
                        </li>
                    ))}
                </ul>

                {/* Mobile Menu */}
                <ul
                    className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                        }`}
                >
                    {navItems.map((item) => (
                        <li key={item.path} className="border-t border-green-600">
                            <Link
                                href={item.path}
                                onClick={() => setIsOpen(false)}
                                className={`block px-4 py-3 hover:bg-green-600 transition-colors ${pathname === item.path ? "bg-green-600 font-semibold" : ""
                                    }`}
                            >
                                {item.name}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    );
}
