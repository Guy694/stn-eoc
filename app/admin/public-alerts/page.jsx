"use client";

import { useAuth } from "@/context/AuthContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import { AdminPage } from "@/components/admin/crud";
import PublicPushSettings from "@/components/admin/settings/PublicPushSettings";

// แจ้งเตือนประชาชน (Web Push): ส่งข้อความเอง ข้อความสำเร็จรูป การส่งอัตโนมัติ และประวัติการส่ง
// ผู้ดูแลระบบและผู้บัญชาการเหตุการณ์ใช้ได้ (เปิด/ปิดการส่งอัตโนมัติได้เฉพาะผู้ดูแลระบบ)
export default function PublicAlertsPage() {
  const { user, loading } = useAuth();
  const allowed = ["admin", "commander"].includes(user?.role);
  return (
    <EOCLayout>
      {loading ? null : allowed ? (
        <AdminPage title="แจ้งเตือนประชาชน" description="ส่งเตือนภัยเข้ามือถือประชาชนที่กดรับแจ้งเตือน ตั้งการส่งอัตโนมัติ และดูประวัติการส่ง">
          <PublicPushSettings />
        </AdminPage>
      ) : (
        <p className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">หน้านี้สำหรับผู้ดูแลระบบและผู้บัญชาการเหตุการณ์</p>
      )}
    </EOCLayout>
  );
}
