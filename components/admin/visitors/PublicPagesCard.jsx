"use client";

// หน้าที่ประชาชนเข้าชม (ไม่นับผู้ที่เข้าสู่ระบบ) — ใช้เป็นสถิติว่าประชาชนสนใจข้อมูลอะไร
import { useState } from "react";
import { BarChart3, Search } from "lucide-react";
import { formatNumber } from "@/lib/adminApi";

const SHOW = 10;

export default function PublicPagesCard({ data, onPickPath, filtered = false }) {
  const [all, setAll] = useState(false);
  const pages = data?.pages || [];
  const shown = all ? pages : pages.slice(0, SHOW);
  const max = Math.max(1, ...pages.map((page) => page.visits));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-3">
        <h4 className="flex items-center gap-2 font-black text-slate-900"><BarChart3 className="h-4 w-4 text-[#0b4c86]" aria-hidden="true" />หน้าที่ประชาชนเข้าชม</h4>
        {data ? <span className="text-sm text-slate-500">{formatNumber(data.visits)} ครั้ง • {formatNumber(data.ips)} IP</span> : null}
      </div>
      {shown.length ? (
        <ol className="divide-y divide-slate-100">
          {shown.map((page, index) => {
            const searchable = page.key !== "/";
            const searchText = page.key.replace(/\/\[id\].*$/, "/");
            return (
              <li key={page.key} className="flex gap-2 px-4 py-2.5 text-sm">
                <span className="w-5 shrink-0 text-right tabular-nums text-slate-400">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold text-slate-800">{page.label || page.key}</p>
                  {searchable ? (
                    <button type="button" onClick={() => onPickPath?.(searchText)} className="inline-flex max-w-full items-center gap-1 break-all text-left font-mono text-[11px] text-[#0b4c86] hover:underline" title="ดูรายการเข้าชมของหน้านี้">
                      <Search className="h-3 w-3 shrink-0" aria-hidden="true" />{page.key}
                    </button>
                  ) : <p className="font-mono text-[11px] text-slate-500">/</p>}
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full bg-[#0b4c86]" style={{ width: `${(page.visits / max) * 100}%` }} /></div>
                  <p className="mt-1 text-xs tabular-nums text-slate-600"><b className="text-slate-900">{formatNumber(page.visits)}</b> ครั้ง • {page.share}% • {formatNumber(page.ips)} IP</p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="p-4 text-sm text-slate-500">{filtered ? "ไม่มีการเข้าชมหน้าประชาชนตามตัวกรองนี้" : "ยังไม่มีการเข้าชมหน้าประชาชนในช่วงนี้"}</p>
      )}
      {pages.length > SHOW ? (
        <button type="button" onClick={() => setAll((value) => !value)} aria-expanded={all} className="w-full border-t border-slate-100 px-4 py-2.5 text-sm font-semibold text-[#0b4c86] hover:bg-slate-50">
          {all ? "แสดงน้อยลง" : `ดูทั้งหมด (อีก ${pages.length - SHOW} หน้า)`}
        </button>
      ) : null}
      <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
        นับเฉพาะผู้ที่ไม่ได้เข้าสู่ระบบ ตามช่วงเวลาและคำค้นที่เลือก • หน้าอ่านรายเรื่อง (เช่น ประกาศแต่ละฉบับ) รวมเป็นแถวเดียว จำนวน IP ของแถวนั้นอาจนับคนเดียวกันซ้ำ
      </p>
    </div>
  );
}
