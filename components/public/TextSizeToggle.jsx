"use client";

// ขยายตัวอักษรทั้งหน้า (สำหรับผู้สูงอายุ/สายตาไม่ดี) — ปรับขนาดฐานของ rem ทั้งเว็บ จำค่าไว้ในเครื่อง
// ค่าเริ่มต้นถูกใส่ตั้งแต่ก่อนหน้าแสดงผลด้วยสคริปต์ใน app/layout.jsx (TEXT_SCALE_SCRIPT) จึงไม่กระพริบ
import { useEffect, useState } from "react";
import { TEXT_SCALES, TEXT_SCALE_KEY } from "@/lib/textScale";

function readScale() {
  try {
    const value = Number.parseFloat(window.localStorage.getItem(TEXT_SCALE_KEY));
    return TEXT_SCALES.some((s) => s.value === value) ? value : 1;
  } catch {
    return 1;
  }
}

export default function TextSizeToggle({ className = "" }) {
  const [scale, setScale] = useState(1);
  useEffect(() => { setScale(readScale()); }, []);

  const next = () => {
    const index = TEXT_SCALES.findIndex((s) => s.value === scale);
    const value = TEXT_SCALES[(index + 1) % TEXT_SCALES.length].value;
    setScale(value);
    document.documentElement.style.fontSize = value === 1 ? "" : `${value * 100}%`;
    try {
      if (value === 1) window.localStorage.removeItem(TEXT_SCALE_KEY);
      else window.localStorage.setItem(TEXT_SCALE_KEY, String(value));
    } catch {
      // โหมดส่วนตัว: ใช้ได้เฉพาะหน้านี้
    }
  };
  const current = TEXT_SCALES.find((s) => s.value === scale) || TEXT_SCALES[0];
  return (
    <button type="button" onClick={next} className={className} aria-label={`ขนาดตัวอักษร: ${current.label} (กดเพื่อเปลี่ยน)`} title="ขยายตัวอักษร">
      <span aria-hidden="true" className="font-black leading-none"><span className="text-xs">ก</span><span className="text-base">ก</span></span>
      <span className="text-xs font-bold">{current.label}</span>
    </button>
  );
}
