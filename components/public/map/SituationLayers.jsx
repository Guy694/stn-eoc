"use client";

// ชั้นข้อมูล "สถานการณ์ตอนนี้" ที่ย้ายมาจากหน้าแผนที่สถานการณ์ — วางไว้ใน MapContainer ใดก็ได้
// สถานพยาบาล · เส้นทาง/ถนน (รายงานการสัญจรที่ตรวจแล้ว) · ระดับน้ำ–ตลิ่ง · ฝนวัดจริง · กล้อง CCTV ปภ. · เส้นทางน้ำ/คลอง · ขอบเขตตำบล · ขอบเขตอำเภอ
// โหลดข้อมูลเฉพาะชั้นที่เปิด และโหลดครั้งเดียว (สถานีฝน/ระดับน้ำ ดึงใหม่ทุก 10 นาที)
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { GeoJSON, Marker, Pane, Popup, Tooltip } from "react-leaflet";
import AppIcon from "@/components/icons/AppIcon";
import HealthFacilityPopup from "@/components/public/map/HealthFacilityPopup";
import CitizenPointPopup from "@/components/public/map/CitizenPointPopup";
import RainStationLayer from "@/components/weather/RainStationLayer";
import CctvLayer from "@/components/weather/CctvLayer";
import { facilityTypeInfo, markerTone } from "@/lib/healthFacilityStatus";
import { healthDivIconOptions } from "@/lib/shelterMarker";
import { escapeHtml as esc } from "@/lib/escapeHtml";

export const SITUATION_LAYER_KEYS = ["hospitals", "traffic", "rainStations", "cctv", "waterways", "tambon", "district"];

const icon = (name, className) => renderToStaticMarkup(<AppIcon icon={name} className={className} strokeWidth={2.5} />);
const POPUP_PAN = typeof window !== "undefined" && window.innerWidth >= 768 ? [392, 80] : [16, 70];

function hospitalIcon(facility) {
  const type = facilityTypeInfo(facility?.typecode);
  return L.divIcon(healthDivIconOptions({ level: type.level, statusColor: markerTone(facility).color, name: facility?.name }));
}

const TRAFFIC = {
  passable: { bg: "#10B981", border: "#059669", icon: "checkCircle" },
  difficult: { bg: "#F59E0B", border: "#D97706", icon: "alert" },
  impassable: { bg: "#EF4444", border: "#DC2626", icon: "xCircle" }
};
function trafficIcon(status) {
  const tone = TRAFFIC[status] || TRAFFIC.impassable;
  return L.divIcon({
    className: "custom-traffic-icon",
    html: `<div style="background:${tone.bg};width:36px;height:36px;border-radius:50%;border:3px solid ${tone.border};box-shadow:0 3px 10px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff">${icon(tone.icon, "h-5 w-5 text-white")}</div>`,
    iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -18]
  });
}

function waterwayStyle(feature) {
  const type = feature?.properties?.waterway;
  const main = type === "river" || type === "canal";
  return { color: main ? "#0369A1" : "#0EA5E9", weight: main ? 2.4 : 1.4, opacity: main ? 0.95 : 0.72, dashArray: feature?.properties?.intermittent ? "5, 6" : null };
}

async function getJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

const STATIC_SOURCES = {
  hospitals: () => getJson("/stn-eoc/api/common/health-facilities").then((json) => json.data || []),
  traffic: () => getJson("/stn-eoc/api/public/verified-incidents?disaster_type=flood&limit=500").then((json) => (json.data || []).filter((item) => item.report_type === "traffic_report")),
  waterways: () => getJson("/stn-eoc/api/common/waterways").then((json) => (json.success ? json.data : null)),
  tambon: () => getJson("/stn-eoc/api/common/area-polygons?level=tambon").then((json) => json.data || []),
  district: () => getJson("/stn-eoc/api/common/area-polygons?level=district").then((json) => json.data || [])
};

/** ข้อมูลที่ไม่เปลี่ยนบ่อย: โหลดครั้งแรกที่เปิดชั้น แล้วเก็บไว้ */
function useStaticLayers(layers) {
  const [data, setData] = useState({});
  const requested = useRef(new Set());
  const enabledKey = Object.keys(STATIC_SOURCES).filter((key) => layers?.[key]).join(",");
  useEffect(() => {
    let alive = true;
    for (const key of enabledKey ? enabledKey.split(",") : []) {
      if (requested.current.has(key)) continue;
      requested.current.add(key);
      STATIC_SOURCES[key]()
        .then((value) => { if (alive) setData((current) => ({ ...current, [key]: value })); })
        .catch(() => { requested.current.delete(key); });
    }
    return () => { alive = false; };
  }, [enabledKey]);
  return data;
}

/** สถานี ThaiWater: ค่าปัจจุบัน ดึงใหม่ทุก 10 นาทีขณะเปิดชั้น */
function useStationFeed(enabled, url) {
  const [stations, setStations] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const load = () => getJson(url).then((json) => { if (alive && json?.success) setStations(json.stations || []); }).catch(() => {});
    load();
    const timer = window.setInterval(load, 10 * 60 * 1000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [enabled, url]);
  return enabled ? stations : [];
}

