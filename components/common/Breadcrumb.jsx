"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppIcon from "@/components/icons/AppIcon";

export default function Breadcrumb() {
    const pathname = usePathname();

    // แปลง path เป็น breadcrumb items
    const generateBreadcrumbs = () => {
        const paths = pathname.split("/").filter(Boolean);
        const breadcrumbs = [];

        // เพิ่ม "หน้าหลัก" ถ้าไม่ใช่หน้า dashboard
        if (pathname !== "/dashboard") {
            breadcrumbs.push({ label: "หน้าหลัก", href: "/dashboard" });
        }

        let currentPath = "";
        paths.forEach((path, index) => {
            currentPath += `/${path}`;

            // แปลงชื่อเป็นภาษาไทย
            const labels = {
                dashboard: "แดชบอร์ด",
                eoc: "EOC",
                admin: "ผู้ดูแลระบบ",
                flood: "แผนที่อุทกภัยน้ำท่วม",
                drought: "แผนที่ภัยแล้ง",
                "village-map": "แผนที่หมู่บ้าน",
                tsunami: "แผนที่สึนามิ",
                earthquake: "แผนที่แผ่นดินไหว",
                disease: "แผนที่โรคระบาด",
                officers: "จัดการเจ้าหน้าที่",
                "flood-records": "บันทึกข้อมูลอุทกภัยน้ำท่วม",
                profile: "โปรไฟล์",
                settings: "ตั้งค่า",
                login: "เข้าสู่ระบบ",
                public: "สาธารณะ",
                "disaster-map": "แผนที่ภัยพิบัติ",
                reports: "รายงาน",
                resources: "ทรัพยากร",
                events: "เหตุการณ์",
                user: "ผู้ใช้งาน"
            };

            breadcrumbs.push({
                label: labels[path] || path,
                href: currentPath,
                isLast: index === paths.length - 1
            });
        });

        return breadcrumbs;
    };

    const breadcrumbs = generateBreadcrumbs();

    // ไม่แสดง breadcrumb ในหน้าหลักหรือหน้า login
    if (pathname === "/" || pathname === "/login" || pathname === "/dashboard") {
        return null;
    }

    return (
        <nav className="bg-white border-b border-gray-200 px-6 py-3">
            <ol className="flex items-center space-x-2 text-sm">
                {breadcrumbs.map((crumb, index) => (
                    <li key={crumb.href} className="flex items-center">
                        {index > 0 && (
                            <AppIcon icon="chevronRight" className="mx-2 h-4 w-4 text-gray-400" />
                        )}
                        {crumb.isLast ? (
                            <span className="font-semibold text-green-600">
                                {crumb.label}
                            </span>
                        ) : (
                            <Link
                                href={crumb.href}
                                className="text-gray-600 hover:text-green-600 transition-colors"
                            >
                                {crumb.label}
                            </Link>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}
