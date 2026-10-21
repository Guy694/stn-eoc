"use client";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function PaginationControls({
    page,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    itemLabel = "รายการ",
    className = "border-t bg-slate-50",
    compact = false // คอลัมน์แคบ (เช่น รายชื่อข้างแผนที่): มีแค่ ก่อนหน้า/ถัดไป
}) {
    const totalPages = Math.max(1, Math.ceil(Number(totalItems || 0) / Number(pageSize || 1)));
    const safePage = Math.min(Math.max(Number(page || 1), 1), totalPages);
    const start = totalItems > 0 ? ((safePage - 1) * pageSize) + 1 : 0;
    const end = Math.min(safePage * pageSize, totalItems || 0);

    if (!totalItems || totalItems <= Math.min(...pageSizeOptions)) {
        return null;
    }

    if (compact) {
        return (
            <nav aria-label="เลือกหน้า" className={`flex items-center justify-between gap-2 px-3 py-2 text-xs text-slate-600 ${className}`}>
                <button type="button" onClick={() => onPageChange(Math.max(1, safePage - 1))} disabled={safePage === 1}
                    className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">ก่อนหน้า</button>
                <span className="text-center tabular-nums">
                    <b className="text-slate-900">{start.toLocaleString('th-TH')}–{end.toLocaleString('th-TH')}</b> จาก {Number(totalItems).toLocaleString('th-TH')}
                    <span className="block">หน้า {safePage.toLocaleString('th-TH')}/{totalPages.toLocaleString('th-TH')}</span>
                </span>
                <button type="button" onClick={() => onPageChange(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages}
                    className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">ถัดไป</button>
            </nav>
        );
    }

    return (
        <nav aria-label="เลือกหน้า" className={`flex flex-col gap-3 px-4 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between ${className}`}>
            <div>
                แสดง <span className="font-bold">{start.toLocaleString('th-TH')}</span> ถึง <span className="font-bold">{end.toLocaleString('th-TH')}</span>
                {' '}จาก <span className="font-bold">{Number(totalItems || 0).toLocaleString('th-TH')}</span> {itemLabel}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {onPageSizeChange && (
                    <select
                        value={pageSize}
                        onChange={(event) => {
                            onPageSizeChange(Number(event.target.value));
                            onPageChange(1);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
                    >
                        {pageSizeOptions.map((option) => (
                            <option key={option} value={option}>{option} / หน้า</option>
                        ))}
                    </select>
                )}

                <button
                    type="button"
                    onClick={() => onPageChange(1)}
                    disabled={safePage === 1}
                    className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-1 font-bold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    แรก
                </button>
                <button
                    type="button"
                    onClick={() => onPageChange(Math.max(1, safePage - 1))}
                    disabled={safePage === 1}
                    className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-1 font-bold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    ก่อนหน้า
                </button>
                <span className="px-2 font-bold">
                    หน้า {safePage.toLocaleString('th-TH')} / {totalPages.toLocaleString('th-TH')}
                </span>
                <button
                    type="button"
                    onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
                    disabled={safePage === totalPages}
                    className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-1 font-bold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    ถัดไป
                </button>
                <button
                    type="button"
                    onClick={() => onPageChange(totalPages)}
                    disabled={safePage === totalPages}
                    className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-1 font-bold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    สุดท้าย
                </button>
            </div>
        </nav>
    );
}

export function paginateRows(rows, page, pageSize) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const safePageSize = Math.max(Number(pageSize || 20), 1);
    const totalPages = Math.max(1, Math.ceil(safeRows.length / safePageSize));
    const safePage = Math.min(Math.max(Number(page || 1), 1), totalPages);
    const start = (safePage - 1) * safePageSize;
    return safeRows.slice(start, start + safePageSize);
}

/**
 * แบ่งหน้ารายการฝั่งเบราว์เซอร์: คืนรายการของหน้าปัจจุบัน + props สำหรับ <PaginationControls />
 * resetKey: เปลี่ยนเมื่อตัวกรอง/คำค้นเปลี่ยน เพื่อกลับไปหน้า 1 · เปลี่ยนหน้าแล้วเลื่อนจอกลับไปต้นรายการ
 * ใช้: const { anchor, ...paged } = usePagination(rows) แล้วใส่ ref={anchor} ที่ต้นรายการ (แยก anchor ออกก่อน ตามกฎ react-hooks/refs)
 */
export function usePagination(rows, { pageSize: initialPageSize = 20, resetKey = "" } = {}) {
    const list = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(initialPageSize);
    const [anchorEl, setAnchorEl] = useState(null);
    useEffect(() => { setPage(1); }, [resetKey, pageSize]);
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const visible = useMemo(() => paginateRows(list, safePage, pageSize), [list, safePage, pageSize]);
    const goTo = (next, { scroll = true } = {}) => {
        setPage(next);
        if (scroll && anchorEl?.scrollTop > 0) anchorEl.scrollTop = 0; // รายการที่เลื่อนในกล่องตัวเอง
        if (scroll && anchorEl?.getBoundingClientRect && anchorEl.getBoundingClientRect().top < 0) {
            anchorEl.scrollIntoView({ block: "start", behavior: "smooth" });
        }
    };
    return {
        anchor: setAnchorEl,
        visible,
        page: safePage,
        pageSize,
        totalItems: list.length,
        goTo,
        /** หน้าที่รายการลำดับนี้อยู่ (ใช้กระโดดไปหาแถวที่เลือกจากแผนที่) */
        pageOfIndex: (index) => Math.floor(Math.max(index, 0) / pageSize) + 1,
        controls: { page: safePage, pageSize, totalItems: list.length, onPageChange: (next) => goTo(next), onPageSizeChange: setPageSize }
    };
}
