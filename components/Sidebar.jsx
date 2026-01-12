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
    const [pendingReportsCount, setPendingReportsCount] = useState(0);
    const [expandedSections, setExpandedSections] = useState({});
    const { user, canAccessResources, canAccessReports } = useAuth();
    const { eocStatus, getEOCDisplayName } = useEOC();

    // Toggle expanded section
    const toggleSection = (sectionKey) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey]
        }));
    };

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Fetch pending reports count
    useEffect(() => {
        const fetchPendingCount = async () => {
            try {
                const response = await fetch('/api/admin/incident-reports?status=pending&limit=1');
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.stats) {
                        setPendingReportsCount(data.stats.pending || 0);
                    }
                }
            } catch (error) {
                console.error('Error fetching pending reports count:', error);
            }
        };

        if (user) {
            fetchPendingCount();
            // Refresh count every 30 seconds
            const interval = setInterval(fetchPendingCount, 30000);
            return () => clearInterval(interval);
        }
    }, [user]);

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

    // ============================================
    // MENU CONFIGURATION
    // ============================================
    // โครงสร้างเมนูทั้งหมด แบ่งตามหมวดหมู่และสิทธิ์การเข้าถึง
    // 
    // สิทธิ์การเข้าถึง:
    // - Public: ทุกคนที่ login แล้วเห็นได้
    // - requiresAdmin: เฉพาะ admin เท่านั้น (user.role === 'admin')
    // - requiresEOCManager: เฉพาะ admin และ eoc_manager
    // - requiresStaff: เฉพาะ admin, eoc_manager, eoc_staff
    // - eocType: เมนูที่เกี่ยวข้องกับ EOC ประเภทต่างๆ
    // - collapsible: เมนูที่สามารถขยาย/ย่อได้
    //
    // ============================================

    const allMenuItems = [
        // ============================================
        // 1. DASHBOARD - ทุกคนเห็นได้
        // ============================================
        {
            title: "แดshบอร์ด",
            section: "dashboard",
            requiresPermission: null, // ทุกคนเห็นได้
            items: [
                { name: "ภาพรวมระบบ", path: "/dashboard", icon: "📊", description: "ภาพรวมข้อมูลทั้งหมด" },
            ],
        },

        // ============================================
        // 2. EOC MODULES - แยกตามประเภทภัยพิบัติ
        // ============================================
        // เมนูเหล่านี้จะแสดงตามสถานะการเปิด/ปิด EOC
        {
            title: "🌊 EOC น้ำท่วม",
            section: "eoc-flood",
            key: "flood",
            eocType: "flood",
            collapsible: true,
            requiresPermission: null, // ทุกคนเห็นได้
            items: [
                { name: "แผนที่และสถานการณ์", path: "/eoc/flood", icon: "📊", description: "ภาพรวมสถานการณ์น้ำท่วม" },
                { name: "รายชื่อผู้ได้รับผลกระทบ", path: "/eoc/flood/affected", icon: "👥", description: "ข้อมูลผู้ประสบภัย" },
                { name: "กลุ่มเปราะบาง", path: "/eoc/flood/vulnerable-groups", icon: "🧑‍🦽", description: "ผู้สูงอายุ เด็ก คนพิการ" },
                { name: "ประกาศข่าวสาร", path: "/admin/announcements", icon: "📢", description: "ข่าวประชาสัมพันธ์" },
                { name: "รายงานโรคระบาด", path: "/admin/disease-reports", icon: "📋", description: "ติดตามโรคระบาด" },
            ],
        },

        {
            title: "🌵 EOC ภัยแล้ง",
            section: "eoc-drought",
            key: "drought",
            eocType: "drought",
            collapsible: true,
            requiresPermission: null,
            items: [
                { name: "แผนที่และสถานการณ์", path: "/eoc/drought", icon: "📊", description: "ภาพรวมสถานการณ์ภัยแล้ง" },
                { name: "ข้อมูลแหล่งน้ำ", path: "/eoc/drought/water-sources", icon: "💧", description: "สถานะแหล่งน้ำ" },
            ],
        },

        {
            title: "🌊 EOC สึนามิ",
            section: "eoc-tsunami",
            key: "tsunami",
            eocType: "tsunami",
            collapsible: true,
            requiresPermission: null,
            items: [
                { name: "แผนที่และสถานการณ์", path: "/eoc/tsunami", icon: "📊", description: "ภาพรวมสถานการณ์สึนามิ" },
                { name: "จุดอพยพ", path: "/eoc/tsunami/evacuation", icon: "🏃", description: "จุดอพยพและเส้นทาง" },
            ],
        },

        {
            title: "🏚️ EOC แผ่นดินไหว",
            section: "eoc-earthquake",
            key: "earthquake",
            eocType: "earthquake",
            collapsible: true,
            requiresPermission: null,
            items: [
                { name: "แผนที่และสถานการณ์", path: "/eoc/earthquake", icon: "📊", description: "ภาพรวมสถานการณ์แผ่นดินไหว" },
                { name: "อาคารเสียหาย", path: "/eoc/earthquake/damages", icon: "🏚️", description: "รายงานความเสียหาย" },
            ],
        },

        {
            title: "🦠 EOC โรคระบาด",
            section: "eoc-disease",
            key: "disease",
            eocType: "disease",
            collapsible: true,
            requiresPermission: null,
            items: [
                { name: "แผนที่และสถานการณ์", path: "/eoc/disease", icon: "📊", description: "ภาพรวมการระบาด" },
                { name: "รายงานผู้ป่วย", path: "/eoc/disease/reports", icon: "📋", description: "สถิติผู้ป่วยรายวัน" },
            ],
        },

        // ============================================
        // 3. ADMIN MANAGEMENT - เฉพาะ Admin
        // ============================================
        {
            title: "🔧 จัดการระบบ",
            section: "admin",
            requiresPermission: "admin", // เฉพาะ admin
            collapsible: true,
            items: [
                {
                    name: "รายงานเหตุการณ์",
                    path: "/admin/incident-reports",
                    icon: "📋",
                    badge: "pendingReports",
                    description: "รายงานจากประชาชน"
                },
                { name: "จัดการเจ้าหน้าที่", path: "/admin/officers", icon: "👮", description: "ข้อมูลบุคลากร" },
                { name: "จัดการหน่วยบริการ", path: "/admin/health-facilities", icon: "🏥", description: "โรงพยาบาล/สถานีอนามัย" },
                { name: "จัดการข้อมูลหมู่บ้าน", path: "/admin/village-polygons", icon: "🗺️", description: "พื้นที่หมู่บ้าน" },
                { name: "จัดการ EOC", path: "/admin/eoc-management", icon: "⚙️", description: "เปิด/ปิด EOC" },
                { name: "ประวัติ EOC Sessions", path: "/admin/eoc-sessions", icon: "📜", description: "ประวัติการเปิด-ปิด EOC" },
            ],
        },

        // ============================================
        // 4. RESOURCES - ต้องมีสิทธิ์เฉพาะ
        // ============================================
        {
            title: "📦 ทรัพยากร",
            section: "resources",
            requiresPermission: "resources", // ใช้ canAccessResources()
            collapsible: true,
            items: [
                { name: "บุคลากร", path: "/resources/personnel", icon: "👥", description: "ทีมงานและอาสาสมัคร" },
                { name: "ยานพาหนะ", path: "/resources/vehicles", icon: "🚑", description: "รถพยาบาล/รถบรรทุก" },
                { name: "อุปกรณ์", path: "/resources/equipment", icon: "🛠️", description: "เครื่องมือและอุปกรณ์" },
                { name: "ศูนย์พักพิง", path: "/admin/shelter-center", icon: "🏠", description: "ศูนย์พักพิงชั่วคราว" },
            ],
        },

        // ============================================
        // 5. REPORTS - ต้องมีสิทธิ์เฉพาะ
        // ============================================
        {
            title: "📄 รายงาน",
            section: "reports",
            requiresPermission: "reports", // ใช้ canAccessReports()
            collapsible: true,
            items: [
                { name: "สร้างรายงาน", path: "/reports/create", icon: "📝", description: "สร้างรายงานใหม่" },
                { name: "รายงานทั้งหมด", path: "/reports", icon: "📄", description: "ดูรายงานที่ผ่านมา" },
                { name: "สถิติและกราฟ", path: "/reports/statistics", icon: "📊", description: "วิเคราะห์ข้อมูล" },
            ],
        },

        // ============================================
        // 6. SETTINGS - สำหรับการตั้งค่าส่วนตัว
        // ============================================
        {
            title: "⚙️ ตั้งค่า",
            section: "settings",
            requiresPermission: null, // ทุกคนเห็นได้
            items: [
                { name: "โปรไฟล์ของฉัน", path: "/profile", icon: "👤", description: "ข้อมูลส่วนตัว" },
                { name: "ตั้งค่าระบบ", path: "/settings", icon: "🔧", description: "กำหนดค่าต่างๆ" },
            ],
        },
    ];

    // ============================================
    // PENDING USER MENU
    // ============================================
    // เมนูสำหรับผู้ใช้ที่รอการอนุมัติ (isApproved = false)
    // จะเห็นเฉพาะเมนูพื้นฐานและหน้าสมัครเจ้าหน้าที่
    // ============================================
    const pendingUserMenu = [
        {
            title: "แดชบอร์ด",
            section: "dashboard",
            items: [
                { name: "ภาพรวมระบบ", path: "/dashboard", icon: "📊", description: "ข้อมูลเบื้องต้น" },
            ],
        },
        {
            title: "👤 บัญชีผู้ใช้",
            section: "account",
            items: [
                { name: "สมัครเจ้าหน้าที่", path: "/auth/thaiid/registration", icon: "📝", description: "ลงทะเบียนเป็นเจ้าหน้าที่" },
                { name: "สถานะคำขอ", path: "/auth/thaiid/pending", icon: "⏳", description: "ตรวจสอบสถานะ" },
            ],
        },
    ];

    // ============================================
    // MENU FILTERING LOGIC
    // ============================================
    // กรองเมนูตามสิทธิ์และสถานะของผู้ใช้
    // 
    // Logic การกรอง:
    // 1. ถ้า user.role === 'user' หรือ isApproved === false 
    //    → ใช้ pendingUserMenu (เมนูจำกัด)
    // 2. ถ้าเป็นเจ้าหน้าที่ที่อนุมัติแล้ว → กรองตาม requiresPermission
    //    - requiresPermission === "admin" → เฉพาะ admin
    //    - requiresPermission === "resources" → ใช้ canAccessResources()
    //    - requiresPermission === "reports" → ใช้ canAccessReports()
    //    - requiresPermission === null → ทุกคนเห็นได้
    // ============================================
    const menuItems = (user.role === 'user' || user.isApproved === false)
        ? pendingUserMenu
        : allMenuItems.filter(section => {
            // Admin-only sections
            if (section.requiresPermission === "admin") {
                return user.role === 'admin';
            }

            // Resources section
            if (section.requiresPermission === "resources") {
                return canAccessResources();
            }

            // Reports section
            if (section.requiresPermission === "reports") {
                return canAccessReports();
            }

            // Public sections (requiresPermission === null)
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
                    className="fixed inset-0  backdrop-blur-md bg-white/30 bg-opacity-50 z-30 lg:hidden"
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
                        <div key={section.section || idx} className="mb-4">
                            {section.collapsible ? (
                                // ============================================
                                // COLLAPSIBLE SECTION (EOC Modules)
                                // ============================================
                                <>
                                    {/* Collapsible Section Header */}
                                    <button
                                        onClick={() => toggleSection(section.key)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${section.items.some(item => pathname.startsWith(item.path))
                                            ? "bg-green-50 text-green-800"
                                            : "text-gray-700 hover:bg-gray-100"
                                            }`}
                                        title={section.description || section.title}
                                    >
                                        <span className="font-semibold flex items-center gap-2">
                                            {section.title}
                                            {/* แสดงสถานะ EOC (เปิด/ปิด) */}
                                            {section.eocType && eocStatus[section.eocType] && (
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${eocStatus[section.eocType].is_active
                                                    ? "bg-green-500 text-white"
                                                    : "bg-gray-300 text-gray-700"
                                                    }`}>
                                                    {eocStatus[section.eocType].is_active ? "เปิด" : "ปิด"}
                                                </span>
                                            )}
                                        </span>
                                        <svg
                                            className={`w-4 h-4 transition-transform ${expandedSections[section.key] ? "rotate-180" : ""
                                                }`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 9l-7 7-7-7"
                                            />
                                        </svg>
                                    </button>

                                    {/* Collapsible Menu Items */}
                                    {expandedSections[section.key] && (
                                        <ul className="mt-1 ml-4 space-y-1">
                                            {section.items.map((item) => (
                                                <li key={item.path}>
                                                    <Link
                                                        href={item.path}
                                                        onClick={() => isMobile && setIsOpen(false)}
                                                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${pathname === item.path
                                                            ? "bg-green-100 text-green-800 font-medium"
                                                            : "text-gray-600 hover:bg-gray-100"
                                                            }`}
                                                        title={item.description || item.name}
                                                    >
                                                        <span className="text-base">{item.icon}</span>
                                                        <span className="flex-1">{item.name}</span>
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </>
                            ) : (
                                // ============================================
                                // REGULAR SECTION (Non-collapsible)
                                // ============================================
                                <>
                                    {/* Regular Section Header */}
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
                                                    title={item.description || item.name}
                                                >
                                                    <span className="text-lg">{item.icon}</span>
                                                    <span className="flex-1">{item.name}</span>

                                                    {/* Badge สำหรับแจ้งเตือน (เช่น รายงานค้าง) */}
                                                    {item.badge === "pendingReports" && pendingReportsCount > 0 && (
                                                        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                                                            {pendingReportsCount}
                                                        </span>
                                                    )}

                                                    {/* สถานะ EOC (ถ้ามี) */}
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
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </aside>
        </>
    );
}
