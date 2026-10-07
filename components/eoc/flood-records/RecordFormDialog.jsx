"use client";

// ฟอร์มบันทึกพื้นที่น้ำท่วม 3 แบบ
//   village — หมู่บ้านเดียว (ถ้าวันนั้นมีข้อมูลแล้ว จะแก้ข้อมูลเดิมแทนการเพิ่มแถวซ้ำ)
//   tambon  — ทั้งตำบล: ระดับน้ำใช้ร่วมกัน ส่วนครัวเรือน/คนกรอกรายหมู่บ้าน (ไม่คูณตัวเลขเดียวซ้ำทุกหมู่บ้าน)
//   edit    — แก้ไขแถวเดิม
import { useMemo, useState } from "react";
import { Field, FormDialog, FormGrid, StatusPill, inputClass } from "@/components/admin/crud";
import { apiRequest } from "@/lib/adminApi";
import { EMPTY_FORM, FLOOD_LEVELS, findDayRecord, localDateKey, validateRecordForm, villageName, villagesOf } from "@/lib/floodRecords";

const API = "/stn-eoc/api/admin/flood-records";

function thaiDate(key) {
  if (!key) return "-";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

function initialForm(dialog, date) {
  if (dialog.mode === "edit") {
    const record = dialog.record;
    return {
      district: record.district || "",
      tambon: record.tambon || "",
      village: villageName(record),
      flood_level: record.flood_level || "ไม่มี",
      flood_start_date: localDateKey(record.flood_start_date) || date,
      water_depth_cm: record.water_depth_cm ?? "",
      affected_area_sqm: record.affected_area_sqm ?? "",
      affected_households: record.affected_households ?? "",
      affected_people: record.affected_people ?? "",
      description: record.description || ""
    };
  }
  return { ...EMPTY_FORM, district: dialog.district || "", tambon: dialog.tambon || "", flood_start_date: date };
}

function LevelPicker({ value, onChange }) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="mb-1.5 text-sm font-bold text-slate-800">ระดับน้ำท่วม <span className="text-red-600">*</span></legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {FLOOD_LEVELS.map((item) => {
          const active = value === item.value;
          return (
            <label key={item.value} className={`cursor-pointer rounded-lg border-2 px-2.5 py-2 text-sm ${active ? "border-[#0b4c86] bg-[#edf5fc]" : "border-slate-200 hover:border-[#c9dcee]"}`}>
              <input type="radio" name="flood-level" className="sr-only" checked={active} onChange={() => onChange(item.value)} />
              <span className="block font-bold text-slate-900">{item.value}</span>
              <span className="block text-xs leading-snug text-slate-500">{item.hint}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function RecordFormDialog({ open, onOpenChange, dialog, session, date, minDate, maxDate, districts, polygons, records, onSaved }) {
  const [form, setForm] = useState(() => initialForm(dialog, date));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [perVillage, setPerVillage] = useState({});
  const mode = dialog.mode;
  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const tambons = districts.find((item) => item.name === form.district)?.tambons || [];
  const villages = useMemo(() => villagesOf(polygons, form.district, form.tambon), [polygons, form.district, form.tambon]);

  // หมู่บ้านในตำบลที่ยังไม่มีข้อมูลของวันนี้ (โหมดทั้งตำบล)
  const tambonVillages = useMemo(() => villages.map((polygon) => ({
    polygon,
    existing: findDayRecord(records, { date, district: form.district, tambon: form.tambon, village: polygon.villname.trim() })
  })), [villages, records, date, form.district, form.tambon]);
  const pending = tambonVillages.filter((item) => !item.existing);

  // โหมดหมู่บ้านเดียว: ถ้ามีข้อมูลของวันนี้อยู่แล้ว ให้แก้แถวเดิม
  const existing = mode === "village" && form.village
    ? findDayRecord(records, { date, district: form.district, tambon: form.tambon, village: form.village })
    : null;

  const title = mode === "edit" ? "แก้ไขข้อมูลพื้นที่น้ำท่วม" : mode === "tambon" ? `บันทึกทั้งตำบล${form.tambon || ""}` : "บันทึกหมู่บ้าน";

  const payloadBase = (value) => ({
    ...value,
    session_id: session.id,
    year: new Date(session.opened_at).getFullYear(),
    status: "กำลังดำเนินการ",
    damage_amount: 0,
    relief_amount: 0
  });

  const submit = async () => {
    setError("");
    const check = validateRecordForm(form, { tambonMode: mode === "tambon" });
    setErrors(check.errors);
    if (!check.ok) return;
    setBusy(true);
    try {
      if (mode === "tambon") {
        if (!pending.length) {
          setError("ทุกหมู่บ้านในตำบลนี้มีข้อมูลของวันนี้แล้ว — แก้ไขรายหมู่บ้านจากตาราง");
          return;
        }
        const json = await apiRequest(API, {
          method: "POST",
          body: {
            ...payloadBase(check.value),
            flood_start_date: date,
            records: pending.map(({ polygon }) => ({
              village: polygon.villname.trim(),
              polygon_id: polygon.id,
              affected_households: Number(perVillage[polygon.villname]?.households) || 0,
              affected_people: Number(perVillage[polygon.villname]?.people) || 0
            }))
          }
        });
        const skipped = json.data?.skipped?.length || 0;
        onSaved(`บันทึก ต.${form.tambon} แล้ว ${json.data?.inserted || 0} หมู่บ้าน${skipped ? ` (ข้าม ${skipped} หมู่บ้านที่มีข้อมูลแล้ว)` : ""}`);
        return;
      }

      const polygon = villages.find((item) => item.villname.trim() === check.value.village);
      const body = { ...payloadBase(check.value), polygon_id: polygon?.id || dialog.record?.polygon_id || null };
      if (mode === "edit") {
        await apiRequest(API, { method: "PUT", body: { ...body, id: dialog.record.id } });
        onSaved(`แก้ไขข้อมูล ${check.value.village} แล้ว`);
      } else if (existing) {
        await apiRequest(API, { method: "PUT", body: { ...body, id: existing.id, flood_start_date: date } });
        onSaved(`อัปเดตข้อมูล ${check.value.village} ของวันนี้แล้ว`);
      } else {
        await apiRequest(API, { method: "POST", body: { ...body, flood_start_date: date } });
        onSaved(`บันทึก ${check.value.village} แล้ว`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitText = mode === "tambon"
    ? `บันทึก ${pending.length} หมู่บ้าน`
    : mode === "edit" ? "บันทึกการแก้ไข" : existing ? "อัปเดตข้อมูลเดิม" : "บันทึก";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={`${mode === "edit" ? "ข้อมูลของ" : "บันทึกสำหรับ"}วันที่ ${thaiDate(mode === "edit" ? form.flood_start_date : date)}`}
      onSubmit={submit}
      busy={busy}
      error={error}
      submitText={submitText}
    >
      <FormGrid>
        <Field label="อำเภอ" required error={errors.district}>
          <select className={inputClass} value={form.district} disabled={mode === "edit"} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value, tambon: "", village: "" }))}>
            <option value="">เลือกอำเภอ</option>
            {districts.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
          </select>
        </Field>
        <Field label="ตำบล" required error={errors.tambon}>
          <select className={inputClass} value={form.tambon} disabled={!form.district || mode === "edit"} onChange={(event) => setForm((current) => ({ ...current, tambon: event.target.value, village: "" }))}>
            <option value="">เลือกตำบล</option>
            {tambons.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
          </select>
        </Field>

        {mode !== "tambon" ? (
          <Field label="หมู่บ้าน" required error={errors.village} wide hint={form.tambon && !villages.length ? "ไม่พบหมู่บ้านในตำบลนี้" : undefined}>
            <select className={inputClass} value={form.village} disabled={!form.tambon || !villages.length || mode === "edit"} onChange={(event) => set("village", event.target.value)}>
              <option value="">เลือกหมู่บ้าน</option>
              {villages.map((item) => {
                const name = item.villname.trim();
                const done = mode === "village" && findDayRecord(records, { date, district: form.district, tambon: form.tambon, village: name });
                return <option key={item.id} value={name}>{name}{done ? " — มีข้อมูลวันนี้แล้ว" : ""}</option>;
              })}
            </select>
          </Field>
        ) : null}

        {existing ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:col-span-2" role="status">
            {form.village} มีข้อมูลของวันนี้แล้ว (ระดับ {existing.flood_level}) — กดบันทึกจะแก้ข้อมูลเดิม ไม่เพิ่มแถวซ้ำ
          </p>
        ) : null}

        <LevelPicker value={form.flood_level} onChange={(value) => set("flood_level", value)} />

        <Field label="ความลึกของน้ำ (ซม.)" error={errors.water_depth_cm}>
          <input type="number" inputMode="numeric" min="0" className={inputClass} value={form.water_depth_cm} onChange={(event) => set("water_depth_cm", event.target.value)} />
        </Field>
        <Field label="พื้นที่ได้รับผลกระทบ (ตร.ม.)" error={errors.affected_area_sqm}>
          <input type="number" inputMode="numeric" min="0" className={inputClass} value={form.affected_area_sqm} onChange={(event) => set("affected_area_sqm", event.target.value)} />
        </Field>

        {mode !== "tambon" ? (
          <>
            <Field label="ครัวเรือนที่ได้รับผลกระทบ" error={errors.affected_households}>
              <input type="number" inputMode="numeric" min="0" className={inputClass} value={form.affected_households} onChange={(event) => set("affected_households", event.target.value)} />
            </Field>
            <Field label="ประชากรที่ได้รับผลกระทบ (คน)" error={errors.affected_people}>
              <input type="number" inputMode="numeric" min="0" className={inputClass} value={form.affected_people} onChange={(event) => set("affected_people", event.target.value)} />
            </Field>
          </>
        ) : null}

        {mode === "edit" ? (
          <Field label="วันที่" required error={errors.flood_start_date}>
            <input type="date" className={inputClass} value={form.flood_start_date} min={minDate} max={maxDate} onChange={(event) => set("flood_start_date", event.target.value)} />
          </Field>
        ) : null}

        <Field label="รายละเอียดเพิ่มเติม" wide>
          <textarea rows={2} className={inputClass} value={form.description} onChange={(event) => set("description", event.target.value)} placeholder="เช่น ถนนสายหลักน้ำท่วมสูง 40 ซม. รถเล็กผ่านไม่ได้" />
        </Field>
      </FormGrid>

      {mode === "tambon" && form.tambon ? (
        <section className="mt-5 border-t border-slate-200 pt-4" aria-labelledby="tambon-villages">
          <h3 id="tambon-villages" className="text-sm font-bold text-slate-800">ผู้ได้รับผลกระทบรายหมู่บ้าน</h3>
          <p className="mb-2 text-xs text-slate-500">ระดับน้ำด้านบนใช้กับทุกหมู่บ้านที่ยังไม่มีข้อมูล เว้นว่างได้ถ้ายังไม่ทราบตัวเลข (นับเป็น 0)</p>
          {!tambonVillages.length ? (
            <p className="text-sm text-slate-600">ไม่พบหมู่บ้านในตำบลนี้</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {tambonVillages.map(({ polygon, existing: done }) => {
                const name = polygon.villname.trim();
                return (
                  <li key={polygon.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">{name}</span>
                    {done ? (
                      <StatusPill tone="green">มีข้อมูลแล้ว · {done.flood_level}</StatusPill>
                    ) : (
                      <>
                        <label className="flex items-center gap-1 text-xs text-slate-600">
                          <span className="sr-only">ครัวเรือน {name}</span>
                          <input type="number" min="0" inputMode="numeric" placeholder="ครัวเรือน" className={`${inputClass} w-24 py-1.5`} value={perVillage[name]?.households ?? ""} onChange={(event) => setPerVillage((current) => ({ ...current, [name]: { ...current[name], households: event.target.value } }))} />
                        </label>
                        <label className="flex items-center gap-1 text-xs text-slate-600">
                          <span className="sr-only">จำนวนคน {name}</span>
                          <input type="number" min="0" inputMode="numeric" placeholder="คน" className={`${inputClass} w-20 py-1.5`} value={perVillage[name]?.people ?? ""} onChange={(event) => setPerVillage((current) => ({ ...current, [name]: { ...current[name], people: event.target.value } }))} />
                        </label>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </FormDialog>
  );
}
