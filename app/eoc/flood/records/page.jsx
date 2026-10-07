"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import FloodRecordsWorkspace from "@/components/eoc/flood-records/FloodRecordsWorkspace";

// บันทึกพื้นที่น้ำท่วมรายวัน — ส่วนประกอบอยู่ใน components/eoc/flood-records
export default function FloodRecordsPage() {
  return (
    <EOCLayout>
      <FloodRecordsWorkspace />
    </EOCLayout>
  );
}
