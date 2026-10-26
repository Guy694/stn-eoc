"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  CloudRain,
  Hospital,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Mountain,
  Navigation,
  Phone,
  RefreshCw,
  Search,
  Info,
  Siren,
  Square,
  Tent,
  Volume2,
  Waves,
  X
} from "lucide-react";
import PublicLayout from "@/components/layouts/PublicLayout";
import HelpRequestLink from "@/components/public/HelpRequestLink";
import useHelpAvailability from "@/components/public/useHelpAvailability";
import { RISK_META } from "@/lib/weatherRiskConfig";
import { assessHomeRisk, nearest, NEAR_REPORT_KM, officialNotice, riskSpeechText } from "@/lib/myRisk";
import { distanceText, facilityTypeInfo, floodAreaAt, serviceStatusMeta, phoneLinks } from "@/lib/healthFacilityStatus";
import { floodAreaMapMeta } from "@/lib/floodMapLevels";
import { elevationText } from "@/lib/elevation";
import { loadElevation } from "@/lib/elevationClient";
import { isWaterReport, timeAgoText } from "@/lib/waterReportMap";
import { waterLevelMeta } from "@/lib/waterReport";
import { DISCHARGE_LEVELS } from "@/lib/forecastSignals";
import { trackPublicUsage } from "@/lib/publicUsage";
import FloodOutlookCard from "@/components/public/FloodOutlookCard";
import AlertSubscribeCard from "@/components/public/AlertSubscribeCard";
import { hasThaiVoice, primeSpeech, readAloud, stopSpeaking } from "@/lib/readAloud";
import { heavyRainNote } from "@/lib/rainNowcast";
import { shareVisitGps } from "@/lib/visitorGps";

const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const MapClick = dynamic(
  () => import("react-leaflet").then((mod) => {
    function MapClickInner({ position, onPick }) {
      const map = mod.useMapEvents({ click(event) { onPick({ lat: event.latlng.lat, lng: event.latlng.lng }); } });
      useEffect(() => { if (position) map.setView(position, Math.max(map.getZoom(), 14)); }, [map, position]);
      return null;
    }
    return MapClickInner;
  }),
  { ssr: false }
);

const SATUN_CENTER = [6.75, 99.95];
// ขั้นที่แสดงระหว่างรวบรวมข้อมูล (ติ๊กถูกเมื่อแต่ละแหล่งตอบกลับ)
const LOAD_STEPS = [
  { key: "where", label: "ระบุหมู่บ้านและตำบล" },
  { key: "water", label: "อ่านระดับน้ำในคลองใกล้บ้าน" },
  { key: "rain", label: "ดูฝนที่วัดได้รอบบ้าน" },
  { key: "risk", label: "ประเมินความเสี่ยงของอำเภอ" },
  { key: "help", label: "หาที่พึ่งที่ใกล้ที่สุด" }
];
const HOME_KEY = "stn-eoc:home-location";
const toLocalDate = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const normalizeName = (value) => String(value || "").replace(/^อ(\.|ำเภอ)\s*/, "").replace(/\s+/g, "");

function sourceTime(value) {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "" : `วัดเมื่อ ${date.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} น.`;
}

