"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
    Activity,
    BarChart3,
    Bell,
    BookOpen,
    BrainCircuit,
    BriefcaseMedical,
    Car,
    ChevronDown,
    ClipboardList,
    Database,
    Eye,
    FileChartColumn,
    Gauge,
    HardDrive,
    HeartPulse,
    History,
    Inbox,
    LayoutDashboard,
    LifeBuoy,
    Map,
    Megaphone,
    Menu,
    MonitorCog,
    Package,
    Power,
    ScrollText,
    Settings,
    ShieldAlert,
    Tent,
    Trash2,
    UserCheck,
    UserCog,
    UserRoundPlus,
    Users,
    Waves,
    X,
    KeyRound
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEOC } from "@/context/EOCContext";
import { buildAdminMenu, buildOfficerEventSections, groupMenuItems, isMenuItemActive } from "@/src/config/navigation/admin-navigation";

// ไอคอนตาม iconKey ของเมนู (โครงเมนูอยู่ที่ src/config/navigation/admin-navigation.js)
const ICONS = {
    home: LayoutDashboard,
    command: Gauge,
    analytics: BrainCircuit,
    overview: BarChart3,
    flood: Waves,
    shelter: Tent,
    vulnerable: LifeBuoy,
    people: Users,
    health: HeartPulse,
    team: Users,
    records: ClipboardList,
    daily: FileChartColumn,
    map: Map,
    accident: Car,
    checkpoint: ShieldAlert,
    compare: FileChartColumn,
    inbox: Inbox,
    userCheck: UserCheck,
    inventory: BriefcaseMedical,
    server: HardDrive,
    database: Database,
    megaphone: Megaphone,
    power: Power,
    history: History,
    users: UserCog,
    log: ScrollText,
    trash: Trash2,
    profile: UserCog,
    settings: Settings,
    lock: KeyRound,
    guide: BookOpen,
    dashboard: BarChart3,
    assets: HardDrive,
    announcements: Bell,
    register: UserRoundPlus,
    status: Activity,
    package: Package,
    monitor: MonitorCog
};

export const MENU_ICONS = ICONS;

function MenuIcon({ item, className = "h-4 w-4 shrink-0" }) {
    const Icon = item.icon || ICONS[item.iconKey] || ClipboardList;
    return <Icon className={className} aria-hidden="true" strokeWidth={2.2} />;
}

