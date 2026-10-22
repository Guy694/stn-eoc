"use client";

// ใส่ป้ายหัวข้อ (data-label) ให้ทุกช่องของ <table class="stack-mobile"> จากหัวตาราง <th>
// เพื่อให้ CSS แสดงแต่ละแถวเป็นการ์ด "หัวข้อ : ค่า" บนมือถือ (app/globals.css)
// ทำงานกับตารางที่โหลดข้อมูลทีหลังด้วย (เฝ้าดูการเปลี่ยนแปลงของหน้า)
import { useEffect } from "react";

export function labelStackTable(table) {
  const headers = [...table.querySelectorAll("thead tr:last-child th")];
  if (!headers.length) return;
  const labels = [];
  for (const th of headers) {
    const span = Math.max(1, Number(th.getAttribute("colspan")) || 1);
    const text = (th.getAttribute("data-label") ?? th.textContent ?? "").replace(/\s+/g, " ").trim();
    for (let index = 0; index < span; index += 1) labels.push(text);
  }
  for (const row of table.querySelectorAll("tbody tr, tfoot tr")) {
    let column = 0;
    for (const cell of row.children) {
      const span = Math.max(1, Number(cell.getAttribute("colspan")) || 1);
      if (span >= labels.length && labels.length > 1) cell.setAttribute("data-full", "");
      const label = labels[column] ?? "";
      if (!cell.hasAttribute("data-label-fixed") && cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
      // ช่องปุ่มจัดการ (ไม่มีหัวข้อ หรือหัวข้อ "จัดการ") แยกไว้ท้ายการ์ด
      if (!label || /^(จัดการ|การดำเนินการ)$/.test(label)) cell.setAttribute("data-actions", "");
      column += span;
    }
  }
}

export default function StackTableLabels({ rootSelector = "main" }) {
  useEffect(() => {
    const root = document.querySelector(rootSelector) || document.body;
    let frame = 0;
    const run = () => {
      frame = 0;
      root.querySelectorAll("table.stack-mobile").forEach(labelStackTable);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(run); };
    run();
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [rootSelector]);
  return null;
}
