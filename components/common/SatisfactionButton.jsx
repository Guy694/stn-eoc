"use client";

// ประเมินความพึงพอใจระบบ: ให้ดาว 1–5 (บังคับ) + ข้อเสนอแนะ (ไม่บังคับ) — ปุ่มอยู่ท้ายเว็บทุกหน้า (ประชาชนและเจ้าหน้าที่)
import { useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, Star } from "lucide-react";
import AppDialog from "@/components/ui/app-dialog";
import { COMMENT_MAX, RATED_KEY, RATING_LABELS, SOURCE_CHANNELS, SOURCE_OTHER_MAX, ratedRecently } from "@/lib/satisfaction";

const storage = () => { try { return window.localStorage; } catch { return null; } };
const readRated = () => { try { return JSON.parse(storage()?.getItem(RATED_KEY) || "null"); } catch { return null; } };

/** ask = เด้งขอให้ประเมินเอง (มีปุ่ม "ไว้ทีหลัง") · ไม่ใช่ ask = เปิดจากปุ่มท้ายเว็บ */
export function SatisfactionDialog({ open, onClose, ask = false }) {
  const pathname = usePathname() || "/";
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [sources, setSources] = useState([]);
  const [sourceOther, setSourceOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const previous = open ? readRated() : null;
  const shown = hover || rating;

  const close = () => {
    onClose?.();
    if (done) { setDone(false); setRating(0); setComment(""); setSources([]); setSourceOther(""); }
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!rating) { setError("กรุณาเลือกจำนวนดาว"); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/stn-eoc/api/public/satisfaction/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment, sources, sourceOther, path: pathname })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.success) throw new Error(json.message || "ส่งการประเมินไม่สำเร็จ ลองใหม่อีกครั้ง");
      try { storage()?.setItem(RATED_KEY, JSON.stringify({ at: Date.now(), rating })); } catch { /* โหมดส่วนตัว */ }
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppDialog open={open} onOpenChange={(value) => { if (!value) close(); }} size="sm" title={done ? "ขอบคุณสำหรับการประเมิน" : ask ? "ช่วยประเมินความพึงพอใจสักนิด" : "ประเมินความพึงพอใจระบบ"}
      description={done ? null : ask ? "ท่านใช้งานระบบนี้มาสักพักแล้ว ความเห็นของท่านช่วยให้ศูนย์ฯ ปรับปรุงระบบ ใช้เวลาไม่ถึง 1 นาที" : "ความเห็นของท่านช่วยให้ศูนย์ฯ ปรับปรุงระบบให้ใช้งานง่ายขึ้น"}>
      {done ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
          <p className="mt-2 text-slate-700">บันทึกคะแนน {rating} ดาว ({RATING_LABELS[rating]}) แล้ว</p>
          <button type="button" onClick={close} className="mt-4 min-h-11 w-full rounded-xl bg-[#0b4c86] px-4 font-bold text-white hover:bg-[#083865]">ปิด</button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <fieldset>
            <legend className="text-sm font-semibold text-slate-800">ท่านพึงพอใจระบบนี้มากแค่ไหน <span className="text-red-600">*</span></legend>
            <div className="mt-2 flex justify-center gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((value) => (
                <label key={value} className="cursor-pointer rounded-xl p-1 focus-within:ring-2 focus-within:ring-[#0b4c86]" onMouseEnter={() => setHover(value)}>
                  <input type="radio" name="satisfaction-rating" value={value} checked={rating === value} onChange={() => { setRating(value); setError(""); }} className="sr-only" />
                  <Star className={`h-10 w-10 transition-colors ${value <= shown ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} strokeWidth={1.6} aria-hidden="true" />
                  <span className="sr-only">{value} ดาว ({RATING_LABELS[value]})</span>
                </label>
              ))}
            </div>
            <p className="mt-1 h-5 text-center text-sm font-semibold text-amber-700" aria-live="polite">{shown ? `${shown} ดาว • ${RATING_LABELS[shown]}` : ""}</p>
          </fieldset>

          <fieldset className="mt-3">
            <legend className="text-sm font-semibold text-slate-800">ท่านรับทราบข่าวสารระบบนี้จากช่องทางไหน <span className="font-normal text-slate-500">(เลือกได้หลายข้อ ไม่บังคับ)</span></legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {Object.entries(SOURCE_CHANNELS).map(([key, label]) => {
                const on = sources.includes(key);
                return (
                  <button key={key} type="button" aria-pressed={on} onClick={() => setSources((current) => (on ? current.filter((item) => item !== key) : [...current, key]))}
                    className={`min-h-9 rounded-full px-3 text-sm font-semibold ring-1 transition ${on ? "bg-[#0b4c86] text-white ring-[#0b4c86]" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"}`}>{label}</button>
                );
              })}
            </div>
            {sources.includes("other") ? (
              <input value={sourceOther} onChange={(event) => setSourceOther(event.target.value.slice(0, SOURCE_OTHER_MAX))} aria-label="ช่องทางอื่น ๆ" placeholder="ระบุช่องทาง เช่น วิทยุชุมชน ประชุมหมู่บ้าน"
                className="mt-2 h-10 w-full rounded-xl border border-slate-300 px-3 text-[15px] outline-none focus:border-[#0b4c86] focus:ring-2 focus:ring-[#0b4c86]/20" />
            ) : null}
          </fieldset>

          <label className="mt-3 block text-sm font-semibold text-slate-800" htmlFor="satisfaction-comment">ข้อเสนอแนะเพิ่มเติม <span className="font-normal text-slate-500">(ไม่บังคับ)</span></label>
          <textarea id="satisfaction-comment" value={comment} onChange={(event) => setComment(event.target.value.slice(0, COMMENT_MAX))} rows={3}
            placeholder="เช่น อยากให้เพิ่มข้อมูลอะไร ส่วนไหนใช้ยาก หรือสิ่งที่ชอบ"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-[15px] outline-none focus:border-[#0b4c86] focus:ring-2 focus:ring-[#0b4c86]/20" />
          <p className="mt-1 flex justify-between gap-2 text-xs text-slate-500">
            <span>ไม่ต้องใส่ชื่อหรือเบอร์โทร ระบบไม่เก็บข้อมูลที่ระบุตัวตน</span>
            <span className="tabular-nums">{comment.length}/{COMMENT_MAX}</span>
          </p>
          {ratedRecently(previous) ? <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">เครื่องนี้เคยประเมินแล้วเมื่อ {new Date(previous.at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })} ประเมินอีกครั้งได้ถ้ามีความเห็นใหม่</p> : null}
          {error ? <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
          <div className="mt-4 flex gap-2">
            {ask ? <button type="button" onClick={close} className="min-h-11 shrink-0 rounded-xl px-4 font-semibold text-slate-600 hover:bg-slate-100">ไว้ทีหลัง</button> : null}
            <button type="submit" disabled={busy} className="min-h-11 flex-1 rounded-xl bg-[#0b4c86] px-4 font-bold text-white hover:bg-[#083865] disabled:opacity-60">
              {busy ? "กำลังส่ง…" : "ส่งการประเมิน"}
            </button>
          </div>
        </form>
      )}
    </AppDialog>
  );
}

export default function SatisfactionButton({ className = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`inline-flex items-center gap-1.5 ${className}`}>
        <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" /> ประเมินความพึงพอใจ
      </button>
      <SatisfactionDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
