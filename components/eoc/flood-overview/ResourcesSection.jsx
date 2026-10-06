"use client";

import AppIcon from "@/components/icons/AppIcon";

// ส่วนหนึ่งของหน้าภาพรวม EOC อุทกภัย (แยกจาก app/eoc/flood/overview/page.jsx)
export default function ResourcesSection({ resources, teams, shelters, formatNumber }) {
    return (
        <>
        {/* IT Resources */}
        <div className="mb-6">
            <h3 className="text-lg font-black text-slate-900 mb-3"><AppIcon icon="monitor" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ทรัพยากร งานสนับสนุน IT</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-700">เซิร์ฟเวอร์</h4>
                        <div className="text-2xl"><AppIcon icon="monitor" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                    </div>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-green-600">● ออนไลน์:</span>
                            <span className="font-semibold">{resources.by_type.server.online}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-red-600">● ออฟไลน์:</span>
                            <span className="font-semibold">{resources.by_type.server.offline}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-yellow-600">● ซ่อมบำรุง:</span>
                            <span className="font-semibold">{resources.by_type.server.maintenance}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-700">อินเทอร์เน็ต</h4>
                        <div className="text-2xl"><AppIcon icon="earth" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                    </div>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-green-600">● ออนไลน์:</span>
                            <span className="font-semibold">{resources.by_type.internet.online}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-red-600">● ออฟไลน์:</span>
                            <span className="font-semibold">{resources.by_type.internet.offline}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-yellow-600">● ซ่อมบำรุง:</span>
                            <span className="font-semibold">{resources.by_type.internet.maintenance}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-700">เครือข่าย</h4>
                        <div className="text-2xl"><AppIcon icon="wifi" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                    </div>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-green-600">● ออนไลน์:</span>
                            <span className="font-semibold">{resources.by_type.network.online}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-red-600">● ออฟไลน์:</span>
                            <span className="font-semibold">{resources.by_type.network.offline}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-yellow-600">● ซ่อมบำรุง:</span>
                            <span className="font-semibold">{resources.by_type.network.maintenance}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-700">ฮาร์ดแวร์</h4>
                        <div className="text-2xl"><AppIcon icon="wrench" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                    </div>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-green-600">● ออนไลน์:</span>
                            <span className="font-semibold">{resources.by_type.hardware.online}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-red-600">● ออฟไลน์:</span>
                            <span className="font-semibold">{resources.by_type.hardware.offline}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-yellow-600">● ซ่อมบำรุง:</span>
                            <span className="font-semibold">{resources.by_type.hardware.maintenance}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* IT Resources Summary */}
            <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                <h4 className="font-semibold text-gray-800 mb-3">สรุปทรัพยากร IT:</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">ทั้งหมด</p>
                        <p className="text-2xl font-bold text-gray-800">{resources.summary.total_items}</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-600">ออนไลน์</p>
                        <p className="text-2xl font-bold text-green-600">{resources.summary.online_count}</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                        <p className="text-sm text-red-600">ออฟไลน์</p>
                        <p className="text-2xl font-bold text-red-600">{resources.summary.offline_count}</p>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-yellow-600">ซ่อมบำรุง</p>
                        <p className="text-2xl font-bold text-yellow-600">{resources.summary.maintenance_count}</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">ไม่ทราบ</p>
                        <p className="text-2xl font-bold text-gray-600">{resources.summary.unknown_count}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Teams and Shelters */}
        <div id="sec-shelters" className="scroll-mt-20 grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Teams */}
            <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                <h3 className="text-lg font-black text-slate-900 mb-3"><AppIcon icon="users" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ทีมปฏิบัติการ</h3>
                {teams && teams.length > 0 ? (
                    <div className="space-y-3">
                        {teams.map((team, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <AppIcon icon={team.icon || "users"} className="h-7 w-7" />
                                    <div>
                                        <p className="font-semibold text-gray-800">{team.team_name_th}</p>
                                        <p className="text-sm text-gray-600">หัวหน้าทีม: {team.team_lead_name || '-'}</p>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-[#0b4c86]">{team.member_count}</p>
                                    <p className="text-xs text-gray-500">สมาชิก</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-center py-4">ยังไม่มีทีมปฏิบัติการ</p>
                )}
            </div>

            {/* Shelters */}
            <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                <h3 className="text-lg font-black text-slate-900 mb-3"><AppIcon icon="hospital" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ศูนย์พักพิง</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-[#edf5fc] rounded-lg">
                        <div>
                            <p className="text-sm text-gray-600">ศูนย์พักพิงทั้งหมด</p>
                            <p className="text-3xl font-bold text-[#0b4c86]">{shelters.total_shelters || 0}</p>
                        </div>
                        <div className="text-4xl"><AppIcon icon="building" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                        <div>
                            <p className="text-sm text-gray-600">เปิดในเหตุการณ์นี้</p>
                            <p className="text-3xl font-bold text-green-600">{formatNumber(shelters.session?.active_session_shelters || shelters.active_shelters)}</p>
                        </div>
                        <div className="text-4xl"><AppIcon icon="checkCircle" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-violet-50 rounded-lg">
                        <div>
                            <p className="text-sm text-gray-600">ผู้พักพิงปัจจุบัน</p>
                            <p className="text-3xl font-bold text-violet-600">{formatNumber(shelters.session?.session_occupancy || shelters.current_occupancy_total)}</p>
                            <p className="text-xs text-gray-500">คน</p>
                        </div>
                        <div className="text-4xl"><AppIcon icon="personStanding" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-[#edf5fc] rounded-lg">
                        <div>
                            <p className="text-sm text-gray-600">ความจุรวม</p>
                            <p className="text-3xl font-bold text-[#0b4c86]">{formatNumber(shelters.total_capacity)}</p>
                            <p className="text-xs text-gray-500">คน</p>
                        </div>
                        <div className="text-4xl"><AppIcon icon="users" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
}
