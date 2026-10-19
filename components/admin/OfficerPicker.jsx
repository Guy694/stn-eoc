"use client";

// เลือกเจ้าหน้าที่แบบพิมพ์ค้นหา (ชื่อ ชื่อผู้ใช้ ตำแหน่ง หน่วยงาน บทบาท)
//  - OfficerPicker: เลือกคนเดียว
//  - OfficerMultiPicker: เลือกหลายคน แสดงเป็นป้ายชื่อ กดกากบาทเพื่อเอาออก
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";

export function officerName(person) {
  const parts = [person?.title, person?.given_name, person?.family_name].filter(Boolean);
  return parts.join(" ").trim() || person?.full_name?.trim() || person?.username || "ไม่ระบุชื่อ";
}

function officerDetail(person) {
  return [person?.position, person?.department, person?.role].filter(Boolean).join(" · ");
}

function haystack(person) {
  return [officerName(person), person?.username, person?.position, person?.department, person?.role, person?.phone]
    .filter(Boolean).join(" ").toLowerCase();
}

const inputBase = "h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#0b4c86] focus:ring-2 focus:ring-[#0b4c86]/15";

function useSearchList(options, query, exclude) {
  return useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return options
      .filter((person) => !exclude.has(String(person.id)))
      .filter((person) => { const text = haystack(person); return words.every((word) => text.includes(word)); })
      .slice(0, 50);
  }, [options, query, exclude]);
}

function ResultList({ id, results, activeIndex, onPick, onHover, selectedIds, emptyText }) {
  return (
    <ul id={id} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
      {results.length ? results.map((person, index) => {
        const selected = selectedIds?.has(String(person.id));
        return (
          <li
            key={person.id}
            id={`${id}-${person.id}`}
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(event) => { event.preventDefault(); onPick(person); }}
            onMouseEnter={() => onHover(index)}
            className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${index === activeIndex ? "bg-[#edf5fc]" : ""}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-slate-900">{officerName(person)}</span>
              <span className="block truncate text-xs text-slate-500">{officerDetail(person) || person.username}</span>
            </span>
            {selected ? <Check className="h-4 w-4 text-[#0b4c86]" aria-hidden="true" /> : null}
          </li>
        );
      }) : <li className="px-3 py-3 text-sm text-slate-500">{emptyText}</li>}
    </ul>
  );
}

function useCombobox(results, onPick) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => { setActiveIndex(0); }, [results.length]);
  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, results.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
    else if (event.key === "Enter" && open && results[activeIndex]) { event.preventDefault(); onPick(results[activeIndex]); }
    else if (event.key === "Escape") { setOpen(false); }
  };
  return { open, setOpen, activeIndex, setActiveIndex, onKeyDown };
}

/** เลือกคนเดียว: value = id หรือ "" */
export function OfficerPicker({ options = [], value, onChange, placeholder = "พิมพ์ชื่อ ตำแหน่ง หรือหน่วยงาน", emptyLabel = "พิมพ์เพื่อค้นหาเจ้าหน้าที่", exclude = [], required = false, ariaLabel }) {
  const listId = useId();
  const selected = options.find((person) => String(person.id) === String(value)) || null;
  const [query, setQuery] = useState("");
  const [changing, setChanging] = useState(false);
  const excludeSet = useMemo(() => new Set(exclude.map(String)), [exclude]);
  const results = useSearchList(options, query, excludeSet);
  const pick = (person) => { onChange(person ? String(person.id) : ""); setQuery(""); setChanging(false); combo.setOpen(false); };
  const combo = useCombobox(results, pick);

  if (selected && !changing) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{officerName(selected)}</span>
          {officerDetail(selected) ? <span className="block truncate text-[11px] text-slate-500">{officerDetail(selected)}</span> : null}
        </span>
        <button type="button" onClick={() => setChanging(true)} className="text-xs font-bold text-[#0b4c86] hover:underline">เปลี่ยน</button>
        {!required ? <button type="button" onClick={() => pick(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="ล้างการเลือก"><X className="h-4 w-4" /></button> : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        type="text"
        role="combobox"
        aria-expanded={combo.open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-activedescendant={combo.open && results[combo.activeIndex] ? `${listId}-${results[combo.activeIndex].id}` : undefined}
        autoComplete="off"
        autoFocus={changing}
        value={query}
        placeholder={placeholder}
        required={required && !selected}
        onFocus={() => combo.setOpen(true)}
        onBlur={() => setTimeout(() => { combo.setOpen(false); setChanging(false); }, 150)}
        onChange={(event) => { setQuery(event.target.value); combo.setOpen(true); }}
        onKeyDown={combo.onKeyDown}
        className={inputBase}
      />
      {combo.open ? (
        <ResultList id={listId} results={results} activeIndex={combo.activeIndex} onHover={combo.setActiveIndex} onPick={pick}
          emptyText={query ? "ไม่พบเจ้าหน้าที่ที่ตรงกับคำค้น" : emptyLabel} />
      ) : null}
    </div>
  );
}

/** เลือกหลายคน: value = array ของ id */
export function OfficerMultiPicker({ options = [], value = [], onChange, exclude = [], placeholder = "พิมพ์เพื่อค้นหาและเพิ่มสมาชิก", ariaLabel }) {
  const listId = useId();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const selectedIds = useMemo(() => new Set(value.map(String)), [value]);
  const excludeSet = useMemo(() => new Set([...exclude.map(String), ...value.map(String)]), [exclude, value]);
  const results = useSearchList(options, query, excludeSet);
  const byId = useMemo(() => new Map(options.map((person) => [String(person.id), person])), [options]);
  const pick = (person) => { onChange([...value.map(String), String(person.id)]); setQuery(""); inputRef.current?.focus(); };
  const remove = (id) => onChange(value.map(String).filter((item) => item !== String(id)));
  const combo = useCombobox(results, pick);

  return (
    <div>
      {value.length ? (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="สมาชิกที่เลือก">
          {value.map((id) => {
            const person = byId.get(String(id));
            const name = person ? officerName(person) : `เจ้าหน้าที่ #${id}`;
            return (
              <li key={id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#edf5fc] py-1 pl-3 pr-1 text-sm text-[#083865] ring-1 ring-[#c9dcee]">
                <span className="truncate">{name}</span>
                <button type="button" onClick={() => remove(id)} className="rounded-full p-0.5 hover:bg-white" aria-label={`เอา ${name} ออก`}><X className="h-3.5 w-3.5" /></button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={combo.open}
          aria-controls={listId}
          aria-label={ariaLabel}
          aria-activedescendant={combo.open && results[combo.activeIndex] ? `${listId}-${results[combo.activeIndex].id}` : undefined}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onFocus={() => combo.setOpen(true)}
          onBlur={() => setTimeout(() => combo.setOpen(false), 150)}
          onChange={(event) => { setQuery(event.target.value); combo.setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !query && value.length) remove(value[value.length - 1]);
            else combo.onKeyDown(event);
          }}
          className={inputBase}
        />
        {combo.open ? (
          <ResultList id={listId} results={results} activeIndex={combo.activeIndex} onHover={combo.setActiveIndex} onPick={pick} selectedIds={selectedIds}
            emptyText={query ? "ไม่พบเจ้าหน้าที่ที่ตรงกับคำค้น" : "เลือกครบทุกคนแล้ว"} />
        ) : null}
      </div>
      <p className="mt-1 text-xs text-slate-500">เลือกแล้ว {value.length.toLocaleString("th-TH")} คน · พิมพ์บางส่วนของชื่อ ตำแหน่ง หรือหน่วยงานได้</p>
    </div>
  );
}
