"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  CloudSun,
  Download,
  History,
  Hospital,
  Info,
  Landmark,
  List,
  Map as MapIcon,
  MapPinned,
  Mountain,
  Pause,
  Play,
  Radar,
  Route,
  Search,
  Signpost,
  Tag,
  Tent,
  TriangleAlert,
  Waves,
  X
} from "lucide-react";
import AIChatbot from "@/components/AIChatbot";
import PublicIncidentMap from "@/components/PublicIncidentMap";
import PublicTopNavigation from "@/components/public/PublicTopNavigation";
import { MAP_BASE_LAYERS } from "@/lib/mapBaseLayers";
import {
  DISASTER_OPTIONS,
  buildContextOptions,
  buildDateOptions,
  buildDiseaseEventItems,
  buildEventsCsv,
  buildFloodEventItems,
  describeViewMode,
  filterPublicIncidents,
  formatNumber,
  formatThaiDate,
  formatTime,
  getDefaultLayers,
  getEventMeta,
  getEventTypeLabel,
  getTodayDateKey,
  mergeEventItems
} from "@/components/public/PublicDisasterMapContent";
import { fetchLatestRadarLayer } from "@/components/public/disaster-map/windyLayers";
import { GLASS, MenuToggle, SectionTitle, SidebarItem } from "@/components/public/map/WindyStyleControls";

// แถบบอกสถานะข้อมูลที่กำลังดู: เหตุการณ์ปัจจุบัน / ข้อมูลย้อนหลังของเหตุการณ์ปัจจุบัน / เหตุการณ์ย้อนหลัง
function ViewModeBanner({ viewMode, context, selectedDate, disasterLabel, onBackToToday, onShowActive }) {
  if (viewMode.kind === "none") return null;

  if (viewMode.kind === "live") {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-red-600 px-3 py-2 text-white" role="status">
        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-black leading-tight">กำลังดูเหตุการณ์ปัจจุบัน</span>
          <span className="block text-[11px] font-semibold text-white/85">ข้อมูลวันนี้ ศูนย์ปฏิบัติการยังเปิดอยู่</span>
        </span>
      </div>
    );
  }

  if (viewMode.kind === "activePast") {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-amber-400 px-3 py-2 text-slate-950" role="status">
        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black leading-tight">เหตุการณ์ปัจจุบัน: ข้อมูลย้อนหลัง</span>
          <span className="block text-[11px] font-semibold">แสดงข้อมูลของวันที่ {formatThaiDate(selectedDate, { long: true })} ไม่ใช่วันนี้</span>
        </span>
        <button type="button" onClick={onBackToToday} className="shrink-0 rounded-lg bg-slate-950 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800">
          ดูวันนี้
        </button>
      </div>
    );
  }

  const range = context?.opened_at
    ? `${formatThaiDate(context.opened_at)} ถึง ${context.closed_at ? formatThaiDate(context.closed_at) : "ไม่ระบุวันปิด"}`
    : "";
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-slate-200 px-3 py-2 text-slate-900" role="status">
      <History className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black leading-tight">กำลังดูเหตุการณ์ย้อนหลัง (ปิดแล้ว)</span>
        <span className="block text-[11px] font-semibold text-slate-700">
          {range ? `ช่วงเหตุการณ์ ${range}` : "ข้อมูลนี้ไม่ใช่สถานการณ์ปัจจุบัน"}
          {!viewMode.hasActive && ` • ขณะนี้ไม่มีเหตุการณ์${disasterLabel}ที่เปิดอยู่`}
        </span>
      </span>
      {viewMode.hasActive && (
        <button type="button" onClick={onShowActive} className="shrink-0 rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-red-700">
          ดูเหตุการณ์ปัจจุบัน
        </button>
      )}
    </div>
  );
}

