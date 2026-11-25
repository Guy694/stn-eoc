"use client";

// เมนู "วิเคราะห์ข้อมูล": แผนที่สถานการณ์เต็มจอสำหรับเจ้าหน้าที่ (แผนที่หน้าประชาชน + กลุ่มเปราะบาง + คำขอความช่วยเหลือ)
// ไม่มีเมนูข้างของระบบ — กลับหน้าเมนูด้วยปุ่ม "กลับหน้าเมนู" ในแถบรายละเอียด
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import StaffSituationMap from "@/components/analytics/StaffSituationMap";

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.push("/login?next=/analytics");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-900 text-white/80">
        <LoaderCircle className="mr-2 h-6 w-6 animate-spin" aria-hidden="true" /> กำลังโหลดแผนที่สถานการณ์…
      </div>
    );
  }
  return <StaffSituationMap />;
}
