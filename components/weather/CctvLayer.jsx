"use client";

// กล้อง CCTV + ระดับน้ำของ ปภ. บนแผนที่ — สีไอคอนตามสถานะระดับน้ำ (เกณฑ์ ปภ.) แตะเพื่อเปิดหน้าต่างรายละเอียด (ภาพ 2 มุม + ระดับน้ำ)
import { useEffect, useState } from "react";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { Marker, Tooltip } from "react-leaflet";
import { Cctv } from "lucide-react";
import { DDPM_CCTV_STATIONS } from "@/lib/ddpmCctv";
import { dpmStatus } from "@/lib/dpmCanals";
import DpmStationDialog from "@/components/weather/DpmStationDialog";

const CAMERA_SVG = renderToStaticMarkup(<Cctv width={16} height={16} strokeWidth={2.4} color="#ffffff" aria-hidden="true" />);
const iconCache = new Map();
function cameraIcon(color) {
  if (!iconCache.has(color)) {
    iconCache.set(color, L.divIcon({
      className: "",
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      html: `<div style="width:30px;height:30px;border-radius:9px;background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;cursor:pointer">${CAMERA_SVG}</div>`
    }));
  }
  return iconCache.get(color);
}

// ระดับน้ำสถานี ปภ. (ชุดเดียวกับการ์ด "น้ำในคลองตอนนี้" หน้าแรก) — โหลดครั้งเดียวต่อหน้า
let levelsPromise = null;
export const loadDpmLevels = () => (levelsPromise ||= fetch("/stn-eoc/api/public/dpm-water/?history=1")
  .then((r) => r.json())
  .then((json) => (json.success ? { stations: json.stations || [], history: json.history || {} } : { stations: [], history: {} }))
  .catch(() => { levelsPromise = null; return { stations: [], history: {} }; }));

export default function CctvLayer() {
  const [levels, setLevels] = useState({ stations: [], history: {} });
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    let alive = true;
    loadDpmLevels().then((value) => { if (alive) setLevels(value); });
    return () => { alive = false; };
  }, []);
  const byCode = new Map(levels.stations.map((item) => [item.code, item]));

  return (
    <>
      {DDPM_CCTV_STATIONS.map((base) => {
        const station = { amphoe: base.place.split("อ.")[1] || null, level: null, statusCode: 0, ...base, ...(byCode.get(base.code) || {}) };
        const status = dpmStatus(station);
        const color = station.statusCode > 0 ? status.tone : "#0f3b63";
        return (
          <Marker key={`cctv-${base.code}`} position={[base.lat, base.lng]} icon={cameraIcon(color)} zIndexOffset={300}
            eventHandlers={{ click: () => setSelected({ ...station, history: levels.history[base.code] || [] }) }} keyboard title={`กล้อง CCTV ${base.name}`}>
            <Tooltip direction="top" offset={[0, -15]}>
              {base.name}{station.level !== null ? ` • ${station.level.toFixed(2)} ม. (${status.label})` : ""}
            </Tooltip>
          </Marker>
        );
      })}
      <DpmStationDialog station={selected} history={selected?.history || []} open={Boolean(selected)} onClose={() => setSelected(null)} />
    </>
  );
}
