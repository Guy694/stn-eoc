"use client";
// ตั้งค่าบัญชี: รวมเข้ากับหน้าโปรไฟล์แล้ว (/profile#password)
// หน้านี้ยังใช้เป็นหน้า "บังคับเปลี่ยนรหัสผ่าน" (AuthContext ส่งผู้ใช้ที่ใช้รหัสผ่านชั่วคราวมาที่นี่ — API อื่นถูกปิดจนกว่าจะเปลี่ยน)
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import { AdminPage } from "@/components/admin/crud";
import ChangePasswordCard from "@/components/account/ChangePasswordCard";

export default function SettingsPage() {
    const router = useRouter();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (loading) return;
        if (!user) router.push("/login");
        else if (!user.mustChangePassword) router.replace("/profile#password");
    }, [user, loading, router]);

    if (loading || !user || !user.mustChangePassword) {
        return <div className="flex min-h-screen items-center justify-center"><p className="text-sm text-slate-500">กำลังโหลด…</p></div>;
    }
    return (
        <EOCLayout>
            <AdminPage title="ตั้งรหัสผ่านใหม่" description="บัญชีนี้ต้องเปลี่ยนรหัสผ่านก่อนใช้งานระบบ">
                <ChangePasswordCard />
            </AdminPage>
        </EOCLayout>
    );
}
