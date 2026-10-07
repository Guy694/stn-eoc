"use client";

// จุดสถานีวัดฝน (ThaiWater) บนแผนที่สภาพอากาศ — สีตามเกณฑ์ฝน 24 ชม. ของกรมอุตุฯ, ฝนหนักขึ้นไปแสดงตัวเลขข้างจุด
import { Fragment } from "react";
import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { THAIWATER_SOURCE } from "@/lib/thaiWater";
import { isRainStale, rainCategory } from "@/lib/thaiWaterRain";

function formatObserved(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} ${date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`;
}

// รูปหยดน้ำ (แยกจากวงกลม = ระดับน้ำที่ประชาชนรายงาน และสี่เหลี่ยม = สถานีวัดระดับน้ำ)
function dropIcon(station, category, stale) {
  const size = category.key === "none" ? 10 : category.key === "light" ? 12 : category.key === "moderate" ? 14 : 17;
  const showLabel = ["heavy", "very_heavy"].includes(category.key) && !stale;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="position:relative;width:${size}px;height:${size}px">
      <span style="position:absolute;inset:0;border-radius:50% 0 50% 50%;transform:rotate(-45deg);background:${category.color};border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);opacity:${stale ? 0.45 : 1}"></span>
      ${showLabel ? `<span style="position:absolute;left:${size + 3}px;top:${size / 2 - 9}px;white-space:nowrap;border-radius:6px;padding:0 5px;font:800 11px/16px var(--font-kanit, sans-serif);background:${category.color};color:${category.text};border:1px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)">${station.rain24h.toFixed(1)} มม.</span>` : ""}
    </div>`
  });
}


const PAN = typeof window !== "undefined" && window.innerWidth >= 768 ? [392, 80] : [16, 70];

export default function RainStationLayer({ stations = [] }) {
  return stations.map((station) => {
    const category = rainCategory(station.rain24h);
    const stale = isRainStale(station.observedAt);
    const place = [station.tambon && `ต.${station.tambon}`, station.amphoe && `อ.${station.amphoe}`].filter(Boolean).join(" ");
    return (
      <Fragment key={`rain-${station.id}`}>
        <Marker position={[station.lat, station.lng]} icon={dropIcon(station, category, stale)} title={`สถานีวัดฝน${station.name} ${station.rain24h.toFixed(1)} มม.`}>
          <Popup pane="popupPane" maxWidth={240} minWidth={200} autoPanPaddingTopLeft={PAN} autoPanPaddingBottomRight={[72, 110]}>
            <div className="space-y-1 text-[13px] text-slate-700" style={{ fontFamily: "var(--font-kanit)" }}>
              <h4 className="m-0 text-[15px] font-bold leading-snug text-slate-900">สถานีวัดฝน{station.name}</h4>
              {place ? <div className="text-xs text-slate-500">{place}</div> : null}
              <span className="inline-block rounded-md px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: category.color, color: category.text }}>{category.label}</span>
              <div className="font-bold text-slate-900">ฝน 24 ชม. {station.rain24h.toFixed(1)} มม.</div>
              {station.rain1h !== null ? <div>ฝน 1 ชม.ล่าสุด {station.rain1h.toFixed(1)} มม.</div> : null}
              <div className={stale ? "font-semibold text-amber-700" : "text-slate-500"}>
                วัดเมื่อ {formatObserved(station.observedAt)}{stale ? " · ข้อมูลอาจไม่เป็นปัจจุบัน" : ""}
              </div>
              {station.agency ? <div className="text-[11px] text-slate-400">สถานีของ {station.agency}</div> : null}
              <div className="text-[11px] text-sky-700">ข้อมูลฝน: {THAIWATER_SOURCE}</div>
            </div>
          </Popup>
        </Marker>
      </Fragment>
    );
  });
}
