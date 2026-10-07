"use client";

// หน้าต่างบนแผนที่สาธารณะสำหรับ "จุดจากประชาชนที่ตรวจสอบแล้ว"
// แสดงเฉพาะข้อความที่เจ้าหน้าที่เขียน + แหล่งที่มา + เวลาตรวจ และให้ประชาชนแจ้งว่า "ตอนนี้ปกติแล้ว"
import { useState } from "react";
import { problemStyle } from "@/components/public/problemCategoryIcons";
import { waterLevelMeta, waterTrendMeta } from "@/lib/waterReport";

function timeText(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `${time} น.` : `${date.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} ${time} น.`;
}

export default function CitizenPointPopup({ incident }) {
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");
  const style = problemStyle(incident.report_type === "traffic_report" ? "road_cut" : incident.problem_category);
  const Icon = style.icon;
  const level = waterLevelMeta(incident.water_level);
  const trend = waterTrendMeta(incident.water_trend);
  const area = [incident.sub_district && `ต.${incident.sub_district}`, incident.district && `อ.${incident.district}`].filter(Boolean).join(" ");

  const reportNormal = async () => {
    setState("sending");
    try {
      const response = await fetch("/stn-eoc/api/public/incident-normal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: incident.id })
      });
      const json = await response.json();
      setState(json.success ? "sent" : "idle");
      setMessage(json.message || "");
    } catch {
      setState("idle");
      setMessage("ส่งไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  };

  return (
    <div className="w-60 p-1 text-slate-800" style={{ fontFamily: "var(--font-kanit)" }}>
      <div className="flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: style.bg, color: style.color }}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h4 className="text-[15px] font-bold leading-snug text-slate-900">{incident.title || incident.description}</h4>
          <p className="text-xs text-slate-500">{[incident.category_label, area, "พิกัดโดยประมาณ"].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      {level ? (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
          <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: level.color, color: ["dry", "ankle_knee", "knee_waist"].includes(level.value) ? "#111827" : "#ffffff" }}>ระดับน้ำ {level.short} ({level.range})</span>
          {trend ? <span className="text-xs font-semibold text-slate-600">{trend.arrow} {trend.label}</span> : null}
        </p>
      ) : null}
      {incident.detail ? <p className="mt-2 text-sm text-slate-700">{incident.detail}</p> : null}
      {incident.photo_path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={incident.photo_path} alt={incident.title || "รูปประกอบ"} className="mt-2 h-32 w-full rounded-md object-cover" loading="lazy" />
      ) : null}
      <p className="mt-2 inline-flex rounded-full bg-[#edf5fc] px-2 py-0.5 text-xs font-semibold text-[#083865] ring-1 ring-[#c9dcee]">
        ข้อมูลจากประชาชน{incident.report_count > 1 ? ` · แจ้ง ${incident.report_count} ราย` : ""}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        ตรวจสอบแล้วเมื่อ {timeText(incident.verified_at) || "-"}{incident.expires_at ? ` · แสดงถึง ${timeText(incident.expires_at)}` : ""}
      </p>
      {state === "sent" ? (
        <p className="mt-2 rounded-md bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-800" role="status">{message}</p>
      ) : (
        <button
          type="button"
          onClick={reportNormal}
          disabled={state === "sending"}
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {state === "sending" ? "กำลังส่ง…" : "ตอนนี้ปกติแล้ว"}
        </button>
      )}
      {state !== "sent" && message ? <p className="mt-1 text-xs text-red-700" role="alert">{message}</p> : null}
    </div>
  );
}
