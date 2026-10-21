"use client";

// "น้องผู้ช่วย" มาสคอตของผู้ช่วย EOC ยืนชิดขวาล่างของจอ กดแล้วเปิดหน้าต่างถามผู้ช่วย
// ขยับด้วย CSS transform/opacity อย่างเดียว (ลอยเบา ๆ โยกตัว กะพริบตา กระโดดทักทายเป็นระยะ)
// ไม่ขยับเลยถ้าเครื่องตั้ง "ลดการเคลื่อนไหว" · หยุดเองเมื่อแท็บไม่ได้เปิดอยู่
import { useEffect, useState } from "react";
import { X } from "lucide-react";

const BASE = "/stn-eoc/img/mascot";
const GREETINGS = [
  "มีอะไรให้ช่วยไหมครับ",
  "ถามเรื่องน้ำ ฝน หรือศูนย์พักพิงได้นะครับ",
  "บ้านคุณเสี่ยงน้ำท่วมไหม ถามผมได้ครับ"
];
const GREETED_KEY = "eoc-mascot-greeted";

const CSS = `
.eoc-mascot{--mascot-h:104px}
@media (min-width:640px){.eoc-mascot{--mascot-h:132px}}
.eoc-mascot-body{height:var(--mascot-h);width:calc(var(--mascot-h)*.478);transform-origin:50% 100%;animation:eoc-mascot-float 3.4s ease-in-out infinite}
.eoc-mascot-sway{transform-origin:50% 100%;animation:eoc-mascot-sway 7s ease-in-out infinite}
.eoc-mascot-hop{transform-origin:50% 100%;animation:eoc-mascot-hop 16s ease-in-out 4s infinite}
.eoc-mascot-blink{animation:eoc-mascot-blink 5.2s steps(1,end) infinite}
.eoc-mascot-shadow{animation:eoc-mascot-shadow 3.4s ease-in-out infinite}
.eoc-mascot-btn:hover .eoc-mascot-lift,.eoc-mascot-btn:focus-visible .eoc-mascot-lift{transform:translateY(-6px) scale(1.04)}
.eoc-mascot-lift{transition:transform .25s cubic-bezier(.2,.8,.2,1);transform-origin:50% 100%}
.eoc-mascot-bubble{animation:eoc-mascot-pop .35s cubic-bezier(.2,.9,.3,1.3) both}
@keyframes eoc-mascot-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes eoc-mascot-sway{0%,100%{transform:rotate(-1.6deg)}50%{transform:rotate(1.6deg)}}
@keyframes eoc-mascot-hop{0%,86%,100%{transform:translateY(0) rotate(0)}89%{transform:translateY(-10px) rotate(-4deg)}92%{transform:translateY(0) rotate(0)}95%{transform:translateY(-6px) rotate(3deg)}98%{transform:translateY(0) rotate(0)}}
@keyframes eoc-mascot-blink{0%,93%{opacity:0}94%,96%{opacity:1}97%,100%{opacity:0}}
@keyframes eoc-mascot-shadow{0%,100%{transform:scaleX(1);opacity:.32}50%{transform:scaleX(.86);opacity:.22}}
@keyframes eoc-mascot-pop{from{opacity:0;transform:translateY(6px) scale(.9)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.eoc-mascot-body,.eoc-mascot-sway,.eoc-mascot-hop,.eoc-mascot-shadow,.eoc-mascot-bubble{animation:none}.eoc-mascot-blink{animation:none;opacity:0}.eoc-mascot-lift{transition:none}}
`;

function readSession(key) {
  try { return window.sessionStorage.getItem(key); } catch { return null; }
}
function writeSession(key, value) {
  try { window.sessionStorage.setItem(key, value); } catch { /* โหมดส่วนตัว: ข้าม */ }
}

export default function AssistantMascot({ onOpen, onHide, raised = false }) {
  const [bubble, setBubble] = useState(null);

  // ทักทายครั้งแรกของการเปิดเว็บ (ต่อแท็บ) แล้วเงียบ ไม่รบกวน
  useEffect(() => {
    if (readSession(GREETED_KEY)) return undefined;
    const show = window.setTimeout(() => {
      setBubble(GREETINGS[0]);
      writeSession(GREETED_KEY, "1");
    }, 1800);
    const hide = window.setTimeout(() => setBubble(null), 8000);
    return () => { window.clearTimeout(show); window.clearTimeout(hide); };
  }, []);

  const hint = () => setBubble((current) => current || GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

  return (
    <div
      className={`eoc-mascot fixed right-1 z-[1100] flex items-end sm:right-3 ${raised ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-3" : "bottom-2 sm:bottom-3"}`}
      onMouseEnter={hint}
      onMouseLeave={() => setBubble(null)}
    >
      <style>{CSS}</style>
      {bubble ? (
        <button
          type="button"
          onClick={onOpen}
          className="eoc-mascot-bubble relative mb-[calc(var(--mascot-h)*.62)] mr-1 max-w-[11.5rem] rounded-2xl rounded-br-sm bg-white px-3 py-2 text-left text-sm font-semibold leading-snug text-[#0c2f4a] shadow-[0_10px_24px_-10px_rgba(12,47,74,.55)] ring-1 ring-[#c9dcee]"
        >
          {bubble}
          <span className="mt-0.5 block text-xs font-medium text-[#0b72b9]">แตะเพื่อถามผู้ช่วย</span>
        </button>
      ) : null}

      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          onFocus={hint}
          onBlur={() => setBubble(null)}
          aria-label="น้องผู้ช่วย EOC — กดเพื่อถามผู้ช่วย"
          title="ถามผู้ช่วย EOC"
          className="eoc-mascot-btn group relative block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2a9db0] focus-visible:ring-offset-2"
        >
          {/* เงาที่พื้น */}
          <span className="eoc-mascot-shadow absolute bottom-0 left-1/2 -ml-[30%] h-2 w-[60%] rounded-[50%] bg-[#0c2f4a] blur-[3px]" aria-hidden="true" />
          <span className="eoc-mascot-lift block">
            <span className="eoc-mascot-hop block">
              <span className="eoc-mascot-sway block">
                <span className="eoc-mascot-body relative block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- ภาพโปร่งใสขนาดเล็กที่เตรียมไว้แล้ว */}
                  <img src={`${BASE}/eoc-helper.webp`} alt="" width={172} height={360} draggable={false} className="pointer-events-none h-full w-full select-none object-contain" />
                  {/* eslint-disable-next-line @next/next/no-img-element -- เปลือกตาสำหรับกะพริบ วางทับภาพเดิมพอดี */}
                  <img src={`${BASE}/eoc-helper-blink.webp`} alt="" width={172} height={360} draggable={false} className="eoc-mascot-blink pointer-events-none absolute inset-0 h-full w-full select-none object-contain" />
                </span>
              </span>
            </span>
          </span>
        </button>
        {onHide ? (
          <button
            type="button"
            onClick={onHide}
            className="absolute -left-3 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow ring-1 ring-slate-200 hover:bg-white hover:text-slate-900"
            aria-label="ซ่อนน้องผู้ช่วย (เรียกกลับได้จากเมนู ถามผู้ช่วย)"
            title="ซ่อนน้องผู้ช่วย"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** รูปหน้าน้องผู้ช่วย (หัวหน้าต่างแชตและข้างข้อความ) */
export function AssistantAvatar({ className = "" }) {
  // eslint-disable-next-line @next/next/no-img-element -- รูปเล็กที่เตรียมไว้แล้ว
  return <img src={`${BASE}/eoc-helper-avatar.webp`} alt="" width={128} height={128} className={`h-full w-full object-cover ${className}`} />;
}
