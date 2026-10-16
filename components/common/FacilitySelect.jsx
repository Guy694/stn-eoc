"use client";

import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { FACILITY_GROUPS, facilityGroup, matchFacility, sortFacilities } from "@/lib/facilityOrder";

/**
 * ช่องเลือกหน่วยบริการที่พิมพ์ค้นหาได้ — เรียง โรงพยาบาล → สสจ. → สสอ. → รพ.สต. และแบ่งกลุ่มในรายการ
 * facilities: [{ id|value, name|label, typecode, district_name|district }]
 * getValue: ค่าที่ส่งกลับ (ค่าเริ่มต้น id) · renderLabel: ข้อความในรายการ · allLabel: ใส่เมื่อเป็นตัวกรอง ("ทุกหน่วยบริการ")
 */
export default function FacilitySelect({
  facilities = [],
  value,
  onChange,
  getValue = (facility) => facility.id ?? facility.value,
  renderLabel,
  placeholder = "เลือกหน่วยบริการ",
  allLabel,
  required = false,
  disabled = false,
  className = "",
  selectClassName = "h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800",
  label = "หน่วยบริการ",
  id
}) {
  const autoId = useId();
  const selectId = id || `facility-${autoId}`;
  const [keyword, setKeyword] = useState("");
  const sorted = useMemo(() => sortFacilities(facilities), [facilities]);
  const current = String(value ?? "");

  const groups = useMemo(() => {
    const visible = sorted.filter((facility) => matchFacility(facility, keyword) || String(getValue(facility)) === current);
    return FACILITY_GROUPS
      .map((group) => ({ ...group, items: visible.filter((facility) => facilityGroup(facility) === group.key) }))
      .filter((group) => group.items.length);
  }, [sorted, keyword, current, getValue]);

  const shown = groups.reduce((sum, group) => sum + group.items.length, 0);
  const text = (facility) => (renderLabel
    ? renderLabel(facility)
    : `${facility.name ?? facility.label}${(facility.district_name ?? facility.district) ? ` (อ.${facility.district_name ?? facility.district})` : ""}`);

  const onKeyword = (next) => {
    setKeyword(next);
    // พิมพ์จนเหลือรายการเดียว → เลือกให้เลย
    const matches = sorted.filter((facility) => matchFacility(facility, next));
    if (next.trim() && matches.length === 1 && String(getValue(matches[0])) !== current) onChange?.(String(getValue(matches[0])));
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {facilities.length > 8 ? (
        <label className="relative block">
          <span className="sr-only">ค้นหา{label}</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={keyword}
            onChange={(event) => onKeyword(event.target.value)}
            placeholder={`พิมพ์ค้นหา${label} เช่น ละงู, รพ.สต.`}
            className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-2 text-sm text-slate-800"
            aria-controls={selectId}
            disabled={disabled}
          />
        </label>
      ) : null}
      <select
        id={selectId}
        value={current}
        onChange={(event) => onChange?.(event.target.value)}
        required={required}
        disabled={disabled}
        className={selectClassName}
        aria-label={label}
      >
        <option value="">{allLabel || placeholder}</option>
        {groups.map((group) => (
          <optgroup key={group.key} label={group.label}>
            {group.items.map((facility) => {
              const optionValue = String(getValue(facility));
              return <option key={optionValue} value={optionValue}>{text(facility)}</option>;
            })}
          </optgroup>
        ))}
      </select>
      {keyword.trim() ? <p className="text-xs text-slate-500">{shown ? `พบ ${shown} แห่ง` : "ไม่พบหน่วยบริการที่ตรงกับคำค้น"}</p> : null}
    </div>
  );
}
