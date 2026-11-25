"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import EOCLayout from "@/components/layouts/EOCLayout";
import EocControlWorkspace from "@/components/admin/eoc/EocControlWorkspace";
import LinkTabs, { EOC_ADMIN_TABS } from "@/components/common/LinkTabs";
import { useAuth } from "@/context/AuthContext";

export default function EOCManagementPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) router.push("/dashboard");
  }, [loading, router, user]);

  if (loading || user?.role !== "admin") return null;
  return (
    <EOCLayout>
      <LinkTabs items={EOC_ADMIN_TABS} current="control" label="เหตุการณ์ EOC" className="mb-4" />
      <EocControlWorkspace />
    </EOCLayout>
  );
}
