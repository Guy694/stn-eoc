"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import EOCLayout from "@/components/layouts/EOCLayout";
import EocControlWorkspace from "@/components/admin/eoc/EocControlWorkspace";
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
      <EocControlWorkspace />
    </EOCLayout>
  );
}
