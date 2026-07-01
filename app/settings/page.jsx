"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import EOCLayout from "@/components/layouts/EOCLayout";

export default function SettingsPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [activeTab, setActiveTab] = useState("password");
    const [passwordData, setPasswordData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });
    const [message, setMessage] = useState({ type: "", text: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setMessage({ type: "", text: "" });

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: "error", text: "รหัสผ่านใหม่ไม่ตรงกัน" });
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setMessage({ type: "error", text: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch('/stn-eoc/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ type: "success", text: "เปลี่ยนรหัสผ่านสำเร็จ" });
                setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
            } else {
                setMessage({ type: "error", text: data.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ" });
            }
        } catch (error) {
            setMessage({ type: "error", text: "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน" });
        } finally {
            setIsSubmitting(false);
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
            <div className="p-6 max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">⚙️ ตั้งค่า</h1>
                    <p className="text-gray-600">จัดการการตั้งค่าบัญชีและความปลอดภัย</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl shadow-md overflow-hidden">
                            <button
                                onClick={() => setActiveTab("password")}
                                className={`w-full text-left px-6 py-4 transition-colors ${activeTab === "password" ? "bg-green-50 text-green-700 border border-green-600" : "text-green-900 hover:bg-green-50"}`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">🔒</span>
                                    <div>
                                        <div className="font-semibold">รหัสผ่าน</div>
                                        <div className="text-xs opacity-75">เปลี่ยนรหัสผ่าน</div>
                                    </div>
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab("notifications")}
                                className={`w-full text-left px-6 py-4 transition-colors ${activeTab === "notifications" ? "bg-green-50 text-green-700 border border-green-600" : "text-green-900 hover:bg-green-50"}`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">🔔</span>
                                    <div>
                                        <div className="font-semibold">การแจ้งเตือน</div>
                                        <div className="text-xs opacity-75">ตั้งค่าการแจ้งเตือน</div>
                                    </div>
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab("preferences")}
                                className={`w-full text-left px-6 py-4 transition-colors ${activeTab === "preferences" ? "bg-green-50 text-green-700 border border-green-600" : "text-green-900 hover:bg-green-50"}`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">🎨</span>
                                    <div>
                                        <div className="font-semibold">การแสดงผล</div>
                                        <div className="text-xs opacity-75">ธีม และภาษา</div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-3">
                        <div className="bg-white rounded-xl shadow-lg p-8">
                            {/* Message */}
                            {message.text && (
                                <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                    <p className="font-medium">{message.text}</p>
                                </div>
                            )}

                            {/* Password Tab */}
                            {activeTab === "password" && (
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800 mb-6">🔒 เปลี่ยนรหัสผ่าน</h2>
                                    <form onSubmit={handlePasswordChange} className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                รหัสผ่านปัจจุบัน <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="password"
                                                value={passwordData.currentPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                                required
                                                disabled={isSubmitting}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                รหัสผ่านใหม่ <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="password"
                                                value={passwordData.newPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                                required
                                                disabled={isSubmitting}
                                                minLength={6}
                                            />
                                            <p className="text-sm text-gray-500 mt-1">รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                ยืนยันรหัสผ่านใหม่ <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="password"
                                                value={passwordData.confirmPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                                required
                                                disabled={isSubmitting}
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitting ? "กำลังบันทึก..." : "💾 บันทึก"}
                                        </button>
                                    </form>
                                </div>
                            )}

                            {/* Notifications Tab */}
                            {activeTab === "notifications" && (
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800 mb-6">🔔 การแจ้งเตือน</h2>
                                    <div className="space-y-4">
                                        <NotificationToggle
                                            label="แจ้งเตือนเหตุการณ์ใหม่"
                                            description="รับการแจ้งเตือนเมื่อมีเหตุการณ์ภัยพิบัติใหม่"
                                            defaultChecked={true}
                                        />
                                        <NotificationToggle
                                            label="แจ้งเตือนการอัพเดทข้อมูล"
                                            description="รับการแจ้งเตือนเมื่อมีการอัพเดทข้อมูลในระบบ"
                                            defaultChecked={true}
                                        />
                                        <NotificationToggle
                                            label="แจ้งเตือนทาง Email"
                                            description="รับการแจ้งเตือนผ่านอีเมล"
                                            defaultChecked={false}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Preferences Tab */}
                            {activeTab === "preferences" && (
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800 mb-6">🎨 การแสดงผล</h2>
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                ธีม
                                            </label>
                                            <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all">
                                                <option value="light">สว่าง</option>
                                                <option value="dark">มืด</option>
                                                <option value="auto">ปรับอัตโนมัติ</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                ภาษา
                                            </label>
                                            <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all">
                                                <option value="th">ไทย</option>
                                                <option value="en">English</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </EOCLayout>
    );
}

// Notification Toggle Component
function NotificationToggle({ label, description, defaultChecked = false }) {
    const [checked, setChecked] = useState(defaultChecked);

    return (
        <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
                <div className="font-semibold text-gray-800">{label}</div>
                <div className="text-sm text-gray-600 mt-1">{description}</div>
            </div>
            <button
                onClick={() => setChecked(!checked)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${checked ? 'bg-green-600' : 'bg-gray-200'}`}
            >
                <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
                />
            </button>
        </div>
    );
}
