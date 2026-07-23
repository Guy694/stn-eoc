"use client";

import { useEffect, useState } from "react";
import TeamPageShell from "../../../../shared/components/team-page-shell";
import SummaryCard from "../../../../shared/components/summary-card";
import { getDengueSatDashboard } from "../service";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function DengueSatDashboard({ eocType = "dengue", teamCode = "sat" }) {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  useEffect(() => {
    let active = true;
    getDengueSatDashboard(selectedDate)
      .then((result) => {
        if (active) setState({ loading: false, data: result, error: "" });
      })
      .catch((error) => {
        if (active) setState({ loading: false, data: null, error: error.message || "ไม่สามารถโหลดข้อมูล SAT ได้" });
      });
    return () => { active = false; };
  }, [selectedDate]);

  const stats = state.data?.totalStats || {};
  return (
    <TeamPageShell eocType={eocType} teamCode={teamCode} activeSection="dashboard">
      <div className="flex flex-wrap items-end justify-between gap-3 border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-900">สรุปสถานการณ์ไข้เลือดออก</h2>
          <p className="text-sm text-slate-600">Dashboard เฉพาะ EOC ไข้เลือดออกของทีม SAT</p>
        </div>
        <label className="text-sm font-bold text-slate-700">
          วันที่
          <input type="date" value={selectedDate} onChange={(event) => {
            setState((current) => ({ ...current, loading: true, error: "" }));
            setSelectedDate(event.target.value);
          }} className="ml-2 border border-slate-300 px-3 py-2" />
        </label>
      </div>
      {state.loading ? <div className="bg-white p-10 text-center text-sm text-slate-500">กำลังโหลดข้อมูล...</div> : state.error ? (
        <div className="border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800">{state.error}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="ผู้ป่วยรวมวันนี้" value={(stats.total_patients || 0).toLocaleString()} />
          <SummaryCard label="รายงานที่ได้รับ" value={(stats.total_reports || 0).toLocaleString()} />
          <SummaryCard label="โรคที่เฝ้าระวัง" value={(stats.diseases_count || 0).toLocaleString()} />
          <SummaryCard label="อำเภอที่มีรายงาน" value={(stats.affected_districts || 0).toLocaleString()} />
        </div>
      )}
    </TeamPageShell>
  );
}
