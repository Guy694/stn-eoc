"use client";

// แผนที่หน้าแนวโน้มน้ำและฝน — รูปแบบเดียวกับแผนที่ประชาชน (/public/weather-watch):
// อำเภอระบายสีตามฝนในช่วงที่เลือก + ป้ายชื่ออำเภอ · หยดน้ำ = สถานีวัดฝน · สี่เหลี่ยม = สถานีวัดระดับน้ำ
// (ไฟล์นี้ใช้ leaflet โดยตรง — ผู้เรียกต้องโหลดด้วย next/dynamic แบบ ssr: false)
import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GeoJSON, MapContainer, Marker, Pane, Popup, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import { MAP_BASE_LAYERS, getMapBaseLayer } from "@/lib/mapBaseLayers";
import { normalizeDistrictName, rainCategory } from "@/lib/thaiWaterRain";
import { DISTRICT_METRICS, dayLabel, districtFill, districtLegend, fmt, signed, timeLabel, waterTone } from "@/components/eoc/hydro/hydroUi";

const CENTER = [6.86, 99.98];
const hasPoint = (s) => s?.lat !== null && s?.lng !== null && Number.isFinite(Number(s?.lat)) && Number.isFinite(Number(s?.lng));
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const GAUGE_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 3v10"/><path d="M8 9l4 4 4-4"/><path d="M3 18c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0"/></svg>';

function districtLabelIcon(name, text, fill, selected) {
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;font-family:var(--font-kanit, sans-serif)">
      <span style="white-space:nowrap;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:800;color:${fill.text};background:${fill.color};box-shadow:0 2px 6px rgba(0,0,0,.35);${selected ? "outline:2px solid #0f172a;" : ""}">${escapeHtml(name)}</span>
      ${text ? `<span style="white-space:nowrap;border-radius:6px;padding:0 6px;font-size:11px;font-weight:700;color:#0f172a;background:rgba(255,255,255,.92)">${escapeHtml(text)}</span>` : ""}
    </div>`
  });
}

// รูปหยดน้ำ = สถานีวัดฝน (ขนาดและสีตามฝนสูงสุดต่อวันในช่วงที่เลือก · ฝนหนักขึ้นไปแสดงตัวเลข)
function rainIcon(station) {
  const cat = rainCategory(station.max_day_mm);
  const size = cat.key === "none" ? 10 : cat.key === "light" ? 12 : cat.key === "moderate" ? 14 : 17;
  const showLabel = ["heavy", "very_heavy"].includes(cat.key);
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="position:relative;width:${size}px;height:${size}px">
      <span style="position:absolute;inset:0;border-radius:50% 0 50% 50%;transform:rotate(-45deg);background:${cat.color};border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)"></span>
      ${showLabel ? `<span style="position:absolute;left:${size + 3}px;top:${size / 2 - 9}px;white-space:nowrap;border-radius:6px;padding:0 5px;font:800 11px/16px var(--font-kanit, sans-serif);background:${cat.color};color:${cat.text};border:1px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)">${Number(station.max_day_mm).toFixed(0)}</span>` : ""}
    </div>`
  });
}

