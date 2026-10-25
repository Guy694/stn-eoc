"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Anchor,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudLightning,
  CloudRain,
  Droplets,
  ExternalLink,
  Haze,
  HousePlus,
  Layers,
  LocateFixed,
  Map as MapIcon,
  Megaphone,
  MountainSnow,
  Phone,
  RefreshCw,
  Satellite,
  ShieldCheck,
  Siren,
  Sun,
  Tent,
  Thermometer,
  Tornado,
  Umbrella,
  Waves,
  Wind,
  Cctv,
  Hospital,
  Landmark,
  MapPinned,
  Route,
  Signpost,
  History
} from "lucide-react";
import AIChatbot from "@/components/AIChatbot";
import HelpRequestLink from "@/components/public/HelpRequestLink";
import useHelpAvailability from "@/components/public/useHelpAvailability";
import PublicTopNavigation from "@/components/public/PublicTopNavigation";
import { GLASS, MenuToggle, SectionTitle, SidebarItem, WindyFrame } from "@/components/public/map/WindyStyleControls";
import {
  WINDY_OVERLAYS,
  WINDY_PRODUCTS,
  buildWindyEmbedUrl,
  buildWindyWebsiteUrl
} from "@/components/public/disaster-map/windyLayers";
import { RISK_LEVELS, RISK_META } from "@/lib/weatherRiskConfig";
import { FLOOD_FREQ_CLASSES } from "@/lib/floodFreq";
import ElevationLegend from "@/components/public/map/ElevationLegend";
import { DISCHARGE_LEVELS } from "@/lib/forecastSignals";
import { PM25_UNIT } from "@/lib/pm25";
import Pm25Card, { Pm25Dot, Pm25Legend } from "@/components/weather/Pm25Card";
import SeaLevelCard, { SeaLevelPill } from "@/components/weather/SeaLevelCard";
import { heavyRainNote } from "@/lib/rainNowcast";

const WeatherRiskMap = dynamic(() => import("@/components/weather/WeatherRiskMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-slate-800 text-sm font-bold text-white/70">กำลังโหลดแผนที่…</div>
});

const WEATHER_ICONS = { Wind, Tornado, CloudRain, Umbrella, CloudLightning, Thermometer, Cloud, Droplets, Waves };

const BASE_MAPS = [
  { key: "street", label: "แผนที่ถนน", icon: MapIcon, tone: "from-sky-400 to-blue-600" },
  { key: "satellite", label: "ภาพดาวเทียม", icon: Satellite, tone: "from-emerald-500 to-slate-700" },
  { key: "topo", label: "ภูมิประเทศ", icon: Layers, tone: "from-lime-400 to-green-700" }
];

// ชั้นข้อมูลสถานการณ์ตอนนี้ (เดิมอยู่ที่หน้าแผนที่สถานการณ์)
const SITUATION_ITEMS = [
  { key: "tide", label: "น้ำขึ้น–น้ำลง (ทะเลอันดามัน)", icon: Waves, tone: "from-cyan-400 to-blue-700", title: "ระดับน้ำทะเลหน้าสตูลตอนนี้ ลูกศรบอกน้ำกำลังขึ้นหรือลง ชี้ที่สัญลักษณ์เพื่อดูเวลาน้ำขึ้นสูงสุด/ลงต่ำสุดรอบถัดไป" },
  { key: "rainStations", label: "ฝนวัดจริง (ThaiWater)", icon: Umbrella, tone: "from-sky-300 to-indigo-600" },
  { key: "cctv", label: "กล้อง CCTV ริมคลอง (ปภ.)", icon: Cctv, tone: "from-slate-500 to-sky-800", title: "แตะไอคอนกล้องบนแผนที่เพื่อดูภาพล่าสุดของคลอง 2 มุม จากกรมป้องกันและบรรเทาสาธารณภัย (อัปเดตทุก 1 นาที)" },
  { key: "hospitals", label: "สถานพยาบาล", icon: Hospital, tone: "from-blue-500 to-blue-800", title: "หมุดน้ำเงินตัว H · จุดสีที่มุม = สถานะ: เขียว เปิดปกติ · เหลือง จำกัดบริการ/ถนนน้ำท่วม · แดง ปิดหรือน้ำท่วม · เทา ยังไม่มีรายงาน" },
  { key: "traffic", label: "เส้นทาง/ถนน", icon: Route, tone: "from-rose-400 to-red-600", title: "รายงานการสัญจรที่เจ้าหน้าที่ตรวจแล้ว: เขียว ผ่านได้ · เหลือง ผ่านลำบาก · แดง ผ่านไม่ได้" },
  { key: "floodFreq", label: "น้ำท่วมซ้ำซาก (GISTDA)", icon: History, tone: "from-sky-400 to-violet-800", title: "พื้นที่ที่เคยถูกน้ำท่วมจากภาพดาวเทียม GISTDA พ.ศ. 2554–2567 สีเข้มขึ้นเมื่อท่วมหลายปี ใช้ประกอบการเตรียมรับมือ ไม่ใช่สถานการณ์น้ำตอนนี้" },
  { key: "waterways", label: "เส้นทางน้ำ/คลอง", icon: Signpost, tone: "from-cyan-400 to-sky-600" },
  { key: "tambon", label: "ขอบเขตตำบล", icon: MapPinned, tone: "from-emerald-300 to-teal-600" },
  { key: "district", label: "ขอบเขตอำเภอ", icon: Landmark, tone: "from-slate-400 to-slate-700" }
];

const EMERGENCY_CONTACTS = [
  { number: "1669", label: "เจ็บป่วยฉุกเฉิน" },
  { number: "1784", label: "สาธารณภัย (ปภ.)" },
  { number: "191", label: "เหตุด่วนเหตุร้าย" },
  { number: "1182", label: "กรมอุตุนิยมวิทยา" }
];

function riskMeta(level) {
  return RISK_META[level] || RISK_META.normal;
}

