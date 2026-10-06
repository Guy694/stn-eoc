"use client";

// แผงเผยแพร่ในหน้าตรวจ "คำขอจากประชาชน"
// ตัดสิน 2 เรื่องแยกกัน: เกิดจริงไหม (สถานะเรื่อง) กับ ควรให้ประชาชนเห็นไหม (แผงนี้)
// สิ่งที่ประชาชนเห็น = หัวข้อ/รายละเอียดที่เจ้าหน้าที่เขียน + รูปที่เลือก (ค่าเริ่มต้นไม่ใช้รูป) + พิกัดโดยประมาณ
import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, GitMerge, Megaphone, RotateCcw, Undo2 } from "lucide-react";
import { Button, StatusPill, inputClass } from "@/components/admin/crud";
import { apiRequest, formatDateTime } from "@/lib/adminApi";
import { canPublish, categoryMeta, defaultExpiryHours, publicPhotoUrl, suggestTitle, titleTemplates } from "@/lib/incidentPublishing";

const API = "/stn-eoc/api/admin/incident-reports/publish";
const EXPIRY_CHOICES = [6, 12, 24, 48, 72];

function toUrl(path) {
  return publicPhotoUrl(path);
}

function areaShort(report) {
  return [report.sub_district && `ต.${report.sub_district}`, report.district && `อ.${report.district}`].filter(Boolean).join(" ") || "ไม่ระบุพื้นที่";
}

