"use client";

function sanitizeCsvValue(value) {
    if (value === null || value === undefined) {
        return "";
    }

    const text = String(value);
    return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function toCsvLine(row) {
    return row.map((value) => {
        const text = sanitizeCsvValue(value);
        return `"${text.replace(/"/g, '""')}"`;
    }).join(",");
}

export function downloadCsv(rows, filename) {
    const csv = rows.map(toCsvLine).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export function objectsToCsvRows(data, headers = null) {
    const keys = headers || Object.keys(data[0] || {});
    return [
        keys,
        ...data.map((item) => keys.map((key) => item[key])),
    ];
}
