"use client";

import { useEffect, useState } from "react";
import { getOperationSessionLockByType } from "@/lib/eocSessionLock";
import TeamPageShell from "../../../shared/components/team-page-shell";
import SummaryCard from "../../../shared/components/summary-card";
import EmptyState from "../../../shared/components/empty-state";
import { getTeam } from "../../../registries/team.registry";
import { getTeamMembers } from "../services/team-members.service";
import { getTeamReports } from "../services/team-reports.service";

export default function BaseTeamDashboard({ eocType, teamCode }) {
  const team = getTeam(teamCode);
  const [state, setState] = useState({ loading: true, context: null, reports: null, error: "" });

  useEffect(() => {
    const controller = new AbortController();
    const moduleType = eocType === "dengue" ? "disease" : eocType;
    const querySessionId = new URLSearchParams(window.location.search).get("sessionId");
    const sessionId = querySessionId || getOperationSessionLockByType(moduleType)?.sessionId || null;
    getTeamMembers(eocType, teamCode, { sessionId, signal: controller.signal })
      .then(async (memberResult) => {
        const reports = await getTeamReports(memberResult.session.id, memberResult.team.session_team_id, {}, { signal: controller.signal });
        setState({ loading: false, context: memberResult, reports, error: "" });
      })
      .catch((error) => { if (error.name !== "AbortError") setState({ loading: false, context: null, reports: null, error: error.message }); });
    return () => controller.abort();
  }, [eocType, teamCode]);

  const summary = state.reports?.summary || {};
  return (
    <TeamPageShell eocType={eocType} teamCode={teamCode} activeSection="dashboard">
      {state.loading ? <div className="bg-white p-10 text-center text-sm text-slate-500">กำลังโหลด Dashboard...</div> : state.error ? <div className="border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800">{state.error}</div> : <>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="รายงานทั้งหมด" value={summary.total || 0} detail={`Session #${state.context?.session.session_number}`} />
          <SummaryCard label="ฉบับร่าง" value={summary.draft || 0} />
          <SummaryCard label="รอตรวจสอบ" value={summary.submitted || 0} />
          <SummaryCard label="อนุมัติแล้ว" value={summary.approved || 0} />
        </div>
        <article className="border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">รายงานล่าสุดของ {team?.shortName}</h2>
          {state.reports?.data.length ? <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-100"><tr><th className="px-3 py-2">หัวข้อ</th><th className="px-3 py-2">ผู้บันทึก</th><th className="px-3 py-2">สถานะ</th></tr></thead><tbody>{state.reports.data.slice(0, 5).map((report) => <tr key={report.id} className="border-t border-slate-100"><td className="px-3 py-3 font-bold">{report.title}</td><td className="px-3 py-3">{report.created_by_name || "-"}</td><td className="px-3 py-3">{report.status}</td></tr>)}</tbody></table></div> : <div className="mt-4"><EmptyState title="ยังไม่มีรายงาน" description="สร้างรายงานจากแท็บรายงานผล" /></div>}
        </article>
      </>}
    </TeamPageShell>
  );
}
