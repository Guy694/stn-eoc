"use client";

import { useAuth } from "@/context/AuthContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import SystemSettingsWorkspace from "@/components/admin/settings/SystemSettingsWorkspace";

export default function SystemSettingsPage() {
  const { user, loading } = useAuth();
  return (
    <EOCLayout>
      {loading ? null : user?.role === "admin" ? (
        <SystemSettingsWorkspace />
      ) : (
        <p className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
      )}
    </EOCLayout>
  );
}
