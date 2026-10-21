"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import GuideView from "@/components/guide/GuideView";
import { useAuth } from "@/context/AuthContext";
import { adminGuide } from "@/lib/guides";

export default function AdminGuidePage() {
  const { user, loading } = useAuth();
  return (
    <EOCLayout>
      {loading ? null : user?.role === "admin" ? (
        <GuideView guide={adminGuide} current="admin" showAdminLink />
      ) : (
        <p className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-700">คู่มือนี้สำหรับผู้ดูแลระบบ ดูวิธีใช้งานสำหรับเจ้าหน้าที่ได้ที่เมนู “คู่มือการใช้งาน”</p>
      )}
    </EOCLayout>
  );
}
