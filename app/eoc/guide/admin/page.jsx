"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import GuideView from "@/components/guide/GuideView";
import { EmptyPanel } from "@/components/common/ThemePanels";
import { useAuth } from "@/context/AuthContext";
import { adminGuide } from "@/lib/guides";

export default function AdminGuidePage() {
  const { user, loading } = useAuth();
  return (
    <EOCLayout>
      {loading ? null : user?.role === "admin" ? (
        <GuideView guide={adminGuide} current="admin" showAdminLink />
      ) : (
        <div className="mx-auto max-w-xl">
          <EmptyPanel icon="lock" title="คู่มือนี้สำหรับผู้ดูแลระบบ" text="ดูวิธีใช้งานสำหรับเจ้าหน้าที่ได้ที่เมนู “คู่มือการใช้งาน”" />
        </div>
      )}
    </EOCLayout>
  );
}
