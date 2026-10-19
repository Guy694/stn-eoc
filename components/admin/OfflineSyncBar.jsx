"use client";

// แถบแจ้ง "มีข้อมูลรอส่ง" — แสดงเมื่อมีรายการในคิวออฟไลน์ และส่งให้เองเมื่อกลับมาออนไลน์
import { useCallback, useEffect, useState } from "react";
import { CloudOff, RefreshCw, X } from "lucide-react";
import { flushQueue, getQueue, onQueueChange, removeFromQueue } from "@/lib/offlineQueue";
import { notify } from "@/lib/notify";

export default function OfflineSyncBar() {
  const [items, setItems] = useState([]);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const sync = useCallback(async () => {
    if (!getQueue().length) return;
    setBusy(true);
    try {
      const result = await flushQueue();
      if (result.sent) notify.success(`ส่งข้อมูลที่ค้างไว้แล้ว ${result.sent} รายการ`);
      if (result.failed) notify.error("บางรายการส่งไม่สำเร็จ ตรวจรายละเอียดในแถบข้อมูลรอส่ง");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    setItems(getQueue());
    setOnline(navigator.onLine);
    const stop = onQueueChange(setItems);
    const goOnline = () => { setOnline(true); sync(); };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (navigator.onLine) sync();
    return () => { stop(); window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, [sync]);

  if (online && !items.length) return null;
  return (
    <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 print:hidden" role="status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold">
          <CloudOff className="h-4 w-4" aria-hidden="true" />
          {!online ? "ไม่มีอินเทอร์เน็ต — ข้อมูลที่บันทึกจะเก็บไว้ในเครื่องก่อน" : `มีข้อมูลรอส่ง ${items.length} รายการ`}
        </span>
        {items.length ? (
          <span className="flex gap-2">
            <button type="button" onClick={() => setOpen((value) => !value)} className="font-bold underline-offset-2 hover:underline">{open ? "ซ่อน" : "ดูรายการ"}</button>
            <button type="button" disabled={busy || !online} onClick={sync} className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 font-bold text-white disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />ส่งตอนนี้
            </button>
          </span>
        ) : null}
      </div>
      {open && items.length ? (
        <ul className="mt-2 divide-y divide-amber-200">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-2 py-1.5">
              <span>
                {item.label} <span className="text-xs text-amber-800">· บันทึกเมื่อ {new Date(item.createdAt).toLocaleString("th-TH")}</span>
                {item.lastError ? <span className="block text-xs font-semibold text-red-700">ส่งไม่สำเร็จ: {item.lastError}</span> : null}
              </span>
              <button type="button" onClick={() => removeFromQueue(item.id)} className="rounded p-1 hover:bg-amber-100" aria-label={`ทิ้งรายการ ${item.label}`} title="ทิ้งรายการนี้"><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
