"use client";

// แผนที่ผู้เข้าชม (โหลดเฉพาะฝั่งเบราว์เซอร์): heatmap หรือจุดเล็ก
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { drawHeat } from "@/components/admin/visitors/heatCanvas";

const THAILAND = [[5.6, 97.3], [20.5, 105.7]];
const SATUN = [[6.35, 99.55], [7.25, 100.4]];

/** ชั้น heatmap: canvas ในหน้าต่างแผนที่ วาดใหม่เมื่อเลื่อน/ซูม */
function HeatLayer({ points }) {
  const map = useMap();
  useEffect(() => {
    const canvas = L.DomUtil.create("canvas", "leaflet-zoom-hide");
    canvas.style.pointerEvents = "none";
    canvas.style.opacity = "0.85";
    map.getPanes().overlayPane.appendChild(canvas);
    const max = Math.max(1, ...points.map((point) => point.visits));
    const redraw = () => {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
      L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
      const zoom = map.getZoom();
      const radius = zoom >= 12 ? 22 : zoom >= 9 ? 16 : 12;
      const pixels = points.map((point) => {
        const at = map.latLngToContainerPoint([point.lat, point.lon]);
        // ความร้อนตามจำนวนครั้ง แบบลอการิทึม (จุดที่เข้าบ่อยมากไม่กลบจุดอื่นหมด)
        return [at.x, at.y, 0.15 + 0.55 * (Math.log1p(point.visits) / Math.log1p(max))];
      });
      drawHeat(canvas, pixels, { radius, blur: Math.round(radius * 0.8), max: 1 });
    };
    redraw();
    map.on("moveend zoomend resize", redraw);
    return () => {
      map.off("moveend zoomend resize", redraw);
      canvas.remove();
    };
  }, [map, points]);
  return null;
}

/** ซูมให้เห็นทุกจุด หรือกดปุ่ม "ทั้งประเทศ"/"สตูล" */
function Fit({ points, view }) {
  const map = useMap();
  useEffect(() => {
    if (view === "thailand") { map.fitBounds(THAILAND); return; }
    if (view === "satun") { map.fitBounds(SATUN); return; }
    if (!points.length) { map.fitBounds(THAILAND); return; }
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lon]));
    map.fitBounds(bounds.pad(0.2), { maxZoom: 11 });
  }, [map, points, view]);
  return null;
}

function when(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function VisitorMapCanvas({ points, mode, view, onPickIp }) {
  const max = useMemo(() => Math.max(1, ...points.map((point) => point.visits)), [points]);
  return (
    <MapContainer bounds={THAILAND} className="h-full w-full [&_.visitor-map-tiles]:opacity-70 [&_.visitor-map-tiles]:grayscale-[60%]" scrollWheelZoom preferCanvas>
      {/* ใช้แผนที่ OpenStreetMap แบบเดียวกับแผนที่อื่นในระบบ (CARTO ต้องใช้ API key บนโดเมนจริง) · ทำให้สีจางลงเล็กน้อยเพื่อให้เห็นจุด/ความหนาแน่นชัด */}
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" className="visitor-map-tiles" />
      <Fit points={points} view={view} />
      {mode === "heat" ? <HeatLayer points={points} /> : null}
      {/* จุดเล็ก (โหมดจุด) หรือจุดโปร่งใสให้กดดูรายละเอียดได้ (โหมด heatmap) */}
      {points.map((point) => {
        const staffShare = point.staff / point.visits;
        const fill = staffShare >= 0.5 ? "#0b4c86" : "#0e7490";
        const dot = mode === "dots";
        return (
          <CircleMarker
            key={`${point.kind}-${point.lat}-${point.lon}`}
            center={[point.lat, point.lon]}
            radius={dot ? Math.min(7, 3 + Math.log2(point.visits) * 0.6) : 9}
            pathOptions={dot
              ? { color: point.kind === "gps" ? "#15803d" : "#ffffff", weight: point.kind === "gps" ? 1.5 : 1, fillColor: fill, fillOpacity: 0.8 + Math.min(0.2, point.visits / max) }
              : { stroke: false, fillOpacity: 0 }}
          >
            <Popup>
              <div className="min-w-[13rem] space-y-1 text-sm">
                <p className="font-bold text-slate-900">{point.kind === "gps" ? "ตำแหน่ง GPS (ผู้ใช้อนุญาต)" : "ตำแหน่งจาก IP (โดยประมาณ)"}</p>
                <p className="text-slate-700">{point.visits.toLocaleString("th-TH")} ครั้ง · {point.ips} IP · หน้าเจ้าหน้าที่ {point.staff} ครั้ง</p>
                {point.users.length ? (
                  <p className="text-slate-700">ผู้ใช้: {point.users.join(", ")}{point.userCount > point.users.length ? ` และอีก ${point.userCount - point.users.length} คน` : ""}</p>
                ) : <p className="text-slate-500">ไม่ได้เข้าสู่ระบบ</p>}
                <p className="flex flex-wrap gap-1">
                  {point.sampleIps.map((ip) => (
                    <button key={ip} type="button" onClick={() => onPickIp?.(ip)} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-[#0b4c86] hover:bg-sky-100" title="ดูการเข้าชมของ IP นี้">{ip}</button>
                  ))}
                  {point.ips > point.sampleIps.length ? <span className="text-xs text-slate-500">+{point.ips - point.sampleIps.length} IP</span> : null}
                </p>
                <p className="text-xs text-slate-500">ล่าสุด {when(point.lastSeen)} · {point.lat.toFixed(2)}, {point.lon.toFixed(2)}</p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
