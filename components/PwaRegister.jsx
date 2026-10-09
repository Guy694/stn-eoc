"use client";

// ลงทะเบียน service worker (ใช้งานออฟไลน์ + แจ้งเตือนภัย) และเก็บปุ่ม "ติดตั้งแอป" ของเบราว์เซอร์ไว้ใช้ภายหลัง
import { useEffect } from "react";
import { captureInstallPrompt, refreshOfflinePack, registerServiceWorker } from "@/lib/pwaClient";

export default function PwaRegister() {
  useEffect(() => {
    const release = captureInstallPrompt();
    const start = () => registerServiceWorker({ dev: process.env.NODE_ENV !== "production" }).then(() => refreshOfflinePack()).catch(() => {});
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      release();
      window.removeEventListener("load", start);
    };
  }, []);
  return null;
}
