"use client";

// เลือกพื้นที่ อำเภอ → ตำบล → หมู่บ้าน จากข้อมูลหมู่บ้านทางการ (โหลดครั้งเดียวต่อหน้า)
import { useEffect, useMemo, useState } from "react";
import { Field, inputClass } from "@/components/admin/crud";

let villagePromise = null;
function loadVillages() {
  if (!villagePromise) {
    villagePromise = fetch("/stn-eoc/api/common/villages")
      .then((response) => response.json())
      .then((json) => (json.success && Array.isArray(json.data) ? json.data : []))
      .catch(() => {
        villagePromise = null;
        return [];
      });
  }
  return villagePromise;
}

export function useVillages() {
  const [villages, setVillages] = useState([]);
  useEffect(() => {
    let alive = true;
    loadVillages().then((rows) => { if (alive) setVillages(rows); });
    return () => { alive = false; };
  }, []);
  return villages;
}

export function useAreaOptions(villages, district, tambon) {
  return useMemo(() => {
    const unique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
    return {
      districts: unique(villages.map((row) => row.district)),
      tambons: unique(villages.filter((row) => row.district === district).map((row) => row.subDistrict)),
      villages: villages
        .filter((row) => row.district === district && row.subDistrict === tambon)
        .map((row) => ({ value: row.name, label: row.moo ? `หมู่ ${row.moo} ${row.name}` : row.name }))
    };
  }, [district, tambon, villages]);
}

/**
 * value: { district, tambon, village } / onChange(nextPartial)
 * names: ชื่อ field ในฟอร์ม (เช่น ศูนย์พักพิงใช้ district_name)
 */
export default function AreaFields({ value, onChange, names = { district: "district", tambon: "tambon", village: "village" }, required = true, villageRequired = false }) {
  const villages = useVillages();
  const district = value[names.district] || "";
  const tambon = value[names.tambon] || "";
  const options = useAreaOptions(villages, district, tambon);
  const village = value[names.village] || "";
  const villageInList = !village || options.villages.some((item) => item.value === village);

  return (
    <>
      <Field label="อำเภอ" required={required}>
        <select
          className={inputClass}
          value={district}
          required={required}
          onChange={(event) => onChange({ [names.district]: event.target.value, [names.tambon]: "", [names.village]: "" })}
        >
          <option value="">เลือกอำเภอ</option>
          {options.districts.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </Field>
      <Field label="ตำบล" required={required}>
        <select
          className={inputClass}
          value={tambon}
          required={required}
          disabled={!district}
          onChange={(event) => onChange({ [names.tambon]: event.target.value, [names.village]: "" })}
        >
          <option value="">{district ? "เลือกตำบล" : "เลือกอำเภอก่อน"}</option>
          {options.tambons.map((name) => <option key={name} value={name}>{name}</option>)}
          {tambon && !options.tambons.includes(tambon) ? <option value={tambon}>{tambon}</option> : null}
        </select>
      </Field>
      <Field label="หมู่บ้าน/ชุมชน" required={villageRequired} hint={villageRequired ? undefined : "ไม่บังคับ"}>
        <select
          className={inputClass}
          value={village}
          required={villageRequired}
          disabled={!tambon}
          onChange={(event) => onChange({ [names.village]: event.target.value })}
        >
          <option value="">{tambon ? "ทั้งตำบล / ไม่ระบุ" : "เลือกตำบลก่อน"}</option>
          {options.villages.map((item) => <option key={`${item.label}`} value={item.value}>{item.label}</option>)}
          {!villageInList ? <option value={village}>{village}</option> : null}
        </select>
      </Field>
    </>
  );
}
