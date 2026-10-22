"use client";

// แผนที่ปักพิกัดหน่วยบริการสุขภาพ (ผู้ดูแลระบบ)
// เลือกหน่วยบริการจากรายการด้านข้าง → คลิกบนแผนที่ → ตรวจตำแหน่ง → บันทึก
// หมุดสีตามประเภท · หน่วยที่เลือกอยู่เป็นหมุดใหญ่ขอบเหลือง
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Crosshair, MapPin, Search } from "lucide-react";
import { Button, StatusPill, inputClass } from "@/components/admin/crud";
import { cn } from "@/lib/utils";

const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then((mod) => mod.CircleMarker), { ssr: false });
const Tooltip = dynamic(() => import("react-leaflet").then((mod) => mod.Tooltip), { ssr: false });
const MapEvents = dynamic(
  () => import("react-leaflet").then((mod) => {
    function Events({ onPick, focus }) {
      const map = mod.useMapEvents({ click: (event) => onPick?.(event.latlng.lat, event.latlng.lng) });
      useEffect(() => {
        if (focus) map.flyTo(focus, Math.max(map.getZoom(), 14), { duration: 0.6 });
      }, [focus, map]);
      return null;
    }
    return Events;
  }),
  { ssr: false }
);

const SATUN_CENTER = [6.75, 99.95];

export const TYPE_COLORS = {
  "รพ.ทั่วไป": "#b91c1c",
  "รพ.ศูนย์": "#b91c1c",
  "รพ.ชุมชน": "#c2410c",
  "รพ.สต.": "#15803d",
  "สอน.": "#0e7490",
  "ศสช.": "#1d4ed8",
  "สสจ": "#0f766e",
  "สสจ.": "#0f766e",
  "สสอ.": "#be185d"
};
export const typeColor = (typecode) => TYPE_COLORS[String(typecode || "").trim()] || "#475569";

function coord(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}
export function hasCoordinates(facility) {
  return coord(facility?.lat) !== null && coord(facility?.lon) !== null;
}

/**
 * @param {{ facilities: object[], canEdit: boolean, onSave: (facility, point:{lat,lon}) => Promise<void>, onEdit?: (facility) => void }} props
 */