function worstLevel(levels) {
  return levels.reduce((worst, level) => (RISK_LEVELS.indexOf(level) > RISK_LEVELS.indexOf(worst) ? level : worst), "normal");
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(value, index) {
  if (index === 0) return "วันนี้";
  if (index === 1) return "พรุ่งนี้";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("th-TH", { weekday: "short", day: "numeric" });
}

function distanceKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** คำแนะนำสำหรับประชาชนตามระดับความเสี่ยงของพื้นที่ */
function adviceFor(district) {
  if (!district) return [];
  const level = district.risk_level;
  const items = [];
  if (level === "critical") {
    items.push("เตรียมพร้อมอพยพ ขนย้ายสิ่งของขึ้นที่สูง และติดตามประกาศจากอำเภอ/ท้องถิ่นทุกชั่วโมง");
    items.push("ตรวจสอบศูนย์พักพิงที่ใกล้ที่สุด และเส้นทางไปศูนย์พักพิงไว้ล่วงหน้า");
  }
  if (level === "high" || level === "critical") {
    items.push("หลีกเลี่ยงการเดินทางผ่านทางน้ำไหล สะพานข้ามคลอง และถนนที่น้ำท่วมขัง");
    items.push("เตรียมยาประจำตัว เอกสารสำคัญ ไฟฉาย และโทรศัพท์ที่ชาร์จเต็ม");
    items.push("ดูแลผู้สูงอายุ เด็ก ผู้ป่วยติดเตียง และผู้พิการในบ้านเป็นพิเศษ");
  }
  if (level === "watch") {
    items.push("ติดตามพยากรณ์และประกาศเตือนภัยเป็นระยะ");
    items.push("เก็บสิ่งของสำคัญให้พ้นจากจุดที่น้ำเคยขัง และตรวจสอบทางระบายน้ำรอบบ้าน");
  }
  if (district.thunder_expected) {
    items.push("ช่วงฝนฟ้าคะนอง หลีกเลี่ยงที่โล่งแจ้ง ต้นไม้ใหญ่ และการใช้โทรศัพท์ขณะชาร์จไฟ");
  }
  if (district.landslide_risk && district.landslide_risk !== "normal") {
    items.push("ผู้อยู่อาศัยเชิงเขา/ลาดชัน สังเกตน้ำป่าขุ่นข้น เสียงดังผิดปกติ หรือดินแยก และอพยพทันทีเมื่อพบ");
  }
  if (Number(district.wind_speed) >= 22) {
    items.push("ลมแรง ระวังต้นไม้และป้ายโฆษณาล้ม ยึดสิ่งของรอบบ้านให้แน่น");
  }
  if (items.length === 0) {
    items.push("สภาพอากาศอยู่ในเกณฑ์ปกติ ใช้ชีวิตได้ตามปกติ และติดตามข้อมูลล่าสุดเป็นระยะ");
  }
  return items;
}

function RiskBadge({ level, large = false }) {
  const meta = riskMeta(level);
  return (
    <span
      className={`inline-flex items-center rounded-full font-black text-white shadow ${large ? "px-4 py-1.5 text-base" : "px-2.5 py-0.5 text-xs"}`}
      style={{ backgroundColor: meta.color }}
    >
      {meta.label}
    </span>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
      <div className="flex items-center gap-1 text-[11px] font-bold text-white/60">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
      </div>
      <div className="mt-0.5 text-sm font-black">{value}</div>
    </div>
  );
}

const DDPM_CCTV_URL = "https://cctv.disaster.go.th/dashboard";

const WATER_STATE = {
  overflow: { label: "ล้นตลิ่ง", className: "text-red-300" },
  near: { label: "ใกล้ตลิ่ง", className: "text-amber-300" },
  normal: { label: "ต่ำกว่าตลิ่ง", className: "text-emerald-300" }
};

const RIVER_TONE = { normal: "text-emerald-300", high: "text-amber-300", very_high: "text-red-300" };

function SourceTag({ children }) {
  return <span className="rounded bg-white/10 px-1.5 py-px text-[10px] font-bold text-white/70">{children}</span>;
}

function formatThaiDateShort(value) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
}

