"use client";

// ช่องกรอกแบบรายการข้อ (ไม่ใช้ไลบรารีภายนอก)
//  Enter = ข้อใหม่ · Shift+Enter = ขึ้นบรรทัดในข้อเดิม · Tab / Shift+Tab = ย่อหน้าเป็นข้อย่อย / ถอยกลับ
//  Backspace ในข้อว่าง = ลบข้อ · Alt+↑/↓ = เลื่อนข้อ · ลากที่จุดจับเพื่อสลับลำดับ
import { useEffect, useRef, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { MAX_LEVEL, numberItems } from "@/lib/dailyDirectives";

let keySeed = 0;
export const newItem = (patch = {}) => ({ key: `new-${Date.now()}-${keySeed++}`, id: null, content: "", level: 0, status: "open", ...patch });

function autosize(element) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

export default function DirectiveListEditor({ items, onChange, readOnly = false, placeholder = "พิมพ์สถานการณ์หรือข้อสั่งการ แล้วกด Enter เพื่อขึ้นข้อใหม่" }) {
  const refs = useRef(new Map());
  const [focusKey, setFocusKey] = useState(null);
  const [dragKey, setDragKey] = useState(null);
  const numbers = numberItems(items);

  useEffect(() => {
    if (!focusKey) return;
    const element = refs.current.get(focusKey);
    if (element) {
      element.focus();
      const end = element.value.length;
      element.setSelectionRange(end, end);
    }
    setFocusKey(null);
  }, [focusKey, items]);

  useEffect(() => { refs.current.forEach((element) => autosize(element)); }, [items]);

  const update = (index, patch) => onChange(items.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  const insertAfter = (index, patch = {}) => {
    const created = newItem({ level: items[index]?.level || 0, ...patch });
    const next = [...items];
    next.splice(index + 1, 0, created);
    onChange(next);
    setFocusKey(created.key);
  };
  const removeAt = (index) => {
    const next = items.filter((_, position) => position !== index);
    onChange(next.length ? next : [newItem()]);
    const target = next[Math.max(0, index - 1)];
    if (target) setFocusKey(target.key);
  };
  const move = (from, to) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
    setFocusKey(moved.key);
  };

  const onKeyDown = (event, index) => {
    const item = items[index];
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      const { selectionStart, value } = event.currentTarget;
      const before = value.slice(0, selectionStart);
      const after = value.slice(selectionStart);
      if (!value.trim() && item.level > 0) { update(index, { level: item.level - 1 }); return; }
      // แยกข้อความหลังเคอร์เซอร์ไปเป็นข้อใหม่
      const created = newItem({ level: item.level, content: after });
      const next = items.map((row, position) => (position === index ? { ...row, content: before } : row));
      next.splice(index + 1, 0, created);
      onChange(next);
      setFocusKey(created.key);
    } else if (event.key === "Tab") {
      event.preventDefault();
      const maxLevel = index === 0 ? 0 : Math.min(MAX_LEVEL, (items[index - 1]?.level || 0) + 1);
      const level = event.shiftKey ? Math.max(0, item.level - 1) : Math.min(maxLevel, item.level + 1);
      update(index, { level });
    } else if (event.key === "Backspace" && !event.currentTarget.value && items.length > 1) {
      event.preventDefault();
      if (item.level > 0) update(index, { level: item.level - 1 });
      else removeAt(index);
    } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      move(index, index + (event.key === "ArrowUp" ? -1 : 1));
    } else if (!event.altKey && event.key === "ArrowUp" && event.currentTarget.selectionStart === 0 && index > 0) {
      event.preventDefault();
      setFocusKey(items[index - 1].key);
    } else if (!event.altKey && event.key === "ArrowDown" && event.currentTarget.selectionEnd === event.currentTarget.value.length && index < items.length - 1) {
      event.preventDefault();
      setFocusKey(items[index + 1].key);
    }
  };

  if (readOnly) {
    const visible = items.filter((item) => item.content.trim());
    if (!visible.length) return <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">ไม่มีรายการในวันนี้</p>;
    return (
      <ol className="space-y-1.5">
        {visible.map((item) => (
          <li key={item.key} className="flex gap-2" style={{ paddingLeft: `${item.level * 1.75}rem` }}>
            <span className="w-10 shrink-0 text-right font-bold tabular-nums text-slate-500">{numberItems(visible)[visible.indexOf(item)]}.</span>
            <span className={`whitespace-pre-wrap ${item.status === "done" ? "text-slate-500 line-through decoration-slate-400" : "text-slate-900"}`}>{item.content}</span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div>
      <ol className="space-y-1" aria-label="รายการสถานการณ์/ข้อสั่งการ">
        {items.map((item, index) => (
          <li
            key={item.key}
            onDragOver={(event) => { if (dragKey) event.preventDefault(); }}
            onDrop={(event) => {
              event.preventDefault();
              const from = items.findIndex((row) => row.key === dragKey);
              setDragKey(null);
              if (from >= 0) move(from, index);
            }}
            className={`group flex items-start gap-1.5 rounded-lg px-1 py-1 ${dragKey === item.key ? "opacity-40" : ""} ${item.status === "done" ? "bg-emerald-50/50" : "hover:bg-slate-50"}`}
            style={{ paddingLeft: `${item.level * 1.75 + 0.25}rem` }}
          >
            <span
              draggable
              onDragStart={(event) => { setDragKey(item.key); event.dataTransfer.effectAllowed = "move"; }}
              onDragEnd={() => setDragKey(null)}
              className="mt-2 cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
              title="ลากเพื่อสลับลำดับ (หรือกด Alt+↑/↓)"
              aria-hidden="true"
            >
              <GripVertical className="h-4 w-4" />
            </span>
            <span className="mt-1.5 w-9 shrink-0 text-right text-sm font-bold tabular-nums text-slate-500">{numbers[index]}.</span>
            <textarea
              ref={(element) => { if (element) refs.current.set(item.key, element); else refs.current.delete(item.key); }}
              rows={1}
              value={item.content}
              placeholder={index === 0 && items.length === 1 ? placeholder : ""}
              aria-label={`ข้อ ${numbers[index]}`}
              onChange={(event) => { update(index, { content: event.target.value }); autosize(event.target); }}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`min-h-9 flex-1 resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[15px] leading-relaxed outline-none focus:border-[#c9dcee] focus:bg-white ${item.status === "done" ? "text-slate-500 line-through decoration-slate-400" : "text-slate-900"}`}
            />
            <label className="mt-1.5 flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-500" title="ทำเครื่องหมายว่าดำเนินการแล้ว">
              <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={item.status === "done"} onChange={(event) => update(index, { status: event.target.checked ? "done" : "open" })} />
              <span className="hidden sm:inline">เสร็จแล้ว</span>
            </label>
            <button type="button" onClick={() => removeAt(index)} className="mt-1 rounded p-1 text-slate-300 opacity-0 hover:bg-red-50 hover:text-red-700 focus:opacity-100 group-hover:opacity-100" aria-label={`ลบข้อ ${numbers[index]}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => insertAfter(items.length - 1, { level: 0 })} className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-bold text-[#0b4c86] hover:bg-[#edf5fc]">
        <Plus className="h-4 w-4" /> เพิ่มข้อ
      </button>
      <p className="mt-2 text-xs text-slate-500">Enter = ข้อใหม่ · Shift+Enter = ขึ้นบรรทัดในข้อเดิม · Tab = ข้อย่อย · Shift+Tab = ถอยกลับ · Alt+↑/↓ = เลื่อนข้อ</p>
    </div>
  );
}
