"use client";

import AppIcon from "@/components/icons/AppIcon";
import PublicIncidentMap from './PublicIncidentMapLazy';
import { floodAreaMapMeta } from '@/lib/floodMapLevels';

// ส่วนหนึ่งของหน้าภาพรวม EOC อุทกภัย (แยกจาก app/eoc/flood/overview/page.jsx)
export default function FloodMapSection({ session, affected_areas, shelters, diseases, flood_map, isDailyMode, formatNumber, formatDateKey, effectiveDateLabel, mapStartDate, mapEndDate, dashboardData }) {
    return (
        <>
        {/* Flood Map */}
        <div id="sec-map" className="scroll-mt-20 mb-6">
            <div className="flex flex-col gap-1 mb-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <h3 className="text-lg font-black text-slate-900">แผนที่อุทกภัยน้ำท่วมช่วง EOC</h3>
                    <p className="text-sm text-slate-500">
                        แสดงข้อมูลจากวันที่เปิดถึงวันที่ปิด EOC: {formatDateKey(mapStartDate)} - {formatDateKey(mapEndDate)}
                    </p>
                </div>
                <div className="text-sm text-slate-600">
                    วันที่มีข้อมูล {formatNumber(flood_map?.available_dates?.length)} วัน
                </div>
            </div>
            {/* เดิมมีการ์ดตัวเลข 5 ใบตรงนี้ แต่เป็นยอดรวมทุกวันของเหตุการณ์ (หมู่บ้านเดียวกันถูกนับซ้ำทุกวันที่รายงาน)
                และซ้ำกับแผงสรุปด้านบนซึ่งใช้รายงานวันล่าสุด จึงเอาออกเพื่อไม่ให้ตัวเลขขัดกัน */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="h-[560px] overflow-hidden rounded-lg border border-[#c9dcee] bg-white shadow">
                    <PublicIncidentMap
                        disasterType="flood"
                        sessionId={session.id}
                        startDate={mapStartDate}
                        endDate={mapEndDate}
                        chrome="full"
                        heightClass="h-full"
                        layers={{
                            floodAreas: true,
                            district: true,
                            tambon: false,
                            village: false,
                            labels: true,
                            incidents: true,
                            traffic: true,
                            shelters: true,
                            hospitals: true,
                            waterways: true,
                            hillshade: false
                        }}
                        baseMap="street"
                        includeAllShelters
                        shelterApiPath="/stn-eoc/api/eoc/shelter-centers"
                    />
                </div>
                <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                    <h4 className="font-semibold text-slate-800 mb-3">พื้นที่สำคัญจากบันทึกอุทกภัยน้ำท่วม</h4>
                    {flood_map?.events?.length > 0 ? (
                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                            {flood_map.events.slice(0, 12).map((event) => {
                                const level = floodAreaMapMeta({ flood_level: event.severity, water_level: Number(event.water_depth_cm || 0) / 100 });
                                return (
                                <div key={event.id} className="rounded-lg border border-slate-100 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="font-semibold text-slate-800">ต.{event.tambon || '-'} อ.{event.district || '-'}</p>
                                        <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ color: level.color, backgroundColor: `${level.color}1f` }}>
                                            {level.description}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm text-slate-600">{event.village || '-'}</p>
                                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                                        <span>{formatDateKey(event.recorded_day)}</span>
                                        <span>{formatNumber(event.affected_people)} คน</span>
                                        {event.water_depth_cm > 0 && <span>น้ำ {formatNumber(event.water_depth_cm)} ซม.</span>}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500">ยังไม่มีบันทึกอุทกภัยน้ำท่วมในช่วงเหตุการณ์นี้</p>
                    )}
                </div>
            </div>
        </div>

        {isDailyMode && (
            <div className="mb-6">
                <h3 className="text-lg font-black text-slate-900 mb-3">เหตุการณ์ประจำวันที่ {effectiveDateLabel}</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                        <h4 className="font-semibold text-slate-800 mb-3">ผู้ได้รับผลกระทบ</h4>
                        {affected_areas.district_list?.length > 0 ? (
                            <div className="space-y-2">
                                {affected_areas.district_list.map((district, index) => (
                                    <div key={index} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-b-0">
                                        <span className="text-slate-700">{district.district}</span>
                                        <span className="font-semibold text-[#0b4c86]">{Number(district.total_casualties || 0).toLocaleString('th-TH')} คน</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-slate-500 text-sm">ไม่มีรายงานผู้ได้รับผลกระทบในวันนี้</p>
                        )}
                    </div>

                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                        <h4 className="font-semibold text-slate-800 mb-3">โรคที่รายงาน</h4>
                        {diseases.today?.length > 0 ? (
                            <div className="space-y-2">
                                {diseases.today.map((item, index) => (
                                    <div key={index} className="border-b border-slate-100 pb-2 last:border-b-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-700">{item.disease_name}</span>
                                            <span className="font-semibold text-red-700">{Number(item.today_patients || 0).toLocaleString('th-TH')} คน</span>
                                        </div>
                                        <p className="text-xs text-slate-500">{item.district_name}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-slate-500 text-sm">ไม่มีรายงานโรคในวันนี้</p>
                        )}
                    </div>

                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                        <h4 className="font-semibold text-slate-800 mb-3">กิจกรรม/บันทึก</h4>
                        {dashboardData.recent_activities?.length > 0 ? (
                            <div className="space-y-2">
                                {dashboardData.recent_activities.map((activity, index) => (
                                    <div key={index} className="border-b border-slate-100 pb-2 last:border-b-0">
                                        <p className="text-sm font-medium text-slate-800">{activity.action}</p>
                                        <p className="text-sm text-slate-600">{activity.details}</p>
                                        <p className="text-xs text-slate-500">{new Date(activity.time).toLocaleTimeString('th-TH')}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-slate-500 text-sm">ไม่มีกิจกรรมที่บันทึกในวันนี้</p>
                        )}
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
