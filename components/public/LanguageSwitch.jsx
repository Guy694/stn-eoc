"use client";

// สวิตช์ภาษา TH / EN สำหรับหน้าประชาชน — แปลทั้งหน้าอัตโนมัติด้วย Google Translate (เว็บนี้เขียนเป็นภาษาไทย)
// เปิด EN: ตั้งคุกกี้ googtrans=/th/en แล้วโหลดสคริปต์แปลภาษา · กลับเป็น TH: ลบคุกกี้แล้วโหลดหน้าใหม่
// ข้อความถูกส่งไปแปลที่ Google เฉพาะเมื่อผู้ใช้เลือก EN (ระบุไว้ในนโยบายความเป็นส่วนตัว)
import { useEffect, useState } from "react";

const COOKIE = "googtrans";
const SCRIPT_ID = "stn-google-translate";
const HOLDER_ID = "stn-google-translate-holder";

function readLang() {
  if (typeof document === "undefined") return "th";
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
  return match && decodeURIComponent(match[1]).endsWith("/en") ? "en" : "th";
}

function setCookie(value) {
  const host = window.location.hostname;
  const domains = ["", host, host.split(".").slice(-2).join(".")].filter((d, i, all) => all.indexOf(d) === i);
  for (const domain of domains) {
    const scope = `path=/;${domain && domain.includes(".") ? ` domain=.${domain.replace(/^\./, "")};` : ""}`;
    document.cookie = value
      ? `${COOKIE}=${value}; ${scope} max-age=31536000; SameSite=Lax`
      : `${COOKIE}=; ${scope} expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

// Google Translate เปลี่ยนข้อความในหน้า → React อาจหา node เดิมไม่เจอตอนอัปเดต (removeChild error)
// ให้ข้ามกรณีนั้นแทนการทำให้หน้าพัง (แนวทางที่ใช้กันทั่วไปกับ React)
function guardDomForTranslation() {
  if (typeof Node === "undefined" || Node.prototype.__stnTranslateGuard) return;
  Node.prototype.__stnTranslateGuard = true;
  const removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function guardedRemoveChild(child) {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child);
  };
  const insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function guardedInsertBefore(node, reference) {
    if (reference && reference.parentNode !== this) return node;
    return insertBefore.call(this, node, reference);
  };
}

function loadTranslator() {
  if (document.getElementById(SCRIPT_ID)) return;
  guardDomForTranslation();
  if (!document.getElementById(HOLDER_ID)) {
    const holder = document.createElement("div");
    holder.id = HOLDER_ID;
    holder.style.display = "none";
    document.body.appendChild(holder);
  }
  window.stnGoogleTranslateInit = () => {
    try {
      new window.google.translate.TranslateElement({ pageLanguage: "th", includedLanguages: "en", autoDisplay: false }, HOLDER_ID);
    } catch { /* โหลดไม่สำเร็จ: หน้ายังเป็นภาษาไทย */ }
  };
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = "https://translate.google.com/translate_a/element.js?cb=stnGoogleTranslateInit";
  script.async = true;
  document.body.appendChild(script);
}

export default function LanguageSwitch({ className = "", onReload }) {
  const [lang, setLang] = useState("th");

  useEffect(() => {
    const current = readLang();
    setLang(current);
    if (current === "en") loadTranslator();
  }, []);

  const toggle = () => {
    const next = lang === "en" ? "th" : "en";
    setCookie(next === "en" ? "/th/en" : "");
    setLang(next);
    (onReload || (() => window.location.reload()))();
  };

  const en = lang === "en";
  return (
    <>
      <style>{`
        .goog-te-banner-frame, iframe.skiptranslate, .skiptranslate > iframe, #goog-gt-tt, .goog-te-balloon-frame,
        iframe[class^="VIpgJd-"], .VIpgJd-ZVi9od-aZ2wEe-wOHMyf { display: none !important; }
        body { top: 0 !important; position: static !important; }
        .goog-text-highlight, font[style] { background: none !important; box-shadow: none !important; }
      `}</style>
      <button
        type="button"
        role="switch"
        aria-checked={en}
        aria-label={en ? "Switch to Thai (ภาษาไทย)" : "เปลี่ยนเป็นภาษาอังกฤษ (English)"}
        title={en ? "ภาษาไทย" : "English (แปลอัตโนมัติ)"}
        onClick={toggle}
        translate="no"
        className={`notranslate relative inline-flex h-9 w-[4.5rem] shrink-0 items-center rounded-full bg-white/15 p-1 text-[11px] font-black ring-1 ring-white/25 transition-colors hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className}`}
      >
        <span aria-hidden="true" className={`absolute top-1 h-7 w-8 rounded-full bg-white shadow transition-transform duration-200 ${en ? "translate-x-[2.25rem]" : "translate-x-0"}`} />
        <span aria-hidden="true" className={`relative z-10 flex w-8 justify-center transition-colors ${en ? "text-white/80" : "text-[#0b4c86]"}`}>TH</span>
        <span aria-hidden="true" className={`relative z-10 flex w-8 justify-center transition-colors ${en ? "text-[#0b4c86]" : "text-white/80"}`}>EN</span>
      </button>
    </>
  );
}