// ภาพจาก สสน.: เวลาของเรดาร์เป็น UTC ส่วนภาพพยากรณ์เป็นเวลาไทย
function mediaTime(item) {
  if (!item?.datetime) return "";
  const iso = `${item.datetime.replace(" ", "T")}:00${item.timezone === "UTC" ? "Z" : "+07:00"}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? item.datetime : date.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function MediaThumb({ item, label }) {
  if (!item?.url) return null;
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="group block overflow-hidden rounded-lg bg-white ring-1 ring-white/15 hover:ring-sky-300">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.thumb || item.url} alt={label} loading="lazy" className="aspect-[4/3] w-full object-cover object-left-bottom" />
      <span className="block bg-slate-900/90 px-1.5 py-1 text-[10px] font-bold leading-tight text-white">{label}</span>
    </a>
  );
}

/** embedded = แสดงในหน้าเจ้าหน้าที่ (ใน EOCLayout): ไม่มีแถบเมนูประชาชนและผู้ช่วย AI ของหน้าประชาชน */
export default function WeatherWatchWorkspace({ embedded = false }) {
  const [data, setData] = useState(null);
  const { sheltersOpen } = useHelpAvailability();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [viewMode, setViewMode] = useState("risk"); // risk | windy
  const [windyOverlay, setWindyOverlay] = useState("rain");
  const [windyProduct, setWindyProduct] = useState("ecmwf");
  const [baseMap, setBaseMap] = useState("street");

  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [flyTarget, setFlyTarget] = useState(null);
  const [selectedDay, setSelectedDay] = useState(0);

  // หน้านี้ = แผนที่สถานการณ์และความเสี่ยง: ความเสี่ยง/พยากรณ์รายอำเภอ + ชั้นข้อมูลสถานการณ์ตอนนี้ (ย้ายมาจากหน้าแผนที่สถานการณ์)
  const [situationLayers, setSituationLayers] = useState({ tide: true, rainStations: true, cctv: true });
  const [floodFreqStatus, setFloodFreqStatus] = useState(null);
  const onFloodFreqStatus = useCallback((status) => setFloodFreqStatus(status), []);
  const toggleSituation = (key) => {
    setViewMode("risk");
    setSituationLayers((current) => ({ ...current, [key]: !current[key] }));
  };
  const [elevationEnabled, setElevationEnabled] = useState(false);
  // สีพื้นที่อำเภอบนแผนที่: ความเสี่ยงน้ำท่วม/ดินถล่ม หรือ ฝุ่น PM2.5
  const [colorBy, setColorBy] = useState("risk");
  const [pm25, setPm25] = useState(null);
  const [pm25Error, setPm25Error] = useState("");
  const [seaLevel, setSeaLevel] = useState(null);
  const [seaLevelError, setSeaLevelError] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
    }
  }, []);

  const loadWeather = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/stn-eoc/api/public/weather-watch", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "โหลดข้อมูลไม่สำเร็จ");
      setData(payload);
    } catch (err) {
      console.error("Weather Watch load error:", err);
      setError(err.message || "ไม่สามารถโหลดข้อมูลสภาพอากาศได้");
    } finally {
      setLoading(false);
    }
  }, []);

  // ฝุ่น PM2.5 (GISTDA ออกค่าทุกชั่วโมง) — โหลดแยก ไม่ให้หน้ารอ
  const loadPm25 = useCallback(async () => {
    try {
      const response = await fetch("/stn-eoc/api/public/pm25");
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "ยังดึงข้อมูลฝุ่น PM2.5 ไม่ได้");
      setPm25(payload);
      setPm25Error("");
    } catch (err) {
      setPm25Error(err.message || "ยังดึงข้อมูลฝุ่น PM2.5 ไม่ได้");
    }
  }, []);

  useEffect(() => {
    loadPm25();
    const timer = window.setInterval(loadPm25, 30 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [loadPm25]);

  // ระดับน้ำทะเล/น้ำทะเลหนุน (สถานี IOC ลังกาวี วัดรายนาที) — โหลดแยก อัปเดตทุก 10 นาที
  const loadSeaLevel = useCallback(async () => {
    try {
      const response = await fetch("/stn-eoc/api/public/sea-level");
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "ยังดึงข้อมูลระดับน้ำทะเลไม่ได้");
      setSeaLevel(payload);
      setSeaLevelError("");
    } catch (err) {
      setSeaLevelError(err.message || "ยังดึงข้อมูลระดับน้ำทะเลไม่ได้");
    }
  }, []);

  useEffect(() => {
    loadSeaLevel();
    const timer = window.setInterval(loadSeaLevel, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [loadSeaLevel]);

  useEffect(() => {
    loadWeather();
    const timer = window.setInterval(loadWeather, 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [loadWeather]);





  const districts = useMemo(() => data?.district_weather || [], [data?.district_weather]);
  const current = data?.weather_current || {};
  const marine = data?.marine || null;
  const warnings = data?.weather_warnings || [];
  const riverOutlook = data?.river_outlook || [];
  const hiiMedia = data?.hii_media || null;
  const [mediaTab, setMediaTab] = useState("rain");

  // เริ่มต้นเลือกอำเภอที่เสี่ยงที่สุด
  useEffect(() => {
    if (!selectedDistrictId && districts.length > 0) {
      setSelectedDistrictId(String(districts[0].district_id));
    }
  }, [districts, selectedDistrictId]);

  const selectedDistrict = districts.find((item) => String(item.district_id) === String(selectedDistrictId)) || null;
  const districtsAtRisk = districts.filter((item) => item.risk_level !== "normal").length;
  const provinceLevel = worstLevel([current.risk_level || "normal", marine?.risk_level || "normal"]);
  const dailyForecast = selectedDistrict?.forecast_daily || [];
  const dayForecast = dailyForecast[selectedDay] || null;
  const hourlyForecast = selectedDistrict?.forecast_hourly || [];
  const advice = useMemo(() => adviceFor(selectedDistrict), [selectedDistrict]);
  const districtRivers = riverOutlook.filter((item) => selectedDistrict && String(item.amphoe || "").replace(/^อ(\.|ำเภอ)\s*/, "").replace(/\s+/g, "") === String(selectedDistrict.district_name).replace(/\s+/g, ""));

  const isWindy = viewMode === "windy";
  const windyUrl = useMemo(() => buildWindyEmbedUrl({ overlay: windyOverlay, product: windyProduct }), [windyOverlay, windyProduct]);

  const selectDistrict = useCallback((districtId) => {
    setSelectedDistrictId(String(districtId));
    setSelectedDay(0);
    setPanelOpen(true);
    const district = districts.find((item) => String(item.district_id) === String(districtId));
    if (district) setFlyTarget({ latitude: district.latitude, longitude: district.longitude, zoom: 11, at: Date.now() });
  }, [districts]);

  const locateMe = () => {
    if (!navigator.geolocation) {
      setLocationMessage("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    setLocationMessage("กำลังระบุตำแหน่ง…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const here = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setUserLocation(here);
        setViewMode("risk");
        const nearest = districts
          .map((district) => ({ district, km: distanceKm(here, district) }))
          .sort((a, b) => a.km - b.km)[0];
        if (!nearest || nearest.km > 60) {
          setLocationMessage("ตำแหน่งของคุณอยู่นอกจังหวัดสตูล กรุณาเลือกอำเภอเอง");
          setFlyTarget({ ...here, zoom: 10, at: Date.now() });
          return;
        }
        setLocationMessage(`ตำแหน่งของคุณใกล้ อ.${nearest.district.district_name}`);
        setSelectedDistrictId(String(nearest.district.district_id));
        setSelectedDay(0);
        setFlyTarget({ ...here, zoom: 12, at: Date.now() });
      },
      () => setLocationMessage("ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง กรุณาเลือกอำเภอจากรายการ"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  return (
    <div className={embedded ? "flex h-[calc(100dvh-12rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl bg-slate-900" : "flex h-dvh flex-col overflow-hidden bg-slate-900"}>
      {embedded ? null : <PublicTopNavigation activeMenu="weather" showWeatherMenu bottomBar="off" />}

      <main className="relative min-h-0 flex-1 overflow-hidden" aria-label="แผนที่สถานการณ์และความเสี่ยง">
        <div className={`absolute inset-0 ${isWindy ? "invisible" : ""}`} aria-hidden={isWindy}>
          <WeatherRiskMap
            districts={districts}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={selectDistrict}
            baseMap={baseMap}
            userLocation={userLocation}
            flyTarget={flyTarget}
            elevationEnabled={elevationEnabled}
            colorBy={colorBy}
            pm25={pm25}
            situationLayers={situationLayers}
            tide={situationLayers.tide ? seaLevel : null}
            onFloodFreqStatus={onFloodFreqStatus}
          />
        </div>
        {isWindy && <WindyFrame src={windyUrl} />}

        {/* บน: ภาพรวมจังหวัด */}
        <div className="pointer-events-none absolute left-1/2 top-3 z-[690] hidden -translate-x-1/2 lg:block">
          <div className={`pointer-events-auto flex items-center gap-3 rounded-full py-1.5 pl-2 pr-2 text-sm ${GLASS}`}>
            <RiskBadge level={provinceLevel} />
            <span className="font-bold">จ.สตูล ตอนนี้: {current.weather_condition || "-"} {current.temperature ?? "-"}°C</span>
            <span className="text-white/60">|</span>
            <span className="font-semibold text-white/85">พื้นที่ต้องเฝ้าระวัง {districtsAtRisk}/{districts.length || 7} อำเภอ</span>
            {pm25?.province ? (
              <>
                <span className="text-white/60">|</span>
                <button type="button" onClick={() => { setViewMode("risk"); setColorBy("pm25"); }} className="flex items-center gap-1.5 rounded-full px-1.5 font-semibold text-white/85 hover:bg-white/10" title="ดูฝุ่น PM2.5 รายอำเภอบนแผนที่">
                  <Pm25Dot value={pm25.province.value} />
                  PM2.5 {pm25.province.value} <span className="text-[11px] font-normal text-white/60">{PM25_UNIT}</span>
                </button>
              </>
            ) : null}
            {seaLevel?.status ? (
              <>
                <span className="text-white/60">|</span>
                <SeaLevelPill data={seaLevel} />
              </>
            ) : null}
            <span className="text-white/60">|</span>
            <span className="text-xs text-white/70">อัปเดต {formatTime(current.observed_at)} น.</span>
            <button
              type="button"
              onClick={loadWeather}
              className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="โหลดข้อมูลล่าสุด"
              title="โหลดข้อมูลล่าสุด"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ซ้าย: เช็คความเสี่ยงพื้นที่ของฉัน */}
        <section
          className={`absolute z-[700] flex flex-col overflow-hidden rounded-2xl ${GLASS}
            left-3 top-3 w-[360px] max-h-[calc(100%-7rem)]
            max-md:inset-x-2 max-md:top-auto max-md:bottom-2 max-md:w-auto max-md:max-h-[62%]
            ${sidebarOpen ? "max-md:hidden" : ""}`}
          aria-label="เช็คความเสี่ยงพื้นที่ของฉัน"
        >
          <button
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 text-left"
            aria-expanded={panelOpen}
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-300" aria-hidden="true" />
              <span className="text-base font-black">เช็คความเสี่ยงพื้นที่ของคุณ</span>
            </span>
            {panelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {panelOpen && (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 [scrollbar-width:thin]">
              <div className="flex gap-2">
                <select
                  value={selectedDistrictId}
                  onChange={(event) => selectDistrict(event.target.value)}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-white/15 bg-slate-800 px-2 text-sm font-bold text-white outline-none focus:border-sky-400"
                  aria-label="เลือกอำเภอ"
                  disabled={districts.length === 0}
                >
                  {districts.length === 0 && <option value="">{loading ? "กำลังโหลด…" : "ไม่มีข้อมูล"}</option>}
                  {districts.map((district) => (
                    <option key={district.district_id} value={district.district_id}>อ.{district.district_name} — {riskMeta(district.risk_level).label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={locateMe}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-sky-500 px-3 text-sm font-black text-white hover:bg-sky-400"
                >
                  <LocateFixed className="h-4 w-4" aria-hidden="true" /> ตำแหน่งฉัน
                </button>
              </div>
              {locationMessage && <p className="text-xs font-semibold text-sky-200">{locationMessage}</p>}

              {warnings.length > 0 && (
                <div className="space-y-1.5" role="alert">
                  {warnings.slice(0, 4).map((warning) => (
                    <div key={`${warning.issued_at}-${warning.message}`} className={`rounded-lg px-3 py-2 text-[12px] font-semibold leading-snug ${warning.level === "high" ? "bg-red-600/85" : "bg-amber-400/90 text-slate-950"}`}>
                      <span className="flex items-center gap-1.5 font-black"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> ประกาศเตือน{warning.issued_at ? ` • ${formatTime(String(warning.issued_at).replace(" ", "T"))} น.` : ""}</span>
                      <span className="mt-0.5 block">{warning.message}</span>
                      <span className="mt-0.5 block text-[10px] opacity-80">ที่มา: {warning.source}</span>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <p className="rounded-lg bg-red-500/20 p-3 text-sm font-bold text-red-100">
                  {error} — ระบบจะไม่แสดงข้อมูลจำลอง
                </p>
              )}

              {selectedDistrict && (
                <>
                  <div className="rounded-xl p-3" style={{ backgroundColor: `${riskMeta(selectedDistrict.risk_level).color}33` }}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-white/70">ระดับความเสี่ยงวันนี้</p>
                        <p className="text-lg font-black">อ.{selectedDistrict.district_name}</p>
                      </div>
                      <RiskBadge level={selectedDistrict.risk_level} large />
                    </div>
                    <ul className="mt-2 space-y-1 text-[13px] font-semibold text-white/90">
                      {(selectedDistrict.risk_reasons || []).map((reason) => (
                        <li key={reason} className="flex gap-1.5"><span aria-hidden="true">•</span>{reason}</li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
                      <span className="rounded-full bg-black/25 px-2 py-0.5">น้ำท่วม: {riskMeta(selectedDistrict.flood_risk).label}</span>
                      <span className="rounded-full bg-black/25 px-2 py-0.5">ดินถล่ม: {riskMeta(selectedDistrict.landslide_risk).label}</span>
                      {selectedDistrict.thunder_expected && <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-slate-900">ฟ้าคะนอง</span>}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs font-black text-white/70">
                      ขณะนี้ • {selectedDistrict.weather_condition}
                      <SourceTag>{selectedDistrict.condition_source === "gauge" ? "วัดจากสถานี" : "แบบจำลอง"}</SourceTag>
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <Stat icon={CloudRain} label="ฝน 1 ชม." value={selectedDistrict.rain_now?.stations ? `${selectedDistrict.rainfall_1h} มม.` : "ไม่มีสถานี"} />
                      <Stat icon={Umbrella} label={selectedDistrict.rain_source === "gauge" ? "ฝนวัดได้ 24 ชม." : "ฝน 24 ชม. (ประมาณ)"} value={`${selectedDistrict.rainfall_24h} มม.`} />
                      <Stat
                        icon={Waves}
                        label="น้ำในคลอง"
                        value={selectedDistrict.water_status
                          ? <span className={WATER_STATE[selectedDistrict.water_status.state]?.className}>{WATER_STATE[selectedDistrict.water_status.state]?.label}</span>
                          : "ไม่มีสถานี"}
                      />
                      <Stat icon={Thermometer} label="อุณหภูมิ" value={`${selectedDistrict.temperature}°C`} />
                      <Stat icon={Droplets} label="ความชื้น" value={`${selectedDistrict.humidity}%`} />
                      <Stat icon={Wind} label={`ลม${selectedDistrict.wind_direction && selectedDistrict.wind_direction !== "-" ? ` (${selectedDistrict.wind_direction})` : ""}`} value={`${selectedDistrict.wind_speed} กม./ชม.`} />
                    </div>
                    <p className="mt-1.5 text-[11px] leading-4 text-white/60">
                      {selectedDistrict.rain_source === "gauge" && selectedDistrict.rain_gauge
                        ? `ฝนวัดจริงจาก ${selectedDistrict.rain_gauge.count} สถานีของ ThaiWater (สูงสุดที่${selectedDistrict.rain_gauge.max_station} • เฉลี่ย ${selectedDistrict.rain_gauge.mean} มม.)${selectedDistrict.rain_now_text ? ` • ตอนนี้: ${selectedDistrict.rain_now_text}` : ""}`
                        : "อำเภอนี้ไม่มีสถานีวัดฝนที่ส่งข้อมูล ตัวเลขฝนเป็นค่าประมาณจากแบบจำลอง ECMWF"}
                      {selectedDistrict.water_status ? selectedDistrict.water_status.source === "ddpm"
                        ? ` • ระดับน้ำ: สถานี${selectedDistrict.water_status.station} สถานะ ปภ. ${selectedDistrict.water_status.status_label}`
                        : ` • ระดับน้ำ: สถานี${selectedDistrict.water_status.station} ${selectedDistrict.water_status.bank_diff >= 0 ? "สูงกว่า" : "ต่ำกว่า"}ตลิ่ง ${Math.abs(selectedDistrict.water_status.bank_diff)} ม.` : ""}
                      {" "}• อุณหภูมิ ความชื้น ลม จากแบบจำลอง ECMWF
                    </p>
                  </div>

                  <Pm25Card
                    data={pm25}
                    error={pm25Error}
                    districtName={selectedDistrict.district_name}
                    onShowMap={() => { setViewMode("risk"); setColorBy("pm25"); }}
                  />

                  <SeaLevelCard data={seaLevel} error={seaLevelError} />

                  {(selectedDistrict.heavy_rain_today || selectedDistrict.heavy_rain_tomorrow) && (
                    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                      <p className="flex flex-wrap items-center gap-1.5 text-xs font-black text-white/70">
                        โอกาสฝนหนัก (35.1 มม./วัน ขึ้นไป) <SourceTag>{selectedDistrict.heavy_rain_today?.source === "gauge+forecast" ? "สถานีวัดฝน + ECMWF 51 ชุด" : "ECMWF 51 ชุด"}</SourceTag>
                      </p>
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        {[["วันนี้", selectedDistrict.heavy_rain_today], ["พรุ่งนี้", selectedDistrict.heavy_rain_tomorrow]].map(([label, item]) => item && (
                          <div key={label}>
                            <div className="text-[11px] font-bold text-white/60">{label}</div>
                            <div className={`text-lg font-black leading-tight ${item.prob_heavy >= 50 ? "text-red-300" : item.prob_heavy >= 20 ? "text-amber-300" : "text-white"}`}>{item.prob_heavy}%</div>
                            <div className="text-[11px] text-white/65">{heavyRainNote(item)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {districtRivers.length > 0 && (
                    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                      <p className="flex flex-wrap items-center gap-1.5 text-xs font-black text-white/70">
                        แนวโน้มน้ำในคลอง 7 วัน <SourceTag>GloFAS</SourceTag>
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {districtRivers.map((river) => (
                          <li key={river.station} className="flex items-baseline justify-between gap-2 text-[12px]">
                            <span className="min-w-0 truncate font-semibold">{river.station}</span>
                            <span className={`shrink-0 font-black ${RIVER_TONE[river.level] || ""}`}>
                              {DISCHARGE_LEVELS[river.level]?.label}
                              {river.change_pct !== null && river.change_pct >= 20 ? ` • เพิ่ม ${river.change_pct}% ช่วง${formatThaiDateShort(river.peak_date)}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-[10px] leading-4 text-white/55">เทียบปริมาณน้ำที่คาดกับสถิติ 20 ปีของจุดเดียวกัน (แบบจำลองละเอียด 5 กม. ดูแนวโน้มได้ แต่ไม่ใช่ระดับน้ำจริง)</p>
                    </div>
                  )}

                  {hourlyForecast.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs font-black text-white/70">ฝน 24 ชั่วโมงข้างหน้า (รวมทุก 3 ชม.) <SourceTag>ECMWF</SourceTag></p>
                      <div className="grid grid-cols-8 gap-1">
                        {hourlyForecast.map((item) => {
                          const rain = Number(item.rainfall_forecast || 0);
                          const height = Math.min(100, Math.max(6, rain * 8));
                          return (
                            <div key={item.forecast_datetime} className="flex flex-col items-center gap-1" title={`${formatTime(item.forecast_datetime)} • ${item.weather_condition} • ฝน ${rain} มม.`}>
                              <span className="text-[10px] font-bold text-white/80">{rain > 0 ? rain : "-"}</span>
                              <div className="flex h-12 w-full items-end rounded bg-white/5">
                                <div className="w-full rounded bg-sky-400" style={{ height: `${height}%` }} />
                              </div>
                              <span className="text-[10px] text-white/60">{formatTime(item.forecast_datetime).slice(0, 2)}น.</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {dayForecast && selectedDay > 0 && (
                    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-black">พยากรณ์{formatDay(dayForecast.forecast_datetime, selectedDay)}</p>
                        <RiskBadge level={dayForecast.risk_level} />
                      </div>
                      <p className="mt-1 text-[13px] text-white/85">
                        {dayForecast.weather_condition} • {dayForecast.temperature_min}–{dayForecast.temperature_max}°C • ฝนน่าจะได้ ~{dayForecast.rainfall_median ?? dayForecast.rainfall_forecast} มม.{dayForecast.rainfall_p90 !== null && dayForecast.rainfall_p90 !== undefined ? ` (มากสุด ~${dayForecast.rainfall_p90})` : ""} • ลมสูงสุด {dayForecast.wind_speed} กม./ชม.
                      </p>
                      <p className="mt-1 text-[12px] text-white/70">
                        {dayForecast.prob_heavy !== null && dayForecast.prob_heavy !== undefined ? `โอกาสฝนหนัก ${dayForecast.prob_heavy}%` : ""}
                        {dayForecast.prob_very_heavy ? ` • หนักมาก ${dayForecast.prob_very_heavy}%` : ""}
                        {dayForecast.river_level && dayForecast.river_level !== "normal" ? ` • น้ำในคลอง${DISCHARGE_LEVELS[dayForecast.river_level]?.label}` : ""}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-white/70">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> สิ่งที่ควรทำ
                    </p>
                    <ul className="space-y-1.5 text-[13px] leading-5 text-white/90">
                      {advice.map((item) => (
                        <li key={item} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" aria-hidden="true" />{item}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {marine && (
                <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-sm font-black"><Anchor className="h-4 w-4" aria-hidden="true" /> คลื่นลมทะเล</p>
                    <RiskBadge level={marine.risk_level} />
                  </div>
                  <p className="mt-1 text-[13px] text-white/85">
                    {marine.location}: คลื่นสูงสุดวันนี้ ~{marine.wave_height_max_today} ม.{marine.wave_direction && marine.wave_direction !== "-" ? ` จากทิศ${marine.wave_direction}` : ""}
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-white">{marine.advice}</p>
                </div>
              )}

              {hiiMedia && (hiiMedia.rain_forecast?.length > 0 || hiiMedia.radar?.length > 0) && (
                <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-black">แผนที่จากสถาบันสารสนเทศทรัพยากรน้ำ (สสน.)</p>
                  <div className="mt-2 flex gap-1" role="tablist" aria-label="ประเภทแผนที่">
                    {[["rain", "ฝน 3 วัน"], ["radar", "เรดาร์ฝน"], ["wave", "คลื่น 7 วัน"]].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={mediaTab === key}
                        onClick={() => setMediaTab(key)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-black ${mediaTab === key ? "bg-white text-slate-900" : "bg-white/10 text-white hover:bg-white/20"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {mediaTab === "rain" && hiiMedia.rain_forecast.map((item, index) => (
                      <MediaThumb key={item.url} item={item} label={`${formatDay(item.datetime ? item.datetime.replace(" ", "T") : "", index)} (07:00–07:00)`} />
                    ))}
                    {mediaTab === "radar" && hiiMedia.radar.map((item) => (
                      <MediaThumb key={item.url} item={item} label={`${String(item.name || "").replace(" รัศมี 240 กม.", "")} ${mediaTime(item)}`} />
                    ))}
                    {mediaTab === "wave" && hiiMedia.wave_forecast.map((item) => (
                      <MediaThumb key={item.url} item={item} label={mediaTime(item)} />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[10px] leading-4 text-white/55">
                    {mediaTab === "rain" ? "แบบจำลอง WRF-ROMS ละเอียด 3 กม. สตูลอยู่มุมล่างซ้ายของภาพ แตะเพื่อดูภาพเต็ม" : mediaTab === "radar" ? "เรดาร์กรมอุตุนิยมวิทยา ผ่าน ThaiWater สตูลอยู่ในรัศมีของทั้งสองสถานี" : "แบบจำลองคลื่น SWAN ของ สสน. ดูฝั่งทะเลอันดามันด้านซ้ายของภาพ"}
                  </p>
                </div>
              )}

              <Link
                href="/public/disaster-map"
                className="group flex items-start gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10 hover:bg-white/10"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#0b5fa5] text-white"><Waves className="h-5 w-5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-white">ดูน้ำท่วมตอนนี้ → แผนที่สถานการณ์</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-white/75">ระดับน้ำในคลองเทียบตลิ่ง ฝนที่วัดได้จริง พื้นที่น้ำท่วม รายงานจากประชาชน และศูนย์พักพิง</span>
                </span>
              </Link>

              {/* กล้อง CCTV และระดับน้ำของ ปภ. — เว็บต้นทางไม่อนุญาตให้ฝัง (frame-ancestors 'self') จึงเปิดในแท็บใหม่ */}
              <a
                href={DDPM_CCTV_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-xl bg-gradient-to-br from-sky-500/25 to-cyan-400/10 p-3 ring-1 ring-sky-300/40 transition hover:from-sky-500/35 hover:ring-sky-300/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                <span className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-500 text-white"><Cctv className="h-5 w-5" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-sm font-black text-white">
                      ดูกล้องและระดับน้ำ (ปภ.) <ExternalLink className="h-3.5 w-3.5 opacity-70 transition group-hover:opacity-100" aria-hidden="true" />
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-white/80">
                      ภาพกล้อง CCTV และระดับน้ำเทียบตลิ่งแบบสด จากกรมป้องกันและบรรเทาสาธารณภัย รวมสถานีในสตูล เช่น คลองโทน และฝายดุสน
                    </span>
                    <span className="mt-1 block text-[11px] text-white/55">เปิดในแท็บใหม่ · เลือก &quot;สตูล&quot; ในตัวกรองจังหวัด</span>
                  </span>
                </span>
              </a>

              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-white/70">
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" /> เบอร์ฉุกเฉิน (โทรฟรี 24 ชม.)
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {EMERGENCY_CONTACTS.map((contact) => (
                    <a key={contact.number} href={`tel:${contact.number}`} className="rounded-lg bg-red-600/85 px-2 py-1.5 text-center hover:bg-red-500">
                      <span className="block text-base font-black leading-tight">{contact.number}</span>
                      <span className="block text-[11px] font-semibold text-white/85">{contact.label}</span>
                    </a>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px] font-bold">
                  <HelpRequestLink className="flex flex-col items-center gap-1 rounded-lg bg-white/10 px-1 py-2 text-center hover:bg-white/20" disabledClassName="cursor-not-allowed opacity-50 hover:bg-white/10">
                    <Siren className="h-4 w-4" aria-hidden="true" /> ขอความช่วยเหลือ
                  </HelpRequestLink>
                  {sheltersOpen ? (
                    <Link href="/public/shelters" className="flex flex-col items-center gap-1 rounded-lg bg-white/10 px-1 py-2 text-center hover:bg-white/20">
                      <Tent className="h-4 w-4" aria-hidden="true" /> ศูนย์พักพิง
                    </Link>
                  ) : (
                    <Link href="/public/my-risk" className="flex flex-col items-center gap-1 rounded-lg bg-white/10 px-1 py-2 text-center hover:bg-white/20">
                      <HousePlus className="h-4 w-4" aria-hidden="true" /> บ้านฉันเสี่ยงไหม
                    </Link>
                  )}
                  <Link href="/public/announcements" className="flex flex-col items-center gap-1 rounded-lg bg-white/10 px-1 py-2 text-center hover:bg-white/20">
                    <Megaphone className="h-4 w-4" aria-hidden="true" /> ประกาศเตือนภัย
                  </Link>
                </div>
              </div>

              <p className="text-[11px] leading-4 text-white/50">
                ระดับความเสี่ยงคิดจากฝนที่วัดได้จริง (ThaiWater) และระดับน้ำจากสถานี ปภ. เป็นหลัก
                ร่วมกับโอกาสฝนหนักจาก ECMWF 51 ชุด และแนวโน้มน้ำในคลองจาก GloFAS
                ประเมินอัตโนมัติ ไม่ใช่ประกาศทางราชการ โปรดยึดประกาศของกรมอุตุนิยมวิทยาและจังหวัดสตูลเป็นหลัก
              </p>
            </div>
          )}
        </section>

        {/* ขวา: เมนูชั้นข้อมูลแบบ Windy */}
        <div className="pointer-events-none absolute right-3 top-3 z-[700] flex max-h-[calc(100%-7.5rem)] flex-col items-end">
          <MenuToggle open={sidebarOpen} onToggle={() => setSidebarOpen((open) => !open)} controls="weather-layer-menu" />
          {sidebarOpen && (
            <nav id="weather-layer-menu" aria-label="ชั้นข้อมูลสภาพอากาศ" className="pointer-events-auto mt-3 min-h-0 w-[250px] overflow-y-auto overscroll-contain pb-2 pl-2 pr-0.5 [scrollbar-width:thin]">
              <SectionTitle>สถานการณ์ตอนนี้</SectionTitle>
              <div className="space-y-1.5">
                {SITUATION_ITEMS.map((item) => (
                  <SidebarItem
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    tone={item.tone}
                    title={item.title}
                    active={!isWindy && Boolean(situationLayers[item.key])}
                    onClick={() => toggleSituation(item.key)}
                  />
                ))}
              </div>

              <SectionTitle>ความเสี่ยงรายอำเภอ</SectionTitle>
              <div className="space-y-1.5">
                <SidebarItem
                  label="แผนที่ความเสี่ยง"
                  icon={ShieldCheck}
                  tone="from-emerald-400 to-red-500"
                  active={!isWindy && colorBy === "risk"}
                  onClick={() => { setViewMode("risk"); setColorBy("risk"); }}
                />
                <SidebarItem
                  label="ฝุ่น PM2.5"
                  icon={Haze}
                  tone="from-sky-400 via-yellow-400 to-orange-500"
                  active={!isWindy && colorBy === "pm25"}
                  onClick={() => { setViewMode("risk"); setColorBy("pm25"); }}
                />
                <SidebarItem
                  label="ความสูงพื้นที่"
                  icon={MountainSnow}
                  tone="from-blue-800 to-amber-700"
                  active={!isWindy && elevationEnabled}
                  onClick={() => {
                    setViewMode("risk");
                    setElevationEnabled((enabled) => (isWindy ? true : !enabled));
                  }}
                />
                {BASE_MAPS.map((item) => (
                  <SidebarItem
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    tone={item.tone}
                    active={!isWindy && baseMap === item.key}
                    onClick={() => {
                      setViewMode("risk");
                      setBaseMap(item.key);
                    }}
                  />
                ))}
              </div>

              <SectionTitle>พยากรณ์อากาศ (Windy)</SectionTitle>
              <div className="space-y-1.5">
                {WINDY_OVERLAYS.map((item) => (
                  <SidebarItem
                    key={item.key}
                    label={item.label}
                    icon={WEATHER_ICONS[item.icon] || Cloud}
                    tone={item.tone}
                    active={isWindy && windyOverlay === item.key}
                    onClick={() => {
                      setWindyOverlay(item.key);
                      setViewMode("windy");
                    }}
                  />
                ))}
              </div>
              {isWindy && (
                <div className="mt-2 flex justify-end gap-1">
                  {WINDY_PRODUCTS.map((product) => (
                    <button
                      key={product.key}
                      type="button"
                      onClick={() => setWindyProduct(product.key)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-black ${windyProduct === product.key ? "bg-amber-400 text-slate-900" : "bg-slate-900/70 text-white hover:bg-slate-900"}`}
                    >
                      {product.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 flex justify-end">
                <a
                  href={buildWindyWebsiteUrl({ overlay: windyOverlay })}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-bold text-white hover:bg-slate-900"
                >
                  เปิดใน Windy.com <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
            </nav>
          )}
        </div>

        {/* ซ้ายล่าง: คำอธิบายสี (โหมดความเสี่ยง) */}
        {!isWindy && (
          <div className={`absolute bottom-[5.75rem] left-[384px] z-[650] hidden max-h-[calc(100%-13rem)] max-w-[360px] overflow-y-auto rounded-xl px-2.5 py-1.5 text-[11px] [scrollbar-width:thin] md:block ${GLASS}`}>
            {elevationEnabled && <ElevationLegend className="mb-1.5 max-w-[320px] border-b border-white/10 pb-1.5" />}
            {situationLayers.floodFreq ? (
              <div className="mb-1.5 border-b border-white/10 pb-1.5">
                <p className="mb-1 font-bold">น้ำท่วมซ้ำซาก พ.ศ. 2554–2567 (GISTDA){floodFreqStatus?.state === "loading" ? " • กำลังโหลด…" : ""}</p>
                {floodFreqStatus?.state === "error" ? <p className="text-amber-200">{floodFreqStatus.message || "โหลดข้อมูลไม่สำเร็จ"}</p> : (
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    {FLOOD_FREQ_CLASSES.map((item) => (
                      <span key={item.key} className="flex items-center gap-1 font-bold"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden="true" />{item.label}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            {situationLayers.hospitals || situationLayers.traffic ? (
              <div className="mb-1.5 flex flex-wrap gap-x-2 gap-y-1 border-b border-white/10 pb-1.5">
                {situationLayers.hospitals ? <span className="flex items-center gap-1 font-bold"><span className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-[#1d4ed8] text-[9px] font-black leading-none text-white" aria-hidden="true">H</span>สถานพยาบาล · จุดที่มุม:</span> : null}
                {situationLayers.hospitals ? [["#15803d", "เปิดปกติ"], ["#b45309", "จำกัดบริการ/ถนนท่วม"], ["#b91c1c", "ปิด/น้ำท่วม"]].map(([color, text]) => (
                  <span key={text} className="flex items-center gap-1 font-bold"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />{text}</span>
                )) : null}
                {situationLayers.traffic ? [["#10B981", "ถนนผ่านได้"], ["#F59E0B", "ผ่านลำบาก"], ["#EF4444", "ผ่านไม่ได้"]].map(([color, text]) => (
                  <span key={text} className="flex items-center gap-1 font-bold"><span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/70" style={{ backgroundColor: color }} aria-hidden="true" />{text}</span>
                )) : null}
              </div>
            ) : null}
            {colorBy === "pm25" ? <Pm25Legend /> : (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {RISK_LEVELS.map((level) => (
                <span key={level} className="flex items-center gap-1 font-bold">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: riskMeta(level).color }} aria-hidden="true" />
                  {riskMeta(level).label}
                </span>
              ))}
            </div>
            )}
          </div>
        )}

        {/* ล่าง: พยากรณ์ 7 วันของอำเภอที่เลือก */}
        {!isWindy && dailyForecast.length > 0 && (
          <div className="absolute bottom-3 right-3 z-[650] max-md:hidden md:left-[384px]">
            <style>{`
              .day-icon--rain, .day-icon--storm { animation: day-icon-bob 2.4s ease-in-out infinite; }
              .day-icon--sun { animation: day-icon-spin 18s linear infinite; }
              .day-icon--cloud { animation: day-icon-drift 4s ease-in-out infinite alternate; }
              @keyframes day-icon-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(2px); } }
              @keyframes day-icon-spin { to { transform: rotate(360deg); } }
              @keyframes day-icon-drift { from { transform: translateX(-1.5px); } to { transform: translateX(1.5px); } }
              @media (prefers-reduced-motion: reduce) { .day-icon--rain, .day-icon--storm, .day-icon--sun, .day-icon--cloud { animation: none; } }
            `}</style>
            <div className={`ml-auto flex w-fit max-w-full items-stretch gap-0.5 overflow-x-auto rounded-xl p-1 [scrollbar-width:none] ${GLASS}`}>
              <span className="hidden w-14 shrink-0 flex-col justify-center px-1 text-[10px] font-semibold leading-tight text-white/70 xl:flex">
                <span>7 วัน</span>
                <span className="truncate">อ.{selectedDistrict?.district_name}</span>
              </span>
              {dailyForecast.map((day, index) => {
                const meta = riskMeta(day.risk_level);
                const active = index === selectedDay;
                const rain = day.rainfall_median ?? day.rainfall_forecast;
                return (
                  <button
                    key={day.forecast_datetime}
                    type="button"
                    onClick={() => {
                      setSelectedDay(index);
                      setPanelOpen(true);
                    }}
                    title={`${formatDay(day.forecast_datetime, index)} · ${day.weather_condition || ""} · ${day.temperature_min}–${day.temperature_max}°C · ฝน ~${rain ?? "-"} มม.${day.prob_heavy >= 20 ? ` · โอกาสฝนหนัก ${day.prob_heavy}%` : ""} · ${meta.label}`}
                    className={`relative w-[52px] shrink-0 rounded-lg px-0.5 pb-1.5 pt-1 text-center transition ${active ? "bg-white text-slate-900" : "hover:bg-white/10"}`}
                  >
                    <span className="block whitespace-nowrap text-[10px] font-bold leading-3">{formatDay(day.forecast_datetime, index)}</span>
                    {(() => {
                      const text = String(day.weather_condition || "");
                      const Icon = /ฟ้าคะนอง/.test(text) ? CloudLightning : /ฝน/.test(text) ? CloudRain : /เมฆ/.test(text) ? Cloud : Sun;
                      const kind = Icon === CloudLightning ? "storm" : Icon === CloudRain ? "rain" : Icon === Sun ? "sun" : "cloud";
                      return <Icon className={`day-icon day-icon--${kind} mx-auto my-0.5 h-4 w-4 ${active ? "text-[#0b4c86]" : "text-sky-100"}`} style={{ animationDelay: `${index * 120}ms` }} aria-hidden="true" />;
                    })()}
                    <span className={`block whitespace-nowrap text-[10px] leading-3 tabular-nums ${active ? "text-slate-600" : "text-white/70"}`}>{day.temperature_min}–{day.temperature_max}°</span>
                    <span className={`mt-0.5 block whitespace-nowrap text-[10px] font-bold leading-3 tabular-nums ${day.prob_heavy >= 20 ? (active ? "text-red-700" : "text-amber-300") : active ? "text-sky-700" : "text-sky-200"}`}>{rain ?? "-"} มม.</span>
                    {/* แถบล่าง: สีระดับความเสี่ยง */}
                    <span className="absolute inset-x-2 bottom-0.5 block h-[3px] rounded-full" style={{ backgroundColor: meta.color }} aria-label={meta.label} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {embedded ? null : <AIChatbot showLauncher={false} />}
    </div>
  );
}
