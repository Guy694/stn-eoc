"use client";

// ชุดส่วนประกอบกลางสำหรับหน้าหลังบ้าน (เพิ่ม/ลบ/แก้ไข) ให้ทุกหน้ามีรูปแบบเดียวกัน:
// หัวหน้า → แถบค้นหา/กรอง → ตาราง (มือถือเป็นการ์ด) → ฟอร์มในหน้าต่าง → ยืนยันลบพร้อมเหตุผล
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Pencil, Plus, Search, Trash2 } from "lucide-react";
import AppDialog, { AppDialogActions, AppDialogCancel } from "@/components/ui/app-dialog";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelative, parseDateValue } from "@/lib/adminApi";
import { notify } from "@/lib/notify";
import { MetricCard, MetricGrid, toneFromClass } from "@/components/common/MetricCards";

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0b4c86] focus:ring-2 focus:ring-[#0b4c86]/15 disabled:bg-slate-100 disabled:text-slate-500";

const BUTTON = {
  primary: "bg-[#0b4c86] text-white hover:bg-[#083865]",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  danger: "bg-red-700 text-white hover:bg-red-800",
  ghost: "text-slate-600 hover:bg-slate-100"
};

export function Button({ variant = "primary", className, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b4c86]/40 disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function AddButton({ children = "เพิ่มข้อมูล", ...props }) {
  return (
    <Button {...props}>
      <Plus className="h-4 w-4" aria-hidden="true" /> {children}
    </Button>
  );
}

/** หัวหน้า: ชื่อหน้า + คำอธิบายสั้นว่าหน้านี้ใช้ทำอะไร + ปุ่มหลัก */
/**
 * ป้ายความใหม่ของข้อมูล — แบบเดียวกันทุกหน้า: "อัปเดตล่าสุด 25 นาทีที่แล้ว"
 * เกิน staleHours = ข้อมูลเก่า (โทนส้มอ่อน + ข้อความบอกตรง ๆ) · ไม่มีค่า = ยังไม่มีการรายงาน
 */
export function FreshnessBadge({ value, staleHours = 24, label = "อัปเดตล่าสุด", emptyText = "ยังไม่มีการรายงาน" }) {
  const now = useNow();
  const date = parseDateValue(value);
  if (!date) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{emptyText}</span>;
  }
  const stale = now - date.getTime() > staleHours * 3600 * 1000;
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", stale ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200" : "bg-slate-100 text-slate-700")}
      title={`${label} ${formatDateTime(date)}${stale ? ` · เกิน ${staleHours} ชม. ควรอัปเดต` : ""}`}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      {label} <time dateTime={date.toISOString()}>{formatRelative(date, now)}</time>{stale ? " · ข้อมูลอาจไม่เป็นปัจจุบัน" : ""}
    </span>
  );
}

/** ค่าเวลาล่าสุดจากรายการ (ข้ามค่าว่าง) */
export function latestTime(values = []) {
  let best = null;
  for (const value of values) {
    const date = parseDateValue(value);
    if (date && (!best || date > best)) best = date;
  }
  return best ? best.toISOString() : null;
}