export default function PublishPanel({ report, canEdit, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [hours, setHours] = useState(12);
  const [photo, setPhoto] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const json = await apiRequest(`${API}?id=${report.id}`);
      setDetail(json.data);
      setLoadError("");
    } catch (err) {
      setLoadError(err.message);
    }
  }, [report.id]);

  useEffect(() => {
    setTitle(report.public_title || suggestTitle(report));
    setText(report.public_detail || "");
    setHours(defaultExpiryHours(report));
    setPhoto("");
    setError("");
    load();
  }, [report, load]);

  const run = async (action, body = {}) => {
    setBusy(action);
    setError("");
    try {
      const json = await apiRequest(API, { method: "POST", body: { reportId: report.id, action, ...body } });
      onChanged?.(json.message, action);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const check = canPublish(report);
  const published = report.publish_status === "published";
  const photos = detail?.photos || [];
  const templates = titleTemplates(report);
  const count = 1 + (detail?.children?.length || 0);

  return (
    <section className="space-y-4 rounded-xl border border-[#c9dcee] bg-[#f7fbff] p-4" aria-labelledby={`publish-${report.id}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`publish-${report.id}`} className="flex items-center gap-2 text-base font-black text-[#083865]">
          <Megaphone className="h-5 w-5" aria-hidden="true" /> เผยแพร่บนแผนที่สาธารณะ
        </h3>
        {published ? (
          <StatusPill tone="green">เผยแพร่อยู่ · ถึง {formatDateTime(report.expires_at)}</StatusPill>
        ) : report.publish_status === "expired" ? (
          <StatusPill tone="amber">หมดอายุแล้ว</StatusPill>
        ) : report.publish_status === "withdrawn" ? (
          <StatusPill>ถอดออกแล้ว</StatusPill>
        ) : (
          <StatusPill>ยังไม่เผยแพร่</StatusPill>
        )}
      </header>

      {loadError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{loadError}</p> : null}

      {Number(report.normal_reports) > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="min-w-0 flex-1">ประชาชนกด “ตอนนี้ปกติแล้ว” {report.normal_reports} ครั้ง (ล่าสุด {formatDateTime(report.normal_reported_at)}) — ตรวจแล้วถอดออก หรือยืนยันว่ายังมีปัญหา</span>
          {canEdit ? <Button variant="secondary" className="min-h-8 px-3 text-xs" disabled={Boolean(busy)} onClick={() => run("clear_normal")}>ยังมีปัญหาอยู่</Button> : null}
        </div>
      ) : null}

      {!check.ok ? (
        <p className="text-sm text-slate-700">{check.reason}</p>
      ) : (
        <>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-800" htmlFor={`pub-title-${report.id}`}>หัวข้อที่ประชาชนจะเห็น</label>
            <input id={`pub-title-${report.id}`} className={inputClass} value={title} maxLength={150} disabled={!canEdit} onChange={(event) => setTitle(event.target.value)} />
            {templates.length && canEdit ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {templates.map((item) => (
                  <button key={item} type="button" onClick={() => setTitle(item)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${title === item ? "border-[#0b4c86] bg-[#edf5fc] text-[#083865]" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-800" htmlFor={`pub-detail-${report.id}`}>รายละเอียดเพิ่มเติม (ถ้ามี)</label>
            <textarea id={`pub-detail-${report.id}`} rows={2} maxLength={500} className={inputClass} value={text} disabled={!canEdit} onChange={(event) => setText(event.target.value)} placeholder="เช่น แนะนำเลี่ยงไปใช้ถนนเลียบคลอง — ห้ามใส่ชื่อ เบอร์โทร หรือเลขที่บ้าน" />
            <p className="mt-1 text-xs text-slate-500">ข้อความที่ประชาชนพิมพ์มาจะไม่ถูกเผยแพร่ แสดงเฉพาะสิ่งที่เขียนในช่องนี้</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-800">แสดงบนแผนที่นาน</span>
              <select className={inputClass} value={hours} disabled={!canEdit} onChange={(event) => setHours(Number(event.target.value))}>
                {[...new Set([...EXPIRY_CHOICES, defaultExpiryHours(report)])].sort((a, b) => a - b).map((value) => (
                  <option key={value} value={value}>{value} ชั่วโมง{value === defaultExpiryHours(report) ? " (ค่าแนะนำ)" : ""}</option>
                ))}
              </select>
            </label>
            <div className="text-sm text-slate-600 sm:pt-6">หมดเวลาแล้วจุดจะซ่อนเอง ถ้ายังมีปัญหาให้กดเผยแพร่ซ้ำเพื่อต่อเวลา</div>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-bold text-slate-800">รูปที่จะเผยแพร่</legend>
            <div className="flex flex-wrap gap-2">
              <label className={`flex h-20 w-28 cursor-pointer items-center justify-center rounded-lg border-2 text-center text-xs font-bold ${photo === "" ? "border-[#0b4c86] bg-[#edf5fc] text-[#083865]" : "border-slate-200 bg-white text-slate-600"}`}>
                <input type="radio" name={`pub-photo-${report.id}`} className="sr-only" checked={photo === ""} onChange={() => setPhoto("")} disabled={!canEdit} />
                ไม่ใช้รูป
              </label>
              {photos.map((path) => (
                <label key={path} className={`relative block h-20 w-28 cursor-pointer overflow-hidden rounded-lg border-2 ${photo === path ? "border-[#0b4c86]" : "border-transparent"}`}>
                  <input type="radio" name={`pub-photo-${report.id}`} className="sr-only" checked={photo === path} onChange={() => setPhoto(path)} disabled={!canEdit} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={toUrl(path)} alt="รูปจากผู้แจ้ง" className="h-full w-full object-cover" loading="lazy" />
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">เลือกเฉพาะรูปที่ไม่เห็นใบหน้า ทะเบียนรถ หรือเลขที่บ้าน ระบบลบพิกัดในไฟล์ให้อัตโนมัติ{published && report.public_photo_path ? " · ตอนนี้ใช้รูปอยู่ 1 รูป" : ""}</p>
          </fieldset>

          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <div className="text-xs font-semibold text-slate-500">ตัวอย่างที่ประชาชนจะเห็น</div>
            <div className="mt-1 font-black text-slate-900">{title || "—"}</div>
            {text ? <div className="text-slate-700">{text}</div> : null}
            <div className="mt-1 text-xs text-slate-500">
              {report.report_type === "problem_point" ? `${categoryMeta(report.problem_category).label} · ` : ""}{areaShort(report)} · พิกัดโดยประมาณ · ข้อมูลจากประชาชน{count > 1 ? ` · แจ้ง ${count} ราย` : ""} · ตรวจสอบแล้ว
            </div>
          </div>

          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}

          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button disabled={Boolean(busy)} onClick={() => run("publish", { title, detail: text, expiresHours: hours, photo: photo || null })}>
                <Eye className="h-4 w-4" aria-hidden="true" />
                {busy === "publish" ? "กำลังเผยแพร่…" : published ? "อัปเดตและต่อเวลา" : report.status === "verified" ? "เผยแพร่" : "ยืนยัน + เผยแพร่"}
              </Button>
              {published ? (
                <Button variant="secondary" disabled={Boolean(busy)} onClick={() => run("withdraw")}>
                  <EyeOff className="h-4 w-4" aria-hidden="true" /> {busy === "withdraw" ? "กำลังถอด…" : "ถอดออกจากแผนที่"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {detail?.children?.length ? (
        <div className="border-t border-[#c9dcee] pt-3">
          <h4 className="text-sm font-bold text-slate-800">รวมไว้ในเรื่องนี้แล้ว {detail.children.length} เรื่อง</h4>
          <ul className="mt-2 space-y-1.5">
            {detail.children.map((child) => (
              <li key={child.id} className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <span className="font-semibold">#{child.id}</span>
                <span className="min-w-0 flex-1 truncate">{child.description}</span>
                <span className="text-xs text-slate-500">{formatDateTime(child.created_at)}</span>
                {canEdit ? (
                  <Button variant="ghost" className="min-h-8 px-2 text-xs" disabled={Boolean(busy)} onClick={() => run("unmerge", {}).then(load)} title="แยกออกเป็นเรื่องเดี่ยว">
                    <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> แยก
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail?.duplicates?.length && !report.merged_into_id ? (
        <div className="border-t border-[#c9dcee] pt-3">
          <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-800"><GitMerge className="h-4 w-4" aria-hidden="true" /> น่าจะเป็นจุดเดียวกัน</h4>
          <p className="text-xs text-slate-500">ประเภทเดียวกัน ห่างไม่เกิน 300 ม. และแจ้งในช่วงเวลาใกล้กัน — รวมแล้วนับเป็น “แจ้ง N ราย” และตรวจครั้งเดียว</p>
          <ul className="mt-2 space-y-1.5">
            {detail.duplicates.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
                <span className="font-semibold">#{item.id}</span>
                {item.publish_status === "published" ? <StatusPill tone="green">เผยแพร่อยู่</StatusPill> : null}
                <span className="min-w-0 flex-1 truncate">{item.public_title || item.description}</span>
                <span className="text-xs text-slate-500">ห่าง {item.distance_m} ม.</span>
                {canEdit ? (
                  <Button variant="secondary" className="min-h-8 px-2.5 text-xs" disabled={Boolean(busy)} onClick={() => run("merge", { targetId: item.id })}>
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> รวมเข้ากับ #{item.id}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
