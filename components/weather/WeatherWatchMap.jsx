"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RISK_META } from "@/lib/weatherWatch";
import { getMapBaseLayer, getMapOverlayLayer, MAP_BASE_LAYERS } from "@/lib/mapBaseLayers";

const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import("react-leaflet").then((mod) => mod.GeoJSON), { ssr: false });
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
  ["hillshade", "เงาภูมิประเทศ/ความสูง"]
];

const CENTER = [6.86, 99.98];
const DISTRICT_BOUNDARY_STYLE = { color: "#111827", weight: 3, opacity: 0.95, fillOpacity: 0, interactive: true };

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
      </div>
      <div className="rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-700">
       
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
  const [layers, setLayers] = useState({});
  const [baseMap, setBaseMap] = useState("street");
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [districtBoundaries, setDistrictBoundaries] = useState([]);

  const districts = useMemo(() => data?.district_weather || [], [data?.district_weather]);
  const points = data?.map_points || {};
  const defaultLayers = Object.fromEntries((data?.weather_map_layers || []).map((layer) => [layer.layer_id, Boolean(layer.is_visible)]));
  const visible = (key) => Object.hasOwn(layers, key) ? Boolean(layers[key]) : Boolean(defaultLayers[key]);
  const selectedBaseLayer = getMapBaseLayer(baseMap);
  const hillshadeLayer = getMapOverlayLayer("hillshade");

  useEffect(() => {
    let ignore = false;

    async function loadDistrictBoundaries() {
      try {
        const response = await fetch("/stn-eoc/api/common/area-polygons?level=district");
        if (!response.ok) {
          console.error("Failed to fetch district boundaries:", response.status);
          return;
        }

        const result = await response.json();
        if (!ignore) {
          setDistrictBoundaries(Array.isArray(result?.data) ? result.data : []);
        }
      } catch (error) {
        console.error("Error fetching district boundaries:", error);
      }
    }

    loadDistrictBoundaries();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="relative h-[620px] min-h-[520px] overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm">
      <MapContainer center={CENTER} zoom={10} minZoom={9} style={{ height: "100%", width: "100%" }} className="z-0">
        <TileLayer
          attribution={selectedBaseLayer.attribution}
          url={selectedBaseLayer.url}
        />
        {visible("hillshade") && hillshadeLayer && (
          <TileLayer
            attribution={hillshadeLayer.attribution}
            url={hillshadeLayer.url}
            opacity={hillshadeLayer.opacity}
          />
        )}

        {visible("district_boundary") && districtBoundaries.map((item, index) => {
          if (!item.geojson) return null;
          return (
            <GeoJSON
              key={`district-boundary-${item.code || item.name || index}`}
              data={item.geojson}
              style={DISTRICT_BOUNDARY_STYLE}
              onEachFeature={(feature, layer) => {
                layer.bindPopup(`<div class="text-center" style="font-family: var(--font-kanit)"><strong class="text-lg">อ.${item.name}</strong></div>`);
              }}
            />
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

        {visible("current_rain") && (points.rain_gauges || []).map((gauge) => (
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

        {visible("rain_forecast_3h") && points.forecast_3h && (
          <Circle center={points.forecast_3h.center} radius={points.forecast_3h.radius} pathOptions={{ color: "#f97316", fillColor: "#fb923c", fillOpacity: 0.16, weight: 1.5 }}>
            <Popup>พยากรณ์ฝน 3 ชั่วโมง: {points.forecast_3h.district_name} {points.forecast_3h.rainfall} มม.</Popup>
          </Circle>
        )}

        {visible("rain_forecast_24h") && points.forecast_24h && (
          <Circle center={points.forecast_24h.center} radius={points.forecast_24h.radius} pathOptions={{ color: "#dc2626", fillColor: "#ef4444", fillOpacity: 0.12, weight: 1.5 }}>
            <Popup>พยากรณ์ฝน 24 ชั่วโมง: {points.forecast_24h.district_name} {points.forecast_24h.rainfall} มม.</Popup>
          </Circle>
        )}
      </MapContainer>

      {showLayerPanel ? (
        <div className="absolute left-3 top-3 z-[900] w-[255px] max-w-[calc(100%-1.5rem)] rounded-xl border border-blue-100 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-black text-blue-900">ชั้นข้อมูลแผนที่</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs font-bold text-blue-700"
                onClick={() => setLayers({})}
              >
                ค่าเริ่มต้น
              </button>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[11px] font-black text-slate-500 hover:bg-slate-100"
                onClick={() => setShowLayerPanel(false)}
              >
                ซ่อน
              </button>
            </div>
          </div>
          <label className="mb-2 block">
            <span className="mb-1 block text-xs font-black text-blue-800">แผนที่พื้นหลัง</span>
            <select
              value={baseMap}
              onChange={(event) => setBaseMap(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-400"
            >
              {Object.entries(MAP_BASE_LAYERS).map(([key, layer]) => (
                <option key={key} value={key}>{layer.label}</option>
              ))}
            </select>
          </label>
          <div className="grid max-h-[330px] gap-1 overflow-y-auto pr-1">
            {LAYER_GROUPS.map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-xs font-semibold text-slate-700 hover:bg-blue-50">
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
      ) : (
        <button
          type="button"
          onClick={() => setShowLayerPanel(true)}
          className="absolute right-3 top-3 z-[900] rounded-lg border border-blue-100 bg-white/95 px-3 py-2 text-xs font-black text-blue-700 shadow-lg backdrop-blur hover:bg-blue-50"
        >
          แสดงชั้นข้อมูล
        </button>
      )}

      <div className="absolute bottom-3 left-3 z-[900] rounded-xl border border-blue-100 bg-white/95 p-3 text-xs shadow-lg backdrop-blur">
        <div className="mb-2 text-sm font-black text-blue-900">คำอธิบายสัญลักษณ์</div>
        <div className="grid gap-1.5">
          {Object.entries(RISK_META).map(([key, meta]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="h-3 w-6 rounded" style={{ backgroundColor: meta.color }} />
              <span className="font-bold text-slate-700">{meta.label}</span>
            </div>
          ))}
          <div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-sky-400" /> ข้อมูลฝนจาก Open-Meteo</div>
        </div>
      </div>
    </div>
  );
}
