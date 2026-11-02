"use client";

// ธีมหน้าแรก (ทดลอง)
//   "auto"    = ตามสภาพอากาศ: ไม่มีฝน → sky · มีฝน (สถานีวัดฝนรายงานฝนตก หรือภาพรวมบอกฝนตก) → classic
//   "sky"     = Modern Sky Light (โทนฟ้าสว่าง โปร่ง) ตลอด
//   "classic" = แบบเดิม (ฟ้าเข้ม) ตลอด
// ย้อนกลับเป็นแบบเดิมทั้งระบบ: เปลี่ยน DEFAULT_HOME_THEME เป็น "classic" (บรรทัดเดียว)
// ดูเปรียบเทียบบนเครื่องตัวเอง: /?theme=classic | sky | auto (จำไว้ในเครื่อง) · /?theme=default = กลับไปใช้ค่าเริ่มต้น
// ดูตัวอย่างโหมด auto ตอนฝนตก: /?fx=rain
// สไตล์ของธีม sky อยู่ที่ components/public/home/homeThemeSky.css (มีผลเฉพาะใต้ [data-home-theme="sky"])
import { useEffect, useState } from "react";

export const HOME_THEMES = ["auto", "sky", "classic"];
export const DEFAULT_HOME_THEME = "auto";
const STORAGE_KEY = "stn-eoc:home-theme";

export function resolveHomeTheme(param, stored) {
  if (HOME_THEMES.includes(param)) return param;
  if (param === "default") return DEFAULT_HOME_THEME;
  if (HOME_THEMES.includes(stored)) return stored;
  return DEFAULT_HOME_THEME;
}

/** ธีมที่ใช้จริง: auto → ดูฉากอากาศ (weatherScene) · ยังไม่รู้สภาพอากาศ → classic (หน้าโลโก้บังอยู่ จะไม่เห็นการสลับ) */
export function effectiveHomeTheme(choice, scene) {
  if (choice !== "auto") return HOME_THEMES.includes(choice) ? choice : "classic";
  if (!scene) return "classic";
  return Number(scene.rain) > 0 ? "classic" : "sky";
}

export function useHomeTheme() {
  const [theme, setTheme] = useState(DEFAULT_HOME_THEME);
  useEffect(() => {
    let stored = null;
    const param = new URLSearchParams(window.location.search).get("theme");
    try {
      if (HOME_THEMES.includes(param)) window.localStorage.setItem(STORAGE_KEY, param);
      if (param === "default") window.localStorage.removeItem(STORAGE_KEY);
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch { /* โหมดส่วนตัว: ใช้จาก URL อย่างเดียว */ }
    setTheme(resolveHomeTheme(param, stored));
  }, []);
  return theme;
}
