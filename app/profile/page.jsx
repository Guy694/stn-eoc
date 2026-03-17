"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import EOCLayout from "@/components/layouts/EOCLayout";

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
    const [message, setMessage] = useState({ type: "", text: "" });

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

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: "", text: "" });

        try {
            const response = await fetch('/stn-eoc/api/officer/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    ...formData
                })
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ type: "success", text: "บันทึกข้อมูลสำเร็จ" });
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
                setMessage({ type: "error", text: data.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            setMessage({ type: "error", text: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
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
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">👤 โปรไฟล์ผู้ใช้</h1>
                    <p className="text-gray-600">จัดการข้อมูลส่วนตัวของคุณ</p>
                </div>

                {/* Message */}
                {message.text && (
                    <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        <p className="font-medium">{message.text}</p>
                    </div>
                )}

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
                                    <InfoField label="ชื่อ-นามสกุล" value={`${user.title || ''} ${user.givenName || ''} ${user.familyName || ''}`.trim()} icon="👤" />
                                    <InfoField label="อีเมล" value={user.email} icon="📧" />
                                    <InfoField label="เบอร์โทรศัพท์" value={user.phone} icon="📱" />
                                    <InfoField label="ตำแหน่ง" value={user.position} icon="💼" />
                                    <InfoField label="หน่วยงาน" value={user.department} icon="🏢" />
                                    <InfoField label="บทบาท" value={user.roleDisplay} icon="🎭" />
                                </div>

                                {/* Permissions */}
                                <div className="mt-8 pt-8 border-t border-gray-200">
                                    <h3 className="text-xl font-bold text-gray-800 mb-4">🔐 สิทธิ์การเข้าถึง</h3>
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

                                <div className="mt-8 flex gap-4">
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                                    >
                                        ✏️ แก้ไขข้อมูล
                                    </button>
                                    <a
                                        href="/settings"
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors"
                                    >
                                        ⚙️ ตั้งค่า
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
                                        💾 บันทึก
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditing(false);
                                            setMessage({ type: "", text: "" });
                                        }}
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors"
                                    >
                                        ❌ ยกเลิก
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
                {icon && <span className="mr-2">{icon}</span>}
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
        purple: "bg-purple-100 text-purple-700",
        cyan: "bg-cyan-100 text-cyan-700"
    };

    return (
        <div className={`${colorClasses[color]} px-3 py-2 rounded-lg text-sm font-medium text-center`}>
            {label}
        </div>
    );
}