export function AdminPage({ title, description, context, actions, freshness, children }) {
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {context ? <div className="mb-1 text-sm font-semibold text-[#0b4c86]">{context}</div> : null}
          <h1 className="text-2xl font-black text-slate-900 sm:text-[1.7rem]">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p> : null}
          {freshness ? <div className="mt-2"><FreshnessBadge {...freshness} /></div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

/** แถบแท็บ เช่น "ทะเบียนกลาง | ในเหตุการณ์นี้" */
export function Tabs({ value, onChange, items }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-bold transition",
              active ? "border-[#0b4c86] text-[#0b4c86]" : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className={cn("ml-2 rounded-full px-2 py-0.5 text-xs", active ? "bg-[#0b4c86] text-white" : "bg-slate-100 text-slate-600")}>{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * ตัวเลขสรุปเหนือตาราง (ไม่เกิน 4–6 ตัว) แสดงเป็นการ์ดธีมกลาง (components/common/MetricCards)
 * item: { label, value, unit?, icon?, tone? | className? (สีแบบเดิม เช่น "text-red-700"), note?, tag?, share?, onClick?, active? }
 */
export function StatStrip({ items, compact }) {
  const list = items.filter(Boolean);
  return (
    <MetricGrid as="ul" compact={compact}>
      {list.map(({ className, tone, ...item }) => <MetricCard key={item.label} {...item} tone={tone || toneFromClass(className)} />)}
    </MetricGrid>
  );
}

export function Toolbar({ search, onSearchChange, searchPlaceholder = "ค้นหา", children, right }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 lg:flex-row lg:flex-wrap lg:items-center">
      {onSearchChange ? (
        <label className="relative block min-w-0 flex-1 lg:min-w-[14rem]">
          <span className="sr-only">{searchPlaceholder}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={searchPlaceholder} className={cn(inputClass, "pl-9")} />
        </label>
      ) : null}
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
      {right ? <div className="flex flex-wrap gap-2 lg:ml-auto">{right}</div> : null}
    </div>
  );
}

export function FilterSelect({ label, value, onChange, options, className }) {
  return (
    <label className={cn("block min-w-[9rem]", className)}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} aria-label={label}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

const PILL_TONES = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-900 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  gray: "bg-slate-100 text-slate-700 ring-slate-200"
};

export function StatusPill({ tone = "gray", children }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ring-1", PILL_TONES[tone])}>{children}</span>;
}

/** เวลาอัปเดตล่าสุด: แสดงแบบ "3 ชม.ที่แล้ว" และเปลี่ยนเป็นสีส้มถ้าเก่ากว่า staleHours */
// เวลาปัจจุบันที่อัปเดตทุกนาที (ให้ "x นาทีที่แล้ว" เดินเองโดยไม่ต้องโหลดใหม่)
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function UpdatedAt({ value, staleHours = 24 }) {
  const now = useNow();
  const date = parseDateValue(value);
  if (!date) return <span className="text-slate-400">-</span>;
  const stale = now - date.getTime() > staleHours * 3600 * 1000;
  return (
    <time dateTime={date.toISOString()} title={formatDateTime(date)} className={cn("whitespace-nowrap", stale ? "font-semibold text-amber-700" : "text-slate-600")}>
      {formatRelative(date, now)}
    </time>
  );
}

export function RowActions({ onEdit, onDelete, editLabel = "แก้ไข", deleteLabel = "ลบ", children }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {children}
      {onEdit ? (
        <button type="button" onClick={onEdit} className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold text-[#0b4c86] hover:bg-sky-50" title={editLabel}>
          <Pencil className="h-4 w-4" aria-hidden="true" /> <span className="hidden xl:inline">{editLabel}</span><span className="sr-only xl:hidden">{editLabel}</span>
        </button>
      ) : null}
      {onDelete ? (
        <button type="button" onClick={onDelete} className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold text-red-700 hover:bg-red-50" title={deleteLabel}>
          <Trash2 className="h-4 w-4" aria-hidden="true" /> <span className="hidden xl:inline">{deleteLabel}</span><span className="sr-only xl:hidden">{deleteLabel}</span>
        </button>
      ) : null}
    </div>
  );
}

/**
 * ตาราง: จอใหญ่เป็นตาราง จอเล็กเป็นการ์ด
 * columns: [{ key, label, render?(row), className?, mobile?: false }]
 */
/** เลขหน้าแบบย่อ: 1 … 4 5 6 … 12 */
export function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((page) => pages.add(page));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((page) => pages.add(page));
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  return sorted.flatMap((page, index) => (index && page - sorted[index - 1] > 1 ? ["…", page] : [page]));
}

export function DataTable({
  columns,
  rows,
  rowKey = "id",
  loading = false,
  emptyText = "ยังไม่มีข้อมูล",
  emptyAction,
  rowActions,
  pageSize: initialPageSize = 25,
  pageSizeOptions, // เช่น [20, 50, 100] — ให้ผู้ใช้เลือกจำนวนแถวต่อหน้า
  rowClassName,
  caption,
  selection // { selected: Set, onToggle(row), onTogglePage(rows, checked) } — มีช่องติ๊กเลือกแถว
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => { setPage(1); }, [rows.length, pageSize]);
  const safePage = Math.min(page, totalPages);
  const visible = useMemo(() => rows.slice((safePage - 1) * pageSize, safePage * pageSize), [rows, safePage, pageSize]);
  const keyOf = (row) => (typeof rowKey === "function" ? rowKey(row) : row[rowKey]);
  const cell = (column, row) => (column.render ? column.render(row) : row[column.key] ?? "-");
  const pageAllSelected = Boolean(selection) && visible.length > 0 && visible.every((row) => selection.selected.has(keyOf(row)));

  if (loading && rows.length === 0) {
    return (
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4" aria-busy="true">
        {[0, 1, 2, 3].map((index) => <div key={index} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
        <p className="text-sm text-slate-600">{emptyText}</p>
        {emptyAction ? <div className="mt-3">{emptyAction}</div> : null}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* จอใหญ่ */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
            <tr>
              {selection ? (
                <th scope="col" className="w-10 px-3 py-3">
                  <input type="checkbox" className="h-4 w-4" checked={pageAllSelected} onChange={(event) => selection.onTogglePage(visible, event.target.checked)} aria-label="เลือกทุกรายการในหน้านี้" />
                </th>
              ) : null}
              {columns.map((column) => <th key={column.key} scope="col" className={cn("px-4 py-3", column.className)}>{column.label}</th>)}
              {rowActions ? <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">จัดการ</span></th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((row) => (
              <tr key={keyOf(row)} className={cn("align-top hover:bg-slate-50/70", rowClassName?.(row), selection?.selected.has(keyOf(row)) && "bg-sky-50")}>
                {selection ? (
                  <td className="px-3 py-3">
                    <input type="checkbox" className="h-4 w-4" checked={selection.selected.has(keyOf(row))} onChange={() => selection.onToggle(row)} aria-label="เลือกแถวนี้" />
                  </td>
                ) : null}
                {columns.map((column) => <td key={column.key} className={cn("px-4 py-3", column.className)}>{cell(column, row)}</td>)}
                {rowActions ? <td className="px-2 py-2 text-right">{rowActions(row)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* มือถือ */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {visible.map((row) => {
          const [first, ...rest] = columns.filter((column) => column.mobile !== false);
          return (
            <li key={keyOf(row)} className={cn("p-4", rowClassName?.(row), selection?.selected.has(keyOf(row)) && "bg-sky-50")}>
              <div className="flex items-start gap-2 font-bold text-slate-900">
                {selection ? <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={selection.selected.has(keyOf(row))} onChange={() => selection.onToggle(row)} aria-label="เลือกแถวนี้" /> : null}
                <div className="min-w-0">{cell(first, row)}</div>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                {rest.map((column) => (
                  <div key={column.key} className="min-w-0">
                    <dt className="text-xs text-slate-500">{column.label}</dt>
                    <dd className="min-w-0 break-words">{cell(column, row)}</dd>
                  </div>
                ))}
              </dl>
              {rowActions ? <div className="mt-2 border-t border-slate-100 pt-2">{rowActions(row)}</div> : null}
            </li>
          );
        })}
      </ul>

      {totalPages > 1 || (pageSizeOptions && rows.length > Math.min(...pageSizeOptions)) ? (
        <nav className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between" aria-label="เปลี่ยนหน้า">
          <span className="flex flex-wrap items-center gap-2">
            {((safePage - 1) * pageSize + 1).toLocaleString("th-TH")}–{Math.min(safePage * pageSize, rows.length).toLocaleString("th-TH")} จาก {rows.length.toLocaleString("th-TH")}
            {pageSizeOptions ? (
              <label className="inline-flex items-center gap-1.5">
                <span className="text-slate-500">· แสดง</span>
                <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-8 rounded-md border border-slate-300 bg-white px-1.5 text-sm" aria-label="จำนวนแถวต่อหน้า">
                  {pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
                <span className="text-slate-500">แถว</span>
              </label>
            ) : null}
          </span>
          {totalPages > 1 ? (
            <span className="flex items-center gap-1">
              <Button variant="ghost" className="min-h-9 px-2" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="หน้าก่อน"><ChevronLeft className="h-4 w-4" /></Button>
              {pageNumbers(safePage, totalPages).map((item, index) => (item === "…"
                ? <span key={`gap-${index}`} className="px-1 text-slate-400" aria-hidden="true">…</span>
                : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    aria-current={item === safePage ? "page" : undefined}
                    aria-label={`หน้า ${item}`}
                    className={cn("h-9 min-w-9 rounded-lg px-2 text-sm font-bold tabular-nums", item === safePage ? "bg-[#0b4c86] text-white" : "text-slate-700 hover:bg-white")}
                  >{item}</button>
                )))}
              <Button variant="ghost" className="min-h-9 px-2" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} aria-label="หน้าถัดไป"><ChevronRight className="h-4 w-4" /></Button>
            </span>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

export function FormGrid({ children, className }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}

export function Field({ label, required = false, hint, error, wide = false, children }) {
  return (
    <label className={cn("block", wide && "sm:col-span-2")}>
      <span className="mb-1 block text-sm font-bold text-slate-800">
        {label}{required ? <span className="text-red-600"> *</span> : null}
      </span>
      {children}
      {hint && !error ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs font-semibold text-red-700">{error}</span> : null}
    </label>
  );
}

export function FormSection({ title, children }) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="mb-2 text-sm font-black text-[#0b4c86]">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** ฟอร์มในหน้าต่าง: ปุ่มบันทึก/ยกเลิกอยู่ที่เดิมทุกหน้า และแสดงข้อผิดพลาดจากเซิร์ฟเวอร์ในหน้าต่าง */
export function FormDialog({ open, onOpenChange, title, description, onSubmit, busy = false, error = "", submitText = "บันทึก", size = "lg", children }) {
  useErrorToast(open ? error : "");
  const submit = async (event) => {
    event.preventDefault();
    await onSubmit?.();
  };
  return (
    <AppDialog open={open} onOpenChange={onOpenChange} title={title} description={description} size={size} busy={busy} contentClassName="p-0 sm:p-0">
      <form onSubmit={submit} className="flex min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
        <AppDialogActions className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <AppDialogCancel disabled={busy} />
          <Button type="submit" disabled={busy}>{busy ? "กำลังบันทึก…" : submitText}</Button>
        </AppDialogActions>
      </form>
    </AppDialog>
  );
}

/**
 * ยืนยันการลบ: ต้องระบุเหตุผล และบอกชัดว่าข้อมูลไปอยู่ในถังขยะ กู้คืนได้
 */
export function DeleteDialog({ open, onOpenChange, itemType = "ข้อมูล", itemLabel, onConfirm, busy = false, error = "", note }) {
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState("");
  useErrorToast(open ? error : "");
  useEffect(() => {
    if (open) {
      setReason("");
      setLocalError("");
    }
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    const text = reason.trim();
    if (text.length < 5) {
      setLocalError("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร เพื่อให้ตรวจสอบย้อนหลังได้");
      return;
    }
    setLocalError("");
    await onConfirm?.(text);
  };

  return (
    <AppDialog open={open} onOpenChange={onOpenChange} title={`ลบ${itemType}`} size="sm" busy={busy} contentClassName="p-0 sm:p-0">
      <form onSubmit={submit}>
        <div className="space-y-3 p-5 sm:p-6">
          <p className="text-sm text-slate-700">
            ลบ <strong className="font-bold text-slate-900">{itemLabel}</strong> ออกจากรายการ
          </p>
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
            {note || "ข้อมูลจะถูกย้ายไปถังขยะ ผู้ดูแลระบบกู้คืนได้ และระบบบันทึกว่าใครลบ เมื่อไร เพราะอะไร"}
          </p>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-800">เหตุผลที่ลบ <span className="text-red-600">*</span></span>
            <textarea rows={3} autoFocus value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} placeholder="เช่น บันทึกซ้ำ / ข้อมูลผิดพื้นที่" />
          </label>
          {localError ? <p className="text-sm font-semibold text-red-700" role="alert">{localError}</p> : null}
        </div>
        <AppDialogActions className="border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <AppDialogCancel disabled={busy} />
          <Button type="submit" variant="danger" disabled={busy}>{busy ? "กำลังลบ…" : "ย้ายไปถังขยะ"}</Button>
        </AppDialogActions>
      </form>
    </AppDialog>
  );
}

/** แจ้งผลสั้นๆ ที่มุมจอ (แทน SweetAlert สำหรับการบันทึกปกติ) */
/** แถบบอกว่าเมนูนี้ดูได้อย่างเดียว (และใครบันทึกได้) — ข้อความมาจากเซิร์ฟเวอร์ */
export function ReadOnlyNotice({ message }) {
  if (!message) return null;
  return (
    <p className="rounded-xl border border-[#c9dcee] bg-[#edf5fc] px-4 py-3 text-sm text-[#083865]" role="status">{message}</p>
  );
}

/**
 * แจ้งผลการทำงาน — ส่งไป toast มุมขวาบนแบบเดียวกันทั้งระบบ (lib/notify)
 * คืน notice: null ไว้เพื่อให้หน้าที่ยังวาง {notice} อยู่ทำงานได้เหมือนเดิม
 */
export function useNotice() {
  const success = useCallback((message) => notify.success(message), []);
  const fail = useCallback((message) => notify.error(message), []);
  const warn = useCallback((message) => notify.warning(message), []);
  return { notice: null, success, fail, warn };
}

/** error ของฟอร์ม/การลบ → toast (dialog ยังเปิดอยู่ให้แก้แล้วกดใหม่ได้) */
function useErrorToast(error) {
  useEffect(() => {
    if (error) notify.error(error);
  }, [error]);
}
