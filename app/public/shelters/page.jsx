"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import ShelterCenterMap from "@/components/ShelterCenterMap";
import PublicOpsScaffold from "@/components/public/PublicOpsScaffold";

const EOC_TYPE_LABELS = {
  flood: "อุทกภัย",
  drought: "ภัยแล้ง",
  tsunami: "สึนามิ",
  earthquake: "แผ่นดินไหว",
  disease: "โรคระบาด",
  accident: "อุบัติเหตุ",
  "festival-accidents": "อุบัติเหตุช่วงเทศกาล"
};

const STATUS_FILTERS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "available", label: "เปิดให้บริการ" },
  { value: "near_full", label: "ใกล้เต็ม" },
  { value: "full", label: "เต็ม" }
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
  return item?.name_th || EOC_TYPE_LABELS[item?.eoc_type] || item?.eoc_type || "EOC";
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

function getStatusMeta(status) {
  if (status === "full") return { label: "เต็ม", className: "border-red-200 bg-red-50 text-red-700" };
  if (status === "near_full") return { label: "ใกล้เต็ม", className: "border-orange-200 bg-orange-50 text-orange-700" };
  return { label: "เปิดให้บริการ", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
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

function buildContextOptions(activeEocs, sessions) {
  const active = activeEocs
    .filter((item) => item.is_active)
    .sort((a, b) => new Date(b.activated_at || 0) - new Date(a.activated_at || 0))
    .map((item) => ({
      key: `active-${item.eoc_type}-${item.session_id || item.id}`,
      mode: "active",
      session_id: item.session_id || null,
      eoc_type: item.eoc_type,
      label: `${getEocLabel(item)} ที่เปิดอยู่`,
      opened_at: item.activated_at,
      closed_at: null
    }));

  const activeSessionIds = new Set(active.map((item) => String(item.session_id)).filter(Boolean));
  const history = sessions
    .filter((session) => !activeSessionIds.has(String(session.id)))
    .map((session) => ({
      key: `history-${session.id}`,
      mode: "history",
      session_id: session.id,
      eoc_type: session.eoc_type,
      label: `${EOC_TYPE_LABELS[session.eoc_type] || session.eoc_type || "EOC"} #${session.session_number || session.id}`,
      opened_at: session.opened_at,
      closed_at: session.closed_at
    }));

  return [...active, ...history];
}

export default function PublicSheltersPage() {
  const [loadingContext, setLoadingContext] = useState(true);
  const [loadingShelters, setLoadingShelters] = useState(false);
  const [activeEocs, setActiveEocs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [shelters, setShelters] = useState([]);
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("all");
  const [status, setStatus] = useState("all");
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => {
    const loadContext = async () => {
      try {
        const [statusRes, summaryRes] = await Promise.all([
          fetch("/stn-eoc/api/eoc/status/"),
          fetch("/stn-eoc/api/dashboard/summary/")
        ]);

        const statusJson = statusRes.ok ? await statusRes.json() : { success: false, data: [] };
        const summaryJson = summaryRes.ok ? await summaryRes.json() : { success: false, data: {} };
        const statusRows = statusJson.success ? statusJson.data || [] : [];
        const sessionRows = summaryJson?.success ? summaryJson.data?.eocSessions || [] : [];

        setActiveEocs(statusRows);
        setSessions(
          [...sessionRows].sort((a, b) => new Date(b.opened_at || 0) - new Date(a.opened_at || 0))
        );
      } catch (error) {
        console.error("Error loading shelter context:", error);
      } finally {
        setLoadingContext(false);
      }
    };

    loadContext();
  }, []);

  const contextOptions = useMemo(
    () => buildContextOptions(activeEocs, sessions),
    [activeEocs, sessions]
  );

  useEffect(() => {
    if (!selectedKey && contextOptions.length > 0) setSelectedKey(contextOptions[0].key);
  }, [contextOptions, selectedKey]);

  const selectedContext = useMemo(
    () => contextOptions.find((item) => item.key === selectedKey) || contextOptions[0] || null,
    [contextOptions, selectedKey]
  );

  const eocIsOpen = activeEocs.some((item) => Boolean(item.is_active));
  const latestActive = activeEocs.find((item) => item.is_active);

  const loadShelters = useCallback(async () => {
    try {
      setLoadingShelters(true);
      const params = new URLSearchParams();
      if (selectedContext?.eoc_type) params.set("eoc_type", selectedContext.eoc_type);
      if (selectedContext?.session_id) params.set("session_id", selectedContext.session_id);
      if (!selectedContext?.session_id) params.set("include_all", "1");

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
    () => shelters.map((item) => ({
      ...item,
      distance_km: getDistanceKm(userLocation, item)
    })),
    [shelters, userLocation]
  );

  const filteredShelters = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sheltersWithDistance.filter((item) => {
      const itemDistrict = item.district_name || item.district || "";
      const haystack = `${item.sheltername || ""} ${item.address || ""} ${item.tambon || ""} ${itemDistrict}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (district !== "all" && itemDistrict !== district) return false;
      if (status !== "all" && getShelterStatus(item) !== status) return false;
      return true;
    });
  }, [district, search, sheltersWithDistance, status]);

  const stats = useMemo(() => {
    const totalCapacity = shelters.reduce((sum, item) => sum + getCapacity(item), 0);
    const totalOccupancy = shelters.reduce((sum, item) => sum + getOccupancy(item), 0);
    const nearFull = shelters.filter((item) => getShelterStatus(item) === "near_full").length;
    const full = shelters.filter((item) => getShelterStatus(item) === "full").length;

    return {
      total: shelters.length,
      totalCapacity,
      totalOccupancy,
      vacancy: Math.max(totalCapacity - totalOccupancy, 0),
      districts: districts.length,
      risk: nearFull + full
    };
  }, [districts.length, shelters]);

  const recommendedShelters = useMemo(
    () => [...sheltersWithDistance]
      .filter((item) => getShelterStatus(item) !== "full")
      .sort((a, b) => {
        if (userLocation) {
          const distanceA = a.distance_km ?? Number.POSITIVE_INFINITY;
          const distanceB = b.distance_km ?? Number.POSITIVE_INFINITY;
          if (distanceA !== distanceB) return distanceA - distanceB;
        }
        return getVacancy(b) - getVacancy(a);
      })
      .slice(0, 3),
    [sheltersWithDistance, userLocation]
  );

  const requestUserLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationStatus("error");
      setLocationMessage("เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }

    setLocationStatus("loading");
    setLocationMessage("กำลังตรวจสอบตำแหน่งของคุณ...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
        setLocationStatus("ready");
        setLocationMessage("จัดอันดับจากศูนย์พักพิงที่ใกล้คุณที่สุด");
      },
      (error) => {
        setLocationStatus("error");
        if (error.code === error.PERMISSION_DENIED) {
          setLocationMessage("ไม่สามารถใช้ตำแหน่งได้ เพราะยังไม่ได้รับอนุญาต");
        } else {
          setLocationMessage("ไม่สามารถตรวจสอบตำแหน่งได้ในขณะนี้");
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  const selectedPeriod = selectedContext
    ? `${formatDate(selectedContext.opened_at)} - ${selectedContext.closed_at ? formatDate(selectedContext.closed_at) : "ปัจจุบัน"}`
    : "-";

  return (
    <PublicOpsScaffold
      title="ศูนย์พักพิง / Shelters"
      subtitle="ค้นหาศูนย์พักพิงที่ใกล้ที่สุด ตรวจสอบความจุ และบริการที่มี"
      activeMenu="shelters"
      eocIsOpen={eocIsOpen}
      eocLabel={latestActive ? getEocLabel(latestActive) : "สถานะศูนย์"}
    >
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-3">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "จำนวนศูนย์พักพิง", value: stats.total, unit: "แห่ง", tone: "border-violet-200 bg-violet-50 text-violet-700" },
              { label: "ความจุรวม", value: stats.totalCapacity, unit: "เตียง", tone: "border-blue-200 bg-blue-50 text-blue-700" },
              { label: "ผู้เข้าพักปัจจุบัน", value: stats.totalOccupancy, unit: "คน", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
              { label: "ที่ว่างคงเหลือ", value: stats.vacancy, unit: "เตียง", tone: "border-orange-200 bg-orange-50 text-orange-700" },
              { label: "อำเภอที่มีศูนย์พักพิง", value: stats.districts, unit: "อำเภอ", tone: "border-cyan-200 bg-cyan-50 text-cyan-700" },
              { label: "ใกล้เต็ม/เต็ม", value: stats.risk, unit: "แห่ง", tone: "border-red-200 bg-red-50 text-red-700" }
            ].map((item) => (
              <div key={item.label} className={`rounded-xl border p-4 shadow-sm ${item.tone}`}>
                <p className="text-xs font-bold">{item.label}</p>
                <p className="mt-1 text-3xl font-black leading-none">{formatNumber(item.value)}</p>
                <p className="mt-1 text-xs font-semibold">{item.unit}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(230px,1fr)_180px_170px] xl:grid-cols-[minmax(260px,1fr)_170px_160px_190px]">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-500">ชุดข้อมูล</span>
                <select
                  value={selectedKey}
                  onChange={(event) => setSelectedKey(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
                >
                  {contextOptions.length === 0 && <option value="">ไม่มีข้อมูล session</option>}
                  {contextOptions.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.mode === "active" ? "เปิดอยู่: " : "ย้อนหลัง: "}{item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-500">อำเภอ</span>
                <select
                  value={district}
                  onChange={(event) => setDistrict(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
                >
                  <option value="all">ทั้งหมด</option>
                  {districts.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-500">สถานะ</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
                >
                  {STATUS_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>

              <label className="block lg:col-span-3 xl:col-span-1">
                <span className="mb-1 block text-xs font-bold text-slate-500">ค้นหา</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ชื่อศูนย์ / ตำบล"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-slate-800">แนะนำศูนย์พักพิงใกล้คุณ</p>
                <p className={`mt-0.5 text-xs ${locationStatus === "error" ? "text-red-600" : "text-slate-500"}`}>
                  {locationMessage || "กดใช้ตำแหน่งเพื่อแสดงระยะห่างและเรียงศูนย์พักพิงที่ใกล้ที่สุด"}
                </p>
              </div>
              <button
                type="button"
                onClick={requestUserLocation}
                disabled={locationStatus === "loading"}
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {locationStatus === "loading" ? "กำลังค้นหา..." : userLocation ? "อัปเดตตำแหน่ง" : "ใช้ตำแหน่งของฉัน"}
              </button>
            </div>

            <div className={`mt-3 rounded-lg p-3 text-sm font-semibold ${eocIsOpen ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
              {eocIsOpen
                ? `แสดงข้อมูลจาก ${selectedContext?.label || "EOC ที่เปิดอยู่"}`
                : "ขณะนี้ไม่มี EOC ที่เปิดอยู่ สามารถเลือกดูข้อมูลย้อนหลังได้เหมือนหน้าหลัก"}
              <span className="ml-2 text-xs font-medium text-slate-500">ช่วงข้อมูล: {selectedPeriod}</span>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
            <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-lg font-black text-blue-900">แผนที่ศูนย์พักพิง</h3>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{formatNumber(filteredShelters.length)} แห่ง</span>
              </div>
              <ShelterCenterMap
                eocType={selectedContext?.eoc_type || null}
                sessionId={selectedContext?.session_id || null}
                apiPath="/stn-eoc/api/public/shelter-centers"
                includeAll={!selectedContext?.session_id}
                embedded
                heightClass="h-[460px]"
                showLayerControls={false}
              />
              <p className="mt-3 text-xs text-slate-500">หมายเหตุ: ความจุและจำนวนผู้พักพิงอาจเปลี่ยนแปลงได้ตลอดเวลา กรุณาตรวจสอบล่าสุดก่อนเดินทาง</p>
            </section>

            <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-black text-blue-900">รายการศูนย์พักพิง ({formatNumber(filteredShelters.length)} แห่ง)</h3>
                {loadingShelters && <span className="text-xs font-bold text-slate-500">กำลังโหลด...</span>}
              </div>

              <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
                {filteredShelters.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">ไม่พบศูนย์พักพิงในเงื่อนไขนี้</div>
                ) : filteredShelters.map((shelter) => {
                  const meta = getStatusMeta(getShelterStatus(shelter));
                  return (
                    <article key={shelter.id} className="grid gap-3 rounded-xl border border-slate-100 p-3 text-sm shadow-sm sm:grid-cols-[minmax(0,1fr)_220px]">
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50">
                            <Image src="/stn-eoc/img/shelter.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="truncate font-black text-slate-800">{shelter.sheltername}</h4>
                            <p className="mt-0.5 text-xs text-slate-500">ต.{shelter.tambon || "-"} อ.{shelter.district_name || shelter.district || "-"}</p>
                            {shelter.distance_km !== null && shelter.distance_km !== undefined && (
                              <p className="mt-1 text-xs font-black text-violet-700">ห่างจากคุณประมาณ {formatDistance(shelter.distance_km)}</p>
                            )}
                            {shelter.contact_phone && (
                              <a href={`tel:${shelter.contact_phone}`} className="mt-1 inline-flex text-xs font-bold text-blue-700 hover:underline">
                                {shelter.contact_phone}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-2 text-center sm:grid-cols-[48px_48px_48px_minmax(74px,1fr)]">
                        <div><p className="font-black">{formatNumber(getCapacity(shelter))}</p><p className="text-[11px] text-slate-500">จุ</p></div>
                        <div><p className="font-black">{formatNumber(getOccupancy(shelter))}</p><p className="text-[11px] text-slate-500">พัก</p></div>
                        <div><p className="font-black text-emerald-700">{formatNumber(getVacancy(shelter))}</p><p className="text-[11px] text-slate-500">ว่าง</p></div>
                        <span className={`rounded-full border px-2 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        <aside className="space-y-3">
          <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-black text-blue-900">ศูนย์พักพิงแนะนำ</h3>
            <p className="mb-3 text-xs text-slate-500">
              {userLocation ? "เรียงจากระยะใกล้คุณที่สุด" : "กดใช้ตำแหน่งของฉันเพื่อแนะนำจากระยะใกล้ที่สุด"}
            </p>
            <div className="space-y-2">
              {recommendedShelters.length === 0 ? (
                <p className="text-sm text-slate-500">ยังไม่มีศูนย์ที่แนะนำในชุดข้อมูลนี้</p>
              ) : recommendedShelters.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-100 p-3">
                  <p className="truncate text-sm font-black text-slate-800">{item.sheltername}</p>
                  <p className="mt-1 text-xs text-slate-500">อ.{item.district_name || item.district || "-"} เหลือ {formatNumber(getVacancy(item))} เตียง</p>
                  {item.distance_km !== null && item.distance_km !== undefined && (
                    <p className="mt-1 text-xs font-black text-violet-700">ระยะทางประมาณ {formatDistance(item.distance_km)}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-black text-blue-900">การเตรียมตัวเข้าสู่ศูนย์พักพิง</h3>
            {["เตรียมเอกสารสำคัญและยาประจำตัว", "นำของใช้ส่วนตัวเท่าที่จำเป็น", "แจ้งผู้ดูแลหากมีผู้สูงอายุ เด็ก หรือผู้ป่วย", "ปฏิบัติตามคำแนะนำของเจ้าหน้าที่"].map((item) => (
              <div key={item} className="mb-2 flex gap-2 text-sm text-slate-700 last:mb-0">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-50 text-xs font-black text-emerald-700">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </section>

          <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-black text-blue-900">หมายเลขฉุกเฉิน</h3>
            {[
              ["191", "เหตุฉุกเฉิน / แจ้งเหตุ", "text-red-700"],
              ["1784", "ปภ. สายด่วน", "text-blue-700"],
              ["1669", "หน่วยแพทย์ฉุกเฉิน", "text-emerald-700"],
              ["074-711221", "จังหวัดสตูล", "text-slate-700"]
            ].map(([number, label, tone]) => (
              <a key={number} href={`tel:${number}`} className="mb-2 flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm font-bold last:mb-0">
                <span>{label}</span>
                <span className={tone}>{number}</span>
              </a>
            ))}
          </section>
        </aside>
      </section>
    </PublicOpsScaffold>
  );
}
