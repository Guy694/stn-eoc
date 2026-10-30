"use client";

// เด้งขอให้ประเมินความพึงพอใจเมื่อผู้ใช้ใช้งานมาสักพัก (เข้าหลายครั้ง/เปิดหลายหน้า) — เก็บสถิติการเข้าชมในเครื่องผู้ใช้เท่านั้น ไม่ส่งไปเซิร์ฟเวอร์
// ไม่เด้งถ้ามี popup อื่นเปิดอยู่ (เตือนด่วน/ชวนรับแจ้งเตือน) · ปิดหรือ "ไว้ทีหลัง" = ถามใหม่ใน 14 วัน · ประเมินแล้ว = 30 วัน
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SatisfactionDialog } from "@/components/common/SatisfactionButton";
import { ASK_DELAY_MS, RATED_KEY, VISITS_KEY, ratedRecently, recordVisit, shouldAskSatisfaction } from "@/lib/satisfaction";

const SESSION_KEY = "stn-eoc:visit-session";
const read = (key, store = "localStorage") => { try { return JSON.parse(window[store].getItem(key) || "null"); } catch { return null; } };
const write = (key, value) => { try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* โหมดส่วนตัว */ } };
const otherDialogOpen = () => Boolean(document.querySelector('[role="dialog"], [role="alertdialog"]'));

export default function SatisfactionPrompt() {
  const pathname = usePathname() || "";
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);

  // นับการเข้าชม: 1 หน้า = 1 ครั้ง, 1 แท็บที่เปิดใหม่ = 1 ครั้งการเข้าใช้
  useEffect(() => {
    let newSession = false;
    try {
      if (!window.sessionStorage.getItem(SESSION_KEY)) { window.sessionStorage.setItem(SESSION_KEY, "1"); newSession = true; }
    } catch { /* ไม่มี sessionStorage */ }
    const state = recordVisit(read(VISITS_KEY), { newSession });
    write(VISITS_KEY, state);
    setEligible(shouldAskSatisfaction(state, read(RATED_KEY)));
  }, [pathname]);

  // เปิดหลังอยู่ในหน้านี้สักพัก; ถ้ามี popup อื่นอยู่ ลองใหม่ (สูงสุด 3 ครั้ง)
  useEffect(() => {
    if (!eligible || open) return undefined;
    let tries = 0;
    let timer;
    const attempt = () => {
      if (otherDialogOpen()) {
        tries += 1;
        if (tries <= 3) timer = window.setTimeout(attempt, 15000);
        return;
      }
      setOpen(true);
    };
    timer = window.setTimeout(attempt, ASK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [eligible, open, pathname]);

  const close = () => {
    setOpen(false);
    setEligible(false);
    if (!ratedRecently(read(RATED_KEY))) write(VISITS_KEY, { ...(read(VISITS_KEY) || {}), dismissedAt: Date.now() });
  };

  return <SatisfactionDialog open={open} onClose={close} ask />;
}
