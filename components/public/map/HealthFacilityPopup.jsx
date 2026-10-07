"use client";

// popup สถานพยาบาลบนแผนที่สถานการณ์: เปิด/ปิดให้บริการ, น้ำท่วมที่ตั้งและรอบ ๆ, ความสูงพื้นที่, โทร, นำทาง
// ใช้ div แทน p เพราะ leaflet ใส่ระยะห่างให้ <p> ใน popup มากจนอ่านยาก
import { useEffect, useState } from "react";
import { Clock, Mountain, Navigation, Phone, Siren, Waves } from "lucide-react";
import {
  distanceText,
  facilityTypeInfo,
  floodAreaAt,
  floodStatusMeta,
  isStatusStale,
  nearby,
  phoneLinks,
  serviceStatusMeta
} from "@/lib/healthFacilityStatus";
import { floodAreaMapMeta } from "@/lib/floodMapLevels";
import { waterReportSummary, timeAgoText } from "@/lib/waterReportMap";
import { situationMeta, bankText } from "@/lib/thaiWater";
import { ELEVATION_MAX_ZOOM, ELEVATION_TILE_URL, bandFor, decodeTerrarium, elevationText, tilePixelAt } from "@/lib/elevation";

const WATER_REPORT_RADIUS_KM = 1;
const STATION_RADIUS_KM = 10;
const elevationCache = new Map();

// อ่านความสูงจากภาพ Terrain Tiles ที่ zoom สูงสุด (ข้อมูล ~30 ม. ใช้ประกอบ ไม่ใช่ค่ารังวัด)
function loadElevation(lat, lng) {
  const { key, px, py } = tilePixelAt(lat, lng, ELEVATION_MAX_ZOOM);
  const cacheKey = `${key}/${px}/${py}`;
  if (elevationCache.has(cacheKey)) return elevationCache.get(cacheKey);
  const [z, x, y] = key.split("/");
  const promise = new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const context = canvas.getContext("2d");
        context.drawImage(image, px, py, 1, 1, 0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        resolve(decodeTerrarium(r, g, b));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = ELEVATION_TILE_URL.replace("{z}", z).replace("{x}", x).replace("{y}", y);
  });
  elevationCache.set(cacheKey, promise);
  return promise;
}

