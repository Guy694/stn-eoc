"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
    const pathname = usePathname();

    const menuItems = [
        {
            title: "แดชบอร์ด",
            items: [
                { name: "ภาพรวม", path: "/dashboard", icon: "📊" },
                { name: "สถิติ", path: "/dashboard/statistics", icon: "📈" },
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
            items: [
                { name: "บุคลากร", path: "/resources/personnel", icon: "👥" },
                { name: "ยานพาหนะ", path: "/resources/vehicles", icon: "🚑" },
                { name: "อุปกรณ์", path: "/resources/equipment", icon: "🛠️" },
            ],
        },
        {
            title: "รายงาน",
            items: [
                { name: "สร้างรายงาน", path: "/reports/create", icon: "📝" },
                { name: "รายงานทั้งหมด", path: "/reports", icon: "📄" },
            ],
        },
    ];

    return (
        <aside className="w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto">
            <div className="p-4">
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
                                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${pathname === item.path
                                                ? "bg-green-100 text-green-800 font-medium"
                                                : "text-gray-700 hover:bg-gray-100"
                                            }`}
                                    >
                                        <span className="text-lg">{item.icon}</span>
                                        {item.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </aside>
    );
}
