"use client";

// แสดงหน้าต่างยืนยันจาก requestConfirm() — หน้าตาเดียวกับ DeleteDialog / FormDialog ของระบบ
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import AppDialog, { AppDialogActions } from "@/components/ui/app-dialog";
import { registerConfirmHost } from "@/lib/confirmDialog";

export default function ConfirmHost() {
  const [request, setRequest] = useState(null);
  const pending = useRef([]);

  useEffect(() => registerConfirmHost((next) => {
    setRequest((current) => {
      if (current) {
        pending.current.push(next);
        return current;
      }
      return next;
    });
  }), []);

  const finish = useCallback((answer) => {
    setRequest((current) => {
      current?.resolve(answer);
      return pending.current.shift() || null;
    });
  }, []);

  const danger = request?.tone !== "primary";
  const Icon = danger ? AlertTriangle : HelpCircle;

  return (
    <AppDialog
      open={Boolean(request)}
      onOpenChange={(open) => { if (!open) finish(false); }}
      title={request?.title || (danger ? "ยืนยันการลบ" : "ยืนยัน")}
      size="sm"
      contentClassName="p-0 sm:p-0"
    >
      {request ? (
        <div className="font-[family-name:var(--font-kanit)]">
          <div className="flex items-start gap-3 p-5 sm:p-6">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${danger ? "bg-red-50 text-red-700 ring-red-100" : "bg-sky-50 text-[#0b4c86] ring-sky-100"}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="pt-2 text-sm leading-6 text-slate-700">{request.message || (danger ? "ต้องการลบข้อมูลนี้ใช่หรือไม่" : "ต้องการดำเนินการต่อใช่หรือไม่")}</p>
          </div>
          <AppDialogActions className="border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
            <button type="button" onClick={() => finish(false)} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b4c86]/40">
              {request.cancelText || "ยกเลิก"}
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => finish(true)}
              className={`inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-bold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b4c86]/40 ${danger ? "bg-red-700 hover:bg-red-800" : "bg-[#0b4c86] hover:bg-[#083865]"}`}
            >
              {request.confirmText || (danger ? "ลบ" : "ยืนยัน")}
            </button>
          </AppDialogActions>
        </div>
      ) : null}
    </AppDialog>
  );
}
