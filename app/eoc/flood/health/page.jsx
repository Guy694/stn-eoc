"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import { Tabs } from "@/components/admin/crud";
import { useUrlState } from "@/components/admin/useUrlState";
import ShelterDiseaseReports from "@/components/eoc/flood-health/ShelterDiseaseReports";
import DailyDiseaseRecords from "@/components/eoc/disease/DailyDiseaseRecords";
import HealthDashboard from "@/components/eoc/flood-health/HealthDashboard";

// โรคและสุขภาพช่วงน้ำท่วม: ในศูนย์พักพิง + ในชุมชน/พื้นที่ (ผูกกับเหตุการณ์อุทกภัยเดียวกัน)
const TABS = [
  { value: "overview", label: "ภาพรวม" },
  { value: "shelter", label: "ในศูนย์พักพิง" },
  { value: "community", label: "ในชุมชน / พื้นที่" }
];

// โรคที่มักตามมาหลังน้ำท่วม ให้ขึ้นก่อนในรายการ
const POST_FLOOD_DISEASES = ["โรคฉี่หนู (เลปโตสไปโรซิส)", "อุจจาระร่วง", "โรคผิวหนัง/น้ำกัดเท้า", "ตาแดง", "ไข้หวัด/ไข้หวัดใหญ่", "ไข้เลือดออก"];

export default function FloodHealthPage() {
  const [tab, setTab] = useUrlState("tab", "overview", TABS.map((item) => item.value));
  return (
    <EOCLayout>
      <div className="mb-4 rounded-xl border border-[#c9dcee] bg-white px-2 shadow-sm">
        <Tabs value={tab} onChange={setTab} items={TABS} />
      </div>
      {tab === "overview" ? (
        <HealthDashboard eocType="flood" onGoto={setTab} />
      ) : tab === "community" ? (
        <DailyDiseaseRecords
          eocType="flood"
          title="โรคในชุมชนช่วงน้ำท่วม"
          subtitle="ผู้ป่วยนอกศูนย์พักพิง รายหมู่บ้าน"
          priorityDiseases={POST_FLOOD_DISEASES}
        />
      ) : (
        <ShelterDiseaseReports />
      )}
    </EOCLayout>
  );
}
