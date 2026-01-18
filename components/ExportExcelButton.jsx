"use client";
import * as XLSX from 'xlsx';

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
            // Create worksheet from data
            const ws = XLSX.utils.json_to_sheet(data, {
                header: headers || Object.keys(data[0])
            });

            // Auto-size columns
            const colWidths = [];
            const range = XLSX.utils.decode_range(ws['!ref']);

            for (let C = range.s.c; C <= range.e.c; ++C) {
                let maxWidth = 10;
                for (let R = range.s.r; R <= range.e.r; ++R) {
                    const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                    const cell = ws[cellAddress];
                    if (cell && cell.v) {
                        const cellLength = cell.v.toString().length;
                        maxWidth = Math.max(maxWidth, cellLength);
                    }
                }
                colWidths.push({ wch: Math.min(maxWidth + 2, 50) });
            }
            ws['!cols'] = colWidths;

            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, sheetName);

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().slice(0, 10);
            const fullFilename = `${filename}_${timestamp}.xlsx`;

            // Download
            XLSX.writeFile(wb, fullFilename);
        } catch (error) {
            console.error('Export error:', error);
            alert('เกิดข้อผิดพลาดในการ Export ข้อมูล');
        }
    };

    return (
        <button
            onClick={handleExport}
            className={`bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2 ${className}`}
            title="Export to Excel"
        >
            <span className="text-xl">📊</span>
            <span className="hidden md:inline">Export Excel</span>
        </button>
    );
}
