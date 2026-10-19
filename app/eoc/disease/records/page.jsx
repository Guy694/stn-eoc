"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import { Tabs } from "@/components/admin/crud";
import { useUrlState } from "@/components/admin/useUrlState";
import DailyDiseaseRecords from "@/components/eoc/disease/DailyDiseaseRecords";
import FacilityDiseaseReports from "@/components/eoc/disease/FacilityDiseaseReports";

// หน้าเดียวสำหรับรายงานผู้ป่วยโรคระบาด (รวมหน้าเดิม /admin/disease-reports เข้ามาเป็นแท็บ)
const TABS = [
  { value: "daily", label: "บันทึกรายหมู่บ้านวันนี้" },
  { value: "facility", label: "รายงานจากหน่วยบริการ / ย้อนหลัง" }
];

export default function DiseaseRecordsPage() {
  const [tab, setTab] = useUrlState("tab", "daily", TABS.map((item) => item.value));
  return (
    <EOCLayout>
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-2">
        <Tabs value={tab} onChange={setTab} items={TABS} />
      </div>
      {tab === "facility" ? <FacilityDiseaseReports /> : <DailyDiseaseRecords />}
    </EOCLayout>
  );
}
