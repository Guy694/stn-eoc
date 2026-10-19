"use client";
// ตั้งค่าบัญชีของฉัน (ทุกบทบาท): เปลี่ยนรหัสผ่าน
// เดิมมีแท็บ "การแจ้งเตือน" และ "การแสดงผล" ที่ปุ่มไม่ได้บันทึกค่าจริง จึงเอาออกเพื่อไม่ให้เข้าใจผิด
// สถิติผู้เข้าชมและการตั้งค่าทั้งระบบย้ายไปที่ /admin/settings (เฉพาะผู้ดูแลระบบ)
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import { AdminPage, inputClass } from "@/components/admin/crud";
import { showError, showSuccess } from "@/lib/sweetAlert";
import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_TEXT, validatePassword } from "@/lib/passwordPolicy";

export default function SettingsPage() {
    const router = useRouter();
    const { user, loading, validateSession } = useAuth();
    const [passwordData, setPasswordData] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!loading && !user) router.push("/login");
    }, [user, loading, router]);

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            showError("รหัสผ่านใหม่ไม่ตรงกัน");
            return;
        }
        const policyError = validatePassword(passwordData.newPassword, {
            username: user?.username,
            currentPassword: passwordData.currentPassword
        });
        if (policyError) {
            showError(policyError);
            return;
        }
        setIsSubmitting(true);
        try {
            const response = await fetch('/stn-eoc/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword })
            });
            const data = await response.json();
            if (data.success) {
                const wasForced = Boolean(user?.mustChangePassword);
                showSuccess("เปลี่ยนรหัสผ่านสำเร็จ");
                setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
                await validateSession();
                if (wasForced) router.push("/dashboard");
            } else {
                showError(data.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
            }
        } catch {
            showError("เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p className="text-sm text-slate-500">กำลังโหลด…</p>
            </div>
        );
    }
    if (!user) return null;

    const setField = (key) => (e) => setPasswordData({ ...passwordData, [key]: e.target.value });

    return (
        <EOCLayout>
            <AdminPage title="ตั้งค่าบัญชีของฉัน" description="เปลี่ยนรหัสผ่านสำหรับเข้าสู่ระบบ">
                <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                        <h2 className="text-lg font-black text-slate-900">เปลี่ยนรหัสผ่าน</h2>
                        {user.mustChangePassword && (
                            <div role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
                                <p className="font-semibold">กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานระบบ</p>
                                <p className="text-sm">บัญชีนี้ใช้รหัสผ่านชั่วคราวที่ผู้ดูแลระบบออกให้ ระบบจะเปิดให้ใช้งานเมนูอื่นหลังจากตั้งรหัสผ่านใหม่แล้ว</p>
                            </div>
                        )}
                        <p className="mt-2 text-sm text-slate-600">{PASSWORD_POLICY_TEXT}</p>
                        <form onSubmit={handlePasswordChange} className="mt-5 max-w-md space-y-4">
                            <label className="block">
                                <span className="mb-1 block text-sm font-semibold text-slate-700">รหัสผ่านปัจจุบัน <span className="text-red-600">*</span></span>
                                <input type="password" autoComplete="current-password" value={passwordData.currentPassword} onChange={setField("currentPassword")} className={inputClass} required disabled={isSubmitting} />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-sm font-semibold text-slate-700">รหัสผ่านใหม่ <span className="text-red-600">*</span></span>
                                <input type="password" autoComplete="new-password" value={passwordData.newPassword} onChange={setField("newPassword")} className={inputClass} required disabled={isSubmitting} minLength={PASSWORD_MIN_LENGTH} />
                                <span className="mt-1 block text-xs text-slate-500">อย่างน้อย {PASSWORD_MIN_LENGTH} ตัวอักษร มีทั้งตัวอักษรและตัวเลข</span>
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-sm font-semibold text-slate-700">ยืนยันรหัสผ่านใหม่ <span className="text-red-600">*</span></span>
                                <input type="password" autoComplete="new-password" value={passwordData.confirmPassword} onChange={setField("confirmPassword")} className={inputClass} required disabled={isSubmitting} />
                            </label>
                            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-[#0b4c86] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#083865] disabled:cursor-not-allowed disabled:opacity-50">
                                {isSubmitting ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
                            </button>
                        </form>
                    </section>
                    <aside className="space-y-3">
                        <Link href="/profile" className="block rounded-2xl border border-slate-200 bg-white p-4 hover:bg-[#edf5fc]">
                            <p className="font-black text-slate-900">โปรไฟล์</p>
                            <p className="text-sm text-slate-600">ชื่อ อีเมล เบอร์โทร หน่วยงาน และสิทธิ์ของฉัน</p>
                        </Link>
                        {user.role === "admin" ? (
                            <Link href="/admin/settings" className="block rounded-2xl border border-slate-200 bg-white p-4 hover:bg-[#edf5fc]">
                                <p className="font-black text-slate-900">ตั้งค่าระบบ</p>
                                <p className="text-sm text-slate-600">สถานะระบบ การแจ้งเตือน การเชื่อมต่อ ความปลอดภัย สำรองข้อมูล และสถิติผู้เข้าชม</p>
                            </Link>
                        ) : null}
                    </aside>
                </div>
            </AdminPage>
        </EOCLayout>
    );
}