export default function FacilityPinMap({ facilities, canEdit, onSave, onEdit }) {
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [focus, setFocus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [listFilter, setListFilter] = useState("missing");
  const [search, setSearch] = useState("");
  useEffect(() => { setMounted(true); }, []);

  const pinned = useMemo(() => facilities.filter(hasCoordinates), [facilities]);
  const missingCount = facilities.length - pinned.length;
  const selected = facilities.find((item) => item.id === selectedId) || null;

  const list = useMemo(() => {
    const text = search.trim().toLowerCase();
    return facilities
      .filter((item) => (listFilter === "missing" ? !hasCoordinates(item) : true))
      .filter((item) => !text || [item.name, item.district_name, item.tambon].some((value) => String(value || "").toLowerCase().includes(text)));
  }, [facilities, listFilter, search]);

  const choose = (facility) => {
    setSelectedId(facility.id);
    setDraft(null);
    if (hasCoordinates(facility)) setFocus([coord(facility.lat), coord(facility.lon)]);
  };

  const pick = (lat, lon) => {
    if (!canEdit || !selected) return;
    setDraft({ lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) });
  };

  const useCurrentPosition = () => {
    if (!selected || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: Number(position.coords.latitude.toFixed(6)), lon: Number(position.coords.longitude.toFixed(6)) };
        setDraft(point);
        setFocus([point.lat, point.lon]);
      },
      () => {},
      { timeout: 10000 }
    );
  };

  const save = async () => {
    if (!selected || !draft) return;
    setSaving(true);
    try {
      await onSave(selected, draft);
      setDraft(null);
      // ไปหน่วยถัดไปที่ยังไม่มีพิกัด เพื่อปักต่อเนื่องได้เร็ว
      if (listFilter === "missing") {
        const next = list.find((item) => item.id !== selected.id);
        setSelectedId(next?.id ?? null);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="flex max-h-[36rem] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="space-y-2 border-b border-slate-200 p-3">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-bold" role="tablist" aria-label="รายการหน่วยบริการ">
            {[
              { value: "missing", label: `ยังไม่มีพิกัด (${missingCount})` },
              { value: "all", label: `ทั้งหมด (${facilities.length})` }
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={listFilter === option.value}
                onClick={() => setListFilter(option.value)}
                className={cn("rounded-md px-2 py-1.5", listFilter === option.value ? "bg-white text-[#0b4c86] shadow-sm" : "text-slate-600")}
              >{option.label}</button>
            ))}
          </div>
          <label className="relative block">
            <span className="sr-only">ค้นหาหน่วยบริการ</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ อำเภอ ตำบล" className={cn(inputClass, "pl-9")} />
          </label>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
          {list.length === 0 ? (
            <li className="p-4 text-sm text-slate-500">{listFilter === "missing" ? "ทุกหน่วยบริการมีพิกัดแล้ว" : "ไม่พบหน่วยบริการ"}</li>
          ) : list.map((facility) => {
            const active = facility.id === selectedId;
            return (
              <li key={facility.id}>
                <button
                  type="button"
                  onClick={() => choose(facility)}
                  aria-pressed={active}
                  className={cn("flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm", active ? "bg-sky-50" : "hover:bg-slate-50")}
                >
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: typeColor(facility.typecode) }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-slate-900">{facility.name}</span>
                    <span className="block text-xs text-slate-500">{facility.typecode} · อ.{facility.district_name || "-"}{facility.tambon ? ` ต.${facility.tambon}` : ""}</span>
                  </span>
                  {!hasCoordinates(facility) ? <StatusPill tone="amber">ไม่มีพิกัด</StatusPill> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3 text-sm">
          {selected ? (
            <>
              <MapPin className="h-4 w-4 shrink-0 text-[#0b4c86]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <strong className="font-bold text-slate-900">{selected.name}</strong>
                <span className="block text-xs text-slate-600">
                  {draft
                    ? `ตำแหน่งใหม่ ${draft.lat}, ${draft.lon} — ตรวจแล้วกดบันทึก`
                    : canEdit
                      ? (hasCoordinates(selected) ? "คลิกบนแผนที่เพื่อย้ายหมุด" : "คลิกบนแผนที่ตรงที่ตั้งหน่วยบริการเพื่อปักหมุด")
                      : (hasCoordinates(selected) ? `พิกัด ${coord(selected.lat)}, ${coord(selected.lon)}` : "ยังไม่มีพิกัด")}
                </span>
              </span>
              {canEdit ? (
                <span className="flex flex-wrap gap-2">
                  <Button variant="secondary" className="min-h-9 px-3" onClick={useCurrentPosition}>
                    <Crosshair className="h-4 w-4" aria-hidden="true" /> ตำแหน่งของฉัน
                  </Button>
                  {onEdit ? <Button variant="secondary" className="min-h-9 px-3" onClick={() => onEdit(selected)}>แก้ข้อมูล</Button> : null}
                  {draft ? (
                    <>
                      <Button variant="ghost" className="min-h-9 px-3" onClick={() => setDraft(null)} disabled={saving}>ยกเลิก</Button>
                      <Button className="min-h-9 px-3" onClick={save} disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึกพิกัด"}</Button>
                    </>
                  ) : null}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-slate-600">{canEdit ? "เลือกหน่วยบริการจากรายการ แล้วคลิกบนแผนที่เพื่อปักหมุด" : "เลือกหน่วยบริการเพื่อดูตำแหน่ง"}</span>
          )}
        </div>
        <div className={cn("h-[24rem] lg:h-[32rem]", canEdit && selected && "cursor-crosshair")}>
          {mounted ? (
            <MapContainer center={SATUN_CENTER} zoom={10} className="h-full w-full" scrollWheelZoom>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
              <MapEvents onPick={pick} focus={focus} />
              {pinned.map((facility) => {
                const active = facility.id === selectedId;
                const color = typeColor(facility.typecode);
                return (
                  <CircleMarker
                    key={`${facility.id}-${active}`}
                    center={[coord(facility.lat), coord(facility.lon)]}
                    radius={active ? 10 : 6}
                    pathOptions={{ color: active ? "#facc15" : "#fff", weight: active ? 3 : 1.5, fillColor: color, fillOpacity: active && draft ? 0.35 : 0.95 }}
                    eventHandlers={{ click: () => choose(facility) }}
                  >
                    <Tooltip direction="top" offset={[0, -6]}>{facility.typecode} {facility.name}</Tooltip>
                  </CircleMarker>
                );
              })}
              {draft ? (
                <CircleMarker center={[draft.lat, draft.lon]} radius={11} pathOptions={{ color: "#facc15", weight: 3, fillColor: "#0b4c86", fillOpacity: 0.95 }}>
                  <Tooltip permanent direction="top" offset={[0, -10]}>ตำแหน่งใหม่</Tooltip>
                </CircleMarker>
              ) : null}
            </MapContainer>
          ) : null}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 px-3 py-2 text-xs text-slate-600" aria-label="สีหมุดตามประเภท">
          {[["รพ.ทั่วไป", "โรงพยาบาลทั่วไป"], ["รพ.ชุมชน", "โรงพยาบาลชุมชน"], ["รพ.สต.", "รพ.สต."], ["ศสช.", "ศูนย์สุขภาพชุมชน"], ["สสอ.", "สสอ."], ["สสจ", "สสจ."]].map(([code, label]) => (
            <li key={code} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: typeColor(code) }} aria-hidden="true" />{label}</li>
          ))}
          <li className="ml-auto">มีพิกัด {pinned.length} จาก {facilities.length} แห่ง</li>
        </ul>
      </section>
    </div>
  );
}
