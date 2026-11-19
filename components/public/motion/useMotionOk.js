"use client";

import { useEffect, useState } from "react";
import { motionAllowed } from "@/lib/publicMotion";

/** true = เล่นแอนิเมชันได้ · false = ผู้ใช้ตั้ง "ลดการเคลื่อนไหว" หรือเปิดประหยัดข้อมูล · null = ยังไม่รู้ (ฝั่งเซิร์ฟเวอร์/ก่อน mount) */
export default function useMotionOk() {
  const [ok, setOk] = useState(null);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => setOk(motionAllowed({ reducedMotion: Boolean(media?.matches), saveData: Boolean(navigator.connection?.saveData) }));
    update();
    media?.addEventListener?.("change", update);
    return () => media?.removeEventListener?.("change", update);
  }, []);
  return ok;
}
