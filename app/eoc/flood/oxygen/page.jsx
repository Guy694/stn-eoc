"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import OxygenWorkspace from "@/components/eoc/oxygen/OxygenWorkspace";

export default function FloodOxygenPage() {
  return (
    <EOCLayout>
      <OxygenWorkspace eocType="flood" />
    </EOCLayout>
  );
}
