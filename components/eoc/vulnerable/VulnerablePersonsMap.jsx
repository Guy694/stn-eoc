"use client";

// แผนที่กลุ่มเปราะบางรายบุคคล (เฉพาะเจ้าหน้าที่)
// หมุด: สี/สัญลักษณ์ = สถานะการช่วยเหลือ, ป้ายเล็ก = ประเภท | ชั้นข้อมูล: พื้นที่น้ำท่วมล่าสุด, ศูนย์พักพิง (ที่ว่าง)
// ต้องโหลดผ่าน next/dynamic (ssr: false)
import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { GeoJSON, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { pinHtml, pinLabel, shelterPinHtml } from "@/components/eoc/vulnerable/vulnerablePins";
import { caseStatus, typeMeta } from "@/lib/vulnerablePersons";
import { capabilityLabel, parseCapabilities, shelterTypeMeta } from "@/lib/shelterSuitability";

const SATUN_CENTER = [6.75, 99.95];

const PIN_CSS = `
.vp-pin{position:relative;transform-origin:50% 100%;filter:drop-shadow(0 2px 2px rgba(15,23,42,.35))}
.vp-pin svg{display:block}
.vp-pin--selected{z-index:2}
.vp-pin--urgent::before{content:"";position:absolute;left:50%;top:38%;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:9999px;background:rgba(220,38,38,.35);animation:vp-pulse 1.6s ease-out infinite}
.vp-tag{position:absolute;left:62%;top:-6px;white-space:nowrap;border-radius:9999px;background:#fff;color:#0f172a;font:700 10px/1 var(--font-kanit),system-ui,sans-serif;padding:2px 5px;box-shadow:0 0 0 1px #94a3b8}
.vp-tag--priority{color:#b91c1c;box-shadow:0 0 0 1.5px #dc2626}
.vp-shelter{position:relative;width:26px;height:26px;filter:drop-shadow(0 2px 2px rgba(15,23,42,.35))}
.vp-shelter svg{display:block}
.vp-shelter__free{position:absolute;left:50%;top:24px;transform:translateX(-50%);white-space:nowrap;border-radius:6px;background:#fff;color:var(--c);font:800 10px/1 var(--font-kanit),system-ui,sans-serif;padding:2px 4px;box-shadow:0 0 0 1px var(--c)}
.vp-shelter--full .vp-shelter__free{background:#fee2e2;color:#b91c1c;box-shadow:0 0 0 1px #dc2626}
@keyframes vp-pulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(1.9);opacity:0}}
@media (prefers-reduced-motion: reduce){.vp-pin--urgent::before{animation:none;opacity:.5}}
`;

const FLOOD_STYLE = {
  severe: { color: "#b91c1c", fillColor: "#ef4444", fillOpacity: 0.35, weight: 1 },
  moderate: { color: "#c2410c", fillColor: "#f97316", fillOpacity: 0.28, weight: 1 },
  mild: { color: "#0369a1", fillColor: "#38bdf8", fillOpacity: 0.25, weight: 1 }
};
const FLOOD_LABEL = { severe: "น้ำท่วมรุนแรง", moderate: "น้ำท่วมปานกลาง", mild: "น้ำท่วมเล็กน้อย" };

function iconFor(person, selected) {
  const size = selected ? 38 : 30;
  const height = Math.round(size * 1.33);
  return L.divIcon({ className: "", html: pinHtml(person, { selected }), iconSize: [size, height], iconAnchor: [size / 2, height], tooltipAnchor: [0, -height + 6] });
}

function shelterIcon(shelter) {
  const type = shelterTypeMeta(shelter.shelter_type);
  const capacity = Number(shelter.capacity) || 0;
  const free = capacity ? capacity - (Number(shelter.occupancy) || 0) : null;
  return L.divIcon({
    className: "",
    html: shelterPinHtml({ color: type.color, free, active: Number(shelter.active) === 1, full: free !== null && free <= 0 }),
    iconSize: [26, 26], iconAnchor: [13, 13], tooltipAnchor: [0, -12]
  });
}

// ซูมให้เห็นหมุดทั้งหมดเมื่อชุดที่กรองเปลี่ยน (ไม่ซูมตามทุกครั้งที่โหลดข้อมูลใหม่)
function FitToPeople({ people, fitKey }) {
  const map = useMap();
  const last = useRef(null);
  useEffect(() => {
    if (last.current === fitKey) return;
    last.current = fitKey;
    const points = people.map((person) => [person.location.lat, person.location.lng]);
    // ขนาดแผนที่อาจยังไม่นิ่งตอนโหลด (โดยเฉพาะจอมือถือ) — วัดใหม่ก่อนซูม
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (points.length === 1) map.setView(points[0], 15);
      else if (points.length > 1) map.fitBounds(points, { padding: [36, 36], maxZoom: 15 });
    }, 50);
    return () => clearTimeout(timer);
  }, [people, fitKey, map]);
  return null;
}

