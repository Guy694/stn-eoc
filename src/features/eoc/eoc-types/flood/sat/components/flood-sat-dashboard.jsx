"use client";

import { useEffect, useState } from "react";
import { getOperationSessionLockByType } from "@/lib/eocSessionLock";
import TeamPageShell from "../../../../shared/components/team-page-shell";
import SummaryCard from "../../../../shared/components/summary-card";
import { getFloodSatDashboard } from "../service";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function FloodSatDashboard({ eocType = "flood", teamCode = "sat" }) {
  const [date, setDate] = useState(todayKey());
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  useEffect(() => {
    const controller = new AbortController();
    const querySessionId = new URLSearchParams(window.location.search).get("sessionId");
    const sessionId = querySessionId || getOperationSessionLockByType("flood")?.sessionId || null;
    getFloodSatDashboard(date, { sessionId, signal: controller.signal })
      .then((data) => setState({ loading: false, data, error: "" }))
      .catch((error) => { if (error.name !== "AbortError") setState({ loading: false, data: null, error: error.message }); });
    return () => controller.abort();
  }, [date]);

  const stats = state.data?.totalStats || {};
  return (
    <TeamPageShell eocType={eocType} teamCode={teamCode} activeSection="dashboard">
      <div className="flex flex-wrap items-end justify-between gap-3 border border-slate-200 bg-white p-4 shadow-sm">
        <div><h2 className="text-lg font-black text-slate-900">สรุปสถานการณ์อุทกภัย</h2><p className="text-sm text-slate-600">Dashboard เฉพาะกลุ่มภารกิจ SAT</p></div>
        <label className="text-sm font-bold text-slate-700">วันที่
          <input type="date" value={date} onChange={(event) => { setState((current) => ({ ...current, loading: true, error: "" })); setDate(event.target.value); }} className="ml-2 border border-slate-300 px-3 py-2" />
        </label>
      </div>
      {state.loading ? <div className="bg-white p-10 text-center text-sm text-slate-500">กำลังโหลดข้อมูล...</div> : state.error ? <div className="border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800">{state.error}</div> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="อำเภอได้รับผลกระทบ" value={(stats.affected_districts || 0).toLocaleString()} />
          <SummaryCard label="หมู่บ้านได้รับผลกระทบ" value={(stats.affected_villages || 0).toLocaleString()} />
          <SummaryCard label="ครัวเรือนได้รับผลกระทบ" value={(stats.total_households || 0).toLocaleString()} />
          <SummaryCard label="ประชาชนได้รับผลกระทบ" value={(stats.total_population || 0).toLocaleString()} />
        </div>
      )}
    </TeamPageShell>
  );
}
