"use client";
// เปลี่ยนรหัสผ่านของฉัน (ใช้ในหน้าโปรไฟล์ และหน้าบังคับเปลี่ยนรหัสผ่าน /settings)
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { inputClass } from "@/components/admin/crud";
import { showError, showSuccess } from "@/lib/sweetAlert";
import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_TEXT, validatePassword } from "@/lib/passwordPolicy";

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };

export default function ChangePasswordCard({ className = "", id = "password" }) {
    const router = useRouter();
    const { user, validateSession } = useAuth();
    const [data, setData] = useState(EMPTY);
    const [busy, setBusy] = useState(false);
    if (!user) return null;

    const submit = async (e) => {
        e.preventDefault();
        if (data.newPassword !== data.confirmPassword) return showError("รหัสผ่านใหม่ไม่ตรงกัน");
        const policyError = validatePassword(data.newPassword, { username: user?.username, currentPassword: data.currentPassword });
        if (policyError) return showError(policyError);
        setBusy(true);
        try {
            const response = await fetch("/stn-eoc/api/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword })
            });
            const json = await response.json();
            if (json.success) {
                const wasForced = Boolean(user?.mustChangePassword);
                showSuccess("เปลี่ยนรหัสผ่านสำเร็จ");
                setData(EMPTY);
                await validateSession();
                if (wasForced) router.push("/dashboard");
            } else {
                showError(json.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
            }
        } catch {
            showError("เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน");
        } finally {
            setBusy(false);
        }
    };
    const field = (key) => (e) => setData((current) => ({ ...current, [key]: e.target.value }));

    return (
        <section id={id} className={`scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 ${className}`} aria-labelledby={`${id}-title`}>
            <h3 id={`${id}-title`} className="flex items-center gap-2 font-black text-slate-900"><KeyRound className="h-5 w-5 text-[#0b4c86]" aria-hidden="true" />เปลี่ยนรหัสผ่าน</h3>
            {user.mustChangePassword && (
                <div role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
                    <p className="font-semibold">กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานระบบ</p>
                    <p className="text-sm">บัญชีนี้ใช้รหัสผ่านชั่วคราวที่ผู้ดูแลระบบออกให้ ระบบจะเปิดให้ใช้งานเมนูอื่นหลังจากตั้งรหัสผ่านใหม่แล้ว</p>
                </div>
            )}
            <p className="mt-1 text-sm text-slate-600">{PASSWORD_POLICY_TEXT}</p>
            <form onSubmit={submit} className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-3">
                <label className="block">
                    <span className="mb-1 block text-sm font-semibold text-slate-700">รหัสผ่านปัจจุบัน <span className="text-red-600">*</span></span>
                    <input type="password" autoComplete="current-password" value={data.currentPassword} onChange={field("currentPassword")} className={inputClass} required disabled={busy} />
                </label>
                <label className="block">
                    <span className="mb-1 block text-sm font-semibold text-slate-700">รหัสผ่านใหม่ <span className="text-red-600">*</span></span>
                    <input type="password" autoComplete="new-password" value={data.newPassword} onChange={field("newPassword")} className={inputClass} required disabled={busy} minLength={PASSWORD_MIN_LENGTH} />
                    <span className="mt-1 block text-xs text-slate-500">อย่างน้อย {PASSWORD_MIN_LENGTH} ตัวอักษร มีทั้งตัวอักษรและตัวเลข</span>
                </label>
                <label className="block">
                    <span className="mb-1 block text-sm font-semibold text-slate-700">ยืนยันรหัสผ่านใหม่ <span className="text-red-600">*</span></span>
                    <input type="password" autoComplete="new-password" value={data.confirmPassword} onChange={field("confirmPassword")} className={inputClass} required disabled={busy} />
                </label>
                <div className="sm:col-span-3">
                    <button type="submit" disabled={busy} className="rounded-lg bg-[#0b4c86] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#083865] disabled:cursor-not-allowed disabled:opacity-50">
                        {busy ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
                    </button>
                </div>
            </form>
        </section>
    );
}