async function getJson(url, init = {}) {
  try {
    const response = await fetch(url, { cache: "no-store", ...init });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

function directions(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function Card({ title, icon: Icon, children, aside = null }) {
  return (
    <section className="rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
          {Icon ? <Icon className="h-5 w-5 text-[#0b4c86]" aria-hidden="true" /> : null}{title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value, note, tone = "text-slate-900" }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-black leading-tight ${tone}`}>{value}</div>
      {note ? <div className="mt-0.5 text-xs leading-snug text-slate-600">{note}</div> : null}
    </div>
  );
}

function MyRiskContent() {
  const searchParams = useSearchParams();
  const { sheltersOpen, floodOpen } = useHelpAvailability();
  const [position, setPosition] = useState(null);
  const [gps, setGps] = useState({ state: "idle", message: "" });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ state: "idle", items: [] });
  const [showMap, setShowMap] = useState(false);
  const [report, setReport] = useState({ state: "idle" });
  const [stepsDone, setStepsDone] = useState([]);
  const searchTimer = useRef(null);
  // อ่านผลประเมินออกเสียง: อ่านเองเมื่อประเมินเสร็จ (ปิดได้) และกดฟังซ้ำ/หยุดได้
  const [speaking, setSpeaking] = useState(false);
  const [thaiVoice, setThaiVoice] = useState(null);
  const [autoRead, setAutoRead] = useState(false);
  const spokenAt = useRef(null);
  useEffect(() => {
    try { setAutoRead(window.localStorage.getItem(AUTO_READ_KEY) === "on"); } catch { /* ค่าเริ่มต้นปิดเสียงอ่านอัตโนมัติ */ }
    hasThaiVoice().then(setThaiVoice);
    return () => stopSpeaking();
  }, []);

  const pick = useCallback((point, source) => {
    const next = { lat: Number(point.lat), lng: Number(point.lng), source };
    setPosition(next);
    setResults({ state: "idle", items: [] });
    try { window.localStorage.setItem(HOME_KEY, JSON.stringify(next)); } catch { /* ไม่จำก็ใช้ได้ */ }
  }, []);

  // ตำแหน่งเริ่มต้น: จากลิงก์ (?lat=&lng=) หรือที่เคยเช็กไว้ในเครื่องนี้
  useEffect(() => {
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat && lng) {
      setPosition({ lat, lng, source: "link" });
      return;
    }
    try {
      const saved = JSON.parse(window.localStorage.getItem(HOME_KEY) || "null");
      if (Number.isFinite(saved?.lat) && Number.isFinite(saved?.lng)) setPosition({ ...saved, source: "saved" });
    } catch { /* ignore */ }
  }, [searchParams]);

  const locate = () => {
    if (!navigator.geolocation) {
      setGps({ state: "error", message: "เบราว์เซอร์นี้ระบุตำแหน่งไม่ได้ ค้นหาหมู่บ้านหรือแตะบนแผนที่แทน" });
      setShowMap(true);
      return;
    }
    setGps({ state: "requesting", message: "" });
    navigator.geolocation.getCurrentPosition(
      (result) => {
        pick({ lat: result.coords.latitude, lng: result.coords.longitude }, "gps");
        shareVisitGps(result.coords, "my-risk");
        setGps({ state: "idle", message: "" });
      },
      () => {
        setGps({ state: "error", message: "ระบุตำแหน่งไม่ได้ (อาจยังไม่อนุญาตให้เข้าถึงตำแหน่ง) ค้นหาหมู่บ้านหรือแตะบนแผนที่แทน" });
        setShowMap(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const search = (value) => {
    setQuery(value);
    clearTimeout(searchTimer.current);
    if (value.trim().length < 2) { setResults({ state: "idle", items: [] }); return; }
    setResults((current) => ({ ...current, state: "loading" }));
    searchTimer.current = setTimeout(async () => {
      const json = await getJson(`/stn-eoc/api/public/place-search?q=${encodeURIComponent(value.trim())}`);
      setResults({ state: "done", items: json?.success ? (json.data || []).filter((item) => item.kind === "village" || !item.kind) : [] });
    }, 300);
  };

  // รวมข้อมูลรอบตำแหน่ง
  const load = useCallback(async (point) => {
    setReport({ state: "loading" });
    setStepsDone([]);
    const pointKey = `${Number(point.lat).toFixed(5)},${Number(point.lng).toFixed(5)}`;
    const mark = (key) => (value) => {
      setStepsDone((current) => (current.includes(key) ? current : [...current, key]));
      return value;
    };
    const today = toLocalDate();
    const [where, weather, water, rain, health, status, elevation] = await Promise.all([
      getJson("/stn-eoc/api/public/where", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: point.lat, lng: point.lng }) }).then(mark("where")),
      getJson("/stn-eoc/api/public/weather-watch").then(mark("risk")),
      getJson("/stn-eoc/api/public/water-levels").then(mark("water")),
      getJson("/stn-eoc/api/public/rain-stations").then(mark("rain")),
      getJson("/stn-eoc/api/common/health-facilities"),
      getJson("/stn-eoc/api/eoc/status/"),
      loadElevation(point.lat, point.lng)
    ]);
    const floodSession = (status?.data || []).find((item) => item.eoc_type === "flood" && item.is_active && item.session_id);
    mark("help")(null);
    const whereData = where?.data || null;
    const [shelters, floodAreas, incidents, outlook] = await Promise.all([
      getJson("/stn-eoc/api/public/shelter-centers"),
      floodSession ? getJson(`/stn-eoc/api/eoc/flood/area-status?session_id=${floodSession.session_id}&date=${today}`) : null,
      floodSession ? getJson(`/stn-eoc/api/public/verified-incidents?disaster_type=flood&session_id=${floodSession.session_id}&start_date=${today}&end_date=${today}`) : null,
      whereData?.in_satun && whereData.tambon && whereData.district
        ? getJson(`/stn-eoc/api/public/flood-outlook?district=${encodeURIComponent(whereData.district)}&tambon=${encodeURIComponent(whereData.tambon)}`)
        : null
    ]);
    setReport({
      state: "done",
      pointKey,
      at: new Date(),
      where: where?.data || null,
      weather,
      waterStations: water?.stations || [],
      rainStations: rain?.stations || [],
      facilities: health?.data || [],
      shelters: shelters?.data || [],
      floodAreas: floodAreas?.data || [],
      waterReports: (incidents?.data || []).filter(isWaterReport),
      outlook: outlook?.data || null,
      elevation: Number.isFinite(elevation) ? elevation : null,
      floodHistoryState: "loading",
      floodHistory: null
    });
    // โหลดประวัติ GISTDA แยกจากผลปัจจุบัน ไม่ให้การประเมินหลักต้องรอ API ภายนอก
    if (whereData?.in_satun) {
      getJson("/stn-eoc/api/public/flood-freq/point", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: point.lat, lng: point.lng }),
        signal: AbortSignal.timeout(25000)
      }).then((json) => {
        setReport((current) => {
          if (current.state !== "done" || current.pointKey !== pointKey) return current;
          return {
            ...current,
            floodHistoryState: json?.success ? "ready" : "unavailable",
          floodHistory: json?.success ? { ...json.data, nearby_areas: json.nearby_areas || [], nearby_radius_m: json.nearby_radius_m || 200 } : null
          };
        });
      });
    }
    trackPublicUsage("my_risk_checked", "/public/my-risk");
  }, []);

  useEffect(() => {
    if (position) load(position);
  }, [load, position]);

  const result = useMemo(() => {
    if (!position || report.state !== "done") return null;
    const { lat, lng } = position;
    const districtName = normalizeName(report.where?.district);
    const district = (report.weather?.district_weather || []).find((item) => normalizeName(item.district_name) === districtName) || null;
    const floodArea = floodAreaAt(lat, lng, report.floodAreas);
    const station = nearest(lat, lng, report.waterStations, { limit: 1 })[0] || null;
    const gauge = nearest(lat, lng, report.rainStations, { limit: 1 })[0] || null;
    const reports = nearest(lat, lng, report.waterReports, { limit: 5, maxKm: NEAR_REPORT_KM });
    const home = assessHomeRisk({
      districtLevel: district?.risk_level || "normal",
      elevation: report.elevation,
      floodArea: floodArea ? { label: floodAreaMapMeta(floodArea).label } : null,
      station,
      reports
    });
    const facilities = report.facilities.filter((item) => facilityTypeInfo(item.typecode).level !== "office");
    const hospital = nearest(lat, lng, facilities.filter((item) => facilityTypeInfo(item.typecode).level === "hospital"), { limit: 1 })[0] || null;
    const primary = nearest(lat, lng, facilities.filter((item) => facilityTypeInfo(item.typecode).level !== "hospital"), { limit: 2 });
    // ศูนย์พักพิงไกลเกิน 30 กม. ไม่ช่วยตอนน้ำท่วม แสดงเฉพาะถ้าไม่มีที่ใกล้กว่านั้นเลย
    const nearShelters = nearest(lat, lng, report.shelters, { limit: 3, maxKm: 30 });
    const shelters = nearShelters.length ? nearShelters : nearest(lat, lng, report.shelters, { limit: 1 });
    const rivers = (report.weather?.river_outlook || []).filter((item) => normalizeName(item.amphoe) === districtName);
    return { district, floodArea, station, gauge, reports, home, hospital, primary, shelters, rivers };
  }, [position, report]);

  const meta = result ? RISK_META[result.home.level] || RISK_META.normal : null;
  const assessmentIncomplete = Boolean(result && !result.district && result.home.level === "normal");
  const contextOnlySignals = Boolean(result && result.home.level === "normal" && result.home.reasons.length > 0);
  const assessmentLabel = result
    ? assessmentIncomplete ? "ข้อมูลบางส่วนยังไม่พร้อม" : contextOnlySignals ? "ปกติ" : ({ normal: "ปกติ", watch: "เฝ้าระวัง", high: "มีสัญญาณควรติดตาม", critical: "ควรติดตามใกล้ชิด" }[result.home.level] || meta.label)
    : "";
  const assessmentColor = assessmentIncomplete ? "#64748b" : meta?.color || RISK_META.normal.color;
  const where = report.where;
  const placeName = where?.in_satun
    ? [where.village && `${where.moo ? `หมู่ ${where.moo} ` : ""}บ้าน${where.village}`, where.tambon && `ต.${where.tambon}`, where.district && `อ.${where.district}`].filter(Boolean).join(" ")
    : null;

  const speechFor = () => (result && meta ? riskSpeechText({
    label: assessmentLabel,
    place: placeName,
    reasons: [...result.home.reasons, ...(result.district?.risk_reasons || []).map((reason) => `อ.${result.district.district_name}: ${reason}`)],
    notice: officialNotice(result.home.level)
  }) : "");
  const listen = async () => {
    const ok = await readAloud(speechFor(), { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false) });
    if (ok) setSpeaking(true);
    else setThaiVoice(false);
  };
  const stopListening = () => { stopSpeaking(); setSpeaking(false); };
  const toggleAutoRead = () => {
    setAutoRead((value) => {
      try { window.localStorage.setItem(AUTO_READ_KEY, value ? "off" : "on"); } catch { /* ไม่จำก็ได้ */ }
      if (value) stopListening();
      return !value;
    });
  };
  // ประเมินเสร็จ (หรือกด "เช็กใหม่") → อ่านผลให้ฟังครั้งเดียวต่อผลประเมิน
  useEffect(() => {
    if (!result || !where?.in_satun || !autoRead || !report.at || spokenAt.current === report.at) return;
    spokenAt.current = report.at;
    readAloud(speechFor(), { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false) });
  });

  return (
    <div className="min-h-full bg-[#f4f8fc]" onPointerDownCapture={primeSpeech}>
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 md:py-8">
        <header>
          <h1 className="text-2xl font-black text-slate-900 md:text-3xl">บ้านฉันเสี่ยงไหม</h1>
          <p className="mt-1 text-slate-600">เลือกตำแหน่งบ้าน แล้วดูความเสี่ยงน้ำท่วม คลองใกล้บ้าน และที่พึ่งที่ใกล้ที่สุดในหน้าเดียว</p>
        </header>

        {/* เลือกตำแหน่ง */}
        <section className="rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5">
          <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
            <button
              type="button"
              onClick={locate}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0b4c86] px-4 font-bold text-white hover:bg-[#083865]"
            >
              <LocateFixed className="h-5 w-5" aria-hidden="true" /> {gps.state === "requesting" ? "กำลังหาตำแหน่ง…" : "ใช้ตำแหน่งปัจจุบัน"}
            </button>
            <div className="relative">
              <label htmlFor="home-search" className="sr-only">ค้นหาหมู่บ้านหรือตำบล</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="home-search"
                value={query}
                onChange={(event) => search(event.target.value)}
                placeholder="หรือพิมพ์ชื่อหมู่บ้าน / ตำบล"
                autoComplete="off"
                className="min-h-12 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-slate-900 outline-none focus:border-[#0b4c86] focus:ring-2 focus:ring-sky-200"
              />
              {results.state !== "idle" && (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                  {results.state === "loading" && <li className="px-3 py-2 text-sm text-slate-500">กำลังค้นหา…</li>}
                  {results.state === "done" && results.items.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">ไม่พบ ลองพิมพ์ชื่อตำบล หรือแตะบนแผนที่</li>}
                  {results.items.map((item) => (
                    <li key={`${item.name}-${item.lat}-${item.lng}`}>
                      <button
                        type="button"
                        onClick={() => { pick(item, "search"); setQuery(item.name); }}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-sky-50"
                      >
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0b4c86]" aria-hidden="true" />
                        <span>
                          <span className="block font-bold text-slate-900">{item.moo ? `หมู่ ${item.moo} ` : ""}{item.name}</span>
                          <span className="block text-xs text-slate-500">{[item.tambon && `ต.${item.tambon}`, item.district && `อ.${item.district}`].filter(Boolean).join(" ")}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {gps.message && <p className="mt-2 text-sm font-semibold text-amber-700">{gps.message}</p>}
          <button
            type="button"
            onClick={() => setShowMap((value) => !value)}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-[#0b4c86] hover:underline"
            aria-expanded={showMap}
          >
            <MapIcon className="h-4 w-4" aria-hidden="true" /> {showMap ? "ซ่อนแผนที่" : "ปักหมุดบ้านบนแผนที่"}
          </button>
          {showMap && (
            <div className="mt-2 h-72 overflow-hidden rounded-xl border border-slate-200">
              <MapContainer center={position ? [position.lat, position.lng] : SATUN_CENTER} zoom={position ? 14 : 9} style={{ height: "100%", width: "100%" }}>
                <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapClick position={position ? [position.lat, position.lng] : null} onPick={(point) => pick(point, "map")} />
                {position ? <Marker position={[position.lat, position.lng]} /> : null}
              </MapContainer>
            </div>
          )}
          {position && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
              <MapPin className="h-4 w-4 text-[#0b4c86]" aria-hidden="true" />
              {placeName || `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`}
              {position.source === "saved" ? <span className="text-xs text-slate-500">(ตำแหน่งที่เคยเช็กในเครื่องนี้)</span> : null}
              <button
                type="button"
                onClick={() => { setPosition(null); setReport({ state: "idle" }); try { window.localStorage.removeItem(HOME_KEY); } catch { /* ignore */ } }}
                className="inline-flex items-center gap-0.5 text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" /> ล้างตำแหน่ง
              </button>
            </p>
          )}
        </section>

        {report.state === "loading" && (
          <section className="rounded-2xl border border-[#c9dcee] bg-white p-5" role="status" aria-live="polite">
            <p className="font-bold text-slate-800">กำลังรวบรวมข้อมูลรอบบ้านคุณ</p>
            <ol className="mt-3 space-y-2">
              {LOAD_STEPS.map((step, index) => {
                const done = stepsDone.includes(step.key);
                return (
                  <li key={step.key} className="my-risk-step flex items-center gap-3 text-slate-700" style={{ animationDelay: `${index * 120}ms` }}>
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black transition-colors ${done ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                      {done ? "✓" : <span className="my-risk-step__spin h-3 w-3 rounded-full border-2 border-slate-300 border-t-[#0b4c86]" />}
                    </span>
                    <span className={done ? "font-semibold text-slate-900" : ""}>{step.label}</span>
                  </li>
                );
              })}
            </ol>
            <style>{`
              .my-risk-step { animation: my-risk-step-in .35s ease-out both; }
              @keyframes my-risk-step-in { from { opacity: 0; transform: translateY(6px); } }
              .my-risk-step__spin { animation: my-risk-spin .8s linear infinite; }
              @keyframes my-risk-spin { to { transform: rotate(360deg); } }
              @media (prefers-reduced-motion: reduce) { .my-risk-step, .my-risk-step__spin { animation: none; } }
            `}</style>
          </section>
        )}

        {report.state === "done" && where && !where.in_satun && (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 font-semibold text-amber-900" role="status">
            ตำแหน่งนี้อยู่นอกจังหวัดสตูล ระบบนี้มีข้อมูลเฉพาะในจังหวัดสตูล ลองค้นหาหมู่บ้านหรือปักหมุดใหม่
          </p>
        )}

        {result && where?.in_satun && (
          <>
            {/* คำตอบ */}
            <section className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: assessmentColor }} aria-live="polite">
              <div className="py-4 pl-4 pr-[150px] text-white sm:pr-[232px] md:pl-5" style={{ backgroundColor: assessmentColor }}>
                <p className="text-sm font-bold opacity-90">ภาพรวมสถานการณ์ใกล้ตำแหน่งที่เลือก</p>
                <p className="text-3xl font-black">{assessmentLabel}</p>
                <p className="mt-0.5 text-sm opacity-90">{placeName}</p>
              </div>
              <div className="p-4 md:p-5">
                <RiskMascot level={result.home.level} speaking={speaking} />
                <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                  เป็นการคัดกรองจากภาพรวมระดับอำเภอและสัญญาณที่พบใกล้ตำแหน่ง ไม่ใช่การวัดน้ำหน้าบ้านหรือการยืนยันว่าจะเกิดน้ำท่วม ระดับอาจเปลี่ยนเมื่อข้อมูลอัปเดต
                </p>
                {thaiVoice !== false ? (
                  <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <button type="button" onClick={speaking ? stopListening : listen} aria-pressed={speaking}
                      className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition ${speaking ? "bg-slate-900 text-white hover:bg-slate-700" : "bg-[#0b4c86] text-white hover:bg-[#083865]"}`}>
                      {speaking ? <Square className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
                      {speaking ? "หยุดอ่าน" : "ฟังผลประเมิน"}
                    </button>
                    <label className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                      <input type="checkbox" checked={autoRead} onChange={toggleAutoRead} className="h-4 w-4 accent-[#0b4c86]" />
                      อ่านให้ฟังเองทุกครั้งที่ประเมิน
                    </label>
                  </div>
                ) : null}
                {officialNotice(result.home.level) ? (
                  <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-3.5 text-[15px] leading-6 text-sky-950" role="note">
                    <p className="flex items-center gap-2 font-black"><Info className="h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" />{officialNotice(result.home.level).title}</p>
                    <p className="mt-1">{officialNotice(result.home.level).body}</p>
                    <p className="mt-2 font-semibold text-red-800">{officialNotice(result.home.level).urgent}</p>
                  </div>
                ) : null}
                <div className="space-y-3">
                  <section>
                    <h3 className="font-bold text-slate-900">สัญญาณใกล้ตำแหน่งที่เลือก</h3>
                    {result.home.reasons.length ? (
                      <ul className="mt-1 space-y-1.5 text-slate-800">
                        {result.home.reasons.map((reason) => <li key={reason} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />{reason}</li>)}
                      </ul>
                    ) : <p className="mt-1 text-sm leading-6 text-slate-600">จากข้อมูลที่มี ยังไม่พบสัญญาณเฉพาะจุดที่เข้าเกณฑ์ในบริเวณนี้ ทั้งนี้ไม่ได้ยืนยันว่าจะไม่มีน้ำท่วม</p>}
                  </section>
                  <section className="rounded-xl border border-slate-200 p-3">
                    <h3 className="font-bold text-slate-900">ภาพรวมอำเภอ{result.district?.district_name ? ` ${result.district.district_name}` : ""}</h3>
                    {result.district?.risk_reasons?.length ? (
                      <ul className="mt-1 space-y-1.5 text-sm leading-6 text-slate-700">
                        {result.district.risk_reasons.map((reason) => <li key={reason} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />{reason}</li>)}
                      </ul>
                    ) : <p className="mt-1 text-sm text-slate-600">{result.district ? "ยังไม่มีสัญญาณเด่นจากข้อมูลระดับอำเภอ" : "ข้อมูลภาพรวมระดับอำเภอยังโหลดไม่ได้ การประเมินครั้งนี้จึงมีข้อมูลไม่ครบ"}</p>}
                  </section>
                  <section className="rounded-xl border border-violet-200 bg-violet-50/70 p-3">
                    <h3 className="font-bold text-violet-950">พื้นที่ใกล้เคียงที่เคยท่วมจากภาพดาวเทียม GISTDA (ไม่เกิน 200 เมตร)</h3>
                    {report.floodHistoryState === "loading" ? (
                      <p className="mt-1 text-sm text-violet-900">กำลังตรวจสอบข้อมูล…</p>
                    ) : report.floodHistoryState === "unavailable" ? (
                      <p className="mt-1 text-sm text-violet-900">ตรวจสอบข้อมูล GISTDA ไม่สำเร็จ</p>
                    ) : report.floodHistory?.nearby_areas?.length ? (
                      <ul className="mt-1 space-y-2 text-sm leading-6 text-violet-950">
                        {report.floodHistory.nearby_areas.map((area, index) => (
                          <li key={`${area.district}-${area.tambon}-${area.distance_m}-${index}`} className="rounded-lg bg-white/75 px-2.5 py-2">
                            <span className="font-bold">{area.distance_m === 0 ? "ตรงตำแหน่งหมุด" : `ห่างจากหมุด ${area.distance_m} เมตร`}</span>
                            {area.frequency >= 2 ? " · ท่วมซ้ำ" : " · เคยท่วม"}
                            {area.years?.length ? <span> · ปี พ.ศ. {area.years.map((year) => Number(year) + 543).join(", ")}</span> : null}
                            {area.tambon || area.district ? <span className="block text-xs text-violet-800">{[area.tambon && `ต.${area.tambon}`, area.district && `อ.${area.district}`].filter(Boolean).join(" ")}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : <p className="mt-1 text-sm text-violet-900">ไม่มีประวัติน้ำท่วมในระยะ 200 เมตรจากจุดนี้</p>}
                  </section>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>ประมวลผลเมื่อ {report.at.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น. เวลานี้ไม่ใช่เวลาตรวจวัดของทุกแหล่งข้อมูล</span>
                  <button type="button" onClick={() => load(position)} className="inline-flex items-center gap-1 font-bold text-[#0b4c86] hover:underline">
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> เช็กใหม่
                  </button>
                </div>
              </div>
            </section>

            <div className="space-y-3">
            <h2 className="px-1 text-lg font-black text-slate-900">ข้อมูลประกอบการประเมินรอบบ้าน</h2>
            {/* รอบบ้านตอนนี้ */}
            <Card title="รอบบ้านตอนนี้" icon={Waves}>
              <div className="grid gap-2 sm:grid-cols-2">
                {result.station ? (() => {
                  const diff = Number(result.station.item.bankDiff);
                  const state = !Number.isFinite(diff) ? null : diff >= 0 ? "ล้นตลิ่ง" : diff > -0.5 ? "ใกล้ตลิ่ง" : "ต่ำกว่าตลิ่ง";
                  return (
                    <Fact
                      label={`คลองใกล้บ้าน • สถานี${result.station.item.name} (${distanceText(result.station.km)})`}
                      value={state ? `${state}${Number.isFinite(diff) ? ` ${Math.abs(diff).toFixed(2)} ม.` : ""}` : "ไม่มีข้อมูลตลิ่ง"}
                      tone={diff >= 0 ? "text-red-700" : diff > -0.5 ? "text-amber-700" : "text-emerald-700"}
                      note={[result.station.item.river, result.station.item.trend?.label, sourceTime(result.station.item.observedAt)].filter(Boolean).join(" • ")}
                    />
                  );
                })() : <Fact label="คลองใกล้บ้าน" value="ไม่มีสถานีวัด" />}
                {result.gauge ? (
                  <Fact
                    label={`ฝนวัดได้ 24 ชม. • ${result.gauge.item.name} (${distanceText(result.gauge.km)})`}
                    value={`${result.gauge.item.rain24h} มม.`}
                    tone={result.gauge.item.rain24h >= 90 ? "text-red-700" : result.gauge.item.rain24h >= 35 ? "text-amber-700" : "text-slate-900"}
                    note={[Number(result.gauge.item.rain1h) > 0 ? `ชั่วโมงล่าสุด ${result.gauge.item.rain1h} มม. (ฝนกำลังตก)` : "ชั่วโมงล่าสุดไม่มีฝน", sourceTime(result.gauge.item.observedAt)].filter(Boolean).join(" • ")}
                  />
                ) : <Fact label="ฝนวัดได้" value="ไม่มีสถานีวัด" />}
                <Fact
                  label="ความสูงพื้นที่"
                  value={report.elevation !== null ? elevationText(report.elevation) : "อ่านค่าไม่ได้"}
                  note={report.elevation !== null ? "ค่าประมาณจากแผนที่ภูมิประเทศ ความละเอียดราว 30 ม. ไม่ใช่ระดับพื้นบ้านหรือหลักฐานว่าน้ำจะท่วม" : null}
                  tone="text-slate-900"
                />
                <Fact
                  label={`รายงานน้ำจากประชาชนในรัศมี ${NEAR_REPORT_KM} กม. (วันนี้)`}
                  value={result.reports.length ? `${result.reports.length} จุด` : "ไม่มี"}
                  note={result.reports[0] ? `ใกล้สุด ${distanceText(result.reports[0].km)}: ${waterLevelMeta(result.reports[0].item.water_level)?.label || ""} ${result.reports[0].item.occurred_at ? `(${timeAgoText(result.reports[0].item.occurred_at)})` : ""}` : null}
                />
              </div>
              {result.floodArea && (
                <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-800">
                  หมู่บ้านนี้อยู่ในพื้นที่น้ำท่วมที่เจ้าหน้าที่บันทึกวันนี้: {floodAreaMapMeta(result.floodArea).description}
                </p>
              )}
            </Card>

            {/* พยากรณ์จุดเสี่ยงน้ำท่วม 7 วัน (รายตำบล) */}
            {report.outlook ? <FloodOutlookCard outlook={report.outlook} /> : null}

            {/* ข้างหน้า */}
            {result.district && (
              <Card title={`ข้างหน้า • อ.${result.district.district_name}`} icon={CloudRain}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[["วันนี้", result.district.heavy_rain_today], ["พรุ่งนี้", result.district.heavy_rain_tomorrow]].map(([label, item]) => item && (
                    <Fact
                      key={label}
                      label={`โอกาสฝนหนัก ${label}`}
                      value={`${item.prob_heavy}%`}
                      tone={item.prob_heavy >= 50 ? "text-red-700" : item.prob_heavy >= 20 ? "text-amber-700" : "text-slate-900"}
                      note={heavyRainNote(item)}
                    />
                  ))}
                </div>
                {result.rivers.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm">
                    {result.rivers.map((river) => (
                      <li key={river.station} className="flex justify-between gap-2">
                        <span className="text-slate-700">น้ำในคลอง 7 วัน • {river.station}</span>
                        <span className={`font-bold ${river.level === "very_high" ? "text-red-700" : river.level === "high" ? "text-amber-700" : "text-emerald-700"}`}>{DISCHARGE_LEVELS[river.level]?.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/public/weather-watch" className="mt-3 inline-block text-sm font-bold text-[#0b4c86] hover:underline">ดูพยากรณ์ 7 วัน →</Link>
              </Card>
            )}

            {/* ที่พึ่งใกล้บ้าน */}
            <Card title="ที่พึ่งใกล้บ้าน" icon={Hospital}>
              <ul className="divide-y divide-slate-100">
                {/* แสดงเฉพาะศูนย์ที่เปิดใช้ในเหตุการณ์ที่ยังเปิดอยู่ (เซิร์ฟเวอร์กรองแล้ว) — ปิด EOC แล้วรายการจะว่าง */}
                {sheltersOpen && result.shelters.map(({ item, km }) => (
                  <li key={`s-${item.id}`} className="flex items-center gap-3 py-2.5">
                    <Tent className="h-5 w-5 shrink-0 text-violet-700" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-slate-900">{item.sheltername}</span>
                      <span className="block text-xs text-slate-500">ศูนย์พักพิง • {distanceText(km)}{item.shelter_capacity ? ` • ว่าง ${item.vacancy} จาก ${item.shelter_capacity} คน` : ""}</span>
                    </span>
                    <a href={directions(item.lat, item.lon)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#0b4c86] px-3 py-2 text-xs font-bold text-white hover:bg-[#083865]">
                      <Navigation className="h-3.5 w-3.5" aria-hidden="true" /> นำทาง
                    </a>
                  </li>
                ))}
                {[result.hospital, ...result.primary].filter(Boolean).map(({ item, km }) => {
                  const service = serviceStatusMeta(item.service_status);
                  const phone = phoneLinks(item.phone)[0];
                  return (
                    <li key={`h-${item.id}`} className="flex items-center gap-3 py-2.5">
                      <Hospital className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-slate-900">{item.name}</span>
                        <span className="block text-xs text-slate-500">
                          {facilityTypeInfo(item.typecode).label} • {distanceText(km)}
                          {item.service_status ? <> • <span style={{ color: service.color }} className="font-bold">{service.label}</span></> : null}
                        </span>
                      </span>
                      {phone ? (
                        <a href={phone.href} className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50" aria-label={`โทร ${item.name}`}><Phone className="h-4 w-4" /></a>
                      ) : null}
                      <a href={directions(item.lat, item.lon)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#0b4c86] px-3 py-2 text-xs font-bold text-white hover:bg-[#083865]">
                        <Navigation className="h-3.5 w-3.5" aria-hidden="true" /> นำทาง
                      </a>
                    </li>
                  );
                })}
              </ul>
              {!sheltersOpen
                ? <p className="mt-2 text-xs text-slate-500">ศูนย์พักพิงจะแสดงเมื่อเปิดศูนย์ปฏิบัติการ (EOC)</p>
                : !result.shelters.length ? <p className="mt-2 text-xs text-slate-500">ขณะนี้ยังไม่มีศูนย์พักพิงที่เปิดรับผู้อพยพ</p> : null}
            </Card>
            </div>

            <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="font-bold text-red-900">ต้องการความช่วยเหลือ</p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm font-bold">
                <a href="tel:1669" className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-white hover:bg-red-700"><Phone className="h-4 w-4" aria-hidden="true" /> 1669 เจ็บป่วยฉุกเฉิน</a>
                <a href="tel:1784" className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-red-800 hover:bg-red-100"><Phone className="h-4 w-4" aria-hidden="true" /> 1784 สาธารณภัย</a>
                <HelpRequestLink className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-red-800 hover:bg-red-100" disabledClassName="cursor-not-allowed opacity-50">
                  <Siren className="h-4 w-4" aria-hidden="true" /> ขอความช่วยเหลือ
                </HelpRequestLink>
                {floodOpen ? (
                  <Link href={`/public/report-water?lat=${position.lat}&lng=${position.lng}`} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-white px-3 py-2 text-sky-800 hover:bg-sky-50">
                    <Waves className="h-4 w-4" aria-hidden="true" /> รายงานระดับน้ำที่นี่
                  </Link>
                ) : null}
              </div>
            </section>

            {where?.in_satun ? (
              <AlertSubscribeCard
                defaultDistrict={normalizeName(where.district)}
                tambon={report.outlook ? { key: report.outlook.key, tambon: report.outlook.tambon } : null}
              />
            ) : null}

            <p className="flex items-center gap-1.5 text-xs leading-5 text-slate-500">
              <Mountain className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ข้อมูล: ระดับน้ำและฝนจาก ThaiWater (สสน.) • ความเสี่ยงอำเภอจากหน้าพยากรณ์และความเสี่ยง • ความสูงพื้นที่จาก AWS Terrain Tiles (~30 ม.) • พื้นที่น้ำท่วมและรายงานประชาชนที่เจ้าหน้าที่ตรวจแล้ว
            </p>
          </>
        )}

        {!position && (
          <p className="text-center text-sm text-slate-500">
            ระบบไม่บันทึกตำแหน่งบ้านของคุณไว้ที่ศูนย์ จำไว้เฉพาะในเครื่องนี้เพื่อให้กลับมาเช็กได้เร็ว
          </p>
        )}
      </div>
    </div>
  );
}

const AUTO_READ_KEY = "stn-my-risk-autoread";

// น้องสจ๊วตตามระดับความเสี่ยง: ปกติ / เฝ้าระวัง / เสี่ยง และเสี่ยงสูง (ท่าทางเดียวกัน)
// ลอยอยู่มุมขวาบนของการ์ดคำตอบ ทับขอบแถบสีเล็กน้อย ข้อความด้านล่างไหลอ้อมตัวน้อง
const RISK_MASCOTS = {
  normal: { src: "/stn-eoc/img/mascot/risk-normal.webp", motion: "my-risk-mascot--calm" },
  watch: { src: "/stn-eoc/img/mascot/risk-watch.webp", motion: "my-risk-mascot--alert" },
  high: { src: "/stn-eoc/img/mascot/risk-high.webp", motion: "my-risk-mascot--urgent" },
  critical: { src: "/stn-eoc/img/mascot/risk-high.webp", motion: "my-risk-mascot--urgent" }
};

function RiskMascot({ level, speaking = false }) {
  const mascot = RISK_MASCOTS[level] || RISK_MASCOTS.normal;
  return (
    <span key={level} className="my-risk-mascot float-right -mr-1 -mt-[96px] ml-2 block h-[150px] sm:-mt-[100px] sm:h-[215px]" aria-hidden="true">
      <span className={`block h-full ${speaking ? "my-risk-mascot--talk" : mascot.motion}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ภาพโปร่งใสที่เตรียมไว้แล้ว */}
        <img src={mascot.src} alt="" className="h-full w-auto select-none drop-shadow-[0_8px_10px_rgba(15,23,42,.18)]" draggable={false} />
      </span>
      <style>{`
        .my-risk-mascot { animation: my-risk-mascot-in .5s cubic-bezier(.2,.9,.3,1.2) both; transform-origin: 50% 100%; }
        .my-risk-mascot--calm { transform-origin: 50% 100%; animation: my-risk-mascot-float 3.6s ease-in-out .5s infinite; }
        .my-risk-mascot--alert { transform-origin: 50% 100%; animation: my-risk-mascot-sway 2.8s ease-in-out .5s infinite; }
        .my-risk-mascot--urgent { transform-origin: 50% 100%; animation: my-risk-mascot-shake 4s ease-in-out .5s infinite; }
        .my-risk-mascot--talk { transform-origin: 50% 100%; animation: my-risk-mascot-talk .5s ease-in-out infinite; }
        @keyframes my-risk-mascot-talk { 0%,100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-3px) scaleY(1.015); } }
        @keyframes my-risk-mascot-in { from { opacity: 0; transform: translateY(14px) scale(.88); } }
        @keyframes my-risk-mascot-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes my-risk-mascot-sway { 0%,100% { transform: rotate(-1.5deg); } 50% { transform: rotate(1.5deg) translateY(-3px); } }
        @keyframes my-risk-mascot-shake { 0%,70%,100% { transform: translateX(0) rotate(0); } 74% { transform: translateX(-3px) rotate(-2deg); } 78% { transform: translateX(3px) rotate(2deg); } 82% { transform: translateX(-2px) rotate(-1deg); } 86% { transform: translateX(2px) rotate(1deg); } 90% { transform: translateX(0); } }
        @media (prefers-reduced-motion: reduce) { .my-risk-mascot, .my-risk-mascot--calm, .my-risk-mascot--alert, .my-risk-mascot--urgent, .my-risk-mascot--talk { animation: none; } }
      `}</style>
    </span>
  );
}

export default function MyRiskPage() {
  return (
    <PublicLayout>
      <Suspense fallback={<div className="p-6 text-slate-500">กำลังโหลด…</div>}>
        <MyRiskContent />
      </Suspense>
    </PublicLayout>
  );
}
