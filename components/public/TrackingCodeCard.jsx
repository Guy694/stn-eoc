"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { formatTrackingCode, phoneLast4 } from "@/lib/helpTracking";
import { saveTrackingIdentity } from "@/lib/myReports";

// หลังส่งเรื่อง: บอกวิธีติดตาม (ชื่อ-นามสกุล + เบอร์ 4 ตัวท้าย) และจำไว้ในเครื่องเพื่อกดติดตามได้ทันที
export default function TrackingCodeCard({ code, firstName, lastName, phone }) {
  const phone4 = phoneLast4(phone);
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  const canTrack = Boolean(first && last && phone4);

  useEffect(() => {
    if (canTrack) saveTrackingIdentity({ firstName: first, lastName: last, phone4 });
  }, [canTrack, first, last, phone4]);

  return (
    <div className="mt-4 rounded-xl border-2 border-dashed border-[#0b4c86]/40 bg-sky-50 p-4 text-slate-800">
      {canTrack ? (
        <>
          <p className="font-bold text-slate-900">ติดตามเรื่องนี้ได้ที่เมนู &quot;ติดตามคำขอ&quot;</p>
          <p className="mt-1 text-sm text-slate-700">
            กรอกชื่อ นามสกุล และเบอร์โทร 4 ตัวท้าย ({phone4}) ให้ตรงกับที่แจ้ง เครื่องนี้จำไว้ให้แล้ว
          </p>
          <Link
            href="/public/track"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#0b4c86] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#083865]"
          >
            <Search className="h-4 w-4" aria-hidden="true" /> ดูสถานะเรื่องนี้
          </Link>
        </>
      ) : (
        <p className="text-sm text-slate-700">
          รายงานนี้ไม่ได้ให้ชื่อ-นามสกุลหรือเบอร์โทรครบ จึงดูสถานะออนไลน์ไม่ได้
        </p>
      )}
      {code ? (
        <p className="mt-3 text-sm text-slate-600">
          เลขอ้างอิงเมื่อโทรสอบถาม: <span className="font-mono font-bold tracking-wider text-[#0b4c86]">{formatTrackingCode(code)}</span>
        </p>
      ) : null}
    </div>
  );
}
