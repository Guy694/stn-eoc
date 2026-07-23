"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import AppIcon from "@/components/icons/AppIcon";
import { showError, showSuccess } from "@/lib/sweetAlert";

export default function ProfilePage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        givenName: "",
        familyName: "",
        email: "",
        phone: "",
        department: "",
        position: ""
    });
    const [telegramSettings, setTelegramSettings] = useState({
        telegramChatId: "",
        telegramNotifyEnabled: false,
        botLink: ""
    });
    const [telegramSaving, setTelegramSaving] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        } else if (user) {
            setFormData({
                title: user.title || "",
                givenName: user.givenName || "",
                familyName: user.familyName || "",
                email: user.email || "",
                phone: user.phone || "",
                department: user.department || "",
                position: user.position || ""
            });
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (!user) return;

        const loadTelegramSettings = async () => {
            try {
                const response = await fetch("/stn-eoc/api/officer/telegram");
                const data = await response.json();
                if (data.success) {
                    setTelegramSettings(data.data);
                }
            } catch (error) {
                console.error("Error loading Telegram settings:", error);
            }
        };

        loadTelegramSettings();
    }, [user]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/stn-eoc/api/officer/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                showSuccess("บันทึกข้อมูลสำเร็จ");
                setIsEditing(false);

                // อัพเดท user context ด้วยข้อมูลใหม่
                if (data.data) {
                    const updatedUser = {
                        ...user,
                        title: data.data.title,
                        givenName: data.data.given_name,
                        familyName: data.data.family_name,
                        email: data.data.email,
                        phone: data.data.phone,
                        department: data.data.department,
                        position: data.data.position
                    };
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                }
            } else {
                showError(data.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showError("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        }
    };

    const handleTelegramSubmit = async (event) => {
        event.preventDefault();
        setTelegramSaving(true);
        try {
            const response = await fetch("/stn-eoc/api/officer/telegram", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(telegramSettings)
            });
            const data = await response.json();
            if (data.success) {
                setTelegramSettings((current) => ({ ...current, ...data.data }));
                showSuccess("บันทึกการแจ้งเตือน Telegram สำเร็จ");
            } else {
                showError(data.message || "บันทึก Telegram ไม่สำเร็จ");
            }
        } catch (error) {
            console.error("Error saving Telegram settings:", error);
            showError("เกิดข้อผิดพลาดในการบันทึก Telegram");
        } finally {
            setTelegramSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b border-green-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">กำลังโหลด...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <EOCLayout>
            <div className="p-6 max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2"><AppIcon icon="user" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> โปรไฟล์ผู้ใช้</h1>
                    <p className="text-gray-600">จัดการข้อมูลส่วนตัวของคุณ</p>
                </div>

                {/* Profile Card */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
                    {/* Header Section */}
                    <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-8">
                        <div className="flex items-center gap-6">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg">
                                <span className="text-green-700 font-bold text-4xl">
                                    {user.givenName ? user.givenName.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold mb-1">{`${user.title || ''} ${user.givenName || ''} ${user.familyName || ''}`.trim() || user.username}</h2>
                                <p className="text-green-100 text-lg">{user.roleDisplay}</p>
                                <div className="flex items-center gap-4 mt-2">
                                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                                        @{user.username}
                                    </span>
                                    {user.department && (
                                        <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                                            {user.department}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Body Section */}
                    <div className="p-8">
                        {!isEditing ? (
                            // View Mode
                            <div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <InfoField label="ชื่อ-นามสกุล" value={`${user.title || ''} ${user.givenName || ''} ${user.familyName || ''}`.trim()} icon="user" />
                                    <InfoField label="อีเมล" value={user.email} icon="mail" />
                                    <InfoField label="เบอร์โทรศัพท์" value={user.phone} icon="phone" />
                                    <InfoField label="ตำแหน่ง" value={user.position} icon="briefcase" />
                                    <InfoField label="หน่วยงาน" value={user.department} icon="building" />
                                    <InfoField label="บทบาท" value={user.roleDisplay} icon="userCog" />
                                </div>

                                {/* Permissions */}
                                <div className="mt-8 pt-8 border-t border-gray-200">
                                    <h3 className="text-xl font-bold text-gray-800 mb-4"><AppIcon icon="lock" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> สิทธิ์การเข้าถึง</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {user.permissions?.dashboard && (
                                            <PermissionBadge label="Dashboard" />
                                        )}
                                        {user.permissions?.eoc?.view && (
                                            <PermissionBadge label="ดูข้อมูล EOC" />
                                        )}
                                        {user.permissions?.eoc?.create && (
                                            <PermissionBadge label="บันทึกข้อมูล" color="green" />
                                        )}
                                        {user.permissions?.eoc?.edit && (
                                            <PermissionBadge label="แก้ไขข้อมูล" color="yellow" />
                                        )}
                                        {user.permissions?.eoc?.delete && (
                                            <PermissionBadge label="ลบข้อมูล" color="red" />
                                        )}
                                        {user.permissions?.admin?.view && (
                                            <PermissionBadge label="จัดการระบบ" color="purple" />
                                        )}
                                        {user.permissions?.reports?.view && (
                                            <PermissionBadge label="รายงาน" />
                                        )}
                                        {user.permissions?.reports?.export && (
                                            <PermissionBadge label="ส่งออกรายงาน" color="cyan" />
                                        )}
                                    </div>
                                </div>

                                <form onSubmit={handleTelegramSubmit} className="mt-8 rounded-xl border border-sky-100 bg-sky-50 p-5">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-900">แจ้งเตือน Telegram</h3>
                                            <p className="mt-1 text-sm text-slate-600">
                                                เพิ่ม Bot แล้วบันทึก Chat ID เพื่อรับแจ้งเตือนเมื่อประชาชนส่งคำขอความช่วยเหลือ
                                            </p>
                                        </div>
                                        {telegramSettings.botLink ? (
                                            <a
                                                href={telegramSettings.botLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="rounded-lg bg-sky-600 px-4 py-2 text-center text-sm font-bold text-white hover:bg-sky-700"
                                            >
                                                เพิ่ม Bot
                                            </a>
                                        ) : (
                                            <span className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-500">
                                                ยังไม่ได้ตั้งค่า Bot username
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                                        <label className="block">
                                            <span className="mb-2 block text-sm font-bold text-slate-700">Telegram Chat ID</span>
                                            <input
                                                type="text"
                                                value={telegramSettings.telegramChatId || ""}
                                                onChange={(event) => setTelegramSettings((current) => ({ ...current, telegramChatId: event.target.value }))}
                                                placeholder="เช่น 123456789"
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-700 outline-none focus:border-sky-500"
                                            />
                                        </label>
                                        <label className="flex items-center gap-2 rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm font-bold text-slate-700">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(telegramSettings.telegramNotifyEnabled)}
                                                onChange={(event) => setTelegramSettings((current) => ({ ...current, telegramNotifyEnabled: event.target.checked }))}
                                                className="h-4 w-4 accent-sky-600"
                                            />
                                            รับแจ้งเตือน
                                        </label>
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500">
                                        วิธีใช้งาน: กดเพิ่ม Bot, ส่งข้อความหา Bot จาก Telegram แล้วนำ Chat ID ที่ได้รับ/ที่ผู้ดูแลให้มาบันทึกในช่องนี้
                                    </p>
                                    <button
                                        type="submit"
                                        disabled={telegramSaving}
                                        className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:bg-slate-300"
                                    >
                                        {telegramSaving ? "กำลังบันทึก..." : "บันทึก Telegram"}
                                    </button>
                                </form>

                                <div className="mt-8 flex gap-4">
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                                    >
                                        <AppIcon icon="edit" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> แก้ไขข้อมูล
                                    </button>
                                    <a
                                        href="/settings"
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors"
                                    >
                                        <AppIcon icon="settings" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ตั้งค่า
                                    </a>
                                </div>
                            </div>
                        ) : (
                            // Edit Mode
                            <form onSubmit={handleSubmit}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div>
                                        <label className="block text-gray-700 font-semibold mb-2">คำนำหน้า</label>
                                        <select
                                            name="title"
                                            value={formData.title}
                                            onChange={handleChange}
                                            className="text-gray-600 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        >
                                            <option value="">ไม่ระบุ</option>
                                            <option value="นาย">นาย</option>
                                            <option value="นาง">นาง</option>
                                            <option value="นางสาว">นางสาว</option>
                                            <option value="ดร.">ดร.</option>
                                        </select>
                                    </div>
                                    <FormField
                                        label="ชื่อ"
                                        name="givenName"
                                        value={formData.givenName}
                                        onChange={handleChange}
                                        required
                                        placeholder="เช่น สมชาย"
                                    />
                                    <FormField
                                        label="นามสกุล"
                                        name="familyName"
                                        value={formData.familyName}
                                        onChange={handleChange}
                                        required
                                        placeholder="เช่น ใจดี"
                                    />
                                    <FormField
                                        label="อีเมล"
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                    />
                                    <FormField
                                        label="เบอร์โทรศัพท์"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                    />
                                    <FormField
                                        label="ตำแหน่ง"
                                        name="position"
                                        value={formData.position}
                                        onChange={handleChange}
                                    />
                                    <FormField
                                        label="หน่วยงาน"
                                        name="department"
                                        value={formData.department}
                                        onChange={handleChange}
                                        fullWidth
                                    />
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        type="submit"
                                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                                    >
                                        <AppIcon icon="save" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> บันทึก
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditing(false);
                                        }}
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors"
                                    >
                                        <AppIcon icon="xCircle" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ยกเลิก
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </EOCLayout>
    );
}

// Info Field Component
function InfoField({ label, value, icon }) {
    return (
        <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">
                {icon && <AppIcon icon={icon} className="mr-2 h-5 w-5" />}
                {label}
            </label>
            <p className="text-lg text-gray-800">{value || "-"}</p>
        </div>
    );
}

// Form Field Component
function FormField({ label, name, type = "text", value, onChange, required = false, fullWidth = false }) {
    return (
        <div className={fullWidth ? "md:col-span-2" : ""}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                required={required}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
        </div>
    );
}

// Permission Badge Component
function PermissionBadge({ label, color = "blue" }) {
    const colorClasses = {
        blue: "bg-blue-100 text-blue-700",
        green: "bg-green-100 text-green-700",
        yellow: "bg-yellow-100 text-yellow-700",
        red: "bg-red-100 text-red-700",
        purple: "bg-teal-100 text-teal-700",
        cyan: "bg-cyan-100 text-cyan-700"
    };

    return (
        <div className={`${colorClasses[color]} px-3 py-2 rounded-lg text-sm font-medium text-center`}>
            {label}
        </div>
    );
}
