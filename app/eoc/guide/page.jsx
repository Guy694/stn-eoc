"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import GuideView from "@/components/guide/GuideView";
import { useAuth } from "@/context/AuthContext";
import { officerGuide } from "@/lib/guides";

export default function OfficerGuidePage() {
  const { user } = useAuth();
  return (
    <EOCLayout>
      <GuideView guide={officerGuide} current="officer" showAdminLink={user?.role === "admin"} />
    </EOCLayout>
  );
}
