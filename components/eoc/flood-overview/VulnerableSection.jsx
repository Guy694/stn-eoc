"use client";

import Link from "next/link";
import { VULNERABLE_TYPES } from "@/lib/vulnerableEvent";

// สรุปกลุ่มเปราะบางในเหตุการณ์ (ได้รับผลกระทบ / ดูแลแล้ว / เคลื่อนย้ายแล้ว) — รายละเอียดอยู่ที่เมนูกลุ่มเปราะบางของ EOC
export default function VulnerableSection({ vulnerable_groups, formatNumber }) {
    if (!vulnerable_groups) return null;
    const summary = vulnerable_groups.summary || {};
    const byType = VULNERABLE_TYPES.map((type) => ({ ...type, value: Number(summary[`total_${type.key}`]) || 0 }));
    const affected = byType.reduce((sum, type) => sum + type.value, 0);
    const cared = Math.min(Number(summary.total_cared) || 0, affected);
    const moved = Math.min(Number(summary.total_moved) || 0, affected);
    const pending = Math.max(affected - cared, 0);
    const percent = (value) => (affected ? Math.round((value / affected) * 100) : 0);
    const tiles = [
        { label: "ได้รับผลกระทบ", value: affected, hint: `${formatNumber(summary.villages)} หมู่บ้าน/พื้นที่`, tone: "text-[#0b4c86]" },
        { label: "ดูแลแล้ว", value: cared, hint: `${percent(cared)}%`, tone: "text-emerald-700" },
        { label: "เคลื่อนย้ายแล้ว", value: moved, hint: `${percent(moved)}%`, tone: "text-sky-800" },
        { label: "ยังไม่ได้ดูแล", value: pending, hint: pending ? "ต้องติดตาม" : "ดูแลครบแล้ว", tone: pending ? "text-red-700" : "text-emerald-700" }
    ];

    return (
        <section id="sec-vulnerable" className="mb-6 scroll-mt-20">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                    <h3 className="text-lg font-black text-slate-900">กลุ่มเปราะบางในเหตุการณ์</h3>
                    <p className="text-sm text-slate-500">นับเฉพาะหมู่บ้านที่บันทึกว่าได้รับผลกระทบในเหตุการณ์นี้</p>
                </div>
                <Link href="/eoc/flood/vulnerable-groups" className="inline-flex w-fit items-center rounded-lg bg-[#0b4c86] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#083865]">
                    ดูรายละเอียดและอัปเดตการดูแล
                </Link>
            </div>
            {affected ? (
                <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {tiles.map((tile) => (
                            <div key={tile.label} className="rounded-xl border border-[#c9dcee] bg-white p-4">
                                <p className="text-xs font-semibold text-slate-500">{tile.label}</p>
                                <p className={`mt-1 text-3xl font-black tabular-nums ${tile.tone}`}>{formatNumber(tile.value)} <span className="text-sm font-semibold text-slate-500">คน</span></p>
                                <p className="text-xs text-slate-500">{tile.hint}</p>
                            </div>
                        ))}
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-2">
                        {byType.filter((type) => type.value > 0).map((type) => (
                            <li key={type.key} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">
                                {type.label} <b className="tabular-nums text-slate-900">{formatNumber(type.value)}</b>
                            </li>
                        ))}
                    </ul>
                </>
            ) : (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-600">
                    ยังไม่มีการบันทึกกลุ่มเปราะบางที่ได้รับผลกระทบในเหตุการณ์นี้ <Link href="/eoc/flood/vulnerable-groups" className="font-bold text-[#0b4c86] hover:underline">เพิ่มหมู่บ้าน</Link>
                </p>
            )}
        </section>
    );
}
