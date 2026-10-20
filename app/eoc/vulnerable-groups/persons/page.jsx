"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import VulnerablePersonsWorkspace from "@/components/eoc/vulnerable/VulnerablePersonsWorkspace";

// ทะเบียนกลุ่มเปราะบางรายบุคคล (ข้อมูลกลาง): รายชื่อ แผนที่ และนำเข้าจาก Excel
// สถานะการช่วยเหลือผูกกับเหตุการณ์อุทกภัยล่าสุด (ถ้ามี) — ติดตามระหว่างเหตุการณ์ที่เมนูกลุ่มเปราะบางของ EOC
export default function VulnerableRegistryPersonsPage() {
  return (
    <EOCLayout>
      <VulnerablePersonsWorkspace eocType="flood" registry />
    </EOCLayout>
  );
}
