"use client";

// ปุ่มเลือกสถานะความพร้อมแบบแถบเลื่อน (pill): แตะ/ปัดเลือก ตัวเลือกที่เลือกมีแถบสีเลื่อนไปอยู่ใต้
// ใช้คีย์บอร์ดได้ (ลูกศรซ้าย/ขวา) และโปรแกรมอ่านหน้าจออ่านเป็นกลุ่มตัวเลือก (radiogroup)
import { useId, useRef } from "react";
import { READINESS_STATUSES } from "@/lib/officerReadiness";
import { cn } from "@/lib/utils";

export default function ReadinessSlider({ value, onChange, disabled = false, size = "lg", label = "สถานะความพร้อม", options = READINESS_STATUSES }) {
  const id = useId();
  const startX = useRef(null);
  const index = options.findIndex((option) => option.value === value);
  const small = size === "sm";

  const choose = (next) => {
    if (disabled || next < 0 || next >= options.length || options[next].value === value) return;
    onChange?.(options[next].value);
  };
  const onKeyDown = (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); choose(Math.min(options.length - 1, (index < 0 ? -1 : index) + 1)); }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); choose(Math.max(0, (index < 0 ? 1 : index) - 1)); }
  };
  // ปัดซ้าย/ขวาบนมือถือ = เลื่อนไปตัวเลือกข้างเคียง
  const onPointerDown = (event) => { startX.current = event.clientX; };
  const onPointerUp = (event) => {
    if (startX.current === null) return;
    const delta = event.clientX - startX.current;
    startX.current = null;
    if (Math.abs(delta) > 40 && index >= 0) choose(index + (delta > 0 ? 1 : -1));
  };

  const active = index >= 0 ? options[index] : null;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      className={cn(
        "relative grid touch-pan-y select-none rounded-full bg-slate-100 p-1 ring-1 ring-slate-200",
        disabled && "opacity-60"
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute bottom-1 top-1 rounded-full shadow-sm transition-[transform,background-color] duration-300 ease-out motion-reduce:transition-none"
          style={{ left: 4, width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${index * 100}%)`, backgroundColor: active.color }}
        />
      ) : null}
      {options.map((option, position) => {
        const checked = position === index;
        return (
          <button
            key={option.value}
            id={`${id}-${option.value}`}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (index < 0 && position === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => choose(position)}
            title={option.label}
            className={cn(
              "relative z-10 rounded-full text-center font-bold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b4c86]/50",
              small ? "min-h-8 px-1.5 py-1 text-[11px]" : "min-h-12 px-2 py-2 text-sm sm:text-base",
              checked ? "text-white" : "text-slate-600 hover:text-slate-900"
            )}
          >
            {small ? option.short : (
              <>
                <span className="sm:hidden">{option.short}</span>
                <span className="hidden sm:inline">{option.label}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
