"use client";

import Link from "next/link";
import HelpRequestLink from "@/components/public/HelpRequestLink";
import useHelpAvailability from "@/components/public/useHelpAvailability";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  CarFront,
  CheckCircle2,
  LocateFixed,
  MapPinned,
  Phone,
  Siren,
  Tent,
  Waves,
  HousePlus,
  SearchCheck
} from "lucide-react";
import PublicOpsScaffold from "@/components/public/PublicOpsScaffold";
import SatunRiskMap from "@/components/public/home/SatunRiskMap";
import HomeSplashScreen from "@/components/public/home/HomeSplashScreen";
import CanalStrip from "@/components/public/home/CanalStrip";
import WarningRibbon from "@/components/public/home/WarningRibbon";
import HomePopup from "@/components/public/home/HomePopup";
import HeroWeatherFx from "@/components/public/home/HeroWeatherFx";
import { weatherScene } from "@/lib/weatherFx";
import { choosePopup, loadSeenPopups, markPopupsSeen, urgentAlerts } from "@/lib/homePopups";
import { OpsTodayCard, RoadAlerts } from "@/components/public/home/OpsToday";
import { citizenWaterReports, roadAlerts, shelterSummary } from "@/lib/homeSignals";
import CitizenWaterReports from "@/components/public/home/CitizenWaterReports";
import { RISK_LEVELS, RISK_META } from "@/lib/weatherRiskConfig";
import { responsiveImage } from "@/lib/imageUrl";

// หน้าแรกสำหรับประชาชน
// จุดเด่นเดียวของหน้า: แผนที่ 7 อำเภอที่ระบายสีตามความเสี่ยงวันนี้ แตะแล้วเห็น "พื้นที่ของฉัน" ทันที
const MY_DISTRICT_KEY = "stn-eoc:my-district";

const EVENT_META = {
  disease: { icon: Activity, tone: "border-rose-200 bg-rose-50", accent: "text-rose-700", mapType: "disease" },
  flood: { icon: Waves, tone: "border-sky-200 bg-sky-50", accent: "text-sky-700", mapType: "flood" },
  "festival-accidents": { icon: CarFront, tone: "border-orange-200 bg-orange-50", accent: "text-orange-700", mapType: "accident" }
};

const EVENT_ADVICE = {
  disease: (event) => {
    const name = event.disease_name || "";
    if (/ไข้เลือดออก|dengue/i.test(name)) {
      return [
        "สำรวจและเทน้ำขังรอบบ้านทุก 7 วัน ปิดฝาภาชนะเก็บน้ำ เปลี่ยนน้ำแจกัน",
        "ทายากันยุง นอนในมุ้ง โดยเฉพาะเด็กและผู้สูงอายุ",
        "ถ้ามีไข้สูงลอย 2 วันขึ้นไป ให้รีบพบแพทย์ ห้ามซื้อยาแก้ปวดกลุ่ม NSAIDs (เช่น ไอบูโพรเฟน แอสไพริน) กินเอง"
      ];
    }
    return [
      "ล้างมือบ่อย ๆ และสวมหน้ากากเมื่อมีอาการป่วย",
      "หากมีอาการผิดปกติ ให้พบแพทย์หรือโทร 1669",
      "ติดตามคำแนะนำจากสำนักงานสาธารณสุขจังหวัดสตูล"
    ];
  },
  flood: () => [
    "ยกของมีค่าและเอกสารสำคัญขึ้นที่สูง เตรียมยา ไฟฉาย น้ำดื่ม และโทรศัพท์ที่ชาร์จเต็ม",
    "ห้ามขับรถหรือเดินผ่านทางน้ำไหลเชี่ยว และตัดไฟเมื่อน้ำเริ่มเข้าบ้าน",
    "ตรวจสอบศูนย์พักพิงที่ใกล้ที่สุดและเส้นทางไปไว้ล่วงหน้า"
  ],
  "festival-accidents": () => [
    "ดื่มไม่ขับ สวมหมวกกันน็อก คาดเข็มขัดนิรภัยทุกครั้ง",
    "พักรถทุก 2 ชั่วโมง หากง่วงให้แวะพักที่จุดบริการประชาชน",
    "พบอุบัติเหตุ โทร 1669 ทันที"
  ]
};

