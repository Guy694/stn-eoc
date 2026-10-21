"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import HydroTrendsWorkspace from "@/components/eoc/hydro/HydroTrendsWorkspace";

// แนวโน้มน้ำ ฝน และน้ำทะเลหนุน (เจ้าหน้าที่ทุกบทบาท)
export default function HydroTrendsPage() {
  return (
    <EOCLayout>
      <HydroTrendsWorkspace />
    </EOCLayout>
  );
}
