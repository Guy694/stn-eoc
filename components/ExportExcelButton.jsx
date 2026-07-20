"use client";
import { downloadCsv, objectsToCsvRows } from '@/lib/exportCsv';
import AppIcon from "@/components/icons/AppIcon";

export default function ExportExcelButton({
    data,
    filename = 'export',
    sheetName = 'Sheet1',
    headers = null,
    className = ''
}) {
    const handleExport = () => {
        if (!data || data.length === 0) {
            alert('ไม่มีข้อมูลให้ Export');
            return;
        }

        try {
            const timestamp = new Date().toISOString().slice(0, 10);
            const rows = objectsToCsvRows(data, headers || Object.keys(data[0]));
            downloadCsv([[sheetName], [], ...rows], `${filename}_${timestamp}.csv`);
        } catch (error) {
            console.error('Export error:', error);
            alert('เกิดข้อผิดพลาดในการ Export ข้อมูล');
        }
    };

    return (
        <button
            onClick={handleExport}
            className={`bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2 ${className}`}
            title="Export CSV"
        >
            <span className="text-xl"><AppIcon icon="barChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></span>
            <span className="hidden md:inline">Export CSV</span>
        </button>
    );
}
