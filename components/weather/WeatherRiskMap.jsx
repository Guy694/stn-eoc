"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CircleMarker, GeoJSON, MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import { getMapBaseLayer } from "@/lib/mapBaseLayers";
import { RISK_META } from "@/lib/weatherRiskConfig";

const CENTER = [6.86, 99.98];

function riskMeta(level) {
  return RISK_META[level] || RISK_META.normal;
}

function normalizeName(value) {
  return String(value || "").replace(/^อ(\.|ำเภอ)\s*/, "").replace(/\s+/g, "").trim();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function districtLabelIcon(district, selected) {
  const meta = riskMeta(district.risk_level);
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;font-family:var(--font-kanit, sans-serif)">
      <span style="white-space:nowrap;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:800;color:#fff;background:${meta.color};box-shadow:0 2px 6px rgba(0,0,0,.35);${selected ? "outline:2px solid #fff;" : ""}">${escapeHtml(district.district_name)} ${Number(district.temperature)}°</span>
      <span style="white-space:nowrap;border-radius:6px;padding:0 6px;font-size:11px;font-weight:700;color:#0f172a;background:rgba(255,255,255,.9)">ฝน 24 ชม. ${Number(district.rainfall_24h)} มม.</span>
    </div>`
  });
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target?.latitude && target?.longitude) {
      map.flyTo([target.latitude, target.longitude], Math.max(map.getZoom(), target.zoom || 11), { duration: 0.8 });
    }
  }, [map, target]);
  return null;
}

export default function WeatherRiskMap({
  districts = [],
  selectedDistrictId,
  onSelectDistrict,
  baseMap = "street",
  extraTileLayers = [],
  userLocation,
  flyTarget
}) {
  const [boundaries, setBoundaries] = useState([]);
  const baseLayer = getMapBaseLayer(baseMap);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/stn-eoc/api/common/area-polygons?level=district", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => setBoundaries(Array.isArray(json?.data) ? json.data : []))
      .catch((error) => {
        if (error.name !== "AbortError") console.error("Error loading district boundaries:", error);
      });
    return () => controller.abort();
  }, []);

  const districtByName = useMemo(
    () => new Map(districts.map((district) => [normalizeName(district.district_name), district])),
    [districts]
  );

  return (
    <MapContainer center={CENTER} zoom={10} minZoom={7} zoomControl={false} style={{ height: "100%", width: "100%" }} className="z-0">
      <ZoomControl position="bottomright" />
      <TileLayer attribution={baseLayer.attribution} url={baseLayer.url} />
      {extraTileLayers.map((layer) => (
        <TileLayer
          key={`${layer.key}-${layer.url}`}
          attribution={layer.attribution}
          url={layer.url}
          opacity={layer.opacity ?? 0.7}
          maxNativeZoom={layer.maxNativeZoom}
          zIndex={layer.zIndex ?? 300}
        />
      ))}

      {boundaries.map((item, index) => {
        if (!item.geojson) return null;
        const district = districtByName.get(normalizeName(item.name));
        const meta = riskMeta(district?.risk_level);
        const selected = district && String(district.district_id) === String(selectedDistrictId);
        return (
          <GeoJSON
            key={`risk-${item.code || item.name || index}-${district?.risk_level || "none"}-${selected ? "sel" : ""}`}
            data={item.geojson}
            style={{
              // ข้อมูลอำเภอประกอบจากขอบเขตหมู่บ้าน จึงใช้เส้นบางเพื่อไม่ให้แผนที่รก
              color: selected ? "#0f172a" : "#334155",
              weight: selected ? 2.5 : 0.6,
              opacity: selected ? 0.95 : 0.45,
              fillColor: district ? meta.color : "#94a3b8",
              fillOpacity: selected ? 0.42 : 0.28
            }}
            eventHandlers={{
              click: () => district && onSelectDistrict?.(district.district_id)
            }}
          />
        );
      })}

      {districts.map((district) => (
        <Marker
          key={`label-${district.district_id}-${district.risk_level}-${String(district.district_id) === String(selectedDistrictId)}`}
          position={[district.latitude, district.longitude]}
          icon={districtLabelIcon(district, String(district.district_id) === String(selectedDistrictId))}
          interactive={false}
        />
      ))}

      {userLocation && (
        <CircleMarker
          center={[userLocation.latitude, userLocation.longitude]}
          radius={8}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}
        >
          <Tooltip direction="top" offset={[0, -8]} permanent>ตำแหน่งของคุณ</Tooltip>
        </CircleMarker>
      )}

      <FlyTo target={flyTarget} />
    </MapContainer>
  );
}