function centerOf(geojson) {
  const coords = [];
  const walk = (value) => { if (typeof value?.[0] === "number") coords.push(value); else value?.forEach?.(walk); };
  walk(geojson?.coordinates);
  if (!coords.length) return null;
  return [coords.reduce((s, c) => s + c[1], 0) / coords.length, coords.reduce((s, c) => s + c[0], 0) / coords.length];
}

function label(text, type) {
  const style = type === "district"
    ? "font-size:12px;font-weight:700;color:#1E3A8A;background:rgba(255,255,255,.92);padding:1px 6px;border-radius:4px;border:1.5px solid #1E3A8A"
    : "font-size:10px;font-weight:600;color:#047857;background:rgba(255,255,255,.85);padding:1px 4px;border-radius:3px;border:1px solid #10B981";
  return L.divIcon({ className: "label-icon", html: `<div style="${style};white-space:nowrap;pointer-events:none;font-family:var(--font-kanit)">${esc(text)}</div>`, iconSize: null, iconAnchor: [0, 0] });
}

export default function SituationLayers({ layers = {}, showLabels = true }) {
  const loaded = useStaticLayers(layers);
  const waterStations = useStationFeed(Boolean(layers.hospitals), "/stn-eoc/api/public/dpm-water");
  const rainStations = useStationFeed(Boolean(layers.rainStations), "/stn-eoc/api/public/rain-stations");
  const data = { ...loaded, rainStations };

  return (
    <>
      {layers.district && (data.district || []).map((item, index) => item.geojson ? (
        <GeoJSON key={`sit-district-${item.code || index}`} data={item.geojson}
          style={{ color: "#111827", weight: 2.5, opacity: 0.9, fillOpacity: 0 }}
          onEachFeature={(_, layer) => layer.bindPopup(`<div style="font-family:var(--font-kanit)"><strong>อ.${esc(item.name)}</strong></div>`)} />
      ) : null)}
      {layers.district && showLabels && (data.district || []).map((item, index) => {
        const center = item.geojson ? centerOf(item.geojson) : null;
        return center ? <Marker key={`sit-district-label-${index}`} position={center} icon={label(`อ.${item.name}`, "district")} interactive={false} /> : null;
      })}

      {layers.tambon && (data.tambon || []).map((item, index) => item.geojson ? (
        <GeoJSON key={`sit-tambon-${item.code || index}`} data={item.geojson}
          style={{ color: "#059669", weight: 1.8, opacity: 0.9, fillOpacity: 0, dashArray: "5, 5" }}
          onEachFeature={(_, layer) => layer.bindPopup(`<div style="font-family:var(--font-kanit)"><strong>ต.${esc(item.name)}</strong><br/>อ.${esc(item.district_name)}</div>`)} />
      ) : null)}

      {layers.waterways && data.waterways?.features?.length ? (
        <GeoJSON key={`sit-waterways-${data.waterways.features.length}`} data={data.waterways} style={waterwayStyle}
          onEachFeature={(feature, layer) => {
            const props = feature.properties || {};
            layer.bindPopup(`<div style="font-family:var(--font-kanit);min-width:160px"><strong>${esc(props.name || props.label || "เส้นทางน้ำ")}</strong><p style="margin:4px 0 0">ประเภท: ${esc(props.label || props.waterway || "-")}</p><p style="margin:4px 0 0">แหล่งข้อมูล: ${esc(props.source || "OpenStreetMap")}</p></div>`);
          }} />
      ) : null}

      <Pane name="situation-rain" style={{ zIndex: 450 }}>
        {layers.rainStations && data.rainStations?.length ? <RainStationLayer stations={data.rainStations} /> : null}
      </Pane>
      {layers.cctv ? <CctvLayer /> : null}

      {layers.traffic && (data.traffic || []).map((incident) => {
        const lat = Number.parseFloat(incident.latitude);
        const lng = Number.parseFloat(incident.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return (
          <Marker key={`sit-traffic-${incident.id}`} position={[lat, lng]} icon={trafficIcon(incident.travel_status)}>
            <Popup maxWidth={260} autoPanPaddingTopLeft={POPUP_PAN}><CitizenPointPopup incident={incident} /></Popup>
          </Marker>
        );
      })}

      {layers.hospitals && (data.hospitals || []).map((facility) => {
        const lat = Number.parseFloat(facility.lat);
        const lng = Number.parseFloat(facility.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const isHospital = facilityTypeInfo(facility.typecode).level === "hospital";
        return (
          <Marker key={`sit-hospital-${facility.id}-${facility.service_status || ""}-${facility.flood_status || ""}`} position={[lat, lng]} icon={hospitalIcon(facility)} zIndexOffset={isHospital ? 400 : 0}>
            {!isHospital && <Tooltip direction="top">{facility.name}</Tooltip>}
            <Popup maxWidth={280} autoPanPaddingTopLeft={POPUP_PAN}>
              <HealthFacilityPopup facility={facility} floodAreas={[]} waterReports={[]} waterStations={waterStations} />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
