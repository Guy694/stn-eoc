"use client";

// ปักหมุดตำแหน่งบนแผนที่ (คลิกที่แผนที่ หรือใช้ตำแหน่งปัจจุบัน) — ใช้ในฟอร์มศูนย์พักพิงและหน่วยบริการสุขภาพ
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { LocateFixed } from "lucide-react";
import { Button, inputClass } from "@/components/admin/crud";

const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then((mod) => mod.CircleMarker), { ssr: false });
const ClickCapture = dynamic(
  () => import("react-leaflet").then((mod) => {
    function Capture({ onPick }) {
      mod.useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
      return null;
    }
    return Capture;
  }),
  { ssr: false }
);

const SATUN_CENTER = [6.75, 99.95];

function toNumber(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

export default function LocationPicker({ lat, lon, onChange, hint = "คลิกบนแผนที่เพื่อปักหมุด ใช้แสดงศูนย์บนแผนที่สาธารณะและนำทางประชาชน" }) {
  const [mounted, setMounted] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { setMounted(true); }, []);

  const latitude = toNumber(lat);
  const longitude = toNumber(lon);
  const hasPoint = latitude !== null && longitude !== null;
  const pick = (nextLat, nextLon) => onChange({ lat: nextLat.toFixed(6), lon: nextLon.toFixed(6) });

  const useCurrent = () => {
    if (!navigator.geolocation) {
      setMessage("เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        pick(position.coords.latitude, position.coords.longitude);
        setMessage("");
        setLocating(false);
      },
      () => {
        setMessage("หาตำแหน่งไม่ได้ ลองคลิกบนแผนที่แทน");
        setLocating(false);
      },
      { timeout: 10000 }
    );
  };

  return (
    <div className="sm:col-span-2">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-800">ตำแหน่งบนแผนที่</span>
        <Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" onClick={useCurrent} disabled={locating}>
          <LocateFixed className="h-4 w-4" aria-hidden="true" /> {locating ? "กำลังหา…" : "ใช้ตำแหน่งปัจจุบัน"}
        </Button>
      </div>
      <div className="h-56 overflow-hidden rounded-lg border border-slate-300">
        {mounted ? (
          <MapContainer key={hasPoint ? "point" : "none"} center={hasPoint ? [latitude, longitude] : SATUN_CENTER} zoom={hasPoint ? 14 : 9} className="h-full w-full" scrollWheelZoom>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
            <ClickCapture onPick={pick} />
            {hasPoint ? <CircleMarker center={[latitude, longitude]} radius={9} pathOptions={{ color: "#0b4c86", fillColor: "#0b4c86", fillOpacity: 0.9 }} /> : null}
          </MapContainer>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block text-xs text-slate-600">ละติจูด
          <input className={inputClass} inputMode="decimal" value={lat ?? ""} onChange={(event) => onChange({ lat: event.target.value })} placeholder="6.62" />
        </label>
        <label className="block text-xs text-slate-600">ลองจิจูด
          <input className={inputClass} inputMode="decimal" value={lon ?? ""} onChange={(event) => onChange({ lon: event.target.value })} placeholder="100.06" />
        </label>
      </div>
      <p className="mt-1 text-xs text-slate-500">{message || hint}</p>
    </div>
  );
}
