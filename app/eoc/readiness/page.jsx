"use client";

// สถานะของฉัน: เจ้าหน้าที่รายงานว่าพร้อมปฏิบัติงานหรือไม่ (แตะ/ปัดแถบเลือกสถานะ บันทึกทันที)
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, LifeBuoy } from "lucide-react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { AdminPage, Button, inputClass, useNotice } from "@/components/admin/crud";
import ReadinessSlider from "@/components/readiness/ReadinessSlider";
import { apiRequest } from "@/lib/adminApi";
import { MAX_NOTE_LENGTH, isStale, readinessMeta } from "@/lib/officerReadiness";

const API = "/stn-eoc/api/officer/readiness";

function when(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " น.";
}

export default function MyReadinessPage() {
  const { success, fail } = useNotice();
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const json = await apiRequest(API);
      setState({ loading: false, data: json.data, error: "" });
      setDraft(json.data?.status || "");
      setNote(json.data?.note || "");
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (status, noteText = note) => {
    setSaving(true);
    try {
      const json = await apiRequest(API, { method: "PUT", body: { status, note: noteText } });
      setState({ loading: false, data: json.data, error: "" });
      setDraft(json.data?.status || status);
      success(json.message);
    } catch (error) {
      fail(error.message);
      setDraft(state.data?.status || "");
    } finally {
      setSaving(false);
    }
  };

  // เลือกสถานะ: บันทึกทันที ยกเว้น "ต้องการความช่วยเหลือ" ที่ต้องบอกรายละเอียดก่อนส่ง
  const current = state.data;
  const pick = (status) => {
    setDraft(status);
    if (status === "need_help") return;
    // เปลี่ยนจากขอความช่วยเหลือเป็นสถานะอื่น: ล้างรายละเอียดเดิม
    const nextNote = current?.status === "need_help" ? "" : note;
    setNote(nextNote);
    save(status, nextNote);
  };

  const meta = readinessMeta(current?.status);
  const stale = current && isStale(current.updated_at);
  const needHelpDraft = draft === "need_help" && current?.status !== "need_help";
  const noteChanged = (note || "") !== (current?.note || "");

  return (
    <EOCLayout>
      <AdminPage title="สถานะของฉัน" description="บอกศูนย์ฯ ว่าวันนี้คุณพร้อมมาปฏิบัติงานหรือไม่ ผู้บัญชาการใช้ข้อมูลนี้จัดกำลังคน">
        <section className="mx-auto w-full max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          {state.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black text-slate-900">ตอนนี้คุณพร้อมปฏิบัติงานไหม</h2>
            {current ? (
              <span className="rounded-full px-3 py-1 text-sm font-bold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
            ) : !state.loading ? <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">ยังไม่ได้รายงาน</span> : null}
          </div>

          <ReadinessSlider value={draft} onChange={pick} disabled={saving || state.loading} />
          <p className="text-center text-xs text-slate-500">แตะหรือปัดแถบเพื่อเลือก ระบบบันทึกให้ทันที</p>

          {needHelpDraft || current?.status === "need_help" ? (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="flex items-center gap-2 font-bold text-red-900"><LifeBuoy className="h-4 w-4" aria-hidden="true" /> ต้องการความช่วยเหลือเรื่องอะไร</p>
              <textarea rows={3} maxLength={MAX_NOTE_LENGTH} className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="เช่น น้ำท่วมบ้าน ออกจากบ้านไม่ได้ มีผู้สูงอายุ 2 คน" />
              <div className="flex flex-wrap justify-end gap-2">
                {needHelpDraft ? <Button variant="ghost" onClick={() => setDraft(current?.status || "")} disabled={saving}>ยกเลิก</Button> : null}
                <Button variant="danger" disabled={saving || note.trim().length < 3 || (!needHelpDraft && !noteChanged)} onClick={() => save("need_help")}>
                  {needHelpDraft ? "ส่งขอความช่วยเหลือ" : "บันทึกรายละเอียด"}
                </Button>
              </div>
              <p className="text-xs text-red-800">ศูนย์ฯ จะได้รับแจ้งทาง Telegram ทันที หากอันตรายถึงชีวิตโทร 1669 หรือ 1784</p>
            </div>
          ) : current ? (
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-800">หมายเหตุ (ไม่บังคับ)</span>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input className={inputClass} maxLength={MAX_NOTE_LENGTH} value={note} onChange={(event) => setNote(event.target.value)} placeholder="เช่น ถนนเข้าตำบลถูกตัด มาถึงประมาณ 10 โมง" />
                <Button variant="secondary" disabled={saving || !noteChanged} onClick={() => save(current.status)}>บันทึกหมายเหตุ</Button>
              </div>
            </label>
          ) : null}

          {current ? (
            <p className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${stale ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-600"}`}>
              {stale ? <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />}
              <span>
                อัปเดตล่าสุด {when(current.updated_at)}
                {current.source === "admin" ? ` โดยผู้ดูแลระบบ (${current.updated_by_username || "-"})` : ""}
                {stale ? " — เกิน 24 ชั่วโมงแล้ว กรุณาเลือกสถานะใหม่อีกครั้ง" : ""}
              </span>
            </p>
          ) : null}
        </section>
      </AdminPage>
    </EOCLayout>
  );
}
