"use client";

// ชั้นข้อมูลเพิ่มบนแผนที่สถานการณ์เจ้าหน้าที่ (/analytics) — วางใน MapContainer ของ WeatherRiskMap
// หมุดกลุ่มเปราะบาง: แบบเดียวกับหน้าทะเบียน (สี = กลุ่มสี, สัญลักษณ์ = สถานะการช่วยเหลือ)
// คำขอความช่วยเหลือ: วงกลมมีขอบ สีตามสถานะเรื่อง
import { useMemo } from "react";
import L from "leaflet";
import { CircleMarker, Marker, Pane, Tooltip } from "react-leaflet";
import { PIN_CSS, pinHtml, pinKey, pinLabel, spreadApproxPositions } from "@/components/eoc/vulnerable/vulnerablePins";
import { caseStatus, typeMeta } from "@/lib/vulnerablePersons";
import { incidentStatusMeta } from "@/lib/incidentStatuses";
import { HELP_STATUS_COLORS } from "@/lib/staffSituationMap";

const ICONS = new Map();
function personIcon(person, selected) {
  const key = pinKey(person, { selected });
  if (!ICONS.has(key)) {
    const size = selected ? 38 : 30;
    const height = Math.round(size * 1.33);
    ICONS.set(key, L.divIcon({ className: "", html: pinHtml(person, { selected }), iconSize: [size, height], iconAnchor: [size / 2, height], tooltipAnchor: [0, -height + 6] }));
  }
  return ICONS.get(key);
}

export default function StaffMapLayers({ people = [], help = [], selected = null, onSelect }) {
  const spread = useMemo(() => spreadApproxPositions(people), [people]);
  // วาดคนที่ยังไม่จัดการทับคนที่จัดการแล้ว
  const ordered = useMemo(() => {
    const rank = { pending: 2, progress: 1, done: 0 };
    return [...people].sort((a, b) => rank[caseStatus(a.status).group] - rank[caseStatus(b.status).group]);
  }, [people]);

  return (
    <>
      <style>{PIN_CSS}</style>
      <Pane name="staff-help" style={{ zIndex: 620 }}>
        {help.map((report) => {
          const isSelected = selected?.kind === "help" && selected.id === report.id;
          const color = HELP_STATUS_COLORS[report.status] || "#64748b";
          return (
            <CircleMarker
              key={`help-${report.id}-${report.status}-${isSelected ? 1 : 0}`}
              center={[Number(report.latitude), Number(report.longitude)]}
              radius={isSelected ? 13 : 9}
              pathOptions={{ color: "#ffffff", weight: isSelected ? 4 : 2.5, fillColor: color, fillOpacity: 0.95 }}
              eventHandlers={{ click: () => onSelect?.({ kind: "help", id: report.id }) }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <span className="font-bold">คำขอความช่วยเหลือ #{report.id}</span>
                <span className="block text-xs">{[report.first_name, report.last_name].filter(Boolean).join(" ") || "-"} • {incidentStatusMeta(report.status).label}</span>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </Pane>
      <Pane name="staff-people" style={{ zIndex: 630 }}>
        {ordered.map((person) => {
          const isSelected = selected?.kind === "person" && selected.id === person.id;
          return (
            <Marker
              key={`vp-${person.id}-${person.status}-${isSelected ? 1 : 0}`}
              position={spread.get(person.id) || [person.location.lat, person.location.lng]}
              icon={personIcon(person, isSelected)}
              title={pinLabel(person)}
              alt={pinLabel(person)}
              keyboard
              zIndexOffset={isSelected ? 1000 : caseStatus(person.status).group === "pending" ? 500 : 0}
              eventHandlers={{ click: () => onSelect?.({ kind: "person", id: person.id }) }}
            >
              <Tooltip direction="top">
                <span className="font-bold">{person.name}</span>
                <span className="block text-xs">{typeMeta(person.vulnerable_type)?.label} • {caseStatus(person.status).label}</span>
                {person.location?.approx ? <span className="block text-xs text-slate-500">ตำแหน่งประมาณ — ยังไม่ใช่บ้านจริง</span> : null}
              </Tooltip>
            </Marker>
          );
        })}
      </Pane>
    </>
  );
}
