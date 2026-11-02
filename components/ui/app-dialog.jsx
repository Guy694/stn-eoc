"use client";

import { Dialog } from "@base-ui/react/dialog";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-[min(96rem,calc(100vw-2rem))]",
};

export default function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  busy = false,
  closeLabel = "ปิดหน้าต่าง",
  className,
  contentClassName,
  showClose = true,
}) {
  const handleOpenChange = (nextOpen) => {
    if (!nextOpen && busy) return;
    onOpenChange?.(nextOpen);
  };

  return (
    <Dialog.Root
      open={Boolean(open)}
      onOpenChange={handleOpenChange}
      disablePointerDismissal={busy}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[1190] bg-slate-950/55 backdrop-blur-sm transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-[1200] flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-4">
          <Dialog.Popup
            className={cn(
              "my-auto flex max-h-[min(92dvh,900px)] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none transition data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 sm:rounded-2xl",
              SIZE_CLASSES[size] || SIZE_CLASSES.md,
              className,
            )}
          >
            {(title || showClose) && (
              <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  {title ? (
                    <Dialog.Title className="text-lg font-black text-slate-900 sm:text-xl">
                      {title}
                    </Dialog.Title>
                  ) : null}
                  {description ? (
                    <Dialog.Description className="mt-1 text-sm text-slate-600">
                      {description}
                    </Dialog.Description>
                  ) : null}
                </div>
                {showClose ? (
                  <Dialog.Close
                    aria-label={closeLabel}
                    disabled={busy}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X className="h-5 w-5" />
                  </Dialog.Close>
                ) : null}
              </header>
            )}
            <div className={cn("min-h-0 flex-1 overflow-y-auto p-5 sm:p-6", contentClassName)}>
              {children}
            </div>
            {footer ? (
              <footer className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                {footer}
              </footer>
            ) : null}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AppDialogActions({ children, className }) {
  return (
    <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}>
      {children}
    </div>
  );
}

export function AppDialogCancel({
  children = "ยกเลิก",
  className,
  disabled,
  onClick,
}) {
  return (
    <Dialog.Close
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </Dialog.Close>
  );
}

/**
 * Transitional wrapper for existing modal content. It supplies the same focus
 * trap, scroll lock, Escape handling, backdrop and z-index as AppDialog while
 * allowing feature pages to keep their current panel markup during migration.
 */
export function AppDialogFrame({
  open,
  onOpenChange,
  children,
  busy = false,
  className,
}) {
  const handleOpenChange = (nextOpen) => {
    if (!nextOpen && busy) return;
    onOpenChange?.(nextOpen);
  };

  return (
    <Dialog.Root
      open={Boolean(open)}
      onOpenChange={handleOpenChange}
      disablePointerDismissal={busy}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[1190] bg-slate-950/55 backdrop-blur-sm transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-[1200] flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-4">
          <Dialog.Popup
            aria-label="หน้าต่างดำเนินการ"
            className={cn(
              "contents [&>form]:my-auto [&>form]:max-h-[92dvh] [&>form]:rounded-t-2xl [&>form]:shadow-2xl sm:[&>form]:rounded-2xl [&>div]:my-auto [&>div]:max-h-[92dvh] [&>div]:rounded-t-2xl [&>div]:shadow-2xl sm:[&>div]:rounded-2xl",
              className,
            )}
          >
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ชั้นของหน้าต่าง: default = หน้าต่างทำงานทั่วไป · high = popup ชวน/ประกาศบนหน้าประชาชน · urgent = เตือนภัยด่วน (อยู่บนสุด)
const LAYERS = {
  default: { backdrop: "z-[1190]", viewport: "z-[1200]" },
  high: { backdrop: "z-[2040]", viewport: "z-[2050]" },
  urgent: { backdrop: "z-[2090]", viewport: "z-[2100]" },
};

/**
 * หน้าต่างที่ออกแบบหน้าตาเอง (popup ประกาศ เตือนภัยด่วน ภาพเต็มจอ) แต่ใช้พฤติกรรมเดียวกับ AppDialog ทั้งระบบ:
 * focus trap, ล็อกการเลื่อนหน้า, Esc ปิด, คืน focus เมื่อปิด, ฉากหลัง และลำดับชั้น
 * - className = กล่องหน้าต่าง (Popup) ของผู้เรียก · backdropClassName ปรับสีฉากหลัง (เช่น ภาพเต็มจอใช้สีเข้ม)
 * - alert = หน้าต่างเตือนที่ต้องกดรับทราบ (role="alertdialog" แตะฉากหลังไม่ปิด)
 * - dismissOnBackdrop=false = แตะฉากหลังไม่ปิด (ยังปิดด้วยปุ่มหรือ Esc ได้)
 * - placement: "sheet" = แผ่นล่างบนมือถือ/กลางจอบนจอใหญ่ (ค่าเริ่มต้น) · "center" = กลางจอทุกขนาด (เช่น ภาพเต็มจอ)
 */
export function AppDialogShell({
  open,
  onOpenChange,
  children,
  className,
  backdropClassName = "bg-slate-950/55 backdrop-blur-sm",
  viewportClassName = "items-end justify-center p-0 sm:items-center sm:p-4",
  layer = "default",
  alert = false,
  dismissOnBackdrop = true,
  initialFocus,
  placement = "sheet",
  ...popupProps
}) {
  const Parts = alert ? AlertDialog : Dialog;
  const z = LAYERS[layer] || LAYERS.default;
  return (
    <Parts.Root open={Boolean(open)} onOpenChange={(nextOpen) => onOpenChange?.(nextOpen)} disablePointerDismissal={alert || !dismissOnBackdrop}>
      <Parts.Portal>
        <Parts.Backdrop className={cn("fixed inset-0 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 print:hidden", z.backdrop, backdropClassName)} />
        <Parts.Viewport className={cn("fixed inset-0 flex overflow-y-auto print:hidden", z.viewport, viewportClassName)}>
          <Parts.Popup
            initialFocus={initialFocus}
            className={cn(placement === "sheet" ? "max-sm:mt-auto sm:my-auto" : "my-auto", "outline-none transition data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none", className)}
            {...popupProps}
          >
            {children}
          </Parts.Popup>
        </Parts.Viewport>
      </Parts.Portal>
    </Parts.Root>
  );
}

export const AppDialogTitle = Dialog.Title;
export const AppDialogDescription = Dialog.Description;
export const AppDialogClose = Dialog.Close;
