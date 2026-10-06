"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import SuppliesWorkspace from "@/components/eoc/supplies/SuppliesWorkspace";

export default function FloodSuppliesPage() {
  return (
    <EOCLayout>
      <SuppliesWorkspace eocType="flood" />
    </EOCLayout>
  );
}
