"use client";

import { useState } from "react";
import { Button } from "@/components/admin/crud";

const inputClass = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm";
const toNumber = (value) => (value === "" || value === null || value === undefined ? null : Number(value));

/** ตั้งค่ารายงานแบบ 4 หัวข้อ: ผู้ออกรายงาน สถานีตัวแทนลุ่มน้ำ ระดับเฝ้าระวัง และพื้นที่เฝ้าระวังสำคัญ (ใช้ร่วมกันทั้งทีม) */
export default function ReportConfigEditor({ config, stations = [], onSave, onCancel }) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(config)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setIssuer = (field, value) => setDraft((prev) => ({ ...prev, issuer: { ...prev.issuer, [field]: value } }));
  const setBasin = (index, field, value) => setDraft((prev) => ({ ...prev, basins: prev.basins.map((basin, i) => (i === index ? { ...basin, [field]: value } : basin)) }));
  const nowLocal = () => {
    const bangkok = new Date(Date.now() + 7 * 3600 * 1000);
    return bangkok.toISOString().slice(0, 16);
  };
  const setLevel = (index, value) => setDraft((prev) => ({
    ...prev,
    basins: prev.basins.map((basin, i) => (i === index ? { ...basin, level: value, level_at: value !== "" && !basin.level_at ? nowLocal() : basin.level_at } : basin))
  }));
  const setArea = (index, field, value) => setDraft((prev) => ({ ...prev, areas: prev.areas.map((area, i) => (i === index ? { ...area, [field]: value } : area)) }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave({
        ...draft,
        basins: draft.basins.map((basin) => ({ ...basin, warning: toNumber(basin.warning), bank: toNumber(basin.bank), level: toNumber(basin.level), previous: toNumber(basin.previous), level_at: basin.level === "" || basin.level === null || basin.level === undefined ? "" : basin.level_at || "" }))
      });
    } catch (err) {
      setError(err.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const sortedStations = [...stations].sort((a, b) => `${a.river}${a.name}`.localeCompare(`${b.river}${b.name}`, "th"));

  return (
    <div className="space-y-4 rounded-xl border border-[#c9dcee] bg-white p-4 print:hidden">
      <div>
        <h2 className="text-base font-bold text-[#083865]">ตั้งค่ารายงานแบบ 4 หัวข้อ</h2>
        <p className="text-xs text-slate-500">ค่าที่บันทึกใช้ร่วมกันทุกคนในทีม และใช้กับรายงานรอบถัดไป</p>
      </div>

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-slate-800">ผู้ออกรายงาน (มุมขวาบน เว้นว่างได้)</legend>
        <label className="text-sm text-slate-700">ชื่อ
          <input value={draft.issuer.name} onChange={(event) => setIssuer("name", event.target.value)} className={inputClass} maxLength={120} />
        </label>
        <label className="text-sm text-slate-700">ตำแหน่ง
          <input value={draft.issuer.position} onChange={(event) => setIssuer("position", event.target.value)} className={inputClass} maxLength={120} />
        </label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold text-slate-800">หัวข้อ 2 ลุ่มน้ำหลัก (ระดับเป็นเมตร รทก.)</legend>
        {draft.basins.map((basin, index) => (
          <div key={basin.key} className="grid gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-[1fr_1.6fr_0.8fr_0.8fr]">
            <label className="text-sm text-slate-700">ชื่อที่แสดง
              <input value={basin.label} onChange={(event) => setBasin(index, "label", event.target.value)} className={inputClass} maxLength={60} />
            </label>
            <label className="text-sm text-slate-700">สถานีวัด (ThaiWater)
              <select value={basin.station_id} onChange={(event) => setBasin(index, "station_id", event.target.value)} className={inputClass}>
                <option value="">อัตโนมัติ (ค้นจากชื่อ “{basin.match}”)</option>
                {sortedStations.map((station) => (
                  <option key={station.id} value={station.id}>{station.name}{station.river ? ` · ${station.river}` : ""}{station.amphoe ? ` · อ.${station.amphoe}` : ""}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-700">ระดับเฝ้าระวัง
              <input type="number" step="0.01" inputMode="decimal" value={basin.warning ?? ""} onChange={(event) => setBasin(index, "warning", event.target.value)} className={inputClass} placeholder="ไม่แสดง" />
            </label>
            <label className="text-sm text-slate-700">ตลิ่ง (ถ้าต่างจาก ThaiWater)
              <input type="number" step="0.01" inputMode="decimal" value={basin.bank ?? ""} onChange={(event) => setBasin(index, "bank", event.target.value)} className={inputClass} placeholder="ตาม ThaiWater" />
            </label>
            <div className="grid gap-2 border-t border-slate-200 pt-2 sm:col-span-4 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
              <label className="text-sm text-slate-700">ระดับน้ำล่าสุด (กรอกเอง)
                <input type="number" step="0.01" inputMode="decimal" value={basin.level ?? ""} onChange={(event) => setLevel(index, event.target.value)} className={inputClass} placeholder="ใช้ค่าจากสถานี" />
              </label>
              <label className="text-sm text-slate-700">ระดับเมื่อวาน (ถ้ามี)
                <input type="number" step="0.01" inputMode="decimal" value={basin.previous ?? ""} onChange={(event) => setBasin(index, "previous", event.target.value)} className={inputClass} placeholder="ไม่แสดง" disabled={basin.level === "" || basin.level === null || basin.level === undefined} />
              </label>
              <label className="text-sm text-slate-700">วัดเมื่อ
                <input type="datetime-local" value={basin.level_at || ""} onChange={(event) => setBasin(index, "level_at", event.target.value)} className={inputClass} disabled={basin.level === "" || basin.level === null || basin.level === undefined} />
              </label>
              <div className="flex items-end">
                <button type="button" className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 disabled:opacity-40" disabled={basin.level === "" || basin.level === null || basin.level === undefined} onClick={() => setDraft((prev) => ({ ...prev, basins: prev.basins.map((item, i) => (i === index ? { ...item, level: "", previous: "", level_at: "" } : item)) }))}>ล้างค่าที่กรอก</button>
              </div>
            </div>
          </div>
        ))}
        <p className="text-xs text-slate-500">ถ้ากรอก “ระดับน้ำล่าสุด” ระบบจะใช้ค่าที่กรอกแทนค่าจากสถานี และแสดงว่า “กรอกเอง” ในรายงาน ควรล้างค่าเมื่อไม่ใช้แล้ว</p>
        {!stations.length ? <p className="text-xs text-amber-700">ยังดึงรายชื่อสถานีจาก ThaiWater ไม่ได้ ใช้การค้นจากชื่อไปก่อน</p> : null}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold text-slate-800">หัวข้อ 4 พื้นที่เฝ้าระวังสำคัญ</legend>
        {draft.areas.map((area, index) => (
          <div key={area.key} className="grid gap-2 sm:grid-cols-[1fr_2fr]">
            <input value={area.title} onChange={(event) => setArea(index, "title", event.target.value)} className={inputClass} maxLength={60} aria-label={`หัวข้อพื้นที่ ${index + 1}`} />
            <input value={area.text} onChange={(event) => setArea(index, "text", event.target.value)} className={inputClass} maxLength={300} aria-label={`รายละเอียดพื้นที่ ${index + 1}`} />
          </div>
        ))}
      </fieldset>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึกค่าตั้งค่า"}</Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>ยกเลิก</Button>
      </div>
    </div>
  );
}