function getEocLayerItems(disasterType) {
  return [
    ...(disasterType === "flood" ? [{ key: "floodAreas", label: "พื้นที่น้ำท่วม", icon: Waves, tone: "from-sky-500 to-blue-700" }] : []),
    ...(disasterType === "disease" ? [{ key: "diseaseReports", label: "รายงานโรคระบาด", icon: Activity, tone: "from-teal-400 to-emerald-600" }] : []),
    { key: "incidents", label: "เหตุการณ์/ขอความช่วยเหลือ", icon: TriangleAlert, tone: "from-orange-400 to-red-500" },
    { key: "traffic", label: "เส้นทาง/ถนน", icon: Route, tone: "from-rose-400 to-red-600" },
    { key: "shelters", label: "ศูนย์พักพิง", icon: Tent, tone: "from-violet-400 to-purple-600" },
    { key: "hospitals", label: "โรงพยาบาล", icon: Hospital, tone: "from-emerald-400 to-green-600" },
    { key: "waterways", label: "เส้นทางน้ำ/คลอง", icon: Signpost, tone: "from-cyan-400 to-sky-600" },
    { key: "district", label: "ขอบเขตอำเภอ", icon: Landmark, tone: "from-slate-400 to-slate-700" },
    { key: "tambon", label: "ขอบเขตตำบล", icon: MapPinned, tone: "from-emerald-300 to-teal-600" },
    { key: "village", label: "ขอบเขตหมู่บ้าน", icon: MapIcon, tone: "from-stone-300 to-stone-600" },
    { key: "labels", label: "ชื่อพื้นที่", icon: Tag, tone: "from-amber-300 to-amber-600" },
    { key: "hillshade", label: "ภูมิประเทศ", icon: Mountain, tone: "from-lime-400 to-green-700" }
  ];
}

const URGENCY_OPTIONS = [
  ["all", "ทุกระดับ"],
  ["critical", "วิกฤต"],
  ["high", "เร่งด่วน"],
  ["medium", "เฝ้าระวัง"],
  ["low", "ทั่วไป"]
];

function GlassSelect({ label, value, onChange, children, disabled }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-white/70">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-9 w-full rounded-lg border border-white/15 bg-slate-800/90 px-2 text-sm font-semibold text-white outline-none focus:border-sky-400 disabled:opacity-50"
      >
        {children}
      </select>
    </label>
  );
}

