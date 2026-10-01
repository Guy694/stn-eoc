"use client";

import { Noto_Sans_Thai_Looped } from "next/font/google";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LocateFixed, MapPin, Navigation, Phone, Search, Tent } from "lucide-react";
import ShelterCenterMap from "@/components/ShelterCenterMap";
import PublicOpsScaffold from "@/components/public/PublicOpsScaffold";
import { formatEocDisplayName } from "@/lib/eocDisplay";

const bodyFont = Noto_Sans_Thai_Looped({ subsets: ["thai", "latin"], weight: ["400", "500", "600"], display: "swap" });
const NO_DATA_MESSAGE = "ยังไม่มีข้อมูลการเปิดศูนย์พักพิง";
const HEADING = "font-[family-name:var(--font-kanit)]";

const STATUS_FILTERS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "available", label: "รับเพิ่มได้" },
  { value: "near_full", label: "ใกล้เต็ม" },
  { value: "full", label: "เต็ม" }
];

const PREPARATION = [
  "เอกสารสำคัญ และยาประจำตัว",
  "ของใช้ส่วนตัวเท่าที่จำเป็น",
  "แจ้งเจ้าหน้าที่ถ้ามีผู้สูงอายุ เด็ก หรือผู้ป่วยมาด้วย",
  "ทำตามคำแนะนำของเจ้าหน้าที่ในศูนย์"
];

const EMERGENCY_NUMBERS = [
  ["1669", "หน่วยแพทย์ฉุกเฉิน"],
  ["191", "แจ้งเหตุด่วน"],
  ["1784", "ปภ. สายด่วน"],
  ["074-711221", "จังหวัดสตูล"]
];

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("th-TH");
}

function getEocLabel(item) {
  return formatEocDisplayName(item);
}

function getCapacity(shelter) {
  return Number(shelter?.shelter_capacity || 0);
}

function getOccupancy(shelter) {
  return Number(shelter?.current_occupancy || shelter?.current_occupancy_total || 0);
}

function getVacancy(shelter) {
  return Math.max(getCapacity(shelter) - getOccupancy(shelter), 0);
}

function getShelterStatus(shelter) {
  if (shelter?.occupancy_status) return shelter.occupancy_status;
  const capacity = getCapacity(shelter);
  if (!capacity) return "available";
  const ratio = getOccupancy(shelter) / capacity;
  if (ratio >= 1) return "full";
  if (ratio >= 0.8) return "near_full";
  return "available";
}

// ใช้คำที่ประชาชนเข้าใจทันที พร้อมสีประจำสถานะ (ไม่ใช้สีอย่างเดียว: มีคำกำกับเสมอ)
function getStatusMeta(status) {
  if (status === "full") return { label: "เต็ม", color: "#c81e1e", soft: "bg-red-50 text-red-800" };
  if (status === "near_full") return { label: "ใกล้เต็ม", color: "#c77a0a", soft: "bg-amber-50 text-amber-900" };
  return { label: "รับเพิ่มได้", color: "#2e6b4e", soft: "bg-emerald-50 text-emerald-900" };
}

