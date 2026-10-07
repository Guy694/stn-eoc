"use client";

// ความครบของรายงานวันนี้ แยกตามอำเภอ — ตำบลที่ยังไม่ครบกดเพื่อบันทึกทั้งตำบลได้ทันที
import { useMemo, useState } from "react";

const STATUS = {
  empty: { label: "ยังไม่ส่ง", chip: "border-red-200 bg-white text-slate-800 hover:bg-red-50", count: "text-red-700", dot: "bg-red-600" },
  partial: { label: "ส่งบางส่วน", chip: "border-amber-300 bg-amber-50 text-slate-800 hover:bg-amber-100", count: "text-amber-800", dot: "bg-amber-500" },
  complete: { label: "ครบแล้ว", chip: "border-emerald-200 bg-emerald-50 text-emerald-900", count: "text-emerald-700", dot: "bg-emerald-600" }
};

export default function TambonCoverage({ rows, summary, loading, canOperate, onPick }) {
  const [showComplete, setShowComplete] = useState(false);
  const groups = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      if (row.status === "complete" && !showComplete) continue;
      if (!map.has(row.district)) map.set(row.district, []);
      map.get(row.district).push(row);
    }
    return [...map.entries()];
  }, [rows, showComplete]);

  return (
    <section aria-labelledby="coverage-title" className="rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 id="coverage-title" className="text-base font-black text-slate-900">ความครบของรายงานรายตำบล</h2>
          <p className="text-xs text-slate-500">
            ส่งแล้ว {summary.recorded}/{summary.villages} หมู่บ้าน ·{" "}
            {["empty", "partial", "complete"].map((key, index) => (
              <span key={key}>
                {index ? " · " : ""}
                <span className={`mr-1 inline-block h-2 w-2 rounded-full align-middle ${STATUS[key].dot}`} aria-hidden="true" />
                {STATUS[key].label} {summary[key]}
              </span>
            ))}
          </p>
        </div>
        {summary.complete ? (
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-[#0b4c86]" checked={showComplete} onChange={(event) => setShowComplete(event.target.checked)} />
            แสดงตำบลที่ครบแล้ว
          </label>
        ) : null}
      </header>

      <div className="h-1.5 bg-slate-100" aria-hidden="true">
        <div className="h-full bg-[#0b4c86] transition-[width]" style={{ width: `${summary.percent}%` }} />
      </div>

      {loading ? (
        <div className="space-y-2 p-4" aria-busy="true">
          {[0, 1, 2].map((index) => <div key={index} className="h-9 animate-pulse rounded-lg bg-slate-100" />)}
        </div>
      ) : !rows.length ? (
        <p className="px-4 py-5 text-sm text-slate-600">ยังไม่มีข้อมูลขอบเขตหมู่บ้าน จึงคำนวณความครบไม่ได้</p>
      ) : !groups.length ? (
        <p className="px-4 py-5 text-sm font-semibold text-emerald-800">ทุกตำบลส่งรายงานของวันนี้ครบแล้ว</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {groups.map(([district, items]) => (
            <div key={district} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
              <h3 className="w-28 shrink-0 pt-1.5 text-sm font-bold text-slate-700">อ.{district}</h3>
              <ul className="flex flex-1 flex-wrap gap-1.5">
                {items.map((row) => {
                  const meta = STATUS[row.status];
                  const clickable = canOperate && row.status !== "complete";
                  const content = (
                    <>
                      <span className="font-semibold">{row.tambon}</span>
                      <span className={`ml-1.5 text-xs font-bold ${meta.count}`}>{row.recorded}/{row.total}</span>
                    </>
                  );
                  return (
                    <li key={row.key}>
                      {clickable ? (
                        <button
                          type="button"
                          onClick={() => onPick(row)}
                          title={`บันทึกทั้งตำบล${row.tambon}`}
                          className={`inline-flex items-center rounded-lg border px-2.5 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b4c86]/40 ${meta.chip}`}
                        >
                          {content}
                        </button>
                      ) : (
                        <span className={`inline-flex items-center rounded-lg border px-2.5 py-1.5 text-sm ${meta.chip}`}>{content}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
