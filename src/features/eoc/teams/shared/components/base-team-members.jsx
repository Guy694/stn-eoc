"use client";

import { useEffect, useState } from "react";
import { getOperationSessionLockByType } from "@/lib/eocSessionLock";
import TeamPageShell from "../../../shared/components/team-page-shell";
import EmptyState from "../../../shared/components/empty-state";
import { getTeamMembers } from "../services/team-members.service";

export default function BaseTeamMembers({ eocType, teamCode }) {
  const [state, setState] = useState({ loading: true, session: null, team: null, error: "" });

  useEffect(() => {
    const controller = new AbortController();
    const moduleType = eocType === "dengue" ? "disease" : eocType;
    const querySessionId = new URLSearchParams(window.location.search).get("sessionId");
    const lockedSessionId = getOperationSessionLockByType(moduleType)?.sessionId;
    const sessionId = querySessionId || lockedSessionId || null;

    getTeamMembers(eocType, teamCode, { sessionId, signal: controller.signal })
      .then((result) => setState({ loading: false, session: result.session, team: result.team, error: "" }))
      .catch((error) => {
        if (error.name !== "AbortError") {
          setState({ loading: false, session: null, team: null, error: error.message || "ไม่สามารถโหลดข้อมูลสมาชิกได้" });
        }
      });
    return () => controller.abort();
  }, [eocType, teamCode]);

  return (
    <TeamPageShell eocType={eocType} teamCode={teamCode} activeSection="members">
      {state.loading ? (
        <div className="bg-white p-8 text-center text-sm text-slate-500">กำลังโหลดข้อมูลสมาชิก...</div>
      ) : state.error ? (
        <div className="border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800">{state.error}</div>
      ) : state.team?.members?.length ? (
        <>
          <header className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-slate-900">สมาชิก {state.team.team_name_th}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Session #{state.session.session_number} (ID {state.session.id}) · {state.session.status === "closed" ? "ปิดแล้ว — แสดงข้อมูลย้อนหลัง" : "กำลังเปิดใช้งาน"}
              </p>
            </div>
            <span className="bg-cyan-50 px-3 py-2 text-sm font-black text-cyan-800">{state.team.member_count} คน</span>
          </header>
          <div className="overflow-x-auto border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th scope="col" className="w-16 px-4 py-3 text-center">ลำดับ</th>
                  <th scope="col" className="min-w-56 px-4 py-3">ชื่อ-นามสกุล</th>
                  <th scope="col" className="min-w-48 px-4 py-3">ตำแหน่ง</th>
                  <th scope="col" className="min-w-48 px-4 py-3">หน่วยงาน</th>
                  <th scope="col" className="min-w-44 px-4 py-3">บทบาทในทีม</th>
                  <th scope="col" className="w-32 px-4 py-3 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.team.members.map((member, index) => (
                  <tr key={member.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-center text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {member.title || ""}{member.given_name} {member.family_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{member.position || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{member.department || "-"}</td>
                    <td className="px-4 py-3 font-semibold text-cyan-700">{member.role_in_team || "สมาชิกทีม"}</td>
                    <td className="px-4 py-3 text-center">
                      {member.is_team_lead ? (
                        <span className="inline-block whitespace-nowrap bg-amber-100 px-2 py-1 text-xs font-black text-amber-800">หัวหน้าทีม</span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-500">สมาชิก</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyState title="ไม่พบข้อมูลสมาชิกที่มอบหมาย" description="Session นี้ยังไม่มีสมาชิก active ในกลุ่มภารกิจ" />
      )}
    </TeamPageShell>
  );
}