function getCoordinate(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function getDistanceKm(origin, shelter) {
  if (!origin) return null;
  const lat = getCoordinate(shelter?.lat);
  const lon = getCoordinate(shelter?.lon);
  if (lat === null || lon === null) return null;

  const earthRadiusKm = 6371;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat - origin.lat);
  const dLon = toRad(lon - origin.lon);
  const originLat = toRad(origin.lat);
  const shelterLat = toRad(lat);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(originLat) * Math.cos(shelterLat) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distanceKm) {
  if (distanceKm === null || distanceKm === undefined) return "";
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000).toLocaleString("th-TH")} ม.`;
  return `${distanceKm.toLocaleString("th-TH", { maximumFractionDigits: 1 })} กม.`;
}

// แสดงเฉพาะเหตุการณ์ (EOC) ที่เปิดอยู่ ณ ปัจจุบัน — ไม่แสดงข้อมูลย้อนหลัง
function buildContextOptions(activeEocs) {
  return activeEocs
    .filter((item) => item.is_active && item.session_id)
    .sort((a, b) => new Date(b.activated_at || 0) - new Date(a.activated_at || 0))
    .map((item) => ({
      key: `active-${item.eoc_type}-${item.session_id}`,
      session_id: item.session_id,
      eoc_type: item.eoc_type,
      label: getEocLabel(item),
      opened_at: item.activated_at
    }));
}

export default function PublicSheltersPage() {
  const [loadingContext, setLoadingContext] = useState(true);
  const [loadingShelters, setLoadingShelters] = useState(false);
  const [activeEocs, setActiveEocs] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [shelters, setShelters] = useState([]);
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState("list");
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => {
    const loadContext = async () => {
      try {
        const statusRes = await fetch("/stn-eoc/api/eoc/status/");
        const statusJson = statusRes.ok ? await statusRes.json() : { success: false, data: [] };
        setActiveEocs(statusJson.success ? statusJson.data || [] : []);
      } catch (error) {
        console.error("Error loading shelter context:", error);
      } finally {
        setLoadingContext(false);
      }
    };

    loadContext();
  }, []);

  const contextOptions = useMemo(() => buildContextOptions(activeEocs), [activeEocs]);

  useEffect(() => {
    if (!selectedKey && contextOptions.length > 0) setSelectedKey(contextOptions[0].key);
  }, [contextOptions, selectedKey]);

  const selectedContext = useMemo(
    () => contextOptions.find((item) => item.key === selectedKey) || contextOptions[0] || null,
    [contextOptions, selectedKey]
  );

  const eocIsOpen = contextOptions.length > 0;
  const latestActive = activeEocs.find((item) => item.is_active);
  const scaffoldEocStatus = eocIsOpen ? "open" : "closed";
  const scaffoldEocLabel = latestActive ? getEocLabel(latestActive) : "ไม่มีเหตุการณ์ฉุกเฉิน";

  const loadShelters = useCallback(async () => {
    if (!selectedContext?.session_id) {
      setShelters([]);
      setLoadingShelters(false);
      return;
    }

    try {
      setLoadingShelters(true);
      const params = new URLSearchParams();
      if (selectedContext?.eoc_type) params.set("eoc_type", selectedContext.eoc_type);
      params.set("session_id", selectedContext.session_id);

      const response = await fetch(`/stn-eoc/api/public/shelter-centers?${params.toString()}`);
      const json = response.ok ? await response.json() : { success: false, data: [] };
      setShelters(json.success ? json.data || [] : []);
    } catch (error) {
      console.error("Error loading public shelters:", error);
      setShelters([]);
    } finally {
      setLoadingShelters(false);
    }
  }, [selectedContext]);

  useEffect(() => {
    if (!loadingContext) loadShelters();
  }, [loadShelters, loadingContext]);

  const districts = useMemo(
    () => [...new Set(shelters.map((item) => item.district_name || item.district).filter(Boolean))].sort(),
    [shelters]
  );

  const sheltersWithDistance = useMemo(
    () => shelters.map((item) => ({ ...item, distance_km: getDistanceKm(userLocation, item) })),
    [shelters, userLocation]
  );

  // เรียง: ที่ยังรับได้ก่อน → ใกล้คุณก่อน (ถ้ามีตำแหน่ง) → ที่ว่างมากก่อน
  const filteredShelters = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sheltersWithDistance
      .filter((item) => {
        const itemDistrict = item.district_name || item.district || "";
        const haystack = `${item.sheltername || ""} ${item.address || ""} ${item.tambon || ""} ${itemDistrict}`.toLowerCase();
        if (query && !haystack.includes(query)) return false;
        if (district !== "all" && itemDistrict !== district) return false;
        if (status !== "all" && getShelterStatus(item) !== status) return false;
        return true;
      })
      .sort((a, b) => {
        const fullDiff = Number(getShelterStatus(a) === "full") - Number(getShelterStatus(b) === "full");
        if (fullDiff !== 0) return fullDiff;
        if (userLocation) {
          const distanceDiff = (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity);
          if (distanceDiff !== 0) return distanceDiff;
        }
        return getVacancy(b) - getVacancy(a);
      });
  }, [district, search, sheltersWithDistance, status, userLocation]);

  const stats = useMemo(() => {
    const totalCapacity = shelters.reduce((sum, item) => sum + getCapacity(item), 0);
    const totalOccupancy = shelters.reduce((sum, item) => sum + getOccupancy(item), 0);
    const nearFullOrFull = shelters.filter((item) => getShelterStatus(item) !== "available").length;
    return {
      total: shelters.length,
      vacancy: Math.max(totalCapacity - totalOccupancy, 0),
      nearFullOrFull
    };
  }, [shelters]);

  const requestUserLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationStatus("error");
      setLocationMessage("เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง ลองเลือกอำเภอจากตัวกรองแทน");
      return;
    }

    setLocationStatus("loading");
    setLocationMessage("กำลังหาตำแหน่งของคุณ…");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lon: position.coords.longitude });
        setLocationStatus("ready");
        setLocationMessage("เรียงจากศูนย์ที่อยู่ใกล้คุณที่สุด");
      },
      (error) => {
        setLocationStatus("error");
        setLocationMessage(
          error.code === error.PERMISSION_DENIED
            ? "ยังไม่ได้อนุญาตให้ใช้ตำแหน่ง ลองเลือกอำเภอจากตัวกรองแทนได้"
            : "หาตำแหน่งไม่ได้ในขณะนี้ ลองเลือกอำเภอจากตัวกรองแทนได้"
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  // เปิดจากหน้าแรกด้วยปุ่ม "ศูนย์พักพิงใกล้ฉัน" (?near=1) ให้ขอตำแหน่งทันที
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("near") === "1") {
      requestUserLocation();
    }
  }, [requestUserLocation]);

  const hasData = shelters.length > 0;

  const headline = loadingContext
    ? "กำลังตรวจสอบศูนย์พักพิง…"
    : !selectedContext
      ? NO_DATA_MESSAGE
      : hasData
        ? `เปิดรับอยู่ ${formatNumber(stats.total)} แห่ง ที่ว่างรวม ${formatNumber(stats.vacancy)} ที่`
        : loadingShelters ? "กำลังโหลดรายชื่อศูนย์พักพิง…" : NO_DATA_MESSAGE;

  return (
    <PublicOpsScaffold
      title="ศูนย์พักพิง"
      activeMenu="shelters"
      eocIsOpen={eocIsOpen}
      eocStatus={scaffoldEocStatus}
      eocLabel={scaffoldEocLabel}
      showPageHeader={false}
      mainClassName="p-0!"
    >
      <div className={`${bodyFont.className} bg-[#eef2f1] text-[#15232e]`}>
        {/* ── หัวหน้า: บอกสถานการณ์ + ปุ่มหลักปุ่มเดียว ── */}
        <section className="bg-[#0c2f4a] text-white" aria-labelledby="shelter-title">
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:pb-20 lg:pt-10">
            <p className="flex items-center gap-2 text-sm text-[#9fc9d6]">
              <Tent className="h-4 w-4" aria-hidden="true" /> ศูนย์พักพิงจังหวัดสตูล
            </p>
            <h1 id="shelter-title" className={`${HEADING} mt-2 max-w-3xl text-[1.9rem] font-bold leading-[1.25] sm:text-[2.4rem]`}>
              {headline}
            </h1>

            {hasData && (
              <p className="mt-3 max-w-2xl text-[#cfe3ea]">
                {stats.nearFullOrFull > 0
                  ? `${formatNumber(stats.nearFullOrFull)} แห่งใกล้เต็มหรือเต็มแล้ว ควรโทรสอบถามก่อนเดินทาง`
                  : "ทุกแห่งยังรับเพิ่มได้ ควรโทรสอบถามก่อนเดินทาง"}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={requestUserLocation}
                disabled={locationStatus === "loading"}
                className={`${HEADING} inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-lg font-semibold text-[#0c2f4a] shadow-lg transition hover:bg-[#e6f4f1] disabled:cursor-wait disabled:opacity-70`}
              >
                <LocateFixed className="h-5 w-5" aria-hidden="true" />
                {locationStatus === "loading" ? "กำลังหาตำแหน่ง…" : userLocation ? "อัปเดตตำแหน่งของฉัน" : "หาศูนย์ที่ใกล้ฉัน"}
              </button>
              <p className={`text-sm ${locationStatus === "error" ? "text-[#ffd4d4]" : "text-[#9fc9d6]"}`} role="status">
                {locationMessage || "แตะปุ่มเพื่อเรียงศูนย์จากใกล้ไปไกล (ตำแหน่งไม่ถูกเก็บไว้)"}
              </p>
            </div>
          </div>
        </section>

        <div className="relative z-10 mx-auto -mt-8 max-w-6xl px-4 pb-10 sm:px-6">
          {/* ── ตัวกรอง ── */}
          <section className="rounded-2xl bg-white p-4 shadow-[0_20px_45px_-28px_rgba(12,47,74,.6)]" aria-label="ค้นหาและกรองศูนย์พักพิง">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
              <label className="relative block">
                <span className="sr-only">ค้นหาศูนย์พักพิง</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ค้นหาชื่อศูนย์ หรือตำบล"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-base text-slate-800 outline-none focus:border-[#2a9db0] focus:ring-2 focus:ring-[#2a9db0]/25"
                />
              </label>
              <label className="block">
                <span className="sr-only">อำเภอ</span>
                <select
                  value={district}
                  onChange={(event) => setDistrict(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-800 outline-none focus:border-[#2a9db0] focus:ring-2 focus:ring-[#2a9db0]/25"
                >
                  <option value="all">ทุกอำเภอ</option>
                  {districts.map((name) => <option key={name} value={name}>อ.{name}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="กรองตามสถานะ">
              {STATUS_FILTERS.map((item) => {
                const selected = status === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setStatus(item.value)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${selected ? "border-[#0c2f4a] bg-[#0c2f4a] text-white" : "border-slate-200 bg-white text-slate-700 hover:border-[#2a9db0]"}`}
                  >
                    {item.label}
                  </button>
                );
              })}

              {contextOptions.length > 1 && (
                <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
                  <span>เหตุการณ์</span>
                  <select
                    value={selectedKey}
                    onChange={(event) => setSelectedKey(event.target.value)}
                    className="max-w-[14rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-[#2a9db0]"
                  >
                    {contextOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                  </select>
                </label>
              )}
            </div>

          </section>

          {/* มือถือ: สลับ รายการ / แผนที่ */}
          <div className="mt-5 grid grid-cols-2 rounded-xl bg-white p-1 shadow-sm lg:hidden" role="tablist" aria-label="มุมมอง">
            {[["list", "รายการ"], ["map", "แผนที่"]].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={view === value}
                onClick={() => setView(value)}
                className={`${HEADING} rounded-lg py-2 text-base font-semibold transition ${view === value ? "bg-[#0c2f4a] text-white" : "text-slate-600"}`}
              >
                {label}{value === "list" ? ` (${formatNumber(filteredShelters.length)})` : ""}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* รายการ */}
            <section className={view === "map" ? "hidden lg:block" : ""} aria-label="รายการศูนย์พักพิง">
              <h2 className={`${HEADING} mb-3 hidden text-xl font-bold text-[#0c2f4a] lg:block`}>
                รายการศูนย์พักพิง <span className="text-base font-medium text-slate-500">({formatNumber(filteredShelters.length)} แห่ง)</span>
              </h2>

              <div className="space-y-3 lg:max-h-[640px] lg:overflow-y-auto lg:pr-1">
                {loadingShelters && filteredShelters.length === 0 && (
                  <div className="h-28 animate-pulse rounded-2xl bg-white" aria-hidden="true" />
                )}
                {!loadingShelters && filteredShelters.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
                    {hasData ? "ไม่พบศูนย์พักพิงตามที่เลือก ลองล้างตัวกรองหรือเปลี่ยนอำเภอ" : `${NO_DATA_MESSAGE} • หากต้องการความช่วยเหลือเร่งด่วนโทร 1669`}
                  </div>
                )}

                {filteredShelters.map((shelter, index) => {
                  const state = getShelterStatus(shelter);
                  const meta = getStatusMeta(state);
                  const capacity = getCapacity(shelter);
                  const occupancy = getOccupancy(shelter);
                  const ratio = capacity ? Math.min(occupancy / capacity, 1) : 0;
                  const lat = getCoordinate(shelter.lat);
                  const lon = getCoordinate(shelter.lon);
                  const nearest = userLocation && index === 0 && state !== "full" && shelter.distance_km !== null;
                  return (
                    <article
                      key={shelter.id}
                      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70"
                      style={{ borderLeft: `6px solid ${meta.color}` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {nearest && <p className="mb-1 text-xs font-semibold text-[#11466e]">ใกล้คุณที่สุด</p>}
                          <h3 className={`${HEADING} text-lg font-semibold leading-snug text-[#0c2f4a]`}>{shelter.sheltername}</h3>
                          <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-600">
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            ต.{shelter.tambon || "-"} อ.{shelter.district_name || shelter.district || "-"}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`${HEADING} inline-block rounded-full px-3 py-1 text-sm font-semibold ${meta.soft}`}>{meta.label}</span>
                          {shelter.distance_km !== null && shelter.distance_km !== undefined && (
                            <p className={`${HEADING} mt-1 text-sm font-semibold text-[#11466e]`}>{formatDistance(shelter.distance_km)}</p>
                          )}
                        </div>
                      </div>

                      {capacity > 0 && (
                        <div className="mt-3">
                          <div className="flex items-baseline justify-between text-sm">
                            <span className="text-slate-600">ว่าง <strong className={`${HEADING} text-base font-semibold`} style={{ color: meta.color }}>{formatNumber(getVacancy(shelter))}</strong> จาก {formatNumber(capacity)} ที่</span>
                            <span className="text-xs text-slate-500">พักอยู่ {formatNumber(occupancy)} คน</span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`เต็มแล้ว ${Math.round(ratio * 100)} เปอร์เซ็นต์`}>
                            <div className="h-full rounded-full" style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: meta.color }} />
                          </div>
                        </div>
                      )}

                      {(shelter.contact_phone || (lat !== null && lon !== null)) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {lat !== null && lon !== null && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`}
                              target="_blank"
                              rel="noreferrer"
                              className={`${HEADING} inline-flex items-center gap-1.5 rounded-lg bg-[#11466e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0c2f4a]`}
                            >
                              <Navigation className="h-4 w-4" aria-hidden="true" /> นำทาง
                            </a>
                          )}
                          {shelter.contact_phone && (
                            <a
                              href={`tel:${shelter.contact_phone}`}
                              className={`${HEADING} inline-flex items-center gap-1.5 rounded-lg border border-[#11466e] px-4 py-2 text-sm font-semibold text-[#11466e] hover:bg-[#eef2f1]`}
                            >
                              <Phone className="h-4 w-4" aria-hidden="true" /> โทร {shelter.contact_phone}
                            </a>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-slate-500">ความจุและจำนวนผู้พักอาจเปลี่ยนแปลงได้ตลอดเวลา กรุณาโทรสอบถามก่อนเดินทาง</p>
            </section>

            {/* แผนที่: จอใหญ่ลอยตามการเลื่อน */}
            <section className={`${view === "list" ? "hidden lg:block" : ""} lg:sticky lg:top-4 lg:self-start`} aria-label="แผนที่ศูนย์พักพิง">
              <div className="overflow-hidden rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200/70">
                {selectedContext?.session_id && hasData ? (
                  <ShelterCenterMap
                    key={`shelter-map-${selectedContext.session_id}-${view}`}
                    eocType={selectedContext?.eoc_type || null}
                    sessionId={selectedContext.session_id}
                    apiPath="/stn-eoc/api/public/shelter-centers"
                    includeAll={false}
                    embedded
                    heightClass="h-[440px] lg:h-[600px]"
                    showLayerControls={false}
                  />
                ) : (
                  <div className="flex h-[320px] items-center justify-center rounded-xl bg-slate-50 p-6 text-center text-slate-500">
                    ยังไม่มีข้อมูลการเปิดศูนย์พักพิง
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* ── ข้อมูลประกอบ ── */}
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
              <h2 className={`${HEADING} text-xl font-bold text-[#0c2f4a]`}>เตรียมอะไรไปบ้าง</h2>
              <ul className="mt-3 space-y-2">
                {PREPARATION.map((item) => (
                  <li key={item} className="flex gap-2.5 text-slate-700">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#2e6b4e]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
              <h2 className={`${HEADING} text-xl font-bold text-[#0c2f4a]`}>เบอร์โทรฉุกเฉิน</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {EMERGENCY_NUMBERS.map(([number, label], index) => (
                  <a
                    key={number}
                    href={`tel:${number}`}
                    className={`rounded-xl px-3 py-2.5 hover:opacity-90 ${index === 0 ? "bg-[#c81e1e] text-white" : "bg-[#eef2f1] text-[#0c2f4a]"}`}
                  >
                    <span className={`${HEADING} block text-lg font-semibold leading-tight`}>{number}</span>
                    <span className="block text-sm">{label}</span>
                  </a>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </PublicOpsScaffold>
  );
}
