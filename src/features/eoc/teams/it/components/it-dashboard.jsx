"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TeamPageShell from "../../../shared/components/team-page-shell";
import SummaryCard from "../../../shared/components/summary-card";
import { getItResourceSummary } from "../services/it.service";

export default function ItDashboard({ eocType, teamCode = "it" }) {
  const [state, setState] = useState({ loading: true, stats: null, error: "" });

  useEffect(() => {
    let active = true;
    getItResourceSummary()
      .then((result) => { if (active) setState({ loading: false, stats: result.stats, error: "" }); })
      .catch((error) => { if (active) setState({ loading: false, stats: null, error: error.message }); });
    return () => { active = false; };
  }, []);

  const stats = state.stats || {};
  return (
    <TeamPageShell eocType={eocType} teamCode={teamCode} activeSection="dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-white p-5 shadow-sm">
        <div><h2 className="text-lg font-black text-slate-900">สถานะระบบและทรัพย์สินไอที</h2><p className="text-sm text-slate-600">ภาพรวมเซิร์ฟเวอร์, อินเทอร์เน็ต, เครือข่ายและฮาร์ดแวร์</p></div>
        <div className="flex flex-wrap gap-2"><Link href={`/eoc/${eocType === "dengue" ? "disease" : eocType}/it-support`} className="bg-[#0b4c86] px-4 py-2 text-sm font-bold text-white hover:bg-[#083865]">รายงาน IT support ในเหตุการณ์</Link><Link href="/admin/it-resources" className="border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">จัดการทรัพย์สินไอที</Link></div>
      </div>
      {state.loading ? <div className="bg-white p-10 text-center text-sm text-slate-500">กำลังโหลดข้อมูล...</div> : state.error ? <div className="border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800">{state.error}</div> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="ทรัพย์สินทั้งหมด" value={(stats.total || 0).toLocaleString()} />
          <SummaryCard label="ออนไลน์" value={(stats.online || 0).toLocaleString()} />
          <SummaryCard label="ออฟไลน์" value={(stats.offline || 0).toLocaleString()} />
          <SummaryCard label="อยู่ระหว่างบำรุงรักษา" value={(stats.maintenance || 0).toLocaleString()} />
        </div>
      )}
    </TeamPageShell>
  );
}
