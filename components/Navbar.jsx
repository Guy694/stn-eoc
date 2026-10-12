"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import AppIcon from "./icons/AppIcon";

// sidebarMenu: หน้าหลังบ้าน — ปุ่ม "เมนู" บนมือถือเปิดเมนูด้านข้าง (Sidebar) และซ่อนแถบนี้บนจอใหญ่ (มีเมนูด้านข้างอยู่แล้ว)
export default function Navbar({ sidebarMenu = false }) {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { canAccessResources, canAccessReports } = useAuth();
    useEffect(() => {
        if (!sidebarMenu) return undefined;
        const sync = (event) => setSidebarOpen(Boolean(event.detail?.open));
        window.addEventListener("stn:sidebar-state", sync);
        return () => window.removeEventListener("stn:sidebar-state", sync);
    }, [sidebarMenu]);

    if (sidebarMenu) {
        return (
            <nav className="sticky top-0 z-20 bg-[#0b4c86] text-white lg:hidden" aria-label="เมนูหลังบ้าน">
                <button
                    type="button"
                    onClick={() => window.dispatchEvent(new Event("stn:toggle-sidebar"))}
                    aria-expanded={sidebarOpen}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left font-semibold hover:bg-[#083865]"
                >
                    <span>เมนู</span>
                    <AppIcon icon={sidebarOpen ? "x" : "menu"} className="h-6 w-6" />
                </button>
            </nav>
        );
    }

    const allNavItems = [
        { name: "หน้าหลัก", path: "/" },
        // { name: "สภาพอากาศ", path: "/public/weather-watch" },
        // { name: "แผนที่ภัยพิบัติ", path: "/public/disaster-map" },
        // { name: "แผนที่อุทกภัยน้ำท่วม", path: "/eoc/flood" },
        // { name: "แผนที่หมู่บ้าน", path: "/eoc/village-map" },
        //{ name: "โรคระบาด", path: "/eoc/disease" },
        //{ name: "อุบัติเหตุช่วงเทศกาล", path: "/eoc/festival-accidents" },
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
        <nav className="bg-[#0b4c86] text-white border-b border-blue-950/20">
            <div className="container mx-auto px-4">
                {/* Desktop & Mobile Header */}
                <div className="flex items-center justify-between lg:hidden py-3">
                    <span className="font-semibold">เมนู</span>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-2 rounded-lg hover:bg-[#083865] transition-colors"
                        aria-label="เปิด/ปิดเมนู"
                    >
                        <AppIcon icon={isOpen ? "x" : "menu"} className="h-6 w-6" />
                    </button>
                </div>

                {/* Desktop Menu */}
                <ul className="hidden lg:flex gap-1 overflow-x-auto">
                    {navItems.map((item) => (
                        <li key={item.path} className="flex-shrink-0">
                            <Link
                                href={item.path}
                                className={`block px-4 xl:px-6 py-3 hover:bg-[#083865] transition-colors whitespace-nowrap ${pathname === item.path ? "bg-[#083865] border-b border-white" : ""
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
                        <li key={item.path} className="border-t border-blue-950/20">
                            <Link
                                href={item.path}
                                onClick={() => setIsOpen(false)}
                                className={`block px-4 py-3 hover:bg-[#083865] transition-colors ${pathname === item.path ? "bg-[#083865] font-semibold" : ""
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
