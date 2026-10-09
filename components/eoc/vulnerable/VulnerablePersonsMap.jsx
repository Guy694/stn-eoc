"use client";

// แผนที่กลุ่มเปราะบางรายบุคคล (เฉพาะเจ้าหน้าที่) — หมุดสี/สัญลักษณ์ตามสถานะการช่วยเหลือ
// ต้องโหลดผ่าน next/dynamic (ssr: false)
import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { pinHtml, pinLabel } from "@/components/eoc/vulnerable/vulnerablePins";
import { caseStatus, typeMeta } from "@/lib/vulnerablePersons";

const SATUN_CENTER = [6.75, 99.95];

const PIN_CSS = `
.vp-pin{position:relative;transform-origin:50% 100%;filter:drop-shadow(0 2px 2px rgba(15,23,42,.35))}
.vp-pin svg{display:block}
.vp-pin--selected{z-index:2}
.vp-pin--urgent::before{content:"";position:absolute;left:50%;top:38%;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:9999px;background:rgba(220,38,38,.35);animation:vp-pulse 1.6s ease-out infinite}
@keyframes vp-pulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(1.9);opacity:0}}
@media (prefers-reduced-motion: reduce){.vp-pin--urgent::before{animation:none;opacity:.5}}
`;

function iconFor(person, selected) {
  const size = selected ? 38 : 30;
  const height = Math.round(size * 1.33);
  return L.divIcon({ className: "", html: pinHtml(person, { selected }), iconSize: [size, height], iconAnchor: [size / 2, height], tooltipAnchor: [0, -height + 6] });
}

// ซูมให้เห็นหมุดทั้งหมดเมื่อชุดที่กรองเปลี่ยน (ไม่ซูมตามทุกครั้งที่โหลดข้อมูลใหม่)
function FitToPeople({ people, fitKey }) {
  const map = useMap();
  const last = useRef(null);
  useEffect(() => {
    if (last.current === fitKey) return;
    last.current = fitKey;
    const points = people.map((person) => [person.location.lat, person.location.lng]);
    if (points.length === 1) map.setView(points[0], 15);
    else if (points.length > 1) map.fitBounds(points, { padding: [36, 36], maxZoom: 15 });
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

export default function VulnerablePersonsMap({ people, selectedId, onSelect, fitKey }) {
  const mapped = useMemo(() => people.filter((person) => person.location), [people]);
  const selected = mapped.find((person) => person.id === selectedId) || null;
  // วาดหมุดที่ยังไม่จัดการทับหมุดที่จัดการแล้ว
  const ordered = useMemo(() => {
    const rank = { pending: 2, progress: 1, done: 0 };
    return [...mapped].sort((a, b) => rank[caseStatus(a.status).group] - rank[caseStatus(b.status).group]);
  }, [mapped]);

  return (
    <>
      <style>{PIN_CSS}</style>
      <MapContainer center={SATUN_CENTER} zoom={9} className="h-full w-full" scrollWheelZoom>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        <FitToPeople people={mapped} fitKey={fitKey} />
        <FlyToSelected person={selected} />
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
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </>
  );
}
