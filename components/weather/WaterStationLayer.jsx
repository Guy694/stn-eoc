"use client";

// หมุดสถานีวัดระดับน้ำบนแผนที่ — ใช้ได้กับข้อมูล ปภ. และ ThaiWater ตามต้นทางของข้อมูล
import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { DDPM_CCTV_CREDIT } from "@/lib/ddpmCctv";
import { DPM_STATUS } from "@/lib/dpmCanals";
import { bankLabel, bankText, groupByLocation, isStale, situationMeta } from "@/lib/thaiWater";

function stationMeta(station) {
  if (station.source === "ddpm") {
    const status = DPM_STATUS[station.statusCode] || DPM_STATUS[0];
    return { color: status.tone, text: "#fff", label: status.label };
  }
  return situationMeta(station.situationLevel) || { color: "#64748b", text: "#fff", label: "ไม่มีข้อมูล" };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

const GAUGE_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 3v10"/><path d="M8 9l4 4 4-4"/><path d="M3 18c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0"/></svg>';

function stationIcon(group) {
  const station = group.primary;
  const meta = stationMeta(station);
  const label = bankLabel(station.bankDiff);
  const alert = station.source === "ddpm" ? station.statusCode >= 4 : station.situationLevel >= 5;
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div style="transform:translate(-11px,-11px);display:flex;align-items:center;gap:4px;font-family:var(--font-kanit, sans-serif)">
      <span style="display:grid;place-items:center;width:22px;height:22px;border-radius:6px;background:${meta.color};color:${meta.text};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">${GAUGE_SVG}</span>
      ${label ? `<span style="white-space:nowrap;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:800;line-height:16px;${alert ? `background:${meta.color};color:#fff;border:1px solid #fff` : `background:rgba(255,255,255,.94);color:#0f172a;border:1px solid ${meta.color}`};box-shadow:0 1px 4px rgba(0,0,0,.25)">${escapeHtml(label)}</span>` : ""}
    </div>`
  });
}

function formatObserved(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })} ${date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`;
}

function fmt(value, digits = 2) {
  return value === null || value === undefined ? "-" : Number(value).toFixed(digits);
}

function StationDetail({ station, compact }) {
  const meta = stationMeta(station);
  const place = [station.river, station.tambon && `ต.${station.tambon}`, station.amphoe && `อ.${station.amphoe}`].filter(Boolean).join(" · ");
  const stale = isStale(station.observedAt);
  return (
    <div className={compact ? "border-t border-slate-200 pt-2" : ""}>
      <h4 className="m-0 text-[15px] font-bold leading-snug text-slate-900">สถานี{station.name}</h4>
      {place ? <div className="text-xs text-slate-500">{place}</div> : null}
      {meta ? (
        <span className="mt-1.5 inline-block rounded-md px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: meta.color, color: meta.text }}>{meta.label}</span>
      ) : null}
      <div className="mt-1.5 space-y-0.5 text-[13px] text-slate-700">
        {station.bankDiff !== null ? <div className="font-bold text-slate-900">{bankText(station.bankDiff)}</div> : null}
        <div>ระดับน้ำ {fmt(station.waterLevelMsl)} ม.{station.source === "ddpm" ? ` (ระดับตลิ่ง ${fmt(station.bankLevelMsl)} ม.)` : ` รทก.${station.bankLevelMsl !== null ? ` (ตลิ่ง ${fmt(station.bankLevelMsl)})` : ""}`}</div>
      {station.storagePercent !== null && station.storagePercent !== undefined ? <div>ความจุลำน้ำ {fmt(station.storagePercent, 0)}%</div> : null}
      {station.source === "ddpm" && station.statusCode > 0 ? <div>สถานะตามเกณฑ์ ปภ. ระดับ {station.statusCode}</div> : null}
        {station.trend ? <div>{station.trend.arrow} {station.trend.label}{station.trend.change ? ` (${station.trend.change > 0 ? "+" : ""}${station.trend.change.toFixed(2)} ม.)` : ""}</div> : null}
        <div className={stale ? "font-semibold text-amber-700" : "text-slate-500"}>
          วัดเมื่อ {formatObserved(station.observedAt)}{stale ? " · ข้อมูลอาจไม่เป็นปัจจุบัน" : ""}
        </div>
      </div>
      {station.agency ? <div className="mt-1 text-[11px] text-slate-400">สถานีของ {station.agency}</div> : null}
    </div>
  );
}

export default function WaterStationLayer({ stations = [] }) {
  const groups = groupByLocation(stations);
  // กันไม่ให้ popup ไปอยู่ใต้แผงด้านซ้าย (กว้าง ~370px) และแถบบนของหน้า
  const panPadding = typeof window !== "undefined" && window.innerWidth >= 768 ? [392, 80] : [16, 70];
  return groups.map((group) => (
    <Marker
      key={`wl-${group.key}-${group.primary.situationLevel}-${group.primary.bankDiff}`}
      position={[group.lat, group.lng]}
      icon={stationIcon(group)}
      zIndexOffset={group.primary.situationLevel * 100}
      keyboard
      title={`สถานีวัดระดับน้ำ ${group.primary.name}`}
    >
      <Popup maxWidth={260} minWidth={220} autoPanPaddingTopLeft={panPadding} autoPanPaddingBottomRight={[72, 110]}>
        <div className="space-y-1.5 text-slate-700" style={{ fontFamily: "var(--font-kanit)" }}>
          {group.stations.map((station, index) => <StationDetail key={station.id} station={station} compact={index > 0} />)}
          <div className="text-[11px] text-sky-700">ข้อมูลระดับน้ำ: {group.primary.source === "ddpm" ? DDPM_CCTV_CREDIT : "คลังข้อมูลน้ำแห่งชาติ (ThaiWater) สสน."}</div>
        </div>
      </Popup>
    </Marker>
  ));
}
