"use client";

// B2: ตัวเลขนับขึ้นจาก 0 เมื่อเห็นครั้งแรก และนับจากค่าเดิมเมื่อข้อมูลอัปเดต
// ค่าที่ไม่ใช่ตัวเลข ("–") แสดงตามเดิม · SSR/ลดการเคลื่อนไหว = แสดงค่าจริงทันที
import { useEffect, useRef, useState } from "react";
import { countUpValue, decimalsOf } from "@/lib/publicMotion";
import useMotionOk from "@/components/public/motion/useMotionOk";

const DURATION_MS = 900;

export default function CountUp({ value, format = (number) => number.toLocaleString("th-TH"), className = "" }) {
  const numeric = value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const target = numeric ? Number(value) : null;
  const decimals = numeric ? decimalsOf(value) : 0;
  const motionOk = useMotionOk();
  const ref = useRef(null);
  const shownRef = useRef(null); // ค่าที่แสดงล่าสุด (null = ยังไม่เคยเห็น)
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    if (motionOk === null) return undefined; // ยังไม่รู้ว่าเล่นได้ไหม: แสดงค่าจริงไปก่อน
    if (target === null || !motionOk) {
      shownRef.current = target;
      setDisplay(target);
      return undefined;
    }
    let frame = 0;
    let observer = null;
    const run = () => {
      const from = shownRef.current ?? 0;
      if (from === target) { setDisplay(target); return; }
      const started = performance.now();
      const step = (now) => {
        const progress = Math.min(1, (now - started) / DURATION_MS);
        const next = countUpValue(from, target, progress, decimals);
        setDisplay(next);
        shownRef.current = next;
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };
    if (shownRef.current === null && ref.current && typeof IntersectionObserver !== "undefined") {
      setDisplay(0);
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); run(); }
      }, { threshold: 0.4 });
      observer.observe(ref.current);
    } else {
      run();
    }
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [target, decimals, motionOk]);

  if (!numeric) return <span className={className}>{value ?? "–"}</span>;
  const shown = display === null ? target : display;
  return <span ref={ref} className={className}>{format(Number(shown.toFixed(decimals)))}</span>;
}
