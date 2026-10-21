'use client';

import PublicOpsScaffold from '@/components/public/PublicOpsScaffold';
import HydroTrendsWorkspace from '@/components/eoc/hydro/HydroTrendsWorkspace';

// แนวโน้มระดับน้ำและฝน (ประชาชน) — เปิดจาก "น้ำในคลองตอนนี้" หน้าแรก
export default function PublicWaterTrendsPage() {
  return (
    <PublicOpsScaffold title="แนวโน้มระดับน้ำและฝน" subtitle="ข้อมูลจากสถานีตรวจวัด จ.สตูล" activeMenu="weather" showPageHeader={false} mainClassName="p-0!">
      <div className="bg-[#eef2f1] px-4 py-6 sm:px-6">
        <HydroTrendsWorkspace publicMode />
      </div>
    </PublicOpsScaffold>
  );
}
