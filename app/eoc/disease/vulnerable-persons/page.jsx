"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import VulnerablePersonsWorkspace from "@/components/eoc/vulnerable/VulnerablePersonsWorkspace";

// แผนที่และทะเบียนกลุ่มเปราะบางรายบุคคล (เฉพาะเจ้าหน้าที่)
export default function VulnerablePersonsPage() {
  return (
    <EOCLayout>
      <VulnerablePersonsWorkspace eocType="disease" />
    </EOCLayout>
  );
}
