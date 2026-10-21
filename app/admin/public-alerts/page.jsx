"use client";

import { Volume2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import { AdminPage } from "@/components/admin/crud";
import PublicPushSettings from "@/components/admin/settings/PublicPushSettings";
import AlertSoundSettings from "@/components/admin/settings/AlertSoundSettings";

// แจ้งเตือนประชาชน (Web Push): ส่งข้อความเอง ข้อความสำเร็จรูป การส่งอัตโนมัติ ประวัติการส่ง และเสียงแจ้งเตือน
// ผู้ดูแลระบบและผู้บัญชาการเหตุการณ์ใช้ได้ (เปิด/ปิดการส่งอัตโนมัติและเปลี่ยนเสียงได้เฉพาะผู้ดูแลระบบ)
export default function PublicAlertsPage() {
  const { user, loading } = useAuth();
  const allowed = ["admin", "commander"].includes(user?.role);
  const isAdmin = user?.role === "admin";
  return (
    <EOCLayout>
      {loading ? null : allowed ? (
        <AdminPage
          title="แจ้งเตือนประชาชน"
          description="ส่งเตือนภัยเข้ามือถือประชาชนที่กดรับแจ้งเตือน ตั้งการส่งอัตโนมัติ เลือกเสียงแจ้งเตือน และดูประวัติการส่ง"
          actions={isAdmin ? (
            <a href="#alert-sounds" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[#0b4c86] hover:bg-slate-100">
              <Volume2 className="h-4 w-4" aria-hidden="true" />เปลี่ยนเสียงแจ้งเตือน
            </a>
          ) : null}
        >
          <PublicPushSettings />
          {isAdmin ? (
            <div id="alert-sounds" className="scroll-mt-4">
              <AlertSoundSettings />
            </div>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">เสียงแจ้งเตือนของระบบเปลี่ยนได้เฉพาะผู้ดูแลระบบ</p>
          )}
        </AdminPage>
      ) : (
        <p className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">หน้านี้สำหรับผู้ดูแลระบบและผู้บัญชาการเหตุการณ์</p>
      )}
    </EOCLayout>
  );
}
