"use client";

// จุดรายงานระดับน้ำจากประชาชน (เผยแพร่โดยเจ้าหน้าที่แล้ว) — วงกลมสีตามระดับน้ำ + popup ให้ช่วยยืนยันว่ายังท่วม/น้ำลดแล้ว
// ใช้ร่วมกันทั้งแผนที่สถานการณ์และแผนที่สภาพอากาศ (ต้องอยู่ใน MapContainer)
import { useState } from "react";
import { CircleMarker, Popup } from "react-leaflet";
import { timeAgoText, waterReportStyle, waterReportSummary } from "@/lib/waterReportMap";

const VOTED_KEY = "stn-water-report-votes";

function readVotes() {
  try { return JSON.parse(window.localStorage.getItem(VOTED_KEY) || "{}"); } catch { return {}; }
}
function rememberVote(id, kind) {
  try {
    const votes = readVotes();
    votes[id] = { kind, at: Date.now() };
    window.localStorage.setItem(VOTED_KEY, JSON.stringify(votes));
  } catch { /* โหมดส่วนตัว: ไม่เป็นไร */ }
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} ${date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`;
}

function WaterReportPopup({ incident }) {
  const { level, trend, travel } = waterReportSummary(incident);
  const confirmations = incident.confirmations || {};
  // โหวตซ้ำได้หลัง 3 ชม. (สถานการณ์เปลี่ยนได้) — อ่านครั้งเดียวตอนเปิด popup
  const [recentVote] = useState(() => {
    const previous = typeof window !== "undefined" ? readVotes()[incident.id] : null;
    return previous && Date.now() - previous.at < 3 * 3600000 ? previous.kind : null;
  });
  const [state, setState] = useState(recentVote ? "sent" : "idle");
  const [message, setMessage] = useState(recentVote ? "คุณยืนยันจุดนี้แล้ว ขอบคุณครับ" : "");
  const [counts, setCounts] = useState({ still: Number(confirmations.still || 0), normal: Number(confirmations.normal || 0) });

  const send = async (kind) => {
    setState("sending");
    setMessage("");
    try {
      const response = await fetch("/stn-eoc/api/public/incident-normal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: incident.id, kind })
      });
      const json = await response.json().catch(() => ({}));
      if (!json.success) {
        setState("idle");
        setMessage(json.message || "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง");
        return;
      }
      rememberVote(incident.id, kind);
      if (kind === "still" || kind === "normal") setCounts((current) => ({ ...current, [kind]: current[kind] + 1 }));
      setState("sent");
      setMessage(json.message);
    } catch {
      setState("idle");
      setMessage("ส่งไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  };

  return (
    <div className="w-60 text-[13px] text-slate-700" style={{ fontFamily: "var(--font-kanit)" }}>
      <div className="text-[15px] leading-snug text-slate-900">
        <b>{level?.label}</b> <span className="text-slate-600">({level?.range})</span>
      </div>
      <div className="mt-0.5">
        {trend ? <span>{trend.arrow} {trend.label}</span> : null}
        {trend && travel ? " · " : ""}
        {travel}
      </div>
      <div className="mt-0.5">
        รายงาน {formatTime(incident.occurred_at)} <span className="text-slate-500">({timeAgoText(incident.occurred_at)})</span>
      </div>
      {counts.still > 0 && confirmations.still_at ? (
        <div className="mt-0.5 font-semibold text-orange-700">
          ● ยืนยันว่ายังท่วมอยู่ {formatTime(confirmations.still_at)} <span className="font-normal">({timeAgoText(confirmations.still_at)})</span>
        </div>
      ) : null}
      {counts.still || counts.normal ? <div className="mt-0.5 text-xs text-slate-500">ยังท่วม {counts.still} · น้ำลด {counts.normal}</div> : null}
      {[incident.sub_district && `ต.${incident.sub_district}`, incident.district && `อ.${incident.district}`].filter(Boolean).length ? (
        <div className="mt-0.5 text-xs text-slate-500">{[incident.sub_district && `ต.${incident.sub_district}`, incident.district && `อ.${incident.district}`].filter(Boolean).join(" ")} · ตำแหน่งโดยประมาณ</div>
      ) : null}

      {incident.photo_path ? (
        <a href={incident.photo_path} target="_blank" rel="noopener noreferrer" className="mt-2 block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={incident.photo_path} alt={`รูปน้ำท่วมระดับ${level?.label || ""}`} className="h-36 w-full rounded-lg object-cover" loading="lazy" />
          <span className="mt-0.5 block text-[11px] text-slate-500">แตะรูปเพื่อดูขนาดเต็ม</span>
        </a>
      ) : null}

      <div className="mt-2 border-t border-slate-200 pt-2">
        <div className="mb-1.5 font-semibold text-slate-800">ตอนนี้ที่จุดนี้เป็นอย่างไร?</div>
        {state === "sent" ? (
          <div className="rounded-lg bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-800" role="status">{message}</div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" disabled={state === "sending"} onClick={() => send("still")} className="rounded-lg border-2 border-orange-600 bg-white px-2 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-50 disabled:opacity-60">ยังท่วมอยู่</button>
            <button type="button" disabled={state === "sending"} onClick={() => send("normal")} className="rounded-lg border-2 border-emerald-600 bg-white px-2 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60">น้ำลดแล้ว</button>
          </div>
        )}
        {state !== "sent" && message ? <div className="mt-1 text-xs text-red-700" role="alert">{message}</div> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 border-t border-slate-200 pt-1.5 text-[11px]">
        <span className="text-slate-500">ประชาชนรายงาน · เจ้าหน้าที่ตรวจแล้ว</span>
        {state !== "sent" ? (
          <button type="button" onClick={() => send("wrong")} className="font-semibold text-red-700 underline">แจ้งข้อมูลไม่ถูกต้อง</button>
        ) : null}
      </div>
    </div>
  );
}

export default function WaterReportMarker({ incident, panPadding = [16, 70] }) {
  const style = waterReportStyle(incident);
  const lat = Number(incident.latitude);
  const lng = Number(incident.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return (
    <CircleMarker
      center={[lat, lng]}
      radius={style.radius}
      pathOptions={{ color: style.color, weight: style.weight, dashArray: style.dashArray, fillColor: style.fillColor, fillOpacity: style.fillOpacity, opacity: style.opacity }}
    >
      <Popup pane="popupPane" maxWidth={260} minWidth={230} autoPanPaddingTopLeft={panPadding} autoPanPaddingBottomRight={[72, 110]}>
        <WaterReportPopup incident={incident} />
      </Popup>
    </CircleMarker>
  );
}
