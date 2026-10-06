"use client";


// ส่วนหนึ่งของหน้าภาพรวม EOC อุทกภัย (แยกจาก app/eoc/flood/overview/page.jsx)
export default function MeetingSummary({ meeting_summary, isDailyMode, formatNumber, formatDateKey, effectiveDateLabel }) {
    return (
        <>
        {/* Meeting Summary */}
        {meeting_summary && (
            <div id="sec-meeting" className="scroll-mt-20 mb-6">
                <div className="flex flex-col gap-1 mb-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h3 className="text-lg font-black text-slate-900">สรุปสำหรับห้องประชุมภาวะฉุกเฉิน</h3>
                        <p className="text-sm text-gray-500">
                            ช่วงข้อมูล {formatDateKey(meeting_summary.period?.start_date)} - {formatDateKey(meeting_summary.period?.end_date)}
                        </p>
                    </div>
                    <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                        {isDailyMode ? `มุมมองรายวัน ${effectiveDateLabel}` : 'มุมมองสะสมทั้งเหตุการณ์'}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5 border border-[#c9dcee]">
                        <p className="text-xs font-semibold text-gray-500">ผู้ได้รับผลกระทบ</p>
                        <p className="mt-2 text-3xl font-bold text-[#0b4c86]">{formatNumber(meeting_summary.kpis?.affected_people)}</p>
                        <p className="text-xs text-gray-500">คน</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5 border border-[#c9dcee]">
                        <p className="text-xs font-semibold text-gray-500">บันทึกอุทกภัยน้ำท่วม</p>
                        <p className="mt-2 text-3xl font-bold text-[#0b4c86]">{formatNumber(meeting_summary.kpis?.flood_records)}</p>
                        <p className="text-xs text-gray-500">จุด/หมู่บ้าน</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5 border border-violet-100">
                        <p className="text-xs font-semibold text-gray-500">ศูนย์พักพิงเปิด</p>
                        <p className="mt-2 text-3xl font-bold text-violet-700">{formatNumber(meeting_summary.kpis?.active_shelters)}</p>
                        <p className="text-xs text-gray-500">แห่ง</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5 border border-rose-100">
                        <p className="text-xs font-semibold text-gray-500">ผู้ป่วยสะสม</p>
                        <p className="mt-2 text-3xl font-bold text-rose-700">{formatNumber(meeting_summary.kpis?.disease_patients)}</p>
                        <p className="text-xs text-gray-500">ราย{meeting_summary.kpis?.disease_patients_shelter !== undefined ? ` · ชุมชน ${formatNumber(meeting_summary.kpis?.disease_patients_community)} · ศูนย์พักพิง ${formatNumber(meeting_summary.kpis?.disease_patients_shelter)}` : ""}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5 border border-emerald-100">
                        <p className="text-xs font-semibold text-gray-500">รายการเวชภัณฑ์</p>
                        <p className="mt-2 text-3xl font-bold text-emerald-700">{formatNumber(meeting_summary.kpis?.medical_item_types)}</p>
                        <p className="text-xs text-gray-500">ชนิด</p>
                    </div>
                </div>
                <div className="mt-4 bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                    <h4 className="font-semibold text-gray-800 mb-3">ประเด็นที่ควรติดตามในการประชุม</h4>
                    {meeting_summary.focus_points?.length > 0 ? (
                        <div className="grid gap-3 md:grid-cols-2">
                            {meeting_summary.focus_points.map((item, index) => (
                                <div key={index} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                                    {item}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">ยังไม่มีประเด็นเร่งด่วนจากข้อมูลที่บันทึกในเหตุการณ์นี้</p>
                    )}
                </div>
            </div>
        )}
        </>
    );
}
