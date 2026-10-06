"use client";

import Link from 'next/link';

// ส่วนหนึ่งของหน้าภาพรวม EOC อุทกภัย (แยกจาก app/eoc/flood/overview/page.jsx)
export default function OverviewTeams({ session, teams, missionTeams, loadingTeams }) {
    return (
        <>
        <section id="sec-teams" className="mb-6 scroll-mt-20 rounded-xl border border-[#c9dcee] bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h3 className="text-lg font-black text-slate-900">กลุ่มภารกิจที่เปิดใช้งาน</h3>
                    <p className="text-sm text-slate-600">แสดงข้อมูลเหมือนเมนูศูนย์ปฏิบัติงานเจ้าหน้าที่ EOC ของเหตุการณ์นี้</p>
                </div>
                <div className="rounded-lg bg-[#edf5fc] px-3 py-2 text-sm font-semibold text-[#0b4c86]">
                    ทั้งหมด {missionTeams.length} กลุ่ม
                </div>
            </div>

            {loadingTeams ? (
                <div className="text-sm text-slate-500">กำลังโหลดกลุ่มภารกิจ...</div>
            ) : missionTeams.length === 0 ? (
                <div className="text-sm text-slate-500">ยังไม่มีกลุ่มภารกิจสำหรับเหตุการณ์นี้</div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {missionTeams.map((team) => (
                        <Link
                            key={team.session_team_id}
                            href={`/eoc/staff/${session.id}/teams/${team.session_team_id}`}
                            className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <span className="text-2xl">{team.icon || 'ทีม'}</span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                    {team.team_code || '-'}
                                </span>
                            </div>
                            <h4 className="mt-3 text-base font-black text-slate-900">{team.team_name_th || team.team_name_en}</h4>
                            <p className="mt-2 text-sm text-slate-600">หัวหน้าทีม: {team.team_lead_name || 'ยังไม่กำหนด'}</p>
                            <p className="mt-1 text-sm text-slate-600">สมาชิก {team.member_count || 0} คน</p>
                            <div className="mt-3 border-t border-slate-100 pt-2 text-xs font-bold text-[#0b4c86]">แดชบอร์ด · รายงานผล · ประวัติ</div>
                        </Link>
                    ))}
                </div>
            )}
        </section>
        </>
    );
}
