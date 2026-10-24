"use client";

// ผู้เข้าชม: ประวัติการเข้าชม (IP/ตำแหน่ง) เพื่อความปลอดภัย + สถิติการใช้งานหน้าประชาชน
import { useState } from "react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { AdminPage, Tabs } from "@/components/admin/crud";
import VisitorAccessLog from "@/components/admin/settings/VisitorAccessLog";
import SiteVisitorStatistics from "@/components/admin/settings/SiteVisitorStatistics";
import SecurityMonitorPanel from "@/components/admin/settings/SecurityMonitorPanel";
import { useAuth } from "@/context/AuthContext";

export default function VisitorsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("log");
  return (
    <EOCLayout>
      <AdminPage title="ผู้เข้าชม" description="ใครเข้าชมระบบบ้าง จาก IP และตำแหน่งโดยประมาณใด เปิดหน้าไหน เมื่อไร — ใช้ตรวจสอบย้อนหลังด้านความปลอดภัย">
        {user && user.role !== "admin" ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
        ) : (
          <>
            <Tabs value={tab} onChange={setTab} items={[{ value: "log", label: "ประวัติการเข้าชม (IP/ตำแหน่ง)" }, { value: "monitor", label: "เฝ้าระวังและสรุปรายสัปดาห์" }, { value: "stats", label: "สถิติหน้าประชาชน" }]} />
            {tab === "log" ? <VisitorAccessLog /> : tab === "monitor" ? <SecurityMonitorPanel /> : <SiteVisitorStatistics />}
          </>
        )}
      </AdminPage>
    </EOCLayout>
  );
}
