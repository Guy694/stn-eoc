"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import EventVulnerableWorkspace from "@/components/eoc/vulnerable/EventVulnerableWorkspace";

// กลุ่มเปราะบางในเหตุการณ์ที่เปิด (dashboard + รายหมู่บ้าน)
export default function EventVulnerablePage() {
  return (
    <EOCLayout>
      <EventVulnerableWorkspace eocType="flood" />
    </EOCLayout>
  );
}
