"use client";

// แถบขอตำแหน่ง GPS จากเจ้าหน้าที่หลังเข้าสู่ระบบ (เพื่อความปลอดภัยของระบบ) — ไม่บังคับ ปฏิเสธแล้วใช้งานต่อได้ตามปกติ
// อนุญาตแล้ว: ส่งตำแหน่งที่ปัดแล้ว ≈ 1 กม. ครั้งละไม่เกิน 30 นาทีระหว่างใช้งาน · ไม่ถามซ้ำบนเครื่องเดิม
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { readStaffConsent, saveStaffConsent, shareVisitGps } from "@/lib/visitorGps";

const GEO_OPTIONS = { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 };

export default function StaffGeoConsent() {
  const { user } = useAuth();
  const [ask, setAsk] = useState(false);
  const [message, setMessage] = useState("");

  const send = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => shareVisitGps(position.coords, "staff-consent"),
      (error) => {
        // ผู้ใช้ปิดสิทธิ์ตำแหน่งในเบราว์เซอร์ภายหลัง → ถือว่าไม่อนุญาต ไม่ถามซ้ำ
        if (error?.code === 1 && user?.id) saveStaffConsent(user.id, "denied");
      },
      GEO_OPTIONS
    );
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || user.role === "citizen" || typeof navigator === "undefined" || !navigator.geolocation || !window.isSecureContext) return;
    const answer = readStaffConsent(user.id);
    if (answer === "granted") send();
    else if (answer === null) setAsk(true);
  }, [user?.id, user?.role, send]);

  if (!ask) return null;

  const allow = () => {
    saveStaffConsent(user.id, "granted");
    setMessage("เบราว์เซอร์จะถามอีกครั้ง กด “อนุญาต” เพื่อยืนยัน");
    send();
    setTimeout(() => setAsk(false), 4000);
  };
  const decline = () => {
    saveStaffConsent(user.id, "denied");
    setAsk(false);
  };

  return (
    <div role="dialog" aria-label="ขออนุญาตใช้ตำแหน่ง" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border border-[#c9dcee] bg-white p-4 shadow-[0_18px_40px_-18px_rgba(2,6,23,.45)] print:hidden sm:bottom-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#edf5fc] text-[#0b4c86]"><MapPin className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1 text-sm text-slate-700">
          <p className="font-bold text-slate-900">ขออนุญาตใช้ตำแหน่งของคุณเพื่อความปลอดภัยของระบบ</p>
          <p className="mt-1">ใช้ตรวจสอบว่าการเข้าสู่ระบบมาจากพื้นที่ที่ควรเป็น ระบบปัดตำแหน่งเหลือระดับประมาณ 1 กม. (ไม่ถึงตัวบ้าน) ผู้ดูแลระบบเท่านั้นที่เห็น และลบอัตโนมัติใน 90 วัน · ไม่อนุญาตก็ใช้งานได้ตามปกติ</p>
          {message ? <p className="mt-1 font-semibold text-[#0b4c86]" role="status">{message}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={allow} className="inline-flex min-h-10 items-center rounded-lg bg-[#0b4c86] px-4 text-sm font-bold text-white hover:bg-[#083865]">อนุญาต</button>
            <button type="button" onClick={decline} className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">ไม่อนุญาต</button>
            <Link href="/privacy-policy#retention" className="text-xs font-semibold text-[#0b4c86] underline-offset-2 hover:underline">นโยบายความเป็นส่วนตัว</Link>
          </div>
        </div>
        <button type="button" onClick={() => setAsk(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="ปิด (ถามอีกครั้งครั้งหน้า)"><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>
    </div>
  );
}
