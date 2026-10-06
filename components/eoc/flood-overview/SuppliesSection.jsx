"use client";

import Link from "next/link";

// ส่วนหนึ่งของหน้าภาพรวม EOC อุทกภัย (แยกจาก app/eoc/flood/overview/page.jsx)
export default function SuppliesSection({ medical_inventory, formatNumber }) {
    return (
        <>
        {/* Medical Inventory */}
        {medical_inventory && (
            <div id="sec-supplies" className="scroll-mt-20 mb-6">
                <div className="flex flex-col gap-1 mb-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h3 className="text-lg font-black text-slate-900">เวชภัณฑ์และคลังยา</h3>
                        <p className="text-sm text-gray-500">
                            {medical_inventory.event?.event_name ? `บัญชีคลัง: ${medical_inventory.event.event_name}` : 'ยังไม่ได้เปิดบัญชีคลังของเหตุการณ์นี้ กดปุ่มด้านขวาเพื่อเริ่ม'}
                        </p>
                    </div>
                    <Link href="/eoc/flood/supplies" className="inline-flex w-fit items-center rounded-lg bg-[#0b4c86] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#083865]">
                        จัดการคลังยา รับเข้า/เบิกจ่าย
                    </Link>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-6">
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                        <p className="text-xs text-gray-500">หน่วยบริการ</p>
                        <p className="text-2xl font-bold text-[#0b4c86]">{formatNumber(medical_inventory.summary?.agency_count)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                        <p className="text-xs text-gray-500">ชนิดเวชภัณฑ์</p>
                        <p className="text-2xl font-bold text-emerald-700">{formatNumber(medical_inventory.summary?.item_types)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                        <p className="text-xs text-gray-500">ยอดยกมา</p>
                        <p className="text-2xl font-bold text-slate-700">{formatNumber(medical_inventory.summary?.opening_qty)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                        <p className="text-xs text-gray-500">รับเข้า</p>
                        <p className="text-2xl font-bold text-[#0b4c86]">{formatNumber(medical_inventory.summary?.received_qty)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                        <p className="text-xs text-gray-500">เบิกจ่าย</p>
                        <p className="text-2xl font-bold text-amber-700">{formatNumber(medical_inventory.summary?.issued_qty)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                        <p className="text-xs text-gray-500">คงเหลือ</p>
                        <p className="text-2xl font-bold text-green-700">{formatNumber(medical_inventory.summary?.balance_qty)}</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                        <h4 className="text-lg font-bold text-gray-800 mb-4">เวชภัณฑ์ที่มีการเบิก/คงเหลือสูง</h4>
                        {medical_inventory.top_items?.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-gray-500">
                                            <th className="py-2 pr-3">รายการ</th>
                                            <th className="py-2 pr-3 text-right">เบิกจ่าย</th>
                                            <th className="py-2 text-right">คงเหลือ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {medical_inventory.top_items.map((item) => (
                                            <tr key={item.item_code} className="border-b last:border-b-0">
                                                <td className="py-3 pr-3">
                                                    <p className="font-semibold text-gray-800">{item.item_name}</p>
                                                    <p className="text-xs text-gray-500">{item.item_code} • {item.unit || '-'}</p>
                                                </td>
                                                <td className="py-3 pr-3 text-right font-semibold text-amber-700">{formatNumber(item.issued_qty)}</td>
                                                <td className="py-3 text-right font-semibold text-green-700">{formatNumber(item.balance_qty)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">ยังไม่มีข้อมูลเวชภัณฑ์ในฐานข้อมูลสำหรับเหตุการณ์นี้</p>
                        )}
                    </div>
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                        <h4 className="text-lg font-bold text-gray-800 mb-4">สรุปตามหน่วยบริการ</h4>
                        {medical_inventory.agency_summary?.length > 0 ? (
                            <div className="space-y-3">
                                {medical_inventory.agency_summary.map((agency) => (
                                    <div key={agency.agency_name} className="rounded-lg border border-gray-100 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-gray-800">{agency.agency_name}</p>
                                                <p className="text-xs text-gray-500">{formatNumber(agency.item_types)} ชนิด • ยังไม่บันทึก {formatNumber(agency.not_recorded_rows)} รายการ</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-green-700">{formatNumber(agency.balance_qty)}</p>
                                                <p className="text-xs text-gray-500">คงเหลือ</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">ยังไม่มีสรุปตามหน่วยบริการ</p>
                        )}
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
