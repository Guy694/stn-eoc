"use client";

import { useEffect, useState } from "react";
import AppDialog, { AppDialogActions, AppDialogCancel } from "@/components/ui/app-dialog";

export default function ReasonDialog({
  open,
  onOpenChange,
  title = "ระบุเหตุผล",
  description,
  label = "เหตุผล",
  confirmText = "ยืนยัน",
  initialValue = "",
  busy = false,
  onConfirm,
}) {
  const [reason, setReason] = useState(initialValue);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setReason(initialValue);
      setError("");
    }
  }, [initialValue, open]);

  const submit = async (event) => {
    event.preventDefault();
    const normalized = reason.trim();
    if (!normalized) {
      setError(`กรุณากรอก${label}`);
      return;
    }
    setError("");
    await onConfirm?.(normalized);
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      busy={busy}
      contentClassName="p-0 sm:p-0"
    >
      <form onSubmit={submit}>
        <div className="p-5 sm:p-6">
          <label className="block text-sm font-bold text-slate-800">
            {label}
            <textarea
              autoFocus
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
          {error ? <p className="mt-2 text-sm font-bold text-red-700">{error}</p> : null}
        </div>
        <AppDialogActions className="border-t border-slate-200 bg-slate-50 p-4">
          <AppDialogCancel disabled={busy} />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-cyan-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "กำลังดำเนินการ..." : confirmText}
          </button>
        </AppDialogActions>
      </form>
    </AppDialog>
  );
}
