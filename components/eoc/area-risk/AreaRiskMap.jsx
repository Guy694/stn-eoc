"use client";

// แผนที่ตำบลระบายสีตามระดับความเสี่ยง (โหลดผ่าน next/dynamic ssr:false)
import { useEffect, useMemo, useRef } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

function FitOnce({ geometry }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !geometry?.features?.length) return;
    done.current = true;
    const bounds = L.geoJSON(geometry).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [12, 12] });
  }, [geometry, map]);
  return null;
}

export default function AreaRiskMap({ geometry, colorOf, labelOf, selectedKey, onSelect, version }) {
  const style = useMemo(() => (feature) => {
    const key = feature.properties.key;
    const selected = key === selectedKey;
    return { color: selected ? "#0c2f4a" : "#ffffff", weight: selected ? 3 : 1, fillColor: colorOf(key), fillOpacity: selected ? 0.85 : 0.65 };
  }, [colorOf, selectedKey]);

  return (
    <MapContainer center={[6.75, 99.95]} zoom={9} className="h-full w-full" scrollWheelZoom>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
      <FitOnce geometry={geometry} />
      <GeoJSON
        key={`${version}-${selectedKey || ""}`}
        data={geometry}
        style={style}
        onEachFeature={(feature, layer) => {
          layer.bindTooltip(labelOf(feature.properties.key), { sticky: true });
          layer.on("click", () => onSelect(feature.properties.key));
        }}
      />
    </MapContainer>
  );
}
