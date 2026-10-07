"use client";

// คัดลอกข้อมูลทั้งวันจากวันอื่นมาเป็นจุดเริ่มต้น แล้วแก้เฉพาะหมู่บ้านที่สถานการณ์เปลี่ยน
import { useEffect, useMemo, useState } from "react";
import { Field, FormDialog, inputClass } from "@/components/admin/crud";
import { apiRequest } from "@/lib/adminApi";
import { clampDateKey, recordsOnDate, shiftDateKey } from "@/lib/floodRecords";

function thaiDate(key) {
  if (!key) return "-";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

export default function CopyDayDialog({ open, onOpenChange, session, records, targetDate, minDate, maxDate, onDone }) {
  const [source, setSource] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSource(targetDate > minDate ? clampDateKey(shiftDateKey(targetDate, -1), minDate, maxDate) : "");
    setOverwrite(false);
    setError("");
  }, [open, targetDate, minDate, maxDate]);

  const sourceCount = useMemo(() => recordsOnDate(records, source).length, [records, source]);
  const targetCount = useMemo(() => recordsOnDate(records, targetDate).length, [records, targetDate]);

  const submit = async () => {
    if (!source) { setError("เลือกวันที่ต้นทาง"); return; }
    if (source === targetDate) { setError("วันต้นทางต้องไม่ใช่วันเดียวกับวันที่กำลังบันทึก"); return; }
    if (!sourceCount) { setError("วันที่ต้นทางไม่มีข้อมูลให้คัดลอก"); return; }
    setBusy(true);
    setError("");
    try {
      const json = await apiRequest("/stn-eoc/api/admin/flood-records/copy", {
        method: "POST",
        body: { session_id: session.id, source_date: source, target_date: targetDate, overwrite }
      });
      onDone(json.message || "คัดลอกข้อมูลแล้ว");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="คัดลอกข้อมูลจากวันอื่น"
      description={`คัดลอกมาเป็นข้อมูลของ${thaiDate(targetDate)}`}
      onSubmit={submit}
      busy={busy}
      error={error}
      submitText={sourceCount ? `คัดลอก ${sourceCount} หมู่บ้าน` : "คัดลอก"}
      size="md"
    >
      <div className="space-y-4">
        <Field label="คัดลอกจากวันที่" required hint={source ? `มีข้อมูล ${sourceCount} หมู่บ้าน` : undefined}>
          <input type="date" className={inputClass} value={source} min={minDate} max={maxDate} onChange={(event) => setSource(event.target.value)} />
        </Field>
        {targetCount ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0b4c86]" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} />
            <span>
              <span className="block font-bold text-slate-900">แทนที่ข้อมูลที่บันทึกไว้แล้ว ({targetCount} หมู่บ้าน)</span>
              <span className="block text-slate-600">ถ้าไม่เลือก จะคัดลอกเฉพาะหมู่บ้านที่วันนี้ยังไม่มีข้อมูล</span>
            </span>
          </label>
        ) : null}
        <p className="text-xs text-slate-500">หลังคัดลอก ตรวจและแก้หมู่บ้านที่สถานการณ์เปลี่ยน โดยเฉพาะหมู่บ้านที่น้ำลดแล้วให้เปลี่ยนระดับเป็น “ไม่มี”</p>
      </div>
    </FormDialog>
  );
}
