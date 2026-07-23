"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TeamPageShell from "../../../shared/components/team-page-shell";
import SummaryCard from "../../../shared/components/summary-card";
import { getMedicalInventorySummary } from "../services/logistics.service";

function formatQuantity(value) {
  return Number(value || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

export default function LogisticsDashboard({ eocType, teamCode = "logistics" }) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  useEffect(() => {
    const controller = new AbortController();
    getMedicalInventorySummary({ signal: controller.signal })
      .then((data) => setState({ loading: false, data, error: "" }))
      .catch((error) => {
        if (error.name !== "AbortError") setState({ loading: false, data: null, error: error.message });
      });
    return () => controller.abort();
  }, []);

  const summary = state.data?.summary || {};
  return (
    <TeamPageShell eocType={eocType} teamCode={teamCode} activeSection="dashboard">
      <header className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-900">ภาพรวมคลังและส่งกำลังบำรุง</h2>
          <p className="text-sm text-slate-600">{state.data?.event?.name || "ยอดเวชภัณฑ์จากคลังปฏิบัติการปัจจุบัน"}</p>
        </div>
        <Link href="/resources/medical-inventory" className="bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800">จัดการคลังเวชภัณฑ์</Link>
      </header>
      {state.loading ? <div className="bg-white p-10 text-center text-sm text-slate-500">กำลังโหลดข้อมูลคลัง...</div> : state.error ? <div className="border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800">{state.error}</div> : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="ยอดรับเข้า" value={formatQuantity(summary.received_qty)} />
            <SummaryCard label="ยอดเบิกจ่าย" value={formatQuantity(summary.issued_qty)} />
            <SummaryCard label="ยอดคงเหลือ" value={formatQuantity(summary.balance_qty)} />
            <SummaryCard label="รายการยังไม่บันทึก" value={formatQuantity(summary.not_recorded_rows)} />
          </div>
          <section className="grid gap-4 md:grid-cols-3">
            <SummaryCard label="แถวข้อมูลคลัง" value={formatQuantity(summary.total_rows)} />
            <SummaryCard label="หน่วยบริการ" value={formatQuantity(summary.agency_count)} />
            <SummaryCard label="ชนิดเวชภัณฑ์" value={formatQuantity(summary.item_count)} />
          </section>
        </>
      )}
    </TeamPageShell>
  );
}
