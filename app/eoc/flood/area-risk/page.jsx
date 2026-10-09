"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import AreaRiskWorkspace from "@/components/eoc/area-risk/AreaRiskWorkspace";

// วิเคราะห์พื้นที่เสี่ยงน้ำท่วมรายตำบล (เฉพาะเจ้าหน้าที่)
export default function AreaRiskPage() {
  return (
    <EOCLayout>
      <AreaRiskWorkspace />
    </EOCLayout>
  );
}