function FlyToSelected({ person }) {
  const map = useMap();
  useEffect(() => {
    if (person?.location) map.flyTo([person.location.lat, person.location.lng], Math.max(map.getZoom(), 15), { duration: 0.5 });
  }, [person, map]);
  return null;
}

export default function VulnerablePersonsMap({ people, selectedId, onSelect, fitKey, floodAreas = [], shelters = [], layers = {} }) {
  const mapped = useMemo(() => people.filter((person) => person.location), [people]);
  const selected = mapped.find((person) => person.id === selectedId) || null;
  // วาดหมุดที่ยังไม่จัดการทับหมุดที่จัดการแล้ว
  const ordered = useMemo(() => {
    const rank = { pending: 2, progress: 1, done: 0 };
    return [...mapped].sort((a, b) => rank[caseStatus(a.status).group] - rank[caseStatus(b.status).group]);
  }, [mapped]);
  const floodFeatures = useMemo(() => ({
    type: "FeatureCollection",
    features: floodAreas.filter((area) => area.geometry && FLOOD_STYLE[area.flood_level]).map((area) => ({
      type: "Feature", geometry: area.geometry, properties: { level: area.flood_level, name: area.villname, tambon: area.tambon, people: area.affected_population }
    }))
  }), [floodAreas]);
  const visibleShelters = useMemo(() => shelters.filter((shelter) => shelter.lat != null && (layers.allShelters || Number(shelter.active) === 1)), [shelters, layers.allShelters]);

  return (
    <>
      <style>{PIN_CSS}</style>
      <MapContainer center={SATUN_CENTER} zoom={9} className="h-full w-full" scrollWheelZoom>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        {layers.flood && floodFeatures.features.length ? (
          <GeoJSON
            key={`flood-${floodFeatures.features.length}`}
            data={floodFeatures}
            style={(feature) => FLOOD_STYLE[feature.properties.level]}
            onEachFeature={(feature, layer) => layer.bindTooltip(`${feature.properties.name || ""} ต.${feature.properties.tambon || ""} — ${FLOOD_LABEL[feature.properties.level]}`, { sticky: true })}
          />
        ) : null}
        <FitToPeople people={mapped} fitKey={fitKey} />
        <FlyToSelected person={selected} />
        {layers.shelters ? visibleShelters.map((shelter) => {
          const type = shelterTypeMeta(shelter.shelter_type);
          const capacity = Number(shelter.capacity) || 0;
          const occupancy = Number(shelter.occupancy) || 0;
          const caps = parseCapabilities(shelter.capabilities);
          return (
            <Marker key={`shelter-${shelter.id}`} position={[Number(shelter.lat), Number(shelter.lon)]} icon={shelterIcon(shelter)} zIndexOffset={-200} title={shelter.name}>
              <Tooltip direction="top">
                <span className="font-bold">{shelter.name}</span>
                <span className="block text-xs">{type.label}{Number(shelter.active) === 1 ? "" : " • ยังไม่เปิดในเหตุการณ์นี้"}</span>
                {capacity ? <span className="block text-xs">ผู้พักพิง {occupancy}/{capacity} • ว่าง {Math.max(capacity - occupancy, 0)}</span> : null}
                {shelter.vulnerable_moved ? <span className="block text-xs">กลุ่มเปราะบางที่ย้ายเข้า {shelter.vulnerable_moved} คน</span> : null}
                {caps.length ? <span className="block max-w-[14rem] whitespace-normal text-xs">มี: {caps.map(capabilityLabel).join(", ")}</span> : null}
              </Tooltip>
            </Marker>
          );
        }) : null}
        {ordered.map((person) => {
          const isSelected = person.id === selectedId;
          return (
            <Marker
              key={`${person.id}-${person.status}-${isSelected ? 1 : 0}`}
              position={[person.location.lat, person.location.lng]}
              icon={iconFor(person, isSelected)}
              title={pinLabel(person)}
              alt={pinLabel(person)}
              keyboard
              zIndexOffset={isSelected ? 1000 : caseStatus(person.status).group === "pending" ? 500 : 0}
              eventHandlers={{ click: () => onSelect(person.id) }}
            >
              <Tooltip direction="top">
                <span className="font-bold">{person.name}</span>
                <span className="block text-xs">{typeMeta(person.vulnerable_type)?.label} • {caseStatus(person.status).label}</span>
                {person.in_flood_area ? <span className="block text-xs font-bold text-red-700">บ้านอยู่ในพื้นที่น้ำท่วม</span> : null}
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </>
  );
}
