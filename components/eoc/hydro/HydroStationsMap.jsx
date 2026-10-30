"use client";

// แผนที่สถานีวัดน้ำ (ปภ.) และสถานีวัดฝน ในหน้าแนวโน้มน้ำและฝน — สีหมุดตามสถานการณ์ในช่วงที่เลือก
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import { HEAVY_RAIN_MM, VERY_HEAVY_RAIN_MM } from "@/lib/hydroHistory";

const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then((mod) => mod.CircleMarker), { ssr: false });
const Tooltip = dynamic(() => import("react-leaflet").then((mod) => mod.Tooltip), { ssr: false });
const FitBounds = dynamic(
  () => import("react-leaflet").then((mod) => {
    function Fit({ points }) {
      const map = mod.useMap();
      useEffect(() => {
        if (points.length > 1) map.fitBounds(points, { padding: [28, 28], maxZoom: 12 });
        else if (points.length === 1) map.setView(points[0], 12);
      }, [points, map]);
      return null;
    }
    return Fit;
  }),
  { ssr: false }
);

const SATUN_CENTER = [6.75, 99.95];
const hasPoint = (s) => Number.isFinite(Number(s?.lat)) && Number.isFinite(Number(s?.lng)) && s.lat !== null && s.lng !== null;
const fmt = (value, digits = 1) => (value === null || value === undefined ? "–" : Number(value).toLocaleString("th-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits }));

export function waterTone(station) {
  if (station.hours_over_bank > 0) return { color: "#dc2626", label: "เคยล้นตลิ่งในช่วงนี้" };
  if (station.hours_near_bank > 0) return { color: "#d97706", label: "เคยใกล้ตลิ่ง" };
  return { color: "#0b4c86", label: "ต่ำกว่าตลิ่ง" };
}
export function rainTone(station) {
  const max = Number(station.max_day_mm);
  if (max >= VERY_HEAVY_RAIN_MM) return { color: "#7f1d1d", label: "ฝนหนักมาก" };
  if (max >= HEAVY_RAIN_MM) return { color: "#d97706", label: "ฝนหนัก" };
  if (max > 0) return { color: "#2a9db0", label: "มีฝน" };
  return { color: "#94a3b8", label: "ไม่มีฝน" };
}

export default function HydroStationsMap({ waterStations = [], rainStations = [], selectedCode, onSelectWater }) {
  const [mounted, setMounted] = useState(false);
  const [layer, setLayer] = useState("all");
  useEffect(() => { setMounted(true); }, []);

  const water = useMemo(() => waterStations.filter(hasPoint), [waterStations]);
  const rain = useMemo(() => rainStations.filter(hasPoint), [rainStations]);
  const showWater = layer !== "rain";
  const showRain = layer !== "water";
  const points = useMemo(() => [...(showWater ? water : []), ...(showRain ? rain : [])].map((s) => [Number(s.lat), Number(s.lng)]), [water, rain, showWater, showRain]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div role="radiogroup" aria-label="ชั้นข้อมูลบนแผนที่" className="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
          {[["all", "ทั้งหมด"], ["water", "ระดับน้ำ"], ["rain", "ฝน"]].map(([key, text]) => (
            <button key={key} type="button" role="radio" aria-checked={layer === key} onClick={() => setLayer(key)}
              className={`min-h-8 rounded-md px-3 text-sm font-semibold ${layer === key ? "bg-white text-[#0b4c86] shadow-sm" : "text-slate-600 hover:bg-white/60"}`}>{text}</button>
          ))}
        </div>
        <p className="text-xs text-slate-500">สถานีวัดน้ำ {water.length} · สถานีวัดฝน {rain.length}</p>
      </div>
      <div className="h-[22rem] sm:h-[26rem]" role="region" aria-label="แผนที่สถานีวัดน้ำและฝน">
        {mounted ? (
          <MapContainer center={SATUN_CENTER} zoom={10} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
            <FitBounds points={points} />
            {showRain ? rain.map((s) => {
              const tone = rainTone(s);
              return (
                <CircleMarker key={`rain-${s.id}`} center={[Number(s.lat), Number(s.lng)]} radius={7} pathOptions={{ color: "#ffffff", weight: 1.5, fillColor: tone.color, fillOpacity: 0.9 }}>
                  <Tooltip>
                    <b>{s.name}</b><br />ฝน · {tone.label}<br />รวม {fmt(s.total_mm)} มม. · สูงสุดวันละ {fmt(s.max_day_mm)} มม.
                  </Tooltip>
                </CircleMarker>
              );
            }) : null}
            {showWater ? water.map((s) => {
              const tone = waterTone(s);
              const on = s.code === selectedCode;
              return (
                <CircleMarker key={`water-${s.code}`} center={[Number(s.lat), Number(s.lng)]} radius={on ? 12 : 10}
                  pathOptions={{ color: on ? "#facc15" : "#ffffff", weight: on ? 3 : 2, fillColor: tone.color, fillOpacity: 1 }}
                  eventHandlers={{ click: () => onSelectWater?.(s.code) }}>
                  <Tooltip>
                    <b>{s.name}</b><br />ระดับน้ำ · {tone.label}<br />ล่าสุด {fmt(s.latest?.level, 2)} ม.{s.bank !== null && s.bank !== undefined ? ` · ตลิ่ง ${fmt(s.bank, 2)} ม.` : ""}
                  </Tooltip>
                </CircleMarker>
              );
            }) : null}
          </MapContainer>
        ) : <div className="h-full animate-pulse bg-slate-100" aria-hidden="true" />}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 px-3 py-2 text-xs text-slate-600" aria-label="คำอธิบายสี">
        {showWater ? [["#0b4c86", "น้ำ: ต่ำกว่าตลิ่ง"], ["#d97706", "น้ำ: เคยใกล้ตลิ่ง"], ["#dc2626", "น้ำ: เคยล้นตลิ่ง"]].map(([color, text]) => (
          <li key={text} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />{text}</li>
        )) : null}
        {showRain ? [["#94a3b8", "ฝน: ไม่มี"], ["#2a9db0", "ฝน: มีฝน"], ["#d97706", "ฝน: ≥ 35.1 มม./วัน"], ["#7f1d1d", "ฝน: ≥ 90.1 มม./วัน"]].map(([color, text]) => (
          <li key={text} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />{text}</li>
        )) : null}
      </ul>
    </div>
  );
}
