"use client";

// B1: ส่วนของหน้าค่อย ๆ เลื่อนขึ้นเมื่อเลื่อนจอมาถึง (เล่นครั้งเดียว)
// - เนื้อหาแสดงตั้งแต่แรก (SSR/ไม่มี JS/ลดการเคลื่อนไหว) — ซ่อนเฉพาะส่วนที่ยังอยู่ใต้จอตอนเปิดหน้า
// - เพิ่ม class "is-revealed" ให้ลูก ๆ ใช้ต่อได้ (เช่น แถบโอกาสฝนเริ่มเติมตอนเห็น)
import { useEffect, useRef, useState } from "react";
import useMotionOk from "@/components/public/motion/useMotionOk";
import "@/components/public/motion/publicMotion.css";

export default function Reveal({ as: Tag = "div", className = "", children, ...props }) {
  const ref = useRef(null);
  const motionOk = useMotionOk();
  const [state, setState] = useState("idle"); // idle → pending (รอเห็น) → revealed

  useEffect(() => {
    const element = ref.current;
    if (!element || motionOk === null) return undefined;
    if (!motionOk || typeof IntersectionObserver === "undefined") {
      setState("revealed");
      return undefined;
    }
    const belowFold = element.getBoundingClientRect().top > window.innerHeight * 0.9;
    if (!belowFold) {
      setState("revealed");
      return undefined;
    }
    setState("pending");
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setState("revealed");
        observer.disconnect();
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [motionOk]);

  const stateClass = state === "pending" ? "pm-reveal" : state === "revealed" ? "pm-reveal is-revealed" : "";
  return <Tag ref={ref} className={`${stateClass} ${className}`.trim()} {...props}>{children}</Tag>;
}
