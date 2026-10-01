"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import PublicOpsScaffold from "@/components/public/PublicOpsScaffold";

const loadingBox = (label) => function Loading() {
  return <div className="flex h-72 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-500">{label}</div>;
};

const DailyDiseaseChart = dynamic(() => import("@/components/DailyDiseaseChart"), { ssr: false, loading: loadingBox("กำลังโหลดกราฟ…") });
const DiseaseOutbreakDashboard = dynamic(() => import("@/components/DiseaseOutbreakDashboard"), { ssr: false, loading: loadingBox("กำลังโหลดข้อมูลโรค…") });
const FestivalPublicDashboard = dynamic(() => import("@/components/festival/FestivalPublicDashboard"), { ssr: false, loading: loadingBox("กำลังโหลดข้อมูลอุบัติเหตุ…") });

// ข้อมูลเชิงลึกสำหรับสื่อมวลชน นักวิจัย และผู้ที่ต้องการรายละเอียด (ย้ายออกจากหน้าแรกเพื่อให้หน้าแรกอ่านง่าย)
export default function PublicInsightsPage() {
  const [situation, setSituation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/stn-eoc/api/public/situation", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => setSituation(json?.success ? json : null))
      .catch(() => setSituation(null))
      .finally(() => setLoading(false));
  }, []);

  const events = situation?.events || [];
  const disease = events.find((event) => event.type === "disease");
  const flood = events.find((event) => event.type === "flood");
  const festival = events.find((event) => event.type === "festival-accidents");

  return (
    <PublicOpsScaffold
      title="ข้อมูลเชิงลึกและสถิติ"
      subtitle="ข้อมูลรวมสำหรับสื่อมวลชน นักวิจัย และผู้ที่ต้องการรายละเอียด — ไม่มีข้อมูลรายบุคคล"
      activeMenu="insights"
      eocIsOpen={events.length > 0}
      eocStatus={events.length > 0 ? "open" : "closed"}
      eocLabel={events.length > 0 ? events.map((event) => event.label).join(" • ") : "ไม่มีเหตุการณ์ฉุกเฉิน"}
    >
      <div className="mx-auto max-w-6xl space-y-4">
        {loading && <div className="h-40 animate-pulse rounded-xl bg-white" />}

        {!loading && events.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            ขณะนี้ไม่มีเหตุการณ์ที่เปิดศูนย์ปฏิบัติการ ดูข้อมูลย้อนหลังได้ที่ <Link href="/public/disaster-map" className="font-bold text-blue-700 underline">แผนที่สถานการณ์</Link>
          </p>
        )}

        {disease && (
          <section className="space-y-4">
            <h2 className="text-xl font-black text-blue-950">โรค{disease.disease_name || "ระบาด"}</h2>
            <DailyDiseaseChart sessionId={disease.session_id} />
            <DiseaseOutbreakDashboard session={{ id: disease.session_id, session_number: disease.session_number, opened_at: disease.opened_at, eoc_type: "disease" }} />
          </section>
        )}

        {flood && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-blue-950">อุทกภัย (น้ำท่วม)</h2>
            <p className="mt-2 text-sm text-slate-700">
              ข้อมูลพื้นที่น้ำท่วมรายหมู่บ้าน รายวัน และดาวน์โหลดเป็น CSV ได้ที่แผนที่สถานการณ์ (เมนู &quot;ดูรายการเหตุการณ์&quot;)
            </p>
            <Link href="/public/disaster-map?type=flood" className="mt-3 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
              เปิดแผนที่น้ำท่วม
            </Link>
          </section>
        )}

        {festival && <FestivalPublicDashboard />}
      </div>
    </PublicOpsScaffold>
  );
}