// สี่เหลี่ยม = สถานีวัดระดับน้ำ · ป้ายข้างหมุด = ระดับสูงสุดเทียบตลิ่ง
function waterIcon(station, selected, compact) {
  const tone = waterTone(station);
  const diff = station.peak?.diff;
  const label = diff === null || diff === undefined ? "" : diff > 0 ? `ล้น ${diff.toFixed(2)} ม.` : `ต่ำกว่าตลิ่ง ${Math.abs(diff).toFixed(2)} ม.`;
  const strong = tone.key !== "ok";
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div style="transform:translate(-11px,-11px);display:flex;align-items:center;gap:4px;font-family:var(--font-kanit, sans-serif)">
      <span style="display:grid;place-items:center;width:22px;height:22px;border-radius:6px;background:${tone.color};color:#fff;border:2px solid ${selected ? "#facc15" : "#fff"};box-shadow:0 2px 6px rgba(0,0,0,.35)${selected ? ",0 0 0 2px #0f172a" : ""}">${GAUGE_SVG}</span>
      ${label && ((strong && !compact) || selected) ? `<span style="white-space:nowrap;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:800;line-height:16px;${strong ? `background:${tone.color};color:#fff;border:1px solid #fff` : `background:rgba(255,255,255,.94);color:#0f172a;border:1px solid ${tone.color}`};box-shadow:0 1px 4px rgba(0,0,0,.25)">${escapeHtml(label)}</span>` : ""}
    </div>`
  });
}

// แท่งฝนรายวันขนาดเล็กใน popup ของสถานีวัดฝน
function DailyBars({ values = [], dates = [] }) {
  const known = values.filter((v) => v !== null && v !== undefined);
  if (!known.length) return null;
  const max = Math.max(...known, 1);
  const W = 200;
  const H = 44;
  const step = W / values.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 12}`} className="mt-1 w-full" role="img" aria-label={`ฝนรายวัน ${dates.length} วัน สูงสุด ${fmt(Math.max(...known))} มิลลิเมตร`}>
      {values.map((v, i) => {
        if (v === null || v === undefined) return null;
        const h = Math.max(v > 0 ? 1.5 : 0, (v / max) * H);
        return <rect key={dates[i] || i} x={i * step + step * 0.12} y={H - h} width={Math.max(step * 0.76, 0.8)} height={h} rx={step > 6 ? 1.5 : 0} fill={rainCategory(v).color} />;
      })}
      <line x1="0" x2={W} y1={H + 0.5} y2={H + 0.5} stroke="#cbd5e1" strokeWidth="1" />
      <text x="0" y={H + 11} fontSize="9" fill="#64748b">{dates[0] ? dayLabel(dates[0]) : ""}</text>
      <text x={W} y={H + 11} fontSize="9" fill="#64748b" textAnchor="end">{dates.at(-1) ? dayLabel(dates.at(-1)) : ""}</text>
    </svg>
  );
}

function FitTo({ bounds }) {
  const map = useMap();
  const box = bounds ? bounds.toBBoxString() : "";
  useEffect(() => {
    if (!box) return;
    const [west, south, east, north] = box.split(",").map(Number);
    map.flyToBounds([[south, west], [north, east]], { padding: [24, 24], maxZoom: 12, duration: 0.6 });
  }, [box, map]); // เทียบจากค่าพิกัด — โหลดข้อมูลรอบใหม่ไม่ดึงแผนที่กลับ ถ้าขอบเขตเท่าเดิม
  return null;
}

// ซูมออกไกล (เห็นทั้งจังหวัดบนจอแคบ) = ป้ายแบบย่อ ไม่ให้ทับกัน
function ZoomWatch({ onZoom }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  useEffect(() => { onZoom(map.getZoom()); }, [map, onZoom]);
  return null;
}

function Chip({ active, onClick, children }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick}
      className={`min-h-8 rounded-md px-2.5 text-[13px] font-semibold ${active ? "bg-white text-[#0b4c86] shadow-sm" : "text-slate-600 hover:bg-white/60"}`}>{children}</button>
  );
}

