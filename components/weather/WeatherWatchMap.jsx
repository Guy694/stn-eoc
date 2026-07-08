"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RISK_META } from "@/lib/weatherWatch";

const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Polygon = dynamic(() => import("react-leaflet").then((mod) => mod.Polygon), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((mod) => mod.Polyline), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Circle = dynamic(() => import("react-leaflet").then((mod) => mod.Circle), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then((mod) => mod.CircleMarker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });

const LAYER_GROUPS = [
  ["district_boundary", "ขอบเขตอำเภอ"],
  ["current_weather", "สภาพอากาศปัจจุบัน"],
  ["current_rain", "ฝนปัจจุบัน"],
  ["rain_24h", "ฝนสะสม 24 ชั่วโมง"],
  ["rain_forecast_3h", "พยากรณ์ฝน 3 ชั่วโมง"],
  ["rain_forecast_24h", "พยากรณ์ฝน 24 ชั่วโมง"],
  ["wind_speed", "ความเร็วลม"],
  ["wind_direction", "ทิศทางลม"],
  ["sea_wave", "คลื่นทะเล"],
  ["rain_gauge", "จุดวัดฝน"],
  ["water_level", "จุดวัดระดับน้ำ"],
  ["flood_risk_area", "พื้นที่เสี่ยงน้ำท่วม"],
  ["landslide_risk_area", "พื้นที่เสี่ยงดินถล่ม"],
  ["shelter", "ศูนย์พักพิง"],
  ["health_facility", "หน่วยบริการสุขภาพ"],
  ["safe_route", "เส้นทางปลอดภัย"],
  ["radar_rain", "Radar Rain"],
  ["satellite_cloud", "Satellite Cloud"]
];

const CENTER = [6.86, 99.98];

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getRiskMeta(level) {
  return RISK_META[level] || RISK_META.normal;
}

function createIcon(label, color, bg = "#ffffff") {
  return L.divIcon({
    className: "weather-watch-icon",
    html: `<div style="
      width: 30px;
      height: 30px;
      border-radius: 999px;
      background: ${bg};
      border: 3px solid ${color};
      color: ${color};
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.22);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 900;
    ">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
}

function labelIcon(text) {
  return L.divIcon({
    className: "weather-district-label",
    html: `<div style="
      transform: translate(-50%, -50%);
      background: rgba(255,255,255,0.9);
      border: 1px solid rgba(15,23,42,0.18);
      border-radius: 8px;
      padding: 3px 7px;
      color: #0f172a;
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
      box-shadow: 0 6px 16px rgba(15,23,42,0.12);
    ">${text}</div>`,
    iconSize: [1, 1],
    iconAnchor: [0, 0]
  });
}

function PopupCard({ district }) {
  const risk = getRiskMeta(district.risk_level);

  return (
    <div className="min-w-[260px] space-y-2 p-1 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500">ชื่อพื้นที่</div>
          <div className="text-lg font-black text-slate-900">อำเภอ{district.district_name}</div>
        </div>
        <span className="rounded-full px-2.5 py-1 text-xs font-black text-white" style={{ backgroundColor: risk.color }}>
          {risk.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Info label="อุณหภูมิ" value={`${district.temperature}°C`} />
        <Info label="ฝน 1 ชม." value={`${district.rainfall_1h} มม.`} />
        <Info label="ฝน 24 ชม." value={`${district.rainfall_24h} มม.`} />
        <Info label="ความชื้น" value={`${district.humidity}%`} />
        <Info label="ลม" value={`${district.wind_speed} กม./ชม.`} />
        <Info label="ทิศทางลม" value={district.wind_direction} />
        <Info label="โอกาสฝน 24 ชม." value={`${district.rain_probability_24h}%`} />
        <Info label="คะแนนเสี่ยง" value={`${district.risk_score}/10`} />
      </div>
      <div className="rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-700">
        <div><b>ความเสี่ยง:</b> น้ำท่วมฉับพลัน / น้ำป่าไหลหลาก / ดินถล่ม</div>
        <div><b>คำแนะนำ:</b> {district.advice}</div>
        <div><b>อัปเดตล่าสุด:</b> {formatDateTime(district.updated_at)} น.</div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-2">
      <div className="font-bold text-slate-500">{label}</div>
      <div className="mt-0.5 font-black text-slate-900">{value}</div>
    </div>
  );
}

export default function WeatherWatchMap({ data }) {
  const [layers, setLayers] = useState(() => (
    Object.fromEntries((data?.weather_map_layers || []).map((layer) => [layer.layer_id, Boolean(layer.is_visible)]))
  ));

  const districts = data?.district_weather || [];
  const points = data?.map_points || {};
  const visible = (key) => Boolean(layers[key]);
  const highRiskDistricts = districts.filter((district) => ["high", "critical"].includes(district.risk_level));

  const seaPolygon = useMemo(() => [[6.48, 99.45], [7.24, 99.45], [7.15, 99.72], [6.55, 99.76]], []);
  const cloudCenter = useMemo(() => [6.95, 100.06], []);

  return (
    <div className="relative h-[620px] min-h-[520px] overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm">
      <MapContainer center={CENTER} zoom={10} minZoom={9} style={{ height: "100%", width: "100%" }} className="z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {districts.map((district) => {
          const risk = getRiskMeta(district.risk_level);
          return (
            <Polygon
              key={district.district_id}
              positions={district.polygon}
              pathOptions={{
                color: visible("district_boundary") ? "#0f172a" : "transparent",
                weight: visible("district_boundary") ? 1.4 : 0,
                fillColor: visible("rain_24h") ? risk.color : "#60a5fa",
                fillOpacity: visible("rain_24h") ? 0.42 : 0.12
              }}
            >
              <Popup>
                <PopupCard district={district} />
              </Popup>
            </Polygon>
          );
        })}

        {districts.map((district) => (
          <Marker
            key={`label-${district.district_id}`}
            position={[district.latitude, district.longitude]}
            icon={labelIcon(district.district_name)}
          />
        ))}

        {visible("current_weather") && districts.map((district) => (
          <Marker
            key={`weather-${district.district_id}`}
            position={[district.latitude + 0.02, district.longitude + 0.02]}
            icon={createIcon("W", getRiskMeta(district.risk_level).color)}
          >
            <Popup>
              <PopupCard district={district} />
            </Popup>
          </Marker>
        ))}

        {(visible("current_rain") || visible("rain_gauge")) && (points.rain_gauges || []).map((gauge) => (
          <CircleMarker
            key={gauge.id}
            center={[gauge.latitude, gauge.longitude]}
            radius={visible("current_rain") ? Math.max(6, Math.min(18, gauge.rainfall_1h / 1.5)) : 7}
            pathOptions={{
              color: getRiskMeta(gauge.risk_level).color,
              fillColor: "#38bdf8",
              fillOpacity: 0.72,
              weight: 2
            }}
          >
            <Popup>
              <div className="space-y-1 p-1 text-sm">
                <div className="font-black">{gauge.name}</div>
                <div>ฝนล่าสุด 1 ชม.: <b>{gauge.rainfall_1h} มม.</b></div>
                <div>ฝนสะสม 24 ชม.: <b>{gauge.rainfall_24h} มม.</b></div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {visible("water_level") && (points.water_levels || []).map((point) => (
          <Marker key={point.id} position={[point.latitude, point.longitude]} icon={createIcon("H", getRiskMeta(point.status).color)}>
            <Popup>
              <div className="space-y-1 p-1 text-sm">
                <div className="font-black">{point.name}</div>
                <div>ระดับน้ำ: <b>{point.level_m} ม.</b></div>
                <div>สถานะ: <b>{getRiskMeta(point.status).label}</b></div>
              </div>
            </Popup>
          </Marker>
        ))}

        {visible("flood_risk_area") && highRiskDistricts.map((district) => (
          <Circle
            key={`flood-risk-${district.district_id}`}
            center={[district.latitude, district.longitude]}
            radius={district.risk_level === "critical" ? 15000 : 10500}
            pathOptions={{ color: "#0284c7", fillColor: "#38bdf8", fillOpacity: 0.12, weight: 1.2 }}
          />
        ))}

        {visible("landslide_risk_area") && districts.filter((district) => ["high", "critical"].includes(district.landslide_risk)).map((district) => (
          <Circle
            key={`landslide-risk-${district.district_id}`}
            center={[district.latitude - 0.02, district.longitude + 0.02]}
            radius={9000}
            pathOptions={{ color: "#92400e", fillColor: "#f59e0b", fillOpacity: 0.14, weight: 1.2 }}
          />
        ))}

        {visible("shelter") && (points.shelters || []).map((point) => (
          <Marker key={point.id} position={[point.latitude, point.longitude]} icon={createIcon("S", "#2563eb")}>
            <Popup><b>{point.name}</b></Popup>
          </Marker>
        ))}

        {visible("health_facility") && (points.health_facilities || []).map((point) => (
          <Marker key={point.id} position={[point.latitude, point.longitude]} icon={createIcon("+", "#16a34a")}>
            <Popup><b>{point.name}</b></Popup>
          </Marker>
        ))}

        {visible("safe_route") && (points.safe_routes || []).map((route) => (
          <Polyline key={route.id} positions={route.coordinates} pathOptions={{ color: "#16a34a", weight: 5, opacity: 0.8, dashArray: "8 8" }}>
            <Popup><b>{route.name}</b></Popup>
          </Polyline>
        ))}

        {visible("wind_speed") && districts.map((district) => (
          <CircleMarker key={`wind-${district.district_id}`} center={[district.latitude - 0.035, district.longitude + 0.028]} radius={7} pathOptions={{ color: "#7c3aed", fillColor: "#ddd6fe", fillOpacity: 0.8 }}>
            <Popup>{district.district_name}: ลม {district.wind_speed} กม./ชม.</Popup>
          </CircleMarker>
        ))}

        {visible("wind_direction") && districts.map((district) => (
          <Marker key={`wind-dir-${district.district_id}`} position={[district.latitude - 0.055, district.longitude + 0.028]} icon={createIcon("↙", "#7c3aed", "#f5f3ff")}>
            <Popup>{district.district_name}: {district.wind_direction}</Popup>
          </Marker>
        ))}

        {visible("sea_wave") && (
          <Polygon positions={seaPolygon} pathOptions={{ color: "#0369a1", fillColor: "#0ea5e9", fillOpacity: 0.18, weight: 2 }}>
            <Popup>เฝ้าระวังคลื่นลมแรงบริเวณทะเลอันดามัน</Popup>
          </Polygon>
        )}

        {visible("rain_forecast_3h") && (
          <Circle center={[6.82, 99.86]} radius={24000} pathOptions={{ color: "#f97316", fillColor: "#fb923c", fillOpacity: 0.16, weight: 1.5 }}>
            <Popup>พยากรณ์ฝน 3 ชั่วโมง: ฝนปานกลางถึงหนัก</Popup>
          </Circle>
        )}

        {visible("rain_forecast_24h") && (
          <Circle center={[6.98, 100.04]} radius={36000} pathOptions={{ color: "#dc2626", fillColor: "#ef4444", fillOpacity: 0.12, weight: 1.5 }}>
            <Popup>พยากรณ์ฝน 24 ชั่วโมง: พื้นที่เสี่ยงฝนหนัก</Popup>
          </Circle>
        )}

        {visible("radar_rain") && (
          <Circle center={[6.86, 99.9]} radius={48000} pathOptions={{ color: "#0891b2", fillColor: "#22d3ee", fillOpacity: 0.12, weight: 1.5 }}>
            <Popup>Radar Rain mock overlay</Popup>
          </Circle>
        )}

        {visible("satellite_cloud") && (
          <Circle center={cloudCenter} radius={62000} pathOptions={{ color: "#64748b", fillColor: "#cbd5e1", fillOpacity: 0.22, weight: 1 }}>
            <Popup>Satellite Cloud mock overlay</Popup>
          </Circle>
        )}
      </MapContainer>

      <div className="absolute left-3 top-3 z-[900] w-[250px] max-w-[calc(100%-1.5rem)] rounded-lg border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-black text-slate-900">ชั้นข้อมูลแผนที่</div>
            <div className="text-[11px] font-semibold text-slate-500">เปิด/ปิดข้อมูลเฝ้าระวัง</div>
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
            onClick={() => setLayers(Object.fromEntries(LAYER_GROUPS.map(([key]) => [key, false])))}
          >
            ล้าง
          </button>
        </div>
        <div className="grid max-h-[310px] gap-1 overflow-y-auto pr-1">
          {LAYER_GROUPS.map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={visible(key)}
                onChange={(event) => setLayers((current) => ({ ...current, [key]: event.target.checked }))}
                className="h-4 w-4 accent-blue-700"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="absolute bottom-3 left-3 z-[900] rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur">
        <div className="mb-2 font-black text-slate-900">Legend</div>
        <div className="grid gap-1.5">
          {Object.entries(RISK_META).map(([key, meta]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="h-3 w-6 rounded" style={{ backgroundColor: meta.color }} />
              <span className="font-bold text-slate-700">{meta.label}</span>
            </div>
          ))}
          <div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-sky-400" /> จุดวัดฝน</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-blue-700" /> จุดวัดระดับน้ำ</div>
          <div className="flex items-center gap-2"><span className="h-1 w-6 rounded bg-emerald-500" /> เส้นทางปลอดภัย</div>
        </div>
      </div>
    </div>
  );
}
