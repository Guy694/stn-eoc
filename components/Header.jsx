"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { showLogoutConfirm } from "@/lib/sweetAlert";
import Image from "next/image";
import AppIcon from "./icons/AppIcon";

export default function Header() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [showMenu, setShowMenu] = useState(false);

    const handleLogout = async () => {
        const confirmed = await showLogoutConfirm();
        if (confirmed) {
            await logout();
            router.push("/");
        }
    };

    return (
        <header className="bg-[#083865] text-white shadow-md">
            <div className="container mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                    {/* Logo and Title */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 md:w-16 md:h-16 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                            <Image src="/stn-eoc/img/logo.png" alt="EOC Logo" width={64} height={64} className="w-10 h-10 md:w-16 md:h-16 object-contain" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold">ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข</h1>
                            <p className="text-xs text-blue-100 hidden sm:block">Satun Provincial Emergency Operations Center (Satun Geo-EOC)</p>
                        </div>
                    </div>

                    {/* User Info & Actions */}
                    <div className="flex items-center gap-4">
                        {/* Province Name - Hidden on mobile if user logged in */}
                        <div className={`hidden ${user ? 'lg:flex' : 'md:flex'} items-center`}>
                            <span className="text-xs sm:text-sm">ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข จังหวัดสตูล</span>
                        </div>

                        {/* User Menu */}
                        {user ? (
                            <div className="relative">
                                <button
                                    onClick={() => setShowMenu(!showMenu)}
                                    className="flex items-center gap-2 bg-[#0b4c86] hover:bg-[#0f5c9f] px-3 py-2 rounded-lg transition-colors"
                                >
                                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                                        <span className="text-[#083865] font-bold text-sm">
                                            {user.givenName ? user.givenName.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="hidden md:block text-left">
                                        <div className="text-sm font-semibold">
                                            {`${user.title || ''} ${user.givenName || ''} ${user.familyName || ''}`.trim() || user.username}
                                        </div>
                                        <div className="text-xs text-blue-100">{user.roleDisplay}</div>
                                    </div>
                                    <AppIcon icon="chevronDown" className={`h-4 w-4 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Dropdown Menu */}
                                {showMenu && (
                                    <>
                                        {/* Backdrop */}
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => setShowMenu(false)}
                                        ></div>

                                        {/* Menu */}
                                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl z-20 overflow-hidden">
                                            {/* User Info */}
                                            <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                                                <p className="font-semibold text-gray-800">
                                                    {`${user.title || ''} ${user.givenName || ''} ${user.familyName || ''}`.trim() || user.username}
                                                </p>
                                                <p className="text-sm text-gray-600">{user.email}</p>
                                                <p className="text-xs text-blue-700 mt-1">{user.roleDisplay}</p>
                                                {user.department && (
                                                    <p className="text-xs text-gray-500">{user.department}</p>
                                                )}
                                                {user.thaiIdData && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        เข้าสู่ระบบด้วย ThaID
                                                    </p>
                                                )}
                                            </div>

                                            {/* Menu Items */}
                                            <div className="py-2">
                                                <a
                                                    href="/dashboard"
                                                    className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors"
                                                    onClick={() => setShowMenu(false)}
                                                >
                                                    <AppIcon icon="home" className="mr-2 inline h-4 w-4" />
                                                    หน้าหลัก
                                                </a>
                                                <a
                                                    href="/profile"
                                                    className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors"
                                                    onClick={() => setShowMenu(false)}
                                                >
                                                    <AppIcon icon="user" className="mr-2 inline h-4 w-4" />
                                                    โปรไฟล์
                                                </a>
                                                <a
                                                    href="/settings"
                                                    className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors"
                                                    onClick={() => setShowMenu(false)}
                                                >
                                                    <AppIcon icon="settings" className="mr-2 inline h-4 w-4" />
                                                    ตั้งค่า
                                                </a>
                                            </div>

                                            {/* Logout */}
                                            <div className="border-t border-gray-200">
                                                <button
                                                    onClick={handleLogout}
                                                    className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 transition-colors font-medium"
                                                >
                                                    <AppIcon icon="logout" className="mr-2 inline h-4 w-4" />
                                                    ออกจากระบบ
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <a
                                href="/login"
                                className="bg-[#0b4c86] hover:bg-[#0f5c9f] px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                            >
                                <span className="inline-flex items-center gap-2">
                                    <AppIcon icon="lock" className="h-4 w-4" />
                                    เข้าสู่ระบบ
                                </span>
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
