"use client";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function PaginationControls({
    page,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    itemLabel = "รายการ"
}) {
    const totalPages = Math.max(1, Math.ceil(Number(totalItems || 0) / Number(pageSize || 1)));
    const safePage = Math.min(Math.max(Number(page || 1), 1), totalPages);
    const start = totalItems > 0 ? ((safePage - 1) * pageSize) + 1 : 0;
    const end = Math.min(safePage * pageSize, totalItems || 0);

    if (!totalItems || totalItems <= Math.min(...pageSizeOptions)) {
        return null;
    }

    return (
        <div className="flex flex-col gap-3 border-t bg-gray-50 px-4 py-3 text-sm text-gray-700 sm:flex-row sm:items-center sm:justify-between">
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
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700"
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
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1 font-bold disabled:cursor-not-allowed disabled:opacity-50"
                >
                    แรก
                </button>
                <button
                    type="button"
                    onClick={() => onPageChange(Math.max(1, safePage - 1))}
                    disabled={safePage === 1}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1 font-bold disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1 font-bold disabled:cursor-not-allowed disabled:opacity-50"
                >
                    ถัดไป
                </button>
                <button
                    type="button"
                    onClick={() => onPageChange(totalPages)}
                    disabled={safePage === totalPages}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1 font-bold disabled:cursor-not-allowed disabled:opacity-50"
                >
                    สุดท้าย
                </button>
            </div>
        </div>
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