function Legend({ disasterType, onClose }) {
  const items = disasterType === "disease"
    ? [["bg-red-600", "ระบาดหนัก"], ["bg-amber-400", "ระบาดปานกลาง"], ["bg-teal-500", "เฝ้าระวัง"], ["bg-emerald-600", "หน่วยบริการ"], ["bg-orange-500", "เหตุการณ์"], ["bg-violet-600", "ศูนย์พักพิง"]]
    : [["bg-red-600", "น้ำท่วมสูง/สูงมาก"], ["bg-amber-400", "น้ำท่วมปานกลาง"], ["bg-sky-400", "น้ำท่วมต่ำ"], ["bg-orange-500", "เหตุการณ์"], ["bg-violet-600", "ศูนย์พักพิง"], ["bg-emerald-600", "โรงพยาบาล"], ["bg-sky-700", "เส้นทางน้ำ"]];
  return (
    <div className={`rounded-xl p-3 text-xs ${GLASS}`}>
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="font-black">คำอธิบายสัญลักษณ์</span>
        <button type="button" onClick={onClose} className="rounded p-0.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="ซ่อนคำอธิบายสัญลักษณ์">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {items.map(([color, label]) => (
          <span key={label} className="flex items-center gap-2 font-semibold text-white/90">
            <span className={`h-3 w-3 shrink-0 rounded-full ${color}`} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DisasterMapWorkspace({ initialDisasterType = "flood" }) {
  const [activeEocs, setActiveEocs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loadingContext, setLoadingContext] = useState(true);
  const [disasterType, setDisasterType] = useState(initialDisasterType);
  const [selectedContextKey, setSelectedContextKey] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [mapLayers, setMapLayers] = useState(() => getDefaultLayers(initialDisasterType));
  const [baseMap, setBaseMap] = useState("street");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [reportTypeFilter, setReportTypeFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [incidents, setIncidents] = useState([]);
  const [floodAreas, setFloodAreas] = useState([]);
  const [diseaseReports, setDiseaseReports] = useState([]);

  const [radarEnabled, setRadarEnabled] = useState(false);
  const [radarLayer, setRadarLayer] = useState(null);
  const [radarError, setRadarError] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // จอเล็กเริ่มแบบพับเมนูไว้ เพื่อให้เห็นแผนที่ก่อน
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
      setLegendOpen(false);
    }
  }, []);

  useEffect(() => {
    const loadContext = async () => {
      try {
        const [statusRes, summaryRes] = await Promise.all([
          fetch("/stn-eoc/api/eoc/status/"),
          fetch("/stn-eoc/api/dashboard/summary/")
        ]);
        const statusJson = statusRes.ok ? await statusRes.json() : { success: false, data: [] };
        const summaryJson = summaryRes.ok ? await summaryRes.json() : { success: false, data: {} };
        setActiveEocs(statusJson.success ? statusJson.data || [] : []);
        setSessions(summaryJson.success ? summaryJson.data?.eocSessions || [] : []);
      } catch (error) {
        console.error("Error loading map context:", error);
      } finally {
        setLoadingContext(false);
      }
    };
    loadContext();
  }, []);

  const contextOptions = useMemo(
    () => buildContextOptions(activeEocs, sessions, disasterType),
    [activeEocs, disasterType, sessions]
  );

  const changeDisasterType = useCallback((nextType) => {
    setDisasterType(nextType);
    setSelectedContextKey("");
    setSelectedDate("");
    setIncidents([]);
    setFloodAreas([]);
    setDiseaseReports([]);
    setMapLayers(getDefaultLayers(nextType));
    setReportTypeFilter("all");
    setDistrictFilter("all");
  }, []);

  useEffect(() => {
    if (contextOptions.length === 0) return;
    if (!selectedContextKey || !contextOptions.some((item) => item.key === selectedContextKey)) {
      setSelectedContextKey(contextOptions[0].key);
    }
  }, [contextOptions, selectedContextKey]);

  const selectedContext = useMemo(
    () => contextOptions.find((item) => item.key === selectedContextKey) || contextOptions[0] || null,
    [contextOptions, selectedContextKey]
  );

  const dateOptions = useMemo(() => buildDateOptions(selectedContext), [selectedContext]);
  const viewMode = useMemo(
    () => describeViewMode(selectedContext, selectedDate, contextOptions),
    [contextOptions, selectedContext, selectedDate]
  );
  const activeContextOptions = contextOptions.filter((item) => item.mode === "active");
  const historyContextOptions = contextOptions.filter((item) => item.mode !== "active");

  useEffect(() => {
    if (dateOptions.length === 0) return;
    const fallbackDate = selectedContext?.status === "active"
      ? getTodayDateKey()
      : selectedContext?.latest_data_date || dateOptions[dateOptions.length - 1]?.date;
    if (!selectedDate || !dateOptions.some((item) => item.date === selectedDate)) {
      setSelectedDate(fallbackDate || dateOptions[0].date);
    }
  }, [dateOptions, selectedContext?.latest_data_date, selectedContext?.status, selectedDate]);

  useEffect(() => {
    if (disasterType !== "flood" || !selectedContext?.id || !selectedDate) {
      setFloodAreas([]);
      return undefined;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({ session_id: selectedContext.id, date: selectedDate });
    fetch(`/stn-eoc/api/eoc/flood/area-status?${params.toString()}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { success: false }))
      .then((json) => setFloodAreas(json.success ? json.data || [] : []))
      .catch((error) => {
        if (error.name !== "AbortError") setFloodAreas([]);
      });
    return () => controller.abort();
  }, [disasterType, selectedContext?.id, selectedDate]);

  useEffect(() => {
    if (disasterType !== "disease" || !selectedContext?.id || !selectedDate) {
      setDiseaseReports([]);
      return undefined;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({ session_id: selectedContext.id, date: selectedDate });
    fetch(`/stn-eoc/api/eoc/disease/area-status?${params.toString()}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { success: false }))
      .then((json) => setDiseaseReports(json.success ? json.data || [] : []))
      .catch((error) => {
        if (error.name !== "AbortError") setDiseaseReports([]);
      });
    return () => controller.abort();
  }, [disasterType, selectedContext?.id, selectedDate]);

  // เรดาร์ฝน RainViewer (ซ้อนบนแผนที่ EOC) — โหลดใหม่ทุก 10 นาทีขณะเปิดอยู่
  useEffect(() => {
    if (!radarEnabled) return undefined;
    let controller = new AbortController();
    const load = () => {
      controller.abort();
      controller = new AbortController();
      fetchLatestRadarLayer(controller.signal)
        .then((layer) => {
          setRadarLayer(layer);
          setRadarError(layer ? "" : "ไม่สามารถโหลดเรดาร์ฝนได้");
        })
        .catch((error) => {
          if (error.name !== "AbortError") setRadarError("ไม่สามารถโหลดเรดาร์ฝนได้");
        });
    };
    load();
    const timer = window.setInterval(load, 10 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [radarEnabled]);

  // เล่นไทม์ไลน์ทีละวัน
  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = window.setInterval(() => {
      setSelectedDate((current) => {
        const index = dateOptions.findIndex((item) => item.date === current);
        if (index < 0 || index >= dateOptions.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return dateOptions[index + 1].date;
      });
    }, 1600);
    return () => window.clearInterval(timer);
  }, [dateOptions, isPlaying]);

  const visibleIncidents = useMemo(
    () => filterPublicIncidents(incidents, { urgencyFilter, reportTypeFilter, districtFilter, searchQuery, layers: mapLayers }),
    [incidents, mapLayers, urgencyFilter, reportTypeFilter, districtFilter, searchQuery]
  );
  const floodItems = useMemo(
    () => (disasterType === "flood" && mapLayers.floodAreas !== false
      ? buildFloodEventItems(floodAreas, { urgencyFilter, reportTypeFilter, districtFilter, searchQuery })
      : []),
    [disasterType, floodAreas, mapLayers.floodAreas, urgencyFilter, reportTypeFilter, districtFilter, searchQuery]
  );
  const diseaseItems = useMemo(
    () => (disasterType === "disease" && mapLayers.diseaseReports
      ? buildDiseaseEventItems(diseaseReports, { urgencyFilter, reportTypeFilter, districtFilter, searchQuery })
      : []),
    [disasterType, diseaseReports, mapLayers.diseaseReports, urgencyFilter, reportTypeFilter, districtFilter, searchQuery]
  );
  const eventItems = useMemo(
    () => mergeEventItems({ floodItems, diseaseItems, incidentItems: visibleIncidents, reportTypeFilter }),
    [diseaseItems, floodItems, reportTypeFilter, visibleIncidents]
  );

  const districts = useMemo(
    () => [...new Set([
      ...incidents.map((item) => item.district),
      ...floodAreas.map((item) => item.district),
      ...diseaseReports.map((item) => item.district)
    ].filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")),
    [diseaseReports, floodAreas, incidents]
  );

  const criticalCount = eventItems.filter((item) => item.urgency === "critical" || item.urgency === "high").length;
  const affectedPeople = eventItems.reduce((sum, item) => sum + Number(item.affected_people || 0), 0);
  const affectedDistricts = new Set(eventItems.map((item) => item.district).filter(Boolean)).size;
  const selectedDateIndex = Math.max(0, dateOptions.findIndex((item) => item.date === selectedDate));
  const timelineItems = dateOptions.slice(
    Math.max(0, selectedDateIndex - 6),
    Math.min(dateOptions.length, Math.max(13, selectedDateIndex + 7))
  );

  const extraTileLayers = useMemo(() => (radarEnabled && radarLayer ? [radarLayer] : []), [radarEnabled, radarLayer]);
  const layerItems = useMemo(() => getEocLayerItems(disasterType), [disasterType]);
  const toggleEocLayer = (key) => {
    setMapLayers((current) => ({ ...current, [key]: !current[key] }));
  };

  const exportCsv = useCallback(() => {
    const csv = buildEventsCsv(eventItems, selectedDate);
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `satun-map-events-${selectedDate || "latest"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [eventItems, selectedDate]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-900">
      <PublicTopNavigation activeMenu="map" showWeatherMenu />

      <main className="relative min-h-0 flex-1 overflow-hidden" aria-label="แผนที่สถานการณ์">
        <div className="absolute inset-0">
          <PublicIncidentMap
            disasterType={disasterType}
            sessionId={selectedContext?.id || null}
            startDate={selectedDate}
            endDate={selectedDate}
            chrome="full"
            heightClass="h-full"
            layers={mapLayers}
            onLayersChange={setMapLayers}
            urgencyFilter={urgencyFilter}
            reportTypeFilter={reportTypeFilter}
            districtFilter={districtFilter}
            searchQuery={searchQuery}
            baseMap={baseMap}
            onBaseMapChange={setBaseMap}
            onDataChange={setIncidents}
            extraTileLayers={extraTileLayers}
            zoomControlPosition="bottomright"
          />
        </div>

        {/* ซ้ายบน: ค้นหา + ชุดข้อมูล */}
        {/* จอเล็ก: ซ่อนแผงนี้ขณะเปิดเมนูชั้นข้อมูล เพื่อไม่ให้ซ้อนกัน */}
        <div className={`pointer-events-none absolute left-3 top-3 z-[700] flex w-[min(380px,calc(100%-76px))] flex-col gap-2 ${sidebarOpen ? "max-md:hidden" : ""}`}>
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-xl ring-1 ring-slate-200">
              <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="ค้นหาอำเภอ ตำบล หมู่บ้าน รายละเอียด…"
                aria-label="ค้นหาเหตุการณ์บนแผนที่"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100" aria-label="ล้างคำค้นหา">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

          <div className={`pointer-events-auto rounded-2xl p-3 ${GLASS}`}>
              {!loadingContext && (
                <div className="mb-3">
                  <ViewModeBanner
                    viewMode={viewMode}
                    context={selectedContext}
                    selectedDate={selectedDate}
                    disasterLabel={DISASTER_OPTIONS.find((item) => item.value === disasterType)?.label || ""}
                    onBackToToday={() => setSelectedDate(getTodayDateKey())}
                    onShowActive={() => {
                      if (activeContextOptions[0]) {
                        setSelectedContextKey(activeContextOptions[0].key);
                        setSelectedDate("");
                      }
                    }}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={filtersOpen}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">
                    {DISASTER_OPTIONS.find((item) => item.value === disasterType)?.label || "แผนที่สถานการณ์"}
                  </span>
                  <span className="block truncate text-xs text-white/70">
                    {loadingContext ? "กำลังโหลดข้อมูล…" : selectedContext ? `${selectedContext.label} • ${formatThaiDate(selectedDate, { long: true })}` : "ยังไม่มี EOC สำหรับภัยนี้"}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[11px] font-bold">{filtersOpen ? "ซ่อน" : "ตัวกรอง"}</span>
              </button>

              {filtersOpen && (
                <div className="mt-3 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-2">
                  <GlassSelect label="ประเภทภัย" value={disasterType} onChange={changeDisasterType}>
                    {DISASTER_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </GlassSelect>
                  <GlassSelect label="วันที่" value={selectedDate} onChange={setSelectedDate} disabled={dateOptions.length === 0}>
                    {dateOptions.map((item) => (
                      <option key={item.date} value={item.date}>วันที่ {item.dayNumber} ({item.label}){item.isToday ? " วันนี้" : ""}</option>
                    ))}
                  </GlassSelect>
                  <div className="sm:col-span-2">
                    <GlassSelect
                      label="เหตุการณ์ที่ต้องการดู"
                      value={selectedContextKey}
                      onChange={(value) => {
                        setSelectedContextKey(value);
                        setSelectedDate("");
                      }}
                      disabled={contextOptions.length === 0}
                    >
                      {contextOptions.length === 0 && <option value="">ไม่มีเหตุการณ์</option>}
                      {activeContextOptions.length > 0 && (
                        <optgroup label="เหตุการณ์ปัจจุบัน (เปิดอยู่)">
                          {activeContextOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                        </optgroup>
                      )}
                      {historyContextOptions.length > 0 && (
                        <optgroup label="เหตุการณ์ย้อนหลัง (ปิดแล้ว)">
                          {historyContextOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                        </optgroup>
                      )}
                    </GlassSelect>
                  </div>
                  <GlassSelect label="อำเภอ" value={districtFilter} onChange={setDistrictFilter}>
                    <option value="all">ทุกอำเภอ</option>
                    {districts.map((district) => <option key={district} value={district}>{district}</option>)}
                  </GlassSelect>
                  <GlassSelect label="ระดับความเร่งด่วน" value={urgencyFilter} onChange={setUrgencyFilter}>
                    {URGENCY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </GlassSelect>
                  <GlassSelect label="ประเภทข้อมูล" value={reportTypeFilter} onChange={setReportTypeFilter}>
                    <option value="all">ทั้งหมด</option>
                    <option value="help_request">เหตุการณ์/ขอความช่วยเหลือ</option>
                    {disasterType === "flood" && <option value="flood_record">พื้นที่น้ำท่วม</option>}
                    {disasterType === "disease" && <option value="disease_report">รายงานโรคระบาด</option>}
                    <option value="traffic_report">เส้นทาง</option>
                  </GlassSelect>
                  <GlassSelect label="แผนที่พื้นหลัง" value={baseMap} onChange={setBaseMap}>
                    {Object.entries(MAP_BASE_LAYERS).map(([key, layer]) => <option key={key} value={key}>{layer.label}</option>)}
                  </GlassSelect>
                </div>
              )}

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
                <div>
                  <div className="text-lg font-black leading-none">{formatNumber(eventItems.length)}</div>
                  <div className="mt-1 text-[10px] font-semibold text-white/70">เหตุการณ์</div>
                </div>
                <div>
                  <div className="text-lg font-black leading-none">{affectedDistricts}/7</div>
                  <div className="mt-1 text-[10px] font-semibold text-white/70">อำเภอ</div>
                </div>
                <div>
                  <div className="text-lg font-black leading-none">{formatNumber(affectedPeople)}</div>
                  <div className="mt-1 text-[10px] font-semibold text-white/70">{disasterType === "disease" ? "ผู้ป่วย" : "ผู้ได้รับผลกระทบ"}</div>
                </div>
              </div>
              {criticalCount > 0 && (
                <p className="mt-2 rounded-lg bg-red-500/20 px-2 py-1 text-center text-xs font-bold text-red-100">
                  {criticalCount} รายการที่ต้องติดตามเร่งด่วน
                </p>
              )}
              <button
                type="button"
                onClick={() => setEventsOpen(true)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-black hover:bg-white/20"
              >
                <List className="h-4 w-4" aria-hidden="true" /> ดูรายการเหตุการณ์
              </button>
          </div>
        </div>

        {/* ขวา: เมนูชั้นข้อมูล */}
        <div className="pointer-events-none absolute right-3 top-3 z-[700] flex max-h-[calc(100%-7.5rem)] flex-col items-end">
          <MenuToggle open={sidebarOpen} onToggle={() => setSidebarOpen((open) => !open)} controls="map-layer-menu" />

          {sidebarOpen && (
            <nav id="map-layer-menu" aria-label="ชั้นข้อมูลแผนที่" className="pointer-events-auto mt-3 min-h-0 w-[250px] overflow-y-auto overscroll-contain pb-2 pl-2 pr-0.5 [scrollbar-width:thin]">
              <SectionTitle>สภาพอากาศ</SectionTitle>
              <div className="space-y-1.5">
                <SidebarItem
                  label={radarEnabled && radarLayer?.time ? `เรดาร์ฝน ${formatTime(radarLayer.time)}` : "เรดาร์ฝน (RainViewer)"}
                  icon={Radar}
                  tone="from-green-400 to-yellow-400"
                  active={radarEnabled}
                  onClick={() => setRadarEnabled((enabled) => !enabled)}
                />
                <SidebarItem
                  label="พยากรณ์อากาศ (Windy)"
                  icon={CloudSun}
                  tone="from-sky-400 to-amber-400"
                  href="/stn-eoc/public/weather-watch/"
                  title="เปิดหน้าสภาพอากาศ: แผนที่ Windy และเช็คความเสี่ยงพื้นที่"
                />
                {radarEnabled && radarError && <p className="text-right text-[11px] font-bold text-amber-200 drop-shadow">{radarError}</p>}
              </div>

              <SectionTitle>ข้อมูล EOC</SectionTitle>
              <div className="space-y-1.5">
                {layerItems.map((item) => (
                  <SidebarItem
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    tone={item.tone}
                    active={Boolean(mapLayers[item.key])}
                    onClick={() => toggleEocLayer(item.key)}
                  />
                ))}
              </div>

              <div className="mt-3 flex flex-col items-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMapLayers(getDefaultLayers(disasterType));
                    setRadarEnabled(false);
                  }}
                  className="rounded-full bg-slate-900/70 px-3 py-1 text-xs font-bold text-white hover:bg-slate-900"
                >
                  คืนค่าชั้นข้อมูลเริ่มต้น
                </button>
                {!legendOpen && (
                  <button type="button" onClick={() => setLegendOpen(true)} className="rounded-full bg-slate-900/70 px-3 py-1 text-xs font-bold text-white hover:bg-slate-900">
                    แสดงคำอธิบายสัญลักษณ์
                  </button>
                )}
              </div>
            </nav>
          )}
        </div>

        {/* ซ้ายล่าง: คำอธิบายสัญลักษณ์ */}
        {legendOpen && (
          <div className="absolute bottom-24 left-3 z-[650] w-[270px] max-md:hidden">
            <Legend disasterType={disasterType} onClose={() => setLegendOpen(false)} />
          </div>
        )}

        {/* ล่าง: ไทม์ไลน์รายวันของชุดข้อมูล EOC */}
        {dateOptions.length > 0 && (
          <div className="absolute inset-x-3 bottom-3 z-[650] mr-12 sm:mr-14">
            <div className={`flex items-center gap-2 rounded-2xl px-2 py-2 ${GLASS}`}>
              <button
                type="button"
                onClick={() => setIsPlaying((playing) => !playing)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-slate-900 shadow hover:bg-amber-300"
                aria-label={isPlaying ? "หยุดเล่นไทม์ไลน์" : "เล่นไทม์ไลน์ทีละวัน"}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <span className="hidden shrink-0 items-center gap-1 px-1 text-xs font-bold text-white/80 md:flex">
                <CalendarDays className="h-4 w-4" aria-hidden="true" /> ไทม์ไลน์
              </span>
              <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
                {timelineItems.map((item) => {
                  const active = item.date === selectedDate;
                  return (
                    <button
                      key={item.date}
                      type="button"
                      onClick={() => {
                        setIsPlaying(false);
                        setSelectedDate(item.date);
                      }}
                      className={`min-w-[72px] shrink-0 rounded-lg px-2 py-1.5 text-center text-xs font-bold transition ${
                        active ? "bg-amber-400 text-slate-900" : "text-white/85 hover:bg-white/10"
                      }`}
                    >
                      <span className="block leading-tight">{item.isToday ? "วันนี้" : item.label}</span>
                      <span className={`block text-[10px] leading-tight ${active ? "text-slate-800" : "text-white/55"}`}>วันที่ {item.dayNumber}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!loadingContext && eventItems.length === 0 && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-[640] -translate-x-1/2 rounded-full bg-white/95 px-4 py-1.5 text-xs font-bold text-slate-600 shadow max-lg:hidden">
            ไม่พบเหตุการณ์ในเงื่อนไขนี้
          </div>
        )}

        {/* รายการเหตุการณ์ (drawer ซ้าย) */}
        {eventsOpen && (
          <div className="absolute inset-0 z-[800] flex">
            <section className="flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl" aria-label="รายการเหตุการณ์">
              <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-black text-[#0b4c86]">รายการเหตุการณ์ ({formatNumber(eventItems.length)})</h2>
                  <p className="truncate text-xs text-slate-500">{formatThaiDate(selectedDate, { long: true })}{selectedContext ? ` • ${selectedContext.label}` : ""}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-[#0b4c86] hover:bg-sky-50">
                    <Download className="h-4 w-4" aria-hidden="true" /> CSV
                  </button>
                  <button type="button" onClick={() => setEventsOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="ปิดรายการเหตุการณ์">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                </div>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {eventItems.length === 0 ? (
                  <p className="flex items-center justify-center gap-2 p-6 text-sm text-slate-500">
                    <Info className="h-4 w-4" aria-hidden="true" /> ไม่มีรายการในวันที่เลือก
                  </p>
                ) : eventItems.map((item) => {
                  const meta = getEventMeta(item);
                  const isFloodRecord = item.event_kind === "flood_record";
                  const isDiseaseReport = item.event_kind === "disease_report";
                  const timeLabel = isFloodRecord || isDiseaseReport
                    ? formatThaiDate(item.recorded_day || item.occurred_at || selectedDate)
                    : formatTime(item.occurred_at || item.reported_at);
                  return (
                    <article key={`${item.event_kind || "incident"}-${item.id}`} className="border-b border-slate-100 px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 text-sm font-bold text-slate-800">{item.description || getEventTypeLabel(item)}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.className}`}>{meta.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {getEventTypeLabel(item)} • อ.{item.district || "-"} ต.{item.sub_district || "-"} • {timeLabel}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>
            <button type="button" className="min-w-0 flex-1 bg-slate-900/40" onClick={() => setEventsOpen(false)} aria-label="ปิดรายการเหตุการณ์" />
          </div>
        )}
      </main>

      {/* เปิดได้จากเมนู EOC Assistant บน navbar (ไม่แสดงปุ่มลอยเพื่อไม่บังแผนที่) */}
      <AIChatbot showLauncher={false} />
    </div>
  );
}
