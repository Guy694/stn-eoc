"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import MeetingBriefView from "@/components/eoc/brief/MeetingBriefView";
import { FloodCommandTabs } from "@/components/eoc/FloodEocManagementDashboard";

// แท็บแรกของเมนู "ภารกิจและข้อสั่งการ" (ตอนพิมพ์ แถบแท็บถูกซ่อน)
export default function FloodMeetingBriefPage() {
  return (
    <EOCLayout>
      <div className="mb-4 print:hidden"><FloodCommandTabs view="brief" /></div>
      <MeetingBriefView eocType="flood" />
    </EOCLayout>
  );
}
