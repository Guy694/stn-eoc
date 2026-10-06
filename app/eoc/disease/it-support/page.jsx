"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import ItSupportWorkspace from "@/components/eoc/it-support/ItSupportWorkspace";

// รายงาน IT support ในเหตุการณ์
export default function EventItSupportPage() {
  return (
    <EOCLayout>
      <ItSupportWorkspace eocType="disease" />
    </EOCLayout>
  );
}
