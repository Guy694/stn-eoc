"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
    Activity,
    BarChart3,
    Bell,
    BriefcaseMedical,
    CalendarClock,
    Car,
    CloudSun,
    ClipboardCheck,
    ClipboardList,
    FileChartColumn,
    FileText,
    Gauge,
    HardDrive,
    HeartPulse,
    Home,
    LayoutDashboard,
    LifeBuoy,
    Map,
    MapPinned,
    MonitorCog,
    Package,
    Radio,
    Settings,
    ShieldAlert,
    Tent,
    Users,
    UserCog,
    UserRoundCog,
    UserRoundPlus,
    Waves
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEOC } from "@/context/EOCContext";

const iconClassName = "h-4 w-4 shrink-0";

function MenuIcon({ icon: Icon, className = iconClassName }) {
    if (!Icon) return null;
    if (typeof Icon === "string") {
        return <span className="text-base">{Icon}</span>;
    }
    return <Icon className={className} aria-hidden="true" strokeWidth={2.2} />;
}

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
                const response = await fetch('/stn-eoc/api/admin/incident-reports?status=pending&limit=1');
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
            title: "แดชบอร์ด",
            section: "dashboard",
            requiresPermission: null, // ทุกคนเห็นได้
            items: [
                { name: "ภาพรวมระบบ", path: "/dashboard", icon: LayoutDashboard, description: "ภาพรวมข้อมูลทั้งหมด" },
                { name: "สภาพอากาศ / Weather Watch", path: "/public/weather-watch", icon: CloudSun, description: "แผนที่เฝ้าระวังสภาพอากาศและฝนสะสมจังหวัดสตูล" },
            ],
        },

        // ============================================
        // 2. EOC MODULES - แยกตามประเภทภัยพิบัติ
        // ============================================
        // เมนูเหล่านี้จะแสดงตามสถานะการเปิด/ปิด EOC
        {
            title: "EOC น้ำท่วม",
            section: "eoc-flood",
            key: "flood",
            eocType: "flood",
            collapsible: true,
            requiresPermission: null, // ทุกคนเห็นได้
            items: [
                { name: "ภาพรวม EOC", path: "/eoc/flood/overview", icon: BarChart3, description: "Dashboard ภาพรวมสถานการณ์ทั้งหมด" },
                { name: "จัดการ EOC น้ำท่วม", path: "/eoc/flood/management", icon: MonitorCog, description: "Officer EOC Management Dashboard" },
                { name: "แผนที่และสถานการณ์", path: "/eoc/flood", icon: Map, description: "ภาพรวมสถานการณ์น้ำท่วม" },
                { name: "บันทึกพื้นที่น้ำท่วม", path: "/eoc/flood/records", icon: Waves, description: "บันทึกข้อมูลพื้นที่น้ำท่วม" },
                { name: "ศูนย์พักพิงชั่วคราว", path: "/eoc/flood/shelters", icon: Tent, description: "แผนที่ศูนย์พักพิง" },
                { name: "รายงานโรคในศูนย์พักพิง", path: "/eoc/flood/shelters/disease-reports", icon: HeartPulse, description: "บันทึกโรคในศูนย์พักพิง" },
                { name: "รายชื่อผู้ได้รับผลกระทบ", path: "/eoc/flood/affected", icon: Users, description: "ข้อมูลผู้ประสบภัย" },
                { name: "ประกาศข่าวสาร", path: "/admin/announcements", icon: Bell, description: "ข่าวประชาสัมพันธ์" },
                { name: "รายงานโรคระบาด", path: "/admin/disease-reports", icon: ClipboardList, description: "ติดตามโรคระบาดจากหน่วยบริการ" },
            ],
        },

        {
            title: "ข้อมูลประชาชน",
            section: "population-data",
            requiresPermission: null,
            items: [
                { name: "กลุ่มเปราะบาง", path: "/eoc/vulnerable-groups", icon: LifeBuoy, description: "ฐานข้อมูลกลาง เพิ่ม/ลดจำนวนรายกลุ่ม" },
            ],
        },

        {
            title: "EOC อุบัติเหตุช่วงเทศกาล",
            section: "eoc-accident",
            key: "festival-accidents",
            eocType: "festival-accidents",
            collapsible: true,
            requiresPermission: null,
            items: [
                { name: "ภาพรวมเทศกาล", path: "/eoc/festival-accidents", icon: BarChart3, description: "Dashboard สถิติอุบัติเหตุ 7 วันอันตราย" },
                { name: "บันทึกอุบัติเหตุ", path: "/eoc/accident/records", icon: Car, description: "บันทึกข้อมูลอุบัติเหตุ" },
                { name: "จุดบริการชั่วคราว", path: "/eoc/accident/service-points", icon: ShieldAlert, description: "จัดการจุดตรวจ/จุดบริการ" },
                { name: "เปรียบเทียบเทศกาล", path: "/eoc/festival-accidents/compare", icon: FileChartColumn, description: "เปรียบเทียบสถิติข้ามเทศกาล/ปี" },
            ],
        },

        // {
        //     title: "🌊 EOC สึนามิ",
        //     section: "eoc-tsunami",
        //     key: "tsunami",
        //     eocType: "tsunami",
        //     collapsible: true,
        //     requiresPermission: null,
        //     items: [
        //         { name: "แผนที่และสถานการณ์", path: "/eoc/tsunami", icon: "📊", description: "ภาพรวมสถานการณ์สึนามิ" },
        //         { name: "จุดอพยพ", path: "/eoc/tsunami/evacuation", icon: "🏃", description: "จุดอพยพและเส้นทาง" },
        //     ],
        // },

        // {
        //     title: "🏚️ EOC แผ่นดินไหว",
        //     section: "eoc-earthquake",
        //     key: "earthquake",
        //     eocType: "earthquake",
        //     collapsible: true,
        //     requiresPermission: null,
        //     items: [
        //         { name: "แผนที่และสถานการณ์", path: "/eoc/earthquake", icon: "📊", description: "ภาพรวมสถานการณ์แผ่นดินไหว" },
        //         { name: "อาคารเสียหาย", path: "/eoc/earthquake/damages", icon: "🏚️", description: "รายงานความเสียหาย" },
        //     ],
        // },

        {
            title: `EOC ${getEOCDisplayName('disease')}`,
            section: "eoc-disease",
            key: "disease",
            eocType: "disease",
            collapsible: true,
            requiresPermission: null,
            items: [
                { name: "ภาพรวมโรคระบาด", path: "/eoc/disease", icon: Activity, description: "Dashboard ภาพรวมการระบาด" },
                { name: "สรุปสถานการณ์รายวัน", path: "/eoc/disease/daily-risk", icon: FileChartColumn, description: "สรุปรายงานโรครายวัน" },
                { name: "บันทึกรายงานผู้ป่วย", path: "/eoc/disease/records", icon: ClipboardList, description: "บันทึกข้อมูลผู้ป่วยจากหน่วยบริการ" },
                { name: "ประกาศข่าวสาร", path: "/admin/announcements", icon: Bell, description: "ข่าวประชาสัมพันธ์" },
            ],
        },

        // ============================================
        // 3. COMMANDER SECTION - REMOVED
        // Dashboard moved to /eoc/flood/overview (accessible to all)
        // ============================================

        // ============================================
        // 4. ADMIN MANAGEMENT - เฉพาะ Admin
        // ============================================
        {
            title: "จัดการระบบ",
            section: "admin",
            requiresPermission: "admin", // เฉพาะ admin
            collapsible: true,
            items: [
                {
                    name: "รายงานเหตุการณ์",
                    path: "/admin/incident-reports",
                    icon: ClipboardList,
                    badge: "pendingReports",
                    description: "รายงานจากประชาชน"
                },
                { name: "กิจกรรมล่าสุด", path: "/admin/recent-activities", icon: CalendarClock, description: "ติดตามกิจกรรมในระบบ" },
                { name: "จัดการเจ้าหน้าที่", path: "/admin/officers", icon: UserRoundCog, description: "ข้อมูลบุคลากร" },
                { name: "จัดการผู้ใช้ประชาชน", path: "/admin/citizens", icon: UserRoundPlus, description: "ประชาชนที่ลงทะเบียน ThaiID" },
                { name: "จัดการหน่วยบริการ", path: "/admin/health-facilities", icon: BriefcaseMedical, description: "โรงพยาบาล/สถานีอนามัย" },
                { name: "จัดการข้อมูลหมู่บ้าน", path: "/admin/village-polygons", icon: MapPinned, description: "พื้นที่หมู่บ้าน" },
                { name: "จัดการ EOC", path: "/admin/eoc-management", icon: Settings, description: "เปิด/ปิด EOC" },
                { name: "ประวัติ EOC Sessions", path: "/admin/eoc-sessions", icon: FileText, description: "ประวัติการเปิด-ปิด EOC" },
            ],
        },

        // ============================================
        // 4. RESOURCES - ต้องมีสิทธิ์เฉพาะ
        // ============================================
        {
            title: "ทรัพยากร",
            section: "resources",
            requiresPermission: "resources", // ใช้ canAccessResources()
            collapsible: true,
            items: [
                { name: "บุคลากร", path: "/resources/personnel", icon: Users, description: "ทีมงานและอาสาสมัคร" },
                { name: "ยานพาหนะ", path: "/resources/vehicles", icon: Car, description: "รถพยาบาล/รถบรรทุก" },
                { name: "อุปกรณ์", path: "/resources/equipment", icon: Package, description: "เครื่องมือและอุปกรณ์" },
                { name: "ศูนย์พักพิง", path: "/admin/shelter-center", icon: Home, description: "ศูนย์พักพิงชั่วคราว" },
                { name: "ทรัพยากร IT", path: "/admin/it-resources", icon: HardDrive, description: "Server/Internet/Network" },
            ],
        },

        // ============================================
        // 5. REPORTS - ต้องมีสิทธิ์เฉพาะ
        // ============================================
        {
            title: "รายงาน",
            section: "reports",
            requiresPermission: "reports", // ใช้ canAccessReports()
            collapsible: true,
            items: [
                { name: "สร้างรายงาน", path: "/reports/create", icon: FileText, description: "สร้างรายงานใหม่" },
                { name: "รายงานทั้งหมด", path: "/reports", icon: ClipboardCheck, description: "ดูรายงานที่ผ่านมา" },
                { name: "สถิติและกราฟ", path: "/reports/statistics", icon: BarChart3, description: "วิเคราะห์ข้อมูล" },
            ],
        },

        // ============================================
        // 6. SETTINGS - สำหรับการตั้งค่าส่วนตัว
        // ============================================
        {
            title: "ตั้งค่า",
            section: "settings",
            requiresPermission: null, // ทุกคนเห็นได้
            items: [
                { name: "โปรไฟล์ของฉัน", path: "/profile", icon: UserCog, description: "ข้อมูลส่วนตัว" },
                { name: "ตั้งค่าระบบ", path: "/settings", icon: Settings, description: "กำหนดค่าต่างๆ" },
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
                { name: "ภาพรวมระบบ", path: "/dashboard", icon: LayoutDashboard, description: "ข้อมูลเบื้องต้น" },
            ],
        },
        {
            title: "บัญชีผู้ใช้",
            section: "account",
            items: [
                { name: "สมัครเจ้าหน้าที่", path: "/auth/thaiid/registration", icon: UserRoundPlus, description: "ลงทะเบียนเป็นเจ้าหน้าที่" },
                { name: "สถานะคำขอ", path: "/auth/thaiid/pending", icon: Gauge, description: "ตรวจสอบสถานะ" },
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
                if (user.role !== 'admin') return false;
            }

            // Resources section
            if (section.requiresPermission === "resources") {
                if (!canAccessResources()) return false;
            }

            // Reports section
            if (section.requiresPermission === "reports") {
                if (!canAccessReports()) return false;
            }

            // Filter EOC modules based on active pathname
            // This prevents staff from getting confused by seeing all EOC menus at once
            if (section.eocType) {
                if (pathname.startsWith('/eoc/flood') && section.eocType === 'flood') return true;
                if ((pathname.startsWith('/eoc/festival-accidents') || pathname.startsWith('/eoc/accident')) && section.eocType === 'festival-accidents') return true;
                if (pathname.startsWith('/eoc/disease') && section.eocType === 'disease') return true;
                if (pathname.startsWith('/eoc/tsunami') && section.eocType === 'tsunami') return true;
                if (pathname.startsWith('/eoc/earthquake') && section.eocType === 'earthquake') return true;
                
                // Hide EOC module if not currently viewing it
                return false;
            }

            // Public sections (requiresPermission === null) and non-EOC modules
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
                                                        <MenuIcon icon={item.icon} />
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
                                                    <MenuIcon icon={item.icon} />
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