export default function Sidebar() {
    const pathname = usePathname();
    const [search, setSearch] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [pendingReportsCount, setPendingReportsCount] = useState(0);
    const [pendingRegistrationsCount, setPendingRegistrationsCount] = useState(0);
    const [teamAssignments, setTeamAssignments] = useState([]);
    const [ownerOverrides, setOwnerOverrides] = useState({});
    const [expandedSections, setExpandedSections] = useState({});
    const { user } = useAuth();
    const { eocStatus } = useEOC();

    // query string ปัจจุบัน (ใช้แยกเมนูที่ชี้หน้าเดียวกันแต่คนละแท็บ)
    useEffect(() => {
        setSearch(window.location.search);
        setIsOpen(false);
    }, [pathname]);
    useEffect(() => {
        const sync = () => setSearch(window.location.search);
        window.addEventListener("popstate", sync);
        window.addEventListener("stn:tab-change", sync);
        return () => {
            window.removeEventListener("popstate", sync);
            window.removeEventListener("stn:tab-change", sync);
        };
    }, []);

    // ตัวเลขงานค้าง (badge)
    useEffect(() => {
        if (!user) return undefined;
        const fetchPendingCount = async () => {
            try {
                const [reportsResponse, registrationsResponse] = await Promise.all([
                    fetch("/stn-eoc/api/admin/incident-reports?status=pending&limit=1"),
                    user.role === "admin" ? fetch("/stn-eoc/api/admin/registrations?limit=1") : Promise.resolve(null)
                ]);
                if (reportsResponse.ok) {
                    const reportsData = await reportsResponse.json();
                    if (reportsData.success && reportsData.stats) setPendingReportsCount(reportsData.stats.pending || 0);
                }
                if (registrationsResponse?.ok) {
                    const registrationsData = await registrationsResponse.json();
                    if (registrationsData.success && registrationsData.stats) setPendingRegistrationsCount(registrationsData.stats.actionable || 0);
                }
            } catch (error) {
                console.error("Error fetching pending menu counts:", error);
            }
        };
        fetchPendingCount();
        const interval = setInterval(fetchPendingCount, 30000);
        return () => clearInterval(interval);
    }, [user]);

    useEffect(() => {
        if (!user) return undefined;
        let active = true;
        if (user.role !== "admin") {
            fetch("/stn-eoc/api/eoc/module-permissions/")
                .then((response) => (response.ok ? response.json() : null))
                .then((result) => { if (active && result?.success) setOwnerOverrides(result.overrides || {}); })
                .catch(() => {});
        }
        fetch("/stn-eoc/api/user/my-assignments/")
            .then((response) => response.json())
            .then((result) => { if (active && result.success) setTeamAssignments(result.assignments || []); })
            .catch(() => { if (active) setTeamAssignments([]); });
        return () => { active = false; };
    }, [user]);

    if (!user) return null;

    const getBadgeCount = (item) => {
        if (item.badge === "pendingReports") return pendingReportsCount;
        if (item.badge === "pendingRegistrations") return pendingRegistrationsCount;
        return 0;
    };

    const accountItems = [
        { name: "โปรไฟล์", path: "/profile", iconKey: "profile" },
        { name: "ตั้งค่าบัญชี", path: "/settings", iconKey: "lock" },
        { name: "คู่มือเจ้าหน้าที่", path: "/eoc/guide", iconKey: "guide" }
    ];

    // ผู้ใช้ที่รออนุมัติ
    const pendingUserMenu = [
        { section: "dashboard", title: "เริ่มต้น", items: [{ name: "หน้าหลัก", path: "/dashboard", iconKey: "home" }] },
        {
            section: "account",
            title: "บัญชีผู้ใช้",
            items: [
                { name: "สมัครเจ้าหน้าที่", path: "/auth/thaiid/registration", iconKey: "register" },
                { name: "สถานะคำขอ", path: "/auth/thaiid/pending", iconKey: "status" }
            ]
        }
    ];

    // เจ้าหน้าที่ทีม/ผู้บัญชาการ: เห็นเมนูเหตุการณ์ที่เปิดอยู่เหมือนแอดมิน (เมนูของกลุ่มภารกิจอื่นเปิดดูได้อย่างเดียว)
    // และงานเฉพาะของกลุ่มภารกิจที่ได้รับมอบหมาย
    const officerEventSections = buildOfficerEventSections({ eocStatus, assignments: teamAssignments, role: user.role, overrides: ownerOverrides });
    const teamMenu = [
        {
            section: "team-main",
            title: "ภาพรวม",
            items: [
                { name: "หน้าหลัก", path: "/dashboard", iconKey: "home", description: "เลือกเหตุการณ์ก่อนเข้าสู่หน้าปฏิบัติการ" },
                ...(user.role === "commander" ? [{ name: "ห้องบัญชาการ", path: "/commander/dashboard", iconKey: "command" }] : []),
                { name: "วิเคราะห์ข้อมูล", path: "/analytics", iconKey: "analytics" }
            ]
        },
        ...(officerEventSections.length ? [{ section: "events-heading", title: "เหตุการณ์ที่เปิดอยู่", group: "events-heading", items: [] }, ...officerEventSections] : []),
        { section: "team-account", title: "บัญชีของฉัน", items: accountItems }
    ];

    const menuSections = (user.role === "user" || user.isApproved === false)
        ? pendingUserMenu
        : user.role === "admin"
            ? buildAdminMenu({ eocStatus, pathname })
            : teamMenu;

    const isExpanded = (section) => expandedSections[section.key || section.section] ?? section.defaultExpanded ?? false;
    const toggle = (section) => setExpandedSections((previous) => ({ ...previous, [section.key || section.section]: !isExpanded(section) }));

    const renderItem = (item, nested = false) => {
        const badgeCount = getBadgeCount(item);
        const active = isMenuItemActive(item, pathname, search);
        return (
            <li key={`${item.path}-${item.name}`}>
                <Link
                    href={item.path}
                    onClick={() => setIsOpen(false)}
                    aria-current={active ? "page" : undefined}
                    title={item.readOnly ? `${item.description || item.name} (ดูได้อย่างเดียว)` : (item.description || item.name)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${active
                        ? "bg-[#0b4c86] font-semibold text-white"
                        : badgeCount > 0
                            ? "font-semibold text-red-700 hover:bg-red-50"
                            : nested ? "text-slate-600 hover:bg-white hover:text-slate-900" : "text-slate-700 hover:bg-white hover:text-slate-900"
                        }`}
                >
                    <MenuIcon item={item} className={`h-4 w-4 shrink-0 ${active ? "text-white" : badgeCount > 0 ? "text-red-600" : "text-slate-500"}`} />
                    <span className="flex-1 leading-snug">{item.name}</span>
                    {item.readOnly && (
                        <Eye className={`h-3.5 w-3.5 shrink-0 ${active ? "text-white/80" : "text-slate-400"}`} aria-label="ดูได้อย่างเดียว" />
                    )}
                    {badgeCount > 0 && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-black ${active ? "bg-white text-red-700" : "bg-red-600 text-white"}`}>{badgeCount}</span>
                    )}
                </Link>
            </li>
        );
    };

    const renderSection = (section) => {
        // หัวข้อ "เหตุการณ์ที่เปิดอยู่" (แสดงข้อความเมื่อไม่มีเหตุการณ์)
        if (section.group === "events-heading") {
            return (
                <div key={section.section} className="mb-1">
                    <h3 className="mb-1.5 px-3 text-xs font-bold text-slate-500">{section.title}</h3>
                    {section.emptyMessage && (
                        <div className="rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-500">
                            {section.emptyMessage}
                            <ul className="mt-1.5">{section.items.map((item) => renderItem(item))}</ul>
                        </div>
                    )}
                </div>
            );
        }

        // เหตุการณ์แต่ละอัน: การ์ดพับได้ พร้อมสถานะ
        if (section.group === "events") {
            const open = section.eventState === "open";
            const expanded = isExpanded(section);
            return (
                <div key={section.section} className={`mb-2 rounded-xl border ${open ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50"}`}>
                    <button
                        type="button"
                        onClick={() => toggle(section)}
                        aria-expanded={expanded}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                    >
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${open ? "bg-emerald-500" : "bg-slate-400"}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{section.title}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${open ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-700"}`}>
                            {open ? "เปิดอยู่" : "ปิดแล้ว"}
                        </span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                    {expanded && (() => {
                        const shared = section.items.filter((item) => !item.teamWork);
                        const mine = section.items.filter((item) => item.teamWork);
                        return (
                            <div className="px-1.5 pb-2">
                                {groupMenuItems(shared).map((group) => (
                                    <div key={group.title || "main"}>
                                        {group.title ? <h4 className="px-3 pb-0.5 pt-2 text-[11px] font-bold text-slate-500">{group.title}</h4> : null}
                                        <ul className="space-y-0.5">{group.items.map((item) => renderItem(item, true))}</ul>
                                    </div>
                                ))}
                                {mine.length ? (
                                    <>
                                        <h4 className="mt-2 border-t border-emerald-200/70 px-3 pb-1 pt-2 text-[11px] font-bold text-slate-500">งานของกลุ่มภารกิจ</h4>
                                        <ul className="space-y-0.5">{mine.map((item) => renderItem(item, true))}</ul>
                                    </>
                                ) : null}
                            </div>
                        );
                    })()}
                </div>
            );
        }

        const badgeTotal = section.items.reduce((total, item) => total + getBadgeCount(item), 0);
        if (section.collapsible) {
            const expanded = isExpanded(section) || section.items.some((item) => isMenuItemActive(item, pathname, search));
            return (
                <div key={section.section} className="mb-3">
                    <button
                        type="button"
                        onClick={() => toggle(section)}
                        aria-expanded={expanded}
                        title={section.description || section.title}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-white hover:text-slate-800"
                    >
                        <span className="flex items-center gap-2">
                            {section.title}
                            {badgeTotal > 0 && <span className="rounded-full bg-red-600 px-1.5 text-[11px] font-black text-white">{badgeTotal}</span>}
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                    {expanded && <ul className="mt-1 space-y-0.5">{section.items.map((item) => renderItem(item))}</ul>}
                </div>
            );
        }

        return (
            <div key={section.section} className="mb-3">
                <h3 className="mb-1.5 px-3 text-xs font-bold text-slate-500">{section.title}</h3>
                <ul className="space-y-0.5">{section.items.map((item) => renderItem(item))}</ul>
            </div>
        );
    };

    return (
        <>
            {/* ปุ่มเปิดเมนูบนมือถือ */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="sidebar-toggle fixed bottom-6 right-6 z-50 rounded-full bg-[#0b4c86] p-4 text-white shadow-lg transition-colors hover:bg-[#083865] lg:hidden"
                aria-label={isOpen ? "ปิดเมนู" : "เปิดเมนู"}
                aria-expanded={isOpen}
            >
                {isOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
            </button>

            {isOpen && <div className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-sm lg:hidden" onClick={() => setIsOpen(false)} aria-hidden="true" />}

            <aside
                aria-label="เมนูหลังบ้าน"
                className={`fixed left-0 top-0 z-40 h-full w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-[#f4f7fa] transition-transform duration-300 ease-in-out lg:static lg:h-auto lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
            >
                <nav className="p-3">
                    <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3 lg:hidden">
                        <h2 className="font-semibold text-slate-800">เมนู</h2>
                        <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg p-2 hover:bg-slate-200" aria-label="ปิดเมนู">
                            <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                    {menuSections.map(renderSection)}
                </nav>
            </aside>
        </>
    );
}
