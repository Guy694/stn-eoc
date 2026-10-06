"use client";

import AppIcon from "@/components/icons/AppIcon";

// ส่วนหนึ่งของหน้าภาพรวม EOC อุทกภัย (แยกจาก app/eoc/flood/overview/page.jsx)
export default function ImpactSection({ casualties, affected_areas, impactScopeLabel }) {
    return (
        <>
        {/* Casualties Statistics */}
        <div id="sec-casualties" className="scroll-mt-20 mb-6">
            <h3 className="text-lg font-black text-slate-900 mb-3"><AppIcon icon="clipboard" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> สถิติผู้ประสบภัย ({impactScopeLabel})</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5 border border-red-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">ผู้เสียชีวิต</p>
                            <p className="text-3xl font-bold text-red-600">{casualties.death}</p>
                        </div>
                        <div className="text-4xl"><AppIcon icon="skull" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5 border border-orange-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">ผู้สูญหาย</p>
                            <p className="text-3xl font-bold text-orange-600">{casualties.missing}</p>
                        </div>
                        <div className="text-4xl"><AppIcon icon="search" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5 border border-yellow-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">ผู้บาดเจ็บ</p>
                            <p className="text-3xl font-bold text-yellow-600">{casualties.injured}</p>
                        </div>
                        <div className="text-4xl"><AppIcon icon="hospital" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5 border border-[#0b4c86]">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">รวมทั้งหมด</p>
                            <p className="text-3xl font-bold text-[#0b4c86]">{casualties.total}</p>
                        </div>
                        <div className="text-4xl"><AppIcon icon="users" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                    </div>
                </div>
            </div>
        </div>

        {/* Affected Areas */}
        <div id="sec-areas" className="scroll-mt-20 mb-6">
            <h3 className="text-lg font-black text-slate-900 mb-3"><AppIcon icon="mapPin" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> พื้นที่ได้รับผลกระทบ ({impactScopeLabel})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">จำนวนอำเภอ</p>
                            <p className="text-3xl font-bold text-[#0b4c86]">{affected_areas.districts}</p>
                        </div>
                        <div className="text-4xl"><AppIcon icon="landmark" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">จำนวนตำบล</p>
                            <p className="text-3xl font-bold text-green-600">{affected_areas.tambons}</p>
                        </div>
                        <div className="text-4xl"><AppIcon icon="home" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                    </div>
                </div>
            </div>

            {/* District List */}
            {affected_areas.district_list && affected_areas.district_list.length > 0 && (
                <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                    <h4 className="font-semibold text-gray-800 mb-3">รายชื่ออำเภอที่ได้รับผลกระทบ:</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {affected_areas.district_list.map((district, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <span className="font-medium text-gray-700">{district.district}</span>
                                <span className="text-sm text-gray-500">({district.total_casualties?.toLocaleString()} คน)</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
        </>
    );
}