export default function HydroStationsMap({
  waterStations = [], rainStations = [], districts = [], dates = [], selectedCode, onSelectWater, selectedDistrict = "", onSelectDistrict
}) {
  const [metric, setMetric] = useState("max_day_mm");
  const [baseMap, setBaseMap] = useState("street");
  const [show, setShow] = useState({ rain: true, water: true });
  const [boundaries, setBoundaries] = useState([]);
  const [zoom, setZoom] = useState(10);
  const compact = zoom < 10;
  const baseLayer = getMapBaseLayer(baseMap);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/stn-eoc/api/common/area-polygons?level=district", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => setBoundaries(Array.isArray(json?.data) ? json.data : []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const water = useMemo(() => waterStations.filter(hasPoint), [waterStations]);
  const rain = useMemo(() => rainStations.filter(hasPoint), [rainStations]);
  const byDistrict = useMemo(() => new Map(districts.map((d) => [normalizeDistrictName(d.amphoe), d])), [districts]);
  const meta = DISTRICT_METRICS.find((m) => m.key === metric) || DISTRICT_METRICS[0];
  const maxValue = useMemo(() => Math.max(0, ...districts.map((d) => Number(d[metric]) || 0)), [districts, metric]);
  const legend = districtLegend(metric, maxValue);
  const selectedKey = normalizeDistrictName(selectedDistrict);

  const selectedBounds = useMemo(() => {
    if (!selectedKey) return null;
    const item = boundaries.find((b) => normalizeDistrictName(b.name) === selectedKey);
    if (!item?.geojson) return null;
    try { return L.geoJSON(item.geojson).getBounds(); } catch { return null; }
  }, [boundaries, selectedKey]);

  // ไม่ได้เลือกอำเภอ = พอดีแผ่นดินใหญ่ของจังหวัด (จุดกลางอำเภอ + สถานี) — ไม่รวมหมู่เกาะไกล ไม่งั้นแผนที่บนมือถือเล็กเกินอ่าน
  const allBounds = useMemo(() => {
    const points = [
      ...boundaries.filter((b) => Number.isFinite(Number(b.center_lat)) && Number.isFinite(Number(b.center_lng))).map((b) => [Number(b.center_lat), Number(b.center_lng)]),
      ...[...water, ...rain].map((s) => [Number(s.lat), Number(s.lng)])
    ];
    return points.length > 1 ? L.latLngBounds(points).pad(0.2) : null;
  }, [boundaries, water, rain]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div role="radiogroup" aria-label="ระบายสีอำเภอตาม" className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          {DISTRICT_METRICS.map((m) => <Chip key={m.key} active={metric === m.key} onClick={() => setMetric(m.key)}>{m.label}</Chip>)}
        </div>
        <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="ชั้นข้อมูลสถานี">
          {[["rain", `สถานีฝน ${rain.length}`], ["water", `สถานีระดับน้ำ ${water.length}`]].map(([key, text]) => (
            <button key={key} type="button" aria-pressed={show[key]} onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
              className={`min-h-8 rounded-md px-2.5 text-[13px] font-semibold ${show[key] ? "bg-white text-[#0b4c86] shadow-sm" : "text-slate-500 line-through decoration-slate-400 hover:bg-white/60"}`}>{text}</button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-1.5 text-[13px] text-slate-600">
          <span className="sr-only sm:not-sr-only">พื้นหลัง</span>
          <select value={baseMap} onChange={(e) => setBaseMap(e.target.value)} className="min-h-8 rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-900">
            {Object.entries(MAP_BASE_LAYERS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
          </select>
        </label>
      </div>

      <div className="relative h-[26rem] lg:h-[34rem]" role="region" aria-label="แผนที่ฝนรายอำเภอและสถานีตรวจวัด">
        <MapContainer center={CENTER} zoom={10} minZoom={8} zoomControl={false} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }} className="z-0">
          <ZoomControl position="bottomright" />
          <TileLayer key={baseMap} attribution={baseLayer.attribution} url={baseLayer.url} />

          {boundaries.map((item, index) => {
            if (!item.geojson) return null;
            const key = normalizeDistrictName(item.name);
            const district = byDistrict.get(key);
            const fill = districtFill(metric, district ? district[metric] : null, maxValue);
            const selected = Boolean(selectedKey) && key === selectedKey;
            return (
              <GeoJSON
                key={`d-${item.code || item.name || index}-${metric}-${fill.color}-${selected ? "sel" : ""}`}
                data={item.geojson}
                style={{ color: selected ? "#0f172a" : "#334155", weight: selected ? 2.5 : 0.6, opacity: selected ? 0.95 : 0.45, fillColor: fill.color, fillOpacity: selected ? 0.55 : 0.4 }}
                eventHandlers={{ click: () => district && onSelectDistrict?.(selected ? "" : district.amphoe) }}
              />
            );
          })}

          {boundaries.map((item) => {
            const key = normalizeDistrictName(item.name);
            const district = byDistrict.get(key);
            if (!district || !Number.isFinite(Number(item.center_lat)) || !Number.isFinite(Number(item.center_lng))) return null;
            const value = district[metric];
            const fill = districtFill(metric, value, maxValue);
            const selected = Boolean(selectedKey) && key === selectedKey;
            const text = value === null || value === undefined ? "ไม่มีข้อมูล" : `${fmt(value, metric === "heavy_days" ? 0 : 1)} ${meta.unit}`;
            return <Marker key={`l-${key}-${metric}-${value}-${selected}-${compact}`} position={[Number(item.center_lat), Number(item.center_lng)]} icon={districtLabelIcon(district.amphoe, compact && !selected ? "" : text, fill, selected)} interactive={false} />;
          })}

          {/* pane แยกเหนือขอบเขตอำเภอ — ไม่งั้นเลือกอำเภอแล้ว polygon ถูกวาดใหม่ทับหมุดจนกดไม่ได้ */}
          <Pane name="hydro-rain" style={{ zIndex: 450 }}>
            {show.rain ? rain.map((s) => {
              const cat = rainCategory(s.max_day_mm);
              const place = [s.tambon && `ต.${s.tambon}`, s.amphoe && `อ.${s.amphoe}`].filter(Boolean).join(" ");
              return (
                <Marker key={`rain-${s.id}-${s.max_day_mm}`} position={[Number(s.lat), Number(s.lng)]} icon={rainIcon(s)} title={`สถานีวัดฝน${s.name}`}>
                  <Popup maxWidth={250} minWidth={220}>
                    <div className="space-y-1 text-[13px] text-slate-700" style={{ fontFamily: "var(--font-kanit)" }}>
                      <h4 className="m-0 text-[15px] font-bold leading-snug text-slate-900">สถานีวัดฝน{s.name}</h4>
                      {place ? <div className="text-xs text-slate-500">{place}</div> : null}
                      <span className="inline-block rounded-md px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: cat.color, color: cat.text }}>สูงสุดต่อวัน: {cat.label}</span>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
                        <dt className="text-slate-500">ฝนรวม</dt><dd className="m-0 text-right font-semibold text-slate-900">{fmt(s.total_mm)} มม.</dd>
                        <dt className="text-slate-500">สูงสุดต่อวัน</dt><dd className="m-0 text-right font-semibold text-slate-900">{fmt(s.max_day_mm)} มม.</dd>
                        <dt className="text-slate-500">สะสม 3 วันสูงสุด</dt><dd className="m-0 text-right">{fmt(s.max_3d_mm)} มม.</dd>
                        <dt className="text-slate-500">แรงสุดใน 1 ชม.</dt><dd className="m-0 text-right">{fmt(s.max_1h_mm)} มม.{s.max_1h_at ? <span className="block text-[11px] text-slate-500">{timeLabel(s.max_1h_at)}</span> : null}</dd>
                        <dt className="text-slate-500">วันที่มีฝน / ฝนหนัก</dt><dd className="m-0 text-right">{s.rain_days ?? 0} / {s.heavy_days ?? 0} วัน</dd>
                      </dl>
                      <DailyBars values={s.daily_mm} dates={dates} />
                    </div>
                  </Popup>
                </Marker>
              );
            }) : null}
          </Pane>
          <Pane name="hydro-water" style={{ zIndex: 460 }}>
            {show.water ? water.map((s) => {
              const tone = waterTone(s);
              const on = s.code === selectedCode;
              const place = [s.river, s.tambon && `ต.${s.tambon}`, s.amphoe && `อ.${s.amphoe}`].filter(Boolean).join(" · ");
              return (
                <Marker key={`water-${s.code}-${on}-${tone.key}-${compact}`} position={[Number(s.lat), Number(s.lng)]} icon={waterIcon(s, on, compact)} title={`สถานีวัดระดับน้ำ ${s.name}`} zIndexOffset={on ? 500 : 0}>
                  <Popup maxWidth={250} minWidth={220}>
                    <div className="space-y-1 text-[13px] text-slate-700" style={{ fontFamily: "var(--font-kanit)" }}>
                      <h4 className="m-0 text-[15px] font-bold leading-snug text-slate-900">{s.name}</h4>
                      {place ? <div className="text-xs text-slate-500">{place}</div> : null}
                      <span className="inline-block rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: tone.color }}>{tone.label}{s.hours_over_bank ? ` ${s.hours_over_bank} ชม.` : ""}</span>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
                        <dt className="text-slate-500">ล่าสุด</dt><dd className="m-0 text-right font-semibold text-slate-900">{fmt(s.latest?.level, 2)} ม.</dd>
                        <dt className="text-slate-500">ตลิ่ง</dt><dd className="m-0 text-right">{fmt(s.bank, 2)} ม.</dd>
                        <dt className="text-slate-500">สูงสุด</dt><dd className="m-0 text-right">{fmt(s.peak?.level, 2)} ม. ({signed(s.peak?.diff)})<span className="block text-[11px] text-slate-500">{s.peak?.t ? timeLabel(s.peak.t) : ""}</span></dd>
                        <dt className="text-slate-500">เปลี่ยนใน 6 ชม.</dt><dd className="m-0 text-right">{signed(s.change_6h)} ม.</dd>
                      </dl>
                      <button type="button" onClick={() => onSelectWater?.(s.code, true)} className="mt-1 min-h-9 w-full rounded-lg bg-[#0b4c86] px-3 text-sm font-semibold text-white hover:bg-[#093d6c]">ดูกราฟสถานีนี้</button>
                      <div className="text-[11px] text-slate-400">{s.source === "ปภ." ? "กรมป้องกันและบรรเทาสาธารณภัย" : "ThaiWater (สสน.)"}</div>
                    </div>
                  </Popup>
                </Marker>
              );
            }) : null}
          </Pane>
          <FitTo bounds={selectedBounds || allBounds} />
          <ZoomWatch onZoom={setZoom} />
        </MapContainer>

        <div className="pointer-events-none absolute left-2 top-2 z-[500] max-w-[11rem] rounded-lg bg-white/95 px-2.5 py-2 text-[11px] leading-4 text-slate-700 shadow-md ring-1 ring-slate-200" aria-label="คำอธิบายสี">
          <p className="font-bold text-slate-900">{meta.label} ({meta.unit})</p>
          <ul className="mt-1 space-y-0.5">
            {legend.map((item) => <li key={item.label} className="flex items-center gap-1.5"><span className="h-3 w-4 shrink-0 rounded-sm ring-1 ring-black/10" style={{ backgroundColor: item.color }} aria-hidden="true" />{item.label}</li>)}
          </ul>
          <ul className="mt-1.5 hidden space-y-0.5 border-t border-slate-200 pt-1.5 sm:block">
            <li className="flex items-center gap-1.5"><span className="h-3 w-3 shrink-0 -rotate-45 rounded-[50%_0_50%_50%] bg-sky-300 ring-1 ring-white" aria-hidden="true" />สถานีวัดฝน</li>
            {[["#0b4c86", "น้ำต่ำกว่าตลิ่ง"], ["#d97706", "ใกล้ตลิ่ง (≤ 0.5 ม.)"], ["#dc2626", "ล้นตลิ่ง"]].map(([color, text]) => (
              <li key={text} className="flex items-center gap-1.5"><span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} aria-hidden="true" />{text}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