function formatThaiDate(value, long = false) {
  if (!value) return "-";
  const date = new Date(String(value).length <= 10 ? `${value}T00:00:00+07:00` : value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH", { day: "numeric", month: long ? "long" : "short", year: "numeric" });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("th-TH");
}

function riskMeta(level) {
  return RISK_META[level] || RISK_META.normal;
}

function normalizeDistrict(value) {
  return String(value || "").replace(/^อ(\.|ำเภอ)\s*/, "").trim();
}

function distanceKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function eventTitle(event) {
  if (event.type === "disease") return `เฝ้าระวังโรค${event.disease_name || "ระบาด"}`;
  if (event.type === "flood") return "เฝ้าระวังอุทกภัย (น้ำท่วม)";
  if (event.type === "festival-accidents") return "รณรงค์ลดอุบัติเหตุช่วงเทศกาล";
  return event.label;
}

/** สรุปสถานการณ์เป็นประโยคภาษาคน */
function eventSentences(event) {
  const detail = event.detail;
  if (!detail) return ["กำลังรวบรวมข้อมูลจากหน่วยงาน"];

  if (event.type === "disease") {
    const top = detail.districts?.[0];
    const lines = [
      `มีผู้ป่วยสะสม ${formatNumber(detail.patients_total)} ราย${top ? ` อำเภอที่มีผู้ป่วยมากที่สุดคือ อ.${top.district} (${formatNumber(top.value)} ราย)` : ""}`
    ];
    if (detail.patients_last7 > 0) {
      const change = detail.change_pct;
      const trend = change === null ? "" : change > 0 ? ` เพิ่มขึ้น ${change}% จากสัปดาห์ก่อน` : change < 0 ? ` ลดลง ${Math.abs(change)}% จากสัปดาห์ก่อน` : " เท่ากับสัปดาห์ก่อน";
      lines.push(`7 วันล่าสุดมีผู้ป่วยรายใหม่ ${formatNumber(detail.patients_last7)} ราย${trend}`);
    } else {
      lines.push(`ไม่มีรายงานผู้ป่วยรายใหม่ใน 7 วันที่ผ่านมา${detail.last_report_date ? ` (รายงานล่าสุด ${formatThaiDate(detail.last_report_date)})` : ""}`);
    }
    return lines;
  }

  if (event.type === "flood") {
    if (!detail.latest_date || detail.flooded_villages === 0) {
      return ["ยังไม่มีรายงานพื้นที่น้ำท่วมในรอบนี้"];
    }
    const levels = ["สูงมาก", "สูง", "ปานกลาง", "ต่ำ"]
      .filter((level) => detail.villages_by_level?.[level])
      .map((level) => `${level} ${formatNumber(detail.villages_by_level[level])}`)
      .join(" • ");
    return [
      `น้ำท่วม ${formatNumber(detail.flooded_villages)} หมู่บ้าน ใน ${formatNumber(detail.districts?.length || 0)} อำเภอ (ข้อมูลวันที่ ${formatThaiDate(detail.latest_date)})`,
      levels ? `ระดับน้ำ: ${levels}` : null,
      `ผู้ได้รับผลกระทบ ${formatNumber(detail.affected_people)} คน • ศูนย์พักพิงเปิด ${formatNumber(detail.open_shelters)} แห่ง`
    ].filter(Boolean);
  }

  if (event.type === "festival-accidents") {
    return [
      `เกิดอุบัติเหตุ ${formatNumber(detail.accidents)} ครั้ง บาดเจ็บ ${formatNumber(detail.injuries)} ราย เสียชีวิต ${formatNumber(detail.deaths)} ราย`,
      detail.drunk_driving > 0 ? `เกี่ยวข้องกับการดื่มแล้วขับ ${formatNumber(detail.drunk_driving)} ครั้ง` : null
    ].filter(Boolean);
  }

  return [];
}

function districtFigure(event, districtName) {
  const row = (event.detail?.districts || []).find((item) => normalizeDistrict(item.district) === normalizeDistrict(districtName));
  const value = row?.value || 0;
  if (event.type === "disease") return `ผู้ป่วย${event.disease_name || ""}สะสม ${formatNumber(value)} ราย`;
  if (event.type === "flood") return `หมู่บ้านน้ำท่วม ${formatNumber(value)} หมู่บ้าน`;
  if (event.type === "festival-accidents") return `อุบัติเหตุ ${formatNumber(value)} ครั้ง`;
  return null;
}

function TrendBars({ trend }) {
  const points = trend?.points || [];
  if (points.length === 0) return null;
  // เติมวันที่ไม่มีข้อมูลเป็น 0 เพื่อให้แกนเวลาถูกต้อง
  const filled = [];
  if (trend.from && trend.to) {
    const cursor = new Date(`${trend.from}T00:00:00Z`);
    const end = new Date(`${trend.to}T00:00:00Z`);
    const map = new Map(points.map((point) => [point.date, point.value]));
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      filled.push({ date: key, value: map.get(key) || 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else {
    filled.push(...points);
  }
  const max = Math.max(1, ...filled.map((point) => point.value));
  const total = filled.reduce((sum, point) => sum + point.value, 0);
  const peak = filled.reduce((best, point) => (point.value > (best?.value ?? -1) ? point : best), null);
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-800">
        รวม {formatNumber(total)} {trend.unit} ในช่วง {formatThaiDate(filled[0]?.date)} – {formatThaiDate(filled[filled.length - 1]?.date)}
        {peak?.value > 0 ? ` • สูงสุดวันที่ ${formatThaiDate(peak.date)} (${formatNumber(peak.value)} ${trend.unit})` : ""}
      </p>
      <div className="flex h-32 items-end gap-[3px]" role="img" aria-label={`${trend.label} สูงสุด ${formatNumber(max)} ${trend.unit}`}>
        {filled.map((point) => (
          <div
            key={point.date}
            className="flex-1 rounded-t bg-[#2a9db0] hover:bg-[#11466e]"
            style={{ height: `${Math.max(point.value > 0 ? 4 : 1, (point.value / max) * 100)}%` }}
            title={`${formatThaiDate(point.date)}: ${formatNumber(point.value)} ${trend.unit}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] font-semibold text-slate-500">
        <span>{formatThaiDate(filled[0]?.date)}</span>
        <span>{formatThaiDate(filled[filled.length - 1]?.date)}</span>
      </div>
    </div>
  );
}

function readStoredDistrict() {
  try {
    return window.localStorage.getItem(MY_DISTRICT_KEY) || "";
  } catch {
    return "";
  }
}

function storeDistrict(name) {
  try {
    window.localStorage.setItem(MY_DISTRICT_KEY, name);
  } catch {
    // เบราว์เซอร์ปิดการเก็บข้อมูล — ไม่เป็นไร ใช้ค่าในหน้าต่อได้
  }
}

function todayLine(observedAt) {
  const now = new Date();
  const date = now.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const updated = observedAt ? new Date(observedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : null;
  return updated ? `${date} • ข้อมูลอากาศ ${updated} น.` : date;
}

/** พาดหัวเป็นประโยคเดียว บอกสถานการณ์ของทั้งจังหวัดวันนี้ */
function buildHeadline(current, events) {
  const weather = current?.weather_condition ? `อากาศ${current.weather_condition.replace(/^ฝน/, "มีฝน")}` : "";
  const watching = events.map((event) => {
    if (event.type === "disease") return `ไข้${event.disease_name?.replace(/^ไข้/, "") || "ระบาด"}`.replace("ไข้ไข้", "ไข้");
    if (event.type === "flood") return "น้ำท่วม";
    if (event.type === "festival-accidents") return "อุบัติเหตุช่วงเทศกาล";
    return event.label;
  });
  if (watching.length > 0) {
    return `สตูลวันนี้${weather ? ` ${weather}` : ""} และยังเฝ้าระวัง${watching.join(" และ")}`;
  }
  if (current && ["high", "critical"].includes(current.risk_level)) {
    return `สตูลวันนี้${weather ? ` ${weather}` : ""} บางพื้นที่เสี่ยงน้ำท่วมฉับพลัน`;
  }
  return `สตูลวันนี้${weather ? ` ${weather}` : ""} ไม่มีภาวะฉุกเฉิน`;
}

function clock(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) || date.getTime() <= 0 ? null : `${date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`;
}

/** ที่มาของข้อมูลและเวลาอัปเดตของแต่ละแหล่ง */
function SourceTimes({ weather, water }) {
  const rainAt = (weather?.district_weather || []).map((item) => item.rain_gauge?.observed_at).filter(Boolean).sort().pop();
  const waterAt = water.stations.map((item) => item.observedAt).filter(Boolean).sort().pop();
  const sources = [
    ["ระดับน้ำในคลอง", "ThaiWater (สสน.)", clock(waterAt)],
    ["ฝนที่วัดได้", "ThaiWater (สสน.)", clock(rainAt)],
    ["พยากรณ์และโอกาสฝนหนัก", "ECMWF", clock(weather?.weather_current?.observed_at)],
    ["เหตุการณ์และศูนย์พักพิง", "ศูนย์ปฏิบัติการภาวะฉุกเฉิน จ.สตูล", "อัปเดตตามที่เจ้าหน้าที่บันทึก"]
  ];
  return (
    <footer className="mx-auto max-w-6xl px-4 py-8 sm:px-6" aria-label="ที่มาของข้อมูล">
      <dl className="grid gap-x-6 gap-y-3 border-t border-slate-300/70 pt-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {sources.map(([label, source, time]) => (
          <div key={label}>
            <dt className="font-semibold text-slate-700">{label}</dt>
            <dd className="text-slate-500">{source}{time ? ` • ${time}` : ""}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-sm text-slate-500">ประเมินและอัปเดตอัตโนมัติ ไม่ใช่ประกาศทางราชการ โปรดยึดประกาศของหน่วยงานราชการเป็นหลัก</p>
    </footer>
  );
}

export default function PublicHome() {
  const { sheltersOpen } = useHelpAvailability();
  const [situation, setSituation] = useState(null);
  const [weather, setWeather] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [water, setWater] = useState({ loading: true, stations: [], fetchedAt: null });
  const [ops, setOps] = useState(null);
  const [roads, setRoads] = useState([]);
  const [waterReports, setWaterReports] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [popupAnnouncement, setPopupAnnouncement] = useState(undefined);
  const [popup, setPopup] = useState(null);
  // ?fx=rain|heavy|storm|wind|cloudy|clear|night ใช้ดูตัวอย่างฉากพื้นหลัง
  const [fxPreset, setFxPreset] = useState(null);
  useEffect(() => {
    setFxPreset(new URLSearchParams(window.location.search).get("fx"));
  }, []);
  const [loading, setLoading] = useState(true);
  const [districtName, setDistrictName] = useState("");
  const [userPoint, setUserPoint] = useState(null);
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => {
    const stored = readStoredDistrict();
    if (stored) setDistrictName(stored);

    const controller = new AbortController();
    const load = async (url) => {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
        const json = await response.json();
        return response.ok && json.success ? json : null;
      } catch {
        return null;
      }
    };
    Promise.all([
      load("/stn-eoc/api/public/situation"),
      load("/stn-eoc/api/public/weather-watch?view=home"),
      load("/stn-eoc/api/public/announcements?limit=6")
    ]).then(([situationJson, weatherJson, announcementJson]) => {
      if (controller.signal.aborted) return;
      setSituation(situationJson);
      setWeather(weatherJson);
      setAnnouncements((announcementJson?.data || []).slice(0, 6));
      setLoading(false);
    });
    // ข้อมูลประกอบ: โหลดแยก ไม่ให้หน้าแรกรอ
    load("/stn-eoc/api/public/water-levels").then((json) => {
      if (!controller.signal.aborted) setWater({ loading: false, stations: json?.stations || [], fetchedAt: json?.fetchedAt || null });
    });
    load("/stn-eoc/api/public/ops-today").then((json) => {
      if (!controller.signal.aborted) setOps(json?.open ? json.data : null);
    });
    load("/stn-eoc/api/public/verified-incidents").then((json) => {
      if (controller.signal.aborted) return;
      setRoads(roadAlerts(json?.data || []));
      setWaterReports(citizenWaterReports(json?.data || []));
    });
    load("/stn-eoc/api/public/announcements/popup").then((json) => {
      if (!controller.signal.aborted) setPopupAnnouncement(json?.data || null);
    });
    load("/stn-eoc/api/public/shelter-centers").then((json) => {
      if (!controller.signal.aborted) setShelters(json?.data || []);
    });
    return () => controller.abort();
  }, []);

  const events = useMemo(() => situation?.events || [], [situation]);
  const scene = useMemo(
    () => (weather || fxPreset ? weatherScene({ current: weather?.weather_current, districts: weather?.district_weather || [], preset: fxPreset }) : null),
    [fxPreset, weather]
  );

  // popup ตอนเข้าหน้า: เตือนด่วนมาก่อน แล้วค่อยประกาศ — เด้งหลังหน้าจอโลโก้ และเรื่องเดิมเด้งครั้งเดียวต่อเครื่อง
  useEffect(() => {
    if (loading || popupAnnouncement === undefined) return undefined;
    const chosen = choosePopup({
      urgent: urgentAlerts(weather?.weather_warnings || []),
      announcement: popupAnnouncement,
      seen: loadSeenPopups()
    });
    if (!chosen) return undefined;
    const timer = window.setTimeout(() => setPopup(chosen), 1600);
    return () => window.clearTimeout(timer);
  }, [loading, popupAnnouncement, weather]);

  const closePopup = useCallback(() => {
    setPopup((current) => {
      if (current) markPopupsSeen(current.ids);
      return null;
    });
  }, []);
  const districts = useMemo(() => weather?.district_weather || [], [weather]);
  const current = weather?.weather_current || null;

  // ถ้ายังไม่เคยเลือก ให้เริ่มที่อำเภอที่เสี่ยงที่สุด
  useEffect(() => {
    if (districts.length === 0) return;
    if (!districtName || !districts.some((item) => item.district_name === districtName)) {
      setDistrictName(districts[0].district_name);
    }
  }, [districtName, districts]);

  const selectDistrict = (name, { remember = true } = {}) => {
    setDistrictName(name);
    setLocationMessage("");
    if (remember) storeDistrict(name);
  };

  const myDistrict = districts.find((item) => item.district_name === districtName) || null;
  const watchCount = districts.filter((item) => item.risk_level !== "normal").length;
  const primaryEvent = events.find((event) => event.detail?.trend?.points?.length) || null;
  const weatherAdvice = current && current.risk_level !== "normal" ? (weather?.safety_advice || []).slice(0, 2) : [];
  const adviceGroups = [
    ...events.map((event) => ({ title: eventTitle(event), items: (EVENT_ADVICE[event.type] || (() => []))(event) })),
    ...(weatherAdvice.length ? [{ title: "ช่วงฝนตก", items: weatherAdvice }] : [])
  ];
  const headerStatus = events.length > 0 ? "open" : current && ["high", "critical"].includes(current.risk_level) ? "watch" : "closed";
  const headerLabel = events.length > 0 ? events.map(eventTitle).join(" • ") : "ไม่มีเหตุการณ์ฉุกเฉิน";

  const locateMe = () => {
    if (!navigator.geolocation) {
      setLocationMessage("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    setLocationMessage("กำลังหาตำแหน่งของคุณ…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const here = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        const nearest = districts.map((district) => ({ district, km: distanceKm(here, district) })).sort((a, b) => a.km - b.km)[0];
        if (!nearest || nearest.km > 60) {
          setLocationMessage("คุณอยู่นอกจังหวัดสตูล แตะเลือกอำเภอบนแผนที่ได้เลย");
          return;
        }
        setUserPoint(here);
        selectDistrict(nearest.district.district_name);
        setLocationMessage(`คุณอยู่ใกล้ อ.${nearest.district.district_name}`);
      },
      () => setLocationMessage("ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง แตะเลือกอำเภอบนแผนที่แทนได้"),
      { timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  const myRisk = riskMeta(myDistrict?.risk_level);

  return (
    <>
    <HomeSplashScreen />
    <HomePopup popup={popup} onClose={closePopup} />
    <PublicOpsScaffold
      title="หน้าหลัก"
      activeMenu="home"
      eocIsOpen={events.length > 0}
      eocStatus={headerStatus}
      eocLabel={headerLabel}
      showPageHeader={false}
      mainClassName="p-0!"
    >
      <div className="bg-[#eef2f1] text-[#15232e]">
        <WarningRibbon warnings={weather?.weather_warnings || []} />
        {/* ── Hero: พาดหัว + แผนที่ความเสี่ยงรายอำเภอ ── */}
        <section className="relative overflow-hidden bg-[#0c2f4a] text-white" aria-labelledby="home-headline">
          <HeroWeatherFx scene={scene} />
          {/* มือถือ: พาดหัว → แผนที่ → พื้นที่ของฉัน / จอใหญ่: ซ้าย (พาดหัว + พื้นที่ของฉัน) ขวา (แผนที่) */}
          <div className="relative mx-auto grid max-w-6xl gap-6 px-4 pb-24 pt-8 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:pb-28 lg:pt-12">
            <div className="lg:col-start-1 lg:row-start-1">
              <p className="text-sm text-[#9fc9d6]">{todayLine(current?.observed_at)}</p>
              {scene ? (
                <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-[#d5e7ec] backdrop-blur-sm">
                  <span className={`h-2 w-2 rounded-full ${scene.rain ? "bg-[#7cc7e8]" : "bg-[#ffd166]"}`} aria-hidden="true" />
                  {scene.preview ? "ตัวอย่างฉาก: " : "ตอนนี้: "}{scene.label}
                </p>
              ) : null}
              <h1 id="home-headline" className="mt-3 font-[family-name:var(--font-kanit)] text-[1.9rem] font-bold leading-[1.25] tracking-[-0.01em] sm:text-[2.5rem] lg:text-[2.9rem]">
                {loading ? "กำลังดูสถานการณ์ของสตูลวันนี้…" : buildHeadline(current, events)}
              </h1>
              {!loading && districts.length > 0 && (
                <p className="mt-4 max-w-[34rem] text-[1.05rem] leading-8 text-[#d5e7ec]">
                  {watchCount > 0 ? `${watchCount} จาก ${districts.length} อำเภอต้องเฝ้าระวังน้ำท่วม` : "ทุกอำเภอยังไม่มีสัญญาณน้ำท่วม"}
                  {" "}แตะอำเภอของคุณบนแผนที่ เพื่อดูว่าวันนี้ต้องระวังอะไร
                </p>
              )}

            </div>

            {/* พื้นที่ของฉัน */}
            <div className="order-3 lg:order-none lg:col-start-1 lg:row-start-2">
              {myDistrict && (
                <div className="rounded-3xl bg-white p-5 text-[#15232e] shadow-[0_18px_40px_-20px_rgba(0,0,0,.6)]" aria-live="polite">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-500">พื้นที่ของฉัน</p>
                      <p className="font-[family-name:var(--font-kanit)] text-2xl font-bold">อ.{myDistrict.district_name}</p>
                    </div>
                    <span className="rounded-full px-3 py-1 font-[family-name:var(--font-kanit)] text-base font-semibold text-white" style={{ backgroundColor: myRisk.color }}>
                      {myRisk.label}
                    </span>
                  </div>
                  <p className="mt-2 text-[15px] leading-7">
                    {myDistrict.weather_condition} {myDistrict.temperature}°C • {myDistrict.rain_source === "gauge" ? `ฝนวัดได้ 24 ชม. ${myDistrict.rainfall_24h} มม.` : `ฝน 24 ชม. ~${myDistrict.rainfall_24h} มม.`}{myDistrict.heavy_rain_today ? ` • โอกาสฝนหนักวันนี้ ${myDistrict.heavy_rain_today.prob_heavy}%` : ""}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-[15px] leading-7 text-slate-700">
                    {(myDistrict.risk_reasons || []).slice(0, 2).map((reason) => <li key={reason}>• {reason}</li>)}
                    {events.map((event) => {
                      const text = districtFigure(event, myDistrict.district_name);
                      return text ? <li key={event.type}>• {text}</li> : null;
                    })}
                  </ul>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px]">
                    <button type="button" onClick={locateMe} className="inline-flex items-center gap-1.5 rounded-full bg-[#e3f1f4] px-3 py-1.5 font-semibold text-[#11466e] hover:bg-[#cfe7ed]">
                      <LocateFixed className="h-4 w-4" aria-hidden="true" /> ใช้ตำแหน่งของฉัน
                    </button>
                    <Link href="/public/weather-watch" className="inline-flex items-center gap-1 font-semibold text-[#11466e] underline-offset-4 hover:underline">
                      พยากรณ์ 7 วันของพื้นที่นี้ <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                  {locationMessage && <p className="mt-2 text-sm text-[#11466e]">{locationMessage}</p>}
                </div>
              )}
            </div>

            <div className="order-2 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
              <div className="relative rounded-[2rem] bg-[#11466e]/60 p-3 sm:p-5">
                <SatunRiskMap districts={districts} selectedName={districtName} onSelect={(name) => selectDistrict(name)} userPoint={userPoint} />
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-1 text-sm text-[#d5e7ec]" aria-label="ความหมายของสี">
                  {RISK_LEVELS.map((level) => (
                    <li key={level} className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: riskMeta(level).color }} aria-hidden="true" />
                      {riskMeta(level).label}
                    </li>
                  ))}
                  <li className="text-[#9fc9d6]">สีตามความเสี่ยงน้ำท่วมวันนี้ (ฝนที่วัดได้ ระดับน้ำในคลอง และโอกาสฝนหนัก) • ตัวเลขคือฝนที่วัดได้ 24 ชม.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── แถบทางลัด: ซ้อนขอบล่างของ hero ── */}
        <nav aria-label="ทางลัดที่สำคัญ" className="relative z-10 mx-auto -mt-14 max-w-6xl px-4 sm:px-6">
          <div className="grid gap-px overflow-hidden rounded-3xl bg-slate-100 shadow-[0_20px_45px_-25px_rgba(12,47,74,.55)] sm:grid-cols-6 xl:grid-cols-[1.25fr_1.25fr_1fr_1fr_1fr]">
            <HelpRequestLink
              className="flex items-center gap-3 bg-[#c81e1e] p-5 text-white hover:bg-[#a51818] focus-visible:outline-offset-[-4px] sm:col-span-3 xl:col-span-1"
              disabledClassName="cursor-not-allowed bg-slate-200! text-slate-600! hover:bg-slate-200!"
            >
              {({ helpOpen }) => (
                <>
                  <Siren className="h-8 w-8 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="block font-[family-name:var(--font-kanit)] text-xl font-bold">ขอความช่วยเหลือ</span>
                    <span className={`block text-sm ${helpOpen ? "text-red-50" : "text-slate-600"}`}>
                      {helpOpen ? "ส่งตำแหน่งให้เจ้าหน้าที่ติดต่อกลับ" : "เปิดเมื่อมีเหตุการณ์ฉุกเฉิน • เหตุด่วนโทร 1669"}
                    </span>
                  </span>
                </>
              )}
            </HelpRequestLink>
            <HelpRequestLink
              kind="water"
              className="flex items-center gap-3 bg-[#0b5fa5] p-5 text-white hover:bg-[#084a82] focus-visible:outline-offset-[-4px] sm:col-span-3 xl:col-span-1"
              disabledClassName="cursor-not-allowed bg-slate-200! text-slate-600! hover:bg-slate-200!"
            >
              {({ helpOpen }) => (
                <>
                  <Waves className="h-8 w-8 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="block font-[family-name:var(--font-kanit)] text-xl font-bold">รายงานระดับน้ำ</span>
                    <span className={`block text-sm ${helpOpen ? "text-sky-50" : "text-slate-600"}`}>
                      {helpOpen ? "บอกว่าน้ำสูงแค่ไหน ใช้เวลาไม่ถึงนาที" : "เปิดเมื่อเปิดศูนย์ด้านอุทกภัย"}
                    </span>
                  </span>
                </>
              )}
            </HelpRequestLink>
            <Link href="/public/my-risk" className="group flex items-center gap-3 bg-white p-5 hover:bg-[#f3f7f8] sm:col-span-2 xl:col-span-1">
              <HousePlus className="h-7 w-7 shrink-0 text-[#0b4c86] transition-transform group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden="true" />
              <span>
                <span className="block font-[family-name:var(--font-kanit)] text-lg font-semibold">บ้านฉันเสี่ยงไหม</span>
                <span className="block text-sm text-slate-500">คลองใกล้บ้าน ที่พึ่งใกล้สุด</span>
              </span>
            </Link>
            <Link href="/public/track" className="group flex items-center gap-3 bg-white p-5 hover:bg-[#f3f7f8] sm:col-span-2 xl:col-span-1">
              <SearchCheck className="h-7 w-7 shrink-0 text-[#2a9db0] transition-transform group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden="true" />
              <span>
                <span className="block font-[family-name:var(--font-kanit)] text-lg font-semibold">ติดตามคำขอ</span>
                <span className="block text-sm text-slate-500">เจ้าหน้าที่ทำถึงไหนแล้ว</span>
              </span>
            </Link>
            {sheltersOpen && shelters.length > 0 ? (() => {
              const summary = shelterSummary(shelters);
              return (
                <Link href="/public/shelters?near=1" className="group flex items-center gap-3 bg-[#f4effc] p-5 hover:bg-[#ebe2fa] sm:col-span-2 xl:col-span-1">
                  <Tent className="h-7 w-7 shrink-0 text-[#6d3fc4] transition-transform group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden="true" />
                  <span>
                    <span className="block font-[family-name:var(--font-kanit)] text-lg font-semibold">ศูนย์พักพิงเปิด {formatNumber(summary.open)} แห่ง</span>
                    <span className="block text-sm text-[#5b3a9e]">รับได้อีก {formatNumber(summary.vacancy)} คน • หาที่ใกล้ฉัน</span>
                  </span>
                </Link>
              );
            })() : (
              <a href="tel:1669" className="flex items-center gap-3 bg-white p-5 hover:bg-[#f3f7f8] sm:col-span-2 xl:col-span-1">
                <Phone className="h-7 w-7 shrink-0 text-[#c81e1e]" aria-hidden="true" />
                <span>
                  <span className="block font-[family-name:var(--font-kanit)] text-lg font-semibold">โทร 1669</span>
                  <span className="block text-sm text-slate-500">เจ็บป่วยฉุกเฉิน</span>
                </span>
              </a>
            )}
          </div>
        </nav>

        {/* ── น้ำในคลองตอนนี้ ── */}
        <CanalStrip stations={water.stations} observedAt={water.fetchedAt} loading={water.loading} />

        {/* ── รายงานน้ำจากประชาชน (มือถือ/แท็บเล็ต: แถบเลื่อนต่อจากระดับน้ำในคลอง) ── */}
        <CitizenWaterReports reports={waterReports} layout="strip" className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 lg:hidden" />

        {/* ── สถานการณ์ที่ดำเนินการอยู่ + สิ่งที่ควรทำ ── */}
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <section aria-labelledby="events-title">
            <h2 id="events-title" className="font-[family-name:var(--font-kanit)] text-2xl font-bold text-[#0c2f4a]">
              {events.length > 0 ? "เหตุการณ์ที่หน่วยงานกำลังรับมือ" : "ไม่มีเหตุการณ์ฉุกเฉินในขณะนี้"}
            </h2>
            {loading && <div className="mt-4 h-40 animate-pulse rounded-2xl bg-white" />}
            {!loading && events.length === 0 && (
              <p className="mt-3 text-[1.05rem] leading-8 text-slate-700">ศูนย์ปฏิบัติการภาวะฉุกเฉินยังไม่ได้เปิดดำเนินการ ติดตามพยากรณ์อากาศและประกาศจากหน่วยงานได้ในหน้านี้</p>
            )}
            {events.map((event) => {
              const meta = EVENT_META[event.type] || EVENT_META.disease;
              const Icon = meta.icon;
              return (
                <article key={`${event.type}-${event.session_id}`} className="mt-5 border-l-4 border-[#2a9db0] pl-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className={`flex items-center gap-2 font-[family-name:var(--font-kanit)] text-xl font-semibold ${meta.accent}`}>
                      <Icon className="h-6 w-6" aria-hidden="true" /> {eventTitle(event)}
                    </h3>
                    <Link href={`/public/disaster-map?type=${meta.mapType}`} className="inline-flex items-center gap-1 text-[15px] font-semibold text-[#11466e] underline-offset-4 hover:underline">
                      <MapPinned className="h-4 w-4" aria-hidden="true" /> ดูบนแผนที่
                    </Link>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">เปิดศูนย์ปฏิบัติการตั้งแต่ {formatThaiDate(event.opened_at, true)}</p>
                  <ul className="mt-3 space-y-1 text-[1.05rem] leading-8">
                    {eventSentences(event).map((line) => <li key={line}>{line}</li>)}
                  </ul>
                </article>
              );
            })}

            <OpsTodayCard ops={ops} />
            <RoadAlerts roads={roads} />

            {primaryEvent && (
              <div className="mt-8 rounded-3xl bg-white p-5 sm:p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-[family-name:var(--font-kanit)] text-lg font-semibold text-[#0c2f4a]">{primaryEvent.detail.trend.label}</h3>
                  <Link href="/public/insights" className="shrink-0 text-[15px] font-semibold text-[#11466e] underline-offset-4 hover:underline">ข้อมูลเชิงลึก</Link>
                </div>
                <div className="mt-3"><TrendBars trend={primaryEvent.detail.trend} /></div>
              </div>
            )}
          </section>

          <section aria-labelledby="todo-title">
            {/* จอใหญ่: แผงข้างเหนือ "สิ่งที่ควรทำ" */}
            <CitizenWaterReports reports={waterReports} layout="list" className="mb-8 hidden lg:block" />
            <h2 id="todo-title" className="font-[family-name:var(--font-kanit)] text-2xl font-bold text-[#0c2f4a]">สิ่งที่ควรทำตอนนี้</h2>
            {adviceGroups.length === 0 ? (
              <p className="mt-3 text-[1.05rem] leading-8 text-slate-700">ใช้ชีวิตได้ตามปกติ และติดตามข่าวสารจากหน่วยงานราชการเป็นระยะ</p>
            ) : adviceGroups.map((group) => (
              <div key={group.title} className="mt-5">
                <p className="font-semibold text-[#2e6b4e]">{group.title}</p>
                <ul className="mt-2 space-y-3">
                  {group.items.map((item) => (
                    <li key={item} className="flex gap-3 text-[1.05rem] leading-8">
                      <CheckCircle2 className="mt-1.5 h-5 w-5 shrink-0 text-[#2e6b4e]" aria-hidden="true" />{item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="mt-8 rounded-3xl bg-[#0c2f4a] p-5 text-white">
              <p className="font-[family-name:var(--font-kanit)] text-lg font-semibold">เบอร์ฉุกเฉิน โทรฟรี 24 ชม.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[["1669", "เจ็บป่วยฉุกเฉิน"], ["1784", "สาธารณภัย"], ["191", "เหตุด่วนเหตุร้าย"], ["199", "ดับเพลิง"]].map(([number, label]) => (
                  <a key={number} href={`tel:${number}`} className="rounded-2xl bg-white/10 px-3 py-2 hover:bg-white/20">
                    <span className="block font-[family-name:var(--font-kanit)] text-2xl font-bold">{number}</span>
                    <span className="block text-sm text-[#d5e7ec]">{label}</span>
                  </a>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ── ข่าวสารและความรู้สุขภาพ (มีภาพ ดึงดูดให้อ่าน) ── */}
        {announcements.length > 0 && (
          <section aria-labelledby="news-title" className="bg-white">
            <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="news-title" className="font-[family-name:var(--font-kanit)] text-2xl font-bold text-[#0c2f4a]">ข่าวสารและความรู้สุขภาพ</h2>
                <Link href="/public/announcements" className="shrink-0 text-[15px] font-semibold text-[#11466e] underline-offset-4 hover:underline">ดูทั้งหมด</Link>
              </div>
              <ul className="-mx-4 mt-5 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
                {announcements.slice(0, 3).map((item) => (
                  <li key={item.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
                    <Link href={`/public/announcements/${item.id}`} className="group block">
                      <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-[#e3f1f4]">
                        {item.image_path ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img {...responsiveImage(`/stn-eoc${item.image_path}`, [384, 640], "(min-width: 640px) 30vw, 78vw")} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                        ) : (
                          <div className="flex h-full items-center justify-center font-[family-name:var(--font-kanit)] text-lg text-[#11466e]">ประกาศจากหน่วยงาน</div>
                        )}
                      </div>
                      <p className="mt-3 line-clamp-2 font-[family-name:var(--font-kanit)] text-lg font-semibold leading-snug group-hover:text-[#11466e]">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{formatThaiDate(item.start_date || item.created_at)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <SourceTimes weather={weather} water={water} />
      </div>
    </PublicOpsScaffold>
    </>
  );
}