function formatUpdated(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return "";
  return date.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Row({ icon: Icon, children, tone = "text-slate-500" }) {
  return (
    <div className="flex items-start gap-1.5 text-[12px] leading-snug">
      <Icon className={`mt-[1px] h-3.5 w-3.5 shrink-0 ${tone}`} aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default function HealthFacilityPopup({ facility, floodAreas = [], waterReports = [], waterStations = [] }) {
  const lat = Number.parseFloat(facility.lat);
  const lng = Number.parseFloat(facility.lon);
  const type = facilityTypeInfo(facility.typecode);
  const service = serviceStatusMeta(facility.service_status);
  const reportedFlood = floodStatusMeta(facility.flood_status);
  const stale = Boolean(facility.service_status) && isStatusStale(facility.status_updated_at);
  const phones = phoneLinks(facility.phone);
  const area = [facility.tambon && `ต.${facility.tambon}`, facility.district && `อ.${facility.district}`].filter(Boolean).join(" ");

  // สถานการณ์น้ำรอบที่ตั้ง (ข้อมูลที่แผนที่โหลดอยู่แล้ว)
  const floodArea = floodAreaAt(lat, lng, floodAreas);
  const floodAreaMeta = floodArea ? floodAreaMapMeta(floodArea) : null;
  const reportsNearby = nearby(lat, lng, waterReports, WATER_REPORT_RADIUS_KM);
  const nearestReport = reportsNearby[0];
  const nearestStation = nearby(lat, lng, waterStations, STATION_RADIUS_KM)[0];
  const stationLevel = nearestStation ? situationMeta(nearestStation.item.situationLevel) : null;

  const [elevation, setElevation] = useState(undefined);
  useEffect(() => {
    let alive = true;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      loadElevation(lat, lng).then((meters) => { if (alive) setElevation(meters); });
    }
    return () => { alive = false; };
  }, [lat, lng]);
  const elevationBand = Number.isFinite(elevation) ? bandFor(elevation) : null;

  const directions = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <div className="w-64 text-slate-700" style={{ fontFamily: "var(--font-kanit)" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="m-0 text-[15px] font-bold leading-snug text-slate-900">{facility.name}</h4>
          <div className="text-[11px] text-slate-500">{type.label}{area ? ` • ${area}` : ""}</div>
        </div>
        {type.level !== "office" && (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: service.color, backgroundColor: service.bg }}>
            {service.short}
          </span>
        )}
      </div>

      {/* การให้บริการ */}
      <div className="mt-2 rounded-lg p-2" style={{ backgroundColor: type.level === "office" ? "#f1f5f9" : service.bg }}>
        {type.level === "office" ? (
          <div className="text-[12px] font-semibold text-slate-600">{type.care}</div>
        ) : (
          <>
            <div className="text-[13px] font-bold" style={{ color: service.color }}>{service.label}</div>
            {facility.service_note && <div className="mt-0.5 text-[12px] text-slate-700">{facility.service_note}</div>}
            {type.care && <div className="mt-0.5 text-[11px] text-slate-500">ปกติ: {type.care}</div>}
            {facility.status_updated_at ? (
              <div className={`mt-1 flex items-center gap-1 text-[11px] ${stale ? "font-semibold text-amber-700" : "text-slate-500"}`}>
                <Clock className="h-3 w-3" aria-hidden="true" />
                อัปเดต {formatUpdated(facility.status_updated_at)}{stale ? " • อาจไม่เป็นปัจจุบัน โทรสอบถามก่อนเดินทาง" : ""}
              </div>
            ) : (
              <div className="mt-1 text-[11px] text-slate-500">ยังไม่มีรายงานจากเจ้าหน้าที่ โทรสอบถามก่อนเดินทาง</div>
            )}
          </>
        )}
      </div>

      {/* น้ำท่วม */}
      <div className="mt-2 space-y-1">
        <div className="text-[11px] font-bold text-slate-500">สถานการณ์น้ำ</div>
        {reportedFlood && (
          <Row icon={Waves} tone={reportedFlood.value === "normal" ? "text-green-700" : "text-red-600"}>
            <span className="font-semibold" style={{ color: reportedFlood.color }}>{reportedFlood.label}</span>
            <span className="text-slate-500"> (เจ้าหน้าที่รายงาน)</span>
          </Row>
        )}
        {floodArea && (
          <Row icon={Waves} tone="text-blue-700">
            หมู่บ้านที่ตั้ง{floodArea.villname ? ` (${floodArea.villname})` : ""}อยู่ในพื้นที่น้ำท่วม
            {floodAreaMeta?.description || floodAreaMeta?.label ? `: ${floodAreaMeta.description || floodAreaMeta.label}` : ""}
            {floodArea.recorded_day ? <span className="text-slate-500"> (ข้อมูลวันที่ {new Date(floodArea.recorded_day).toLocaleDateString("th-TH", { day: "numeric", month: "short" })})</span> : null}
          </Row>
        )}
        {nearestReport && (() => {
          const summary = waterReportSummary(nearestReport.item);
          return (
            <Row icon={Waves} tone="text-sky-700">
              ประชาชนรายงานน้ำ {reportsNearby.length} จุดในรัศมี 1 กม. ใกล้สุด {distanceText(nearestReport.km)}
              {summary.level?.label ? `: ${summary.level.label}` : ""}
              {nearestReport.item.reported_at || nearestReport.item.occurred_at ? ` (${timeAgoText(nearestReport.item.reported_at || nearestReport.item.occurred_at)})` : ""}
            </Row>
          );
        })()}
        {nearestStation && (
          <Row icon={Waves} tone="text-indigo-700">
            สถานี{nearestStation.item.name} ห่าง {distanceText(nearestStation.km)}
            {stationLevel ? `: น้ำ${stationLevel.label}` : ""}
            {Number.isFinite(nearestStation.item.bankDiff) ? ` (${bankText(nearestStation.item.bankDiff)})` : ""}
          </Row>
        )}
        {!reportedFlood && !floodArea && !nearestReport && !nearestStation && (
          <div className="text-[12px] text-slate-500">ยังไม่มีรายงานน้ำท่วมบริเวณนี้</div>
        )}
        {elevation !== undefined && Number.isFinite(elevation) && (
          <Row icon={Mountain} tone="text-amber-700">
            พื้นที่สูง {elevationText(elevation)}
            {elevationBand ? <span className="text-slate-500"> • {elevationBand.meaning}</span> : null}
          </Row>
        )}
      </div>

      {/* ติดต่อและนำทาง */}
      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        {phones.length > 0 ? (
          <a href={phones[0].href} className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-1.5 text-[12px] font-bold !text-slate-800 no-underline hover:bg-slate-50">
            <Phone className="h-3.5 w-3.5" aria-hidden="true" /> โทร
          </a>
        ) : (
          <a href="tel:1669" className="flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 py-1.5 text-[12px] font-bold !text-red-700 no-underline hover:bg-red-100">
            <Siren className="h-3.5 w-3.5" aria-hidden="true" /> ฉุกเฉิน 1669
          </a>
        )}
        <a href={directions} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 rounded-lg bg-[#0b4c86] py-1.5 text-[12px] font-bold !text-white no-underline hover:bg-[#093d6c]">
          <Navigation className="h-3.5 w-3.5" aria-hidden="true" /> นำทาง
        </a>
      </div>
      {phones.length > 0 && (
        <div className="mt-1 text-center text-[11px] text-slate-500">
          {phones.map((item) => item.label).join(", ")} • เจ็บป่วยฉุกเฉินโทร <a href="tel:1669" className="font-bold !text-red-700">1669</a>
        </div>
      )}
    </div>
  );
}
