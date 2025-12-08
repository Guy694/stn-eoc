"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
    const pathname = usePathname();

    const navItems = [
        { name: "หน้าหลัก", path: "/dashboard" },
        { name: "แผนที่ภัยพิบัติ", path: "/public/disaster-map" },
        { name: "รายงานเหตุการณ์", path: "/reports" },
        { name: "ทรัพยากร", path: "/resources" },
        { name: "การแจ้งเตือน", path: "/alerts" },
    ];

    return (
        <nav className="bg-green-700 text-white border-b border-green-600">
            <div className="container mx-auto px-4">
                <ul className="flex gap-1">
                    {navItems.map((item) => (
                        <li key={item.path}>
                            <Link
                                href={item.path}
                                className={`block px-6 py-3 hover:bg-green-600 transition-colors ${pathname === item.path ? "bg-green-600 border-b-2 border-white" : ""
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
