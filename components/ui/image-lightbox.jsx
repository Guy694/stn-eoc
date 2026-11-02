"use client";

// ภาพเต็มจอ (lightbox) ของทั้งระบบ — ใช้ AppDialogShell: Esc/แตะฉากหลังปิด, focus อยู่ที่ปุ่มปิด, ล็อกการเลื่อนหน้า
import { useRef } from "react";
import { X } from "lucide-react";
import { AppDialogClose, AppDialogShell } from "@/components/ui/app-dialog";

export default function ImageLightbox({ open, onOpenChange, src, alt = "", label = "ดูภาพเต็มจอ", layer = "high" }) {
  const closeRef = useRef(null);
  if (!src) return null;
  return (
    <AppDialogShell
      open={open}
      onOpenChange={onOpenChange}
      layer={layer}
      placement="center"
      initialFocus={closeRef}
      aria-label={label}
      backdropClassName="bg-[#06192a]/92"
      viewportClassName="items-center justify-center p-3 sm:p-6"
      className="relative"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ภาพประกาศ/ภาพจากผู้แจ้งมาจาก API หรือ Drive ไม่ใช่ไฟล์ static */}
      <img src={src} alt={alt} className="block max-h-[calc(100dvh-1.5rem)] max-w-full rounded-xl object-contain sm:max-h-[calc(100dvh-3rem)]" />
      <AppDialogClose
        ref={closeRef}
        aria-label="ปิดภาพ"
        className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-6 w-6" aria-hidden="true" />
      </AppDialogClose>
    </AppDialogShell>
  );
}
