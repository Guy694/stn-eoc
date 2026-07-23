"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TeamPageShell from "../../../shared/components/team-page-shell";
import SummaryCard from "../../../shared/components/summary-card";
import EmptyState from "../../../shared/components/empty-state";
import { getRiskcomAnnouncements } from "../services/riskcom.service";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

export default function RiskcomDashboard({ eocType, teamCode = "riskcom" }) {
  const [state, setState] = useState({ loading: true, items: [], fallback: false, error: "" });
  const apiEocType = eocType === "dengue" ? "disease" : eocType;

  useEffect(() => {
    let active = true;
    getRiskcomAnnouncements(apiEocType)
      .then((result) => { if (active) setState({ loading: false, items: result.data, fallback: result.meta?.fallback === true, error: "" }); })
      .catch((error) => { if (active) setState({ loading: false, items: [], fallback: false, error: error.message }); });
    return () => { active = false; };
  }, [apiEocType]);

  const popupCount = state.items.filter((item) => item.show_popup).length;
  const highPriorityCount = state.items.filter((item) => Number(item.priority) > 0).length;
  return (
    <TeamPageShell eocType={eocType} teamCode={teamCode} activeSection="dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-white p-5 shadow-sm">
        <div><h2 className="text-lg font-black text-slate-900">ภาพรวมการสื่อสารความเสี่ยง</h2><p className="text-sm text-slate-600">ข่าวประกาศที่เผยแพร่ใน EOC ปัจจุบัน</p></div>
        <Link href={`/admin/announcements?eoc=${apiEocType}`} className="bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800">จัดการข่าวประกาศ</Link>
      </div>
      {state.loading ? <div className="bg-white p-10 text-center text-sm text-slate-500">กำลังโหลดข้อมูล...</div> : state.error ? <div className="border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800">{state.error}</div> : <>
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard label="ข่าวที่เผยแพร่" value={state.items.length.toLocaleString()} />
          <SummaryCard label="ประกาศแบบ Popup" value={popupCount.toLocaleString()} />
          <SummaryCard label="ประกาศลำดับความสำคัญ" value={highPriorityCount.toLocaleString()} />
        </div>
        <article className="border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">ข่าวประกาศล่าสุด</h3>
          {state.fallback ? <p className="mt-1 text-xs text-amber-700">ขณะนี้แสดงประกาศล่าสุดที่หมดช่วงเผยแพร่แล้ว เนื่องจากไม่มีประกาศปัจจุบัน</p> : null}
          {state.items.length ? <ul className="mt-4 divide-y divide-slate-100">{state.items.slice(0, 5).map((item) => <li key={item.id} className="py-3"><p className="font-bold text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-500">เผยแพร่ {formatDate(item.created_at)}</p></li>)}</ul> : <div className="mt-4"><EmptyState title="ยังไม่มีข่าวประกาศ" description="สร้างข่าวประกาศเพื่อสื่อสารกับประชาชนและหน่วยปฏิบัติการ" /></div>}
        </article>
      </>}
    </TeamPageShell>
  );
}
