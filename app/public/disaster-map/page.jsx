"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PublicIncidentMap from "@/components/PublicIncidentMap";
import PublicOpsScaffold from "@/components/public/PublicOpsScaffold";
import { MAP_BASE_LAYERS } from "@/lib/mapBaseLayers";
import { formatEocDisplayName } from "@/lib/eocDisplay";

const EOC_TYPE_LABELS = {
  flood: "น้ำท่วม",
  disease: "โรคระบาด",
  accident: "อุบัติเหตุ",
  "festival-accidents": "อุบัติเหตุช่วงเทศกาล"
};

const DISASTER_OPTIONS = [
  { value: "flood", label: "น้ำท่วม" },
  { value: "disease", label: "โรคระบาด" },
  { value: "accident", label: "อุบัติเหตุ" }
];

const DEFAULT_LAYERS = {
  floodAreas: true,
  district: true,
  tambon: false,
  village: false,
  labels: true,
  incidents: true,
  traffic: true,
  shelters: true,
  hospitals: true,
  waterways: true,
  hillshade: false
};

function normalizeEocType(type) {
  return type === "accident" ? "festival-accidents" : type;
}

function normalizeDateKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dateToKey(date);
}

function dateToKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayDateKey() {
  return dateToKey(new Date());
}

function parseDateKey(value) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatThaiDate(value, options = {}) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: options.long ? "long" : "short",
    year: "numeric"
  });
}

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("th-TH");
}

function buildContextOptions(activeEocs, sessions, disasterType) {
  const normalizedType = normalizeEocType(disasterType);
  const active = activeEocs
    .filter((item) => item.is_active && item.eoc_type === normalizedType)
    .map((item) => ({
      key: `active-${item.eoc_type}-${item.session_id || item.id}`,
      mode: "active",
      id: item.session_id || null,
      eoc_type: item.eoc_type,
      disease_name: item.disease_name,
      session_number: item.session_number,
      status: "active",
      label: `${formatEocDisplayName(item)} ที่เปิดอยู่`,
      opened_at: normalizeDateKey(item.activated_at),
      closed_at: ""
    }));

  const activeIds = new Set(active.map((item) => String(item.id)).filter(Boolean));
  const history = sessions
    .filter((session) => session.eoc_type === normalizedType && !activeIds.has(String(session.id)))
    .map((session) => ({
      key: `history-${session.id}`,
      mode: "history",
      id: session.id,
      eoc_type: session.eoc_type,
      disease_name: session.disease_name,
      session_number: session.session_number,
      status: session.status,
      label: `${formatEocDisplayName(session)} #${session.session_number || session.id}`,
      opened_at: normalizeDateKey(session.opened_at),
      closed_at: normalizeDateKey(session.closed_at),
      latest_data_date: normalizeDateKey(session.latest_flood_record_date),
      record_count: Number(session.flood_record_count || 0)
    }))
    .sort((a, b) => {
      if (normalizedType === "flood") {
        const dataDiff = Number(Boolean(b.latest_data_date)) - Number(Boolean(a.latest_data_date));
        if (dataDiff !== 0) return dataDiff;
        if (b.latest_data_date !== a.latest_data_date) return b.latest_data_date.localeCompare(a.latest_data_date);
      }
      return b.opened_at.localeCompare(a.opened_at);
    });

  return [...active, ...history];
}

function buildDateOptions(selectedContext) {
  const today = getTodayDateKey();
  const startDate = selectedContext?.opened_at || today;
  const endDate = selectedContext?.closed_at || today;
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  if (!start || !end) return [{ date: today, label: formatThaiDate(today), dayNumber: 1 }];

  const safeEnd = start > end ? start : end;
  const rows = [];
  let cursor = start;
  let dayNumber = 1;
  while (cursor <= safeEnd && rows.length < 370) {
    const key = dateToKey(cursor);
    rows.push({
      date: key,
      label: cursor.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
      dayNumber,
      isToday: key === today
    });
    cursor = addDays(cursor, 1);
    dayNumber += 1;
  }
  return rows;
}

function getIncidentTypeLabel(incident) {
  if (incident.report_type === "traffic_report") return "เส้นทาง";
  if (incident.disaster_type === "disease") return "โรคระบาด";
  return "เหตุการณ์";
}

function getUrgencyMeta(urgency) {
  const map = {
    critical: { label: "วิกฤต", className: "bg-red-100 text-red-700" },
    high: { label: "เร่งด่วน", className: "bg-orange-100 text-orange-700" },
    medium: { label: "เฝ้าระวัง", className: "bg-amber-100 text-amber-700" },
    low: { label: "ทั่วไป", className: "bg-blue-100 text-blue-700" }
  };
  return map[urgency] || map.low;
}

function getEventMeta(item) {
  if (item?.event_kind === "flood_record") return getFloodSeverityMeta(item.flood_level);
  return getUrgencyMeta(item?.urgency);
}

function getEventTypeLabel(item) {
  if (item?.event_kind === "flood_record") return "บันทึกน้ำท่วม";
  return getIncidentTypeLabel(item);
}

function getFloodSeverityMeta(level) {
  const map = {
    severe: { label: "น้ำท่วมสูง", urgency: "critical", className: "bg-red-100 text-red-700" },
    moderate: { label: "น้ำท่วมปานกลาง", urgency: "high", className: "bg-orange-100 text-orange-700" },
    mild: { label: "น้ำท่วมต่ำ", urgency: "medium", className: "bg-sky-100 text-sky-700" },
    safe: { label: "ไม่มีน้ำท่วม", urgency: "low", className: "bg-emerald-100 text-emerald-700" }
  };
  return map[level] || map.mild;
}

function getFloodLevelRank(level) {
  return { severe: 4, moderate: 3, mild: 2, safe: 1 }[level] || 0;
}

export default function PublicDisasterMapPage() {
  const mapWorkspaceRef = useRef(null);
  const [activeEocs, setActiveEocs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [disasterType, setDisasterType] = useState("flood");
  const [selectedContextKey, setSelectedContextKey] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [mapLayers, setMapLayers] = useState(DEFAULT_LAYERS);
  const [baseMap, setBaseMap] = useState("street");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [reportTypeFilter, setReportTypeFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [incidents, setIncidents] = useState([]);
  const [floodAreas, setFloodAreas] = useState([]);
  const [shelterCount, setShelterCount] = useState(0);
  const [hospitalCount, setHospitalCount] = useState(0);
  const [loadingContext, setLoadingContext] = useState(true);
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  useEffect(() => {
    const loadContext = async () => {
      try {
        const [statusRes, summaryRes, sheltersRes, hospitalsRes] = await Promise.all([
          fetch("/stn-eoc/api/eoc/status/"),
          fetch("/stn-eoc/api/dashboard/summary/"),
          fetch("/stn-eoc/api/public/shelter-centers?eoc_type=flood&include_all=1"),
          fetch("/stn-eoc/api/common/health-facilities")
        ]);

        const statusJson = statusRes.ok ? await statusRes.json() : { success: false, data: [] };
        const summaryJson = summaryRes.ok ? await summaryRes.json() : { success: false, data: {} };
        const sheltersJson = sheltersRes.ok ? await sheltersRes.json() : { success: false, data: [] };
        const hospitalsJson = hospitalsRes.ok ? await hospitalsRes.json() : { success: false, data: [] };

        setActiveEocs(statusJson.success ? statusJson.data || [] : []);
        setSessions(summaryJson.success ? summaryJson.data?.eocSessions || [] : []);
        setShelterCount(sheltersJson.success ? sheltersJson.data?.length || 0 : 0);
        setHospitalCount(hospitalsJson.success ? hospitalsJson.data?.length || 0 : 0);
      } catch (error) {
        console.error("Error loading public map context:", error);
      } finally {
        setLoadingContext(false);
      }
    };

    loadContext();
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentFullscreen = document.fullscreenElement === mapWorkspaceRef.current;
      setIsMapFullscreen(isCurrentFullscreen);
      window.setTimeout(() => window.dispatchEvent(new Event("resize")), 150);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleMapFullscreen = useCallback(() => {
    if (!mapWorkspaceRef.current) return;
    if (document.fullscreenElement === mapWorkspaceRef.current) {
      document.exitFullscreen?.();
      return;
    }
    mapWorkspaceRef.current.requestFullscreen?.().catch((error) => {
      console.error("Error opening map fullscreen:", error);
    });
  }, []);

  const contextOptions = useMemo(
    () => buildContextOptions(activeEocs, sessions, disasterType),
    [activeEocs, disasterType, sessions]
  );

  useEffect(() => {
    setSelectedContextKey("");
    setSelectedDate("");
    setIncidents([]);
    setFloodAreas([]);
  }, [disasterType]);

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
    const loadFloodAreas = async () => {
      if (disasterType !== "flood" || !selectedContext?.id || !selectedDate) {
        setFloodAreas([]);
        return;
      }

      try {
        const params = new URLSearchParams();
        params.set("session_id", selectedContext.id);
        params.set("date", selectedDate);
        const response = await fetch(`/stn-eoc/api/eoc/flood/area-status?${params.toString()}`);
        const json = response.ok ? await response.json() : { success: false, data: [] };
        setFloodAreas(json.success ? json.data || [] : []);
      } catch (error) {
        console.error("Error loading flood records for event list:", error);
        setFloodAreas([]);
      }
    };

    loadFloodAreas();
  }, [disasterType, selectedContext?.id, selectedDate]);

  const eocIsOpen = activeEocs.some((item) => item.is_active);
  const latestActive = activeEocs.find((item) => item.is_active);
  const scaffoldEocStatus = selectedContext?.mode === "active" ? "open" : selectedContext ? "closed" : eocIsOpen ? "open" : "closed";
  const scaffoldEocLabel = selectedContext
    ? `${selectedContext.label}${selectedContext.closed_at ? ` ปิดเมื่อ ${formatThaiDate(selectedContext.closed_at)}` : ""}`
    : latestActive ? formatEocDisplayName(latestActive) : "ไม่มี EOC ที่เปิดอยู่";

  const visibleIncidents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return incidents.filter((incident) => {
      if (urgencyFilter !== "all" && incident.urgency !== urgencyFilter) return false;
      if (reportTypeFilter !== "all" && incident.report_type !== reportTypeFilter) return false;
      if (districtFilter !== "all" && incident.district !== districtFilter) return false;
      if (incident.report_type === "traffic_report" && !mapLayers.traffic) return false;
      if ((incident.report_type || "help_request") !== "traffic_report" && !mapLayers.incidents) return false;
      if (query) {
        const haystack = [
          incident.district,
          incident.sub_district,
          incident.village,
          incident.description
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [districtFilter, incidents, mapLayers.incidents, mapLayers.traffic, reportTypeFilter, searchQuery, urgencyFilter]);

  const floodEventItems = useMemo(() => {
    if (disasterType !== "flood") return [];
    const query = searchQuery.trim().toLowerCase();
    const grouped = new Map();

    for (const area of floodAreas) {
      if (!area || area.flood_level === "safe") continue;
      if (districtFilter !== "all" && area.district !== districtFilter) continue;

      const searchableText = [
        area.district,
        area.tambon,
        area.villname,
        area.notes
      ].filter(Boolean).join(" ").toLowerCase();
      if (query && !searchableText.includes(query)) continue;

      const key = `${area.district || "-"}|${area.tambon || "-"}`;
      const current = grouped.get(key) || {
        id: `flood-record-${key}`,
        event_kind: "flood_record",
        report_type: "flood_record",
        disaster_type: "flood",
        district: area.district || "-",
        sub_district: area.tambon || "-",
        village_count: 0,
        affected_people: 0,
        water_level: 0,
        recorded_day: area.recorded_day,
        occurred_at: area.recorded_day,
        updated_at: area.updated_at,
        urgency: "medium",
        flood_level: area.flood_level,
        village_names: []
      };

      current.village_count += 1;
      current.affected_people += Number(area.affected_population || 0);
      current.water_level = Math.max(current.water_level, Number(area.water_level || 0));
      if (area.villname) current.village_names.push(area.villname);
      if (getFloodLevelRank(area.flood_level) > getFloodLevelRank(current.flood_level)) {
        current.flood_level = area.flood_level;
      }
      current.recorded_day = area.recorded_day || current.recorded_day;
      current.occurred_at = current.recorded_day;
      current.updated_at = area.updated_at || current.updated_at;
      const meta = getFloodSeverityMeta(current.flood_level);
      current.urgency = meta.urgency;
      current.description = `พื้นที่น้ำท่วม ต.${current.sub_district} อ.${current.district} (${current.village_count} หมู่บ้าน)`;
      grouped.set(key, current);
    }

    let items = [...grouped.values()];
    if (urgencyFilter !== "all") {
      items = items.filter((item) => item.urgency === urgencyFilter);
    }
    if (reportTypeFilter !== "all" && reportTypeFilter !== "flood_record") {
      items = [];
    }
    return items.sort((a, b) => getFloodLevelRank(b.flood_level) - getFloodLevelRank(a.flood_level) || a.sub_district.localeCompare(b.sub_district, "th"));
  }, [disasterType, districtFilter, floodAreas, reportTypeFilter, searchQuery, urgencyFilter]);

  const visibleEventItems = useMemo(() => {
    const incidentItems = reportTypeFilter === "flood_record" ? [] : visibleIncidents;
    return [...floodEventItems, ...incidentItems].sort((a, b) => {
      const aTime = new Date(a.occurred_at || a.reported_at || a.recorded_day || 0).getTime();
      const bTime = new Date(b.occurred_at || b.reported_at || b.recorded_day || 0).getTime();
      return bTime - aTime;
    });
  }, [floodEventItems, reportTypeFilter, visibleIncidents]);

  const districts = useMemo(
    () => [...new Set([
      ...incidents.map((item) => item.district).filter(Boolean),
      ...floodAreas.map((item) => item.district).filter(Boolean)
    ])].sort((a, b) => a.localeCompare(b, "th")),
    [floodAreas, incidents]
  );

  const criticalCount = visibleEventItems.filter((item) => item.urgency === "critical" || item.urgency === "high").length;
  const trafficCount = visibleIncidents.filter((item) => item.report_type === "traffic_report").length;
  const helpCount = visibleIncidents.filter((item) => (item.report_type || "help_request") !== "traffic_report").length;
  const floodRecordCount = floodEventItems.length;
  const affectedPeople = visibleEventItems.reduce((sum, item) => sum + Number(item.affected_people || 0), 0);
  const affectedDistricts = new Set(visibleEventItems.map((item) => item.district).filter(Boolean)).size;
  const alertLevel = criticalCount > 0 ? "เฝ้าระวังสูง" : visibleEventItems.length > 0 ? "เฝ้าระวัง" : "ปกติ";
  const selectedDateLabel = formatThaiDate(selectedDate, { long: true });
  const selectedDateIndex = Math.max(0, dateOptions.findIndex((item) => item.date === selectedDate));
  const timelineItems = dateOptions.slice(
    Math.max(0, selectedDateIndex - 4),
    Math.min(dateOptions.length, Math.max(9, selectedDateIndex + 5))
  );

  const exportCsv = useCallback(() => {
    const header = ["เวลา", "ประเภท", "อำเภอ", "ตำบล", "หมู่บ้าน", "ระดับ", "รายละเอียด"];
    const rows = visibleEventItems.map((item) => [
      item.event_kind === "flood_record" ? formatThaiDate(item.recorded_day || selectedDate) : formatTime(item.occurred_at || item.reported_at),
      getEventTypeLabel(item),
      item.district || "",
      item.sub_district || "",
      item.village || item.village_names?.join("; ") || "",
      getEventMeta(item).label,
      String(item.description || "").replace(/\n/g, " ")
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `satun-map-events-${selectedDate || "latest"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [selectedDate, visibleEventItems]);

  return (
    <PublicOpsScaffold
      title="แผนที่ / Map"
      subtitle="แผนที่สถานการณ์ขนาดใหญ่ พร้อมตัวกรองข้อมูลย้อนหลัง ปัจจุบัน และชั้นข้อมูลเฉพาะ"
      activeMenu="map"
      eocIsOpen={eocIsOpen}
      eocStatus={scaffoldEocStatus}
      eocLabel={scaffoldEocLabel}
      showPageHeader={false}
      mainClassName="pb-3 lg:pb-3"
    >
      <section className="flex min-h-[calc(100vh-111px)] flex-col gap-3">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-[repeat(6,minmax(0,1fr))_minmax(220px,1.05fr)]">
          <MapStatCard icon="≈" label="เหตุการณ์ทั้งหมดวันนี้" value={visibleEventItems.length} unit="เหตุการณ์" subText={`${criticalCount} รายที่ต้องติดตาม`} tone="blue" />
          <MapStatCard icon="⌖" label="อำเภอได้รับผลกระทบ" value={affectedDistricts} unit="อำเภอ" subText="จากทั้งหมด 7 อำเภอ" tone="orange" />
          <MapStatCard icon="⌂" label="ศูนย์พักพิงที่เปิด" value={shelterCount} unit="แห่ง" subText={`รองรับข้อมูล ${hospitalCount} จุดสุขภาพ`} tone="violet" />
          <MapStatCard icon="−" label="บันทึกน้ำท่วม" value={floodRecordCount} unit="ตำบล" subText={`${trafficCount} เส้นทาง / ${helpCount} รายงานประชาชน`} tone="red" />
          <MapStatCard icon="+" label="ผู้ได้รับผลกระทบเบื้องต้น" value={affectedPeople} unit="คน" subText="จากรายงานประชาชนและบันทึกน้ำท่วม" tone="emerald" />
          <MapStatCard icon="!" label="ระดับเฝ้าระวัง" value={alertLevel} unit="" subText={criticalCount > 0 ? `${criticalCount} รายการสำคัญ` : "ติดตามตามปกติ"} tone="amber" />

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-500">เลือกวันที่</span>
              <select
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 outline-none focus:border-blue-400"
              >
                {dateOptions.map((item) => (
                  <option key={item.date} value={item.date}>
                    วันที่ {item.dayNumber} {item.label}{item.isToday ? " (วันนี้)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <section
          ref={mapWorkspaceRef}
          className={`flex flex-col gap-3 ${isMapFullscreen ? "h-screen overflow-auto bg-[#edf5fc] p-3" : ""}`}
        >
        <section className="grid gap-3 rounded-xl border border-blue-100 bg-white p-3 shadow-sm lg:grid-cols-[150px_minmax(230px,1fr)_140px_135px_minmax(170px,220px)_120px]">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-500">ประเภท EOC</span>
                <select
                  value={disasterType}
                  onChange={(event) => setDisasterType(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400"
                >
                  {DISASTER_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-500">ชุดข้อมูล</span>
                <select
                  value={selectedContextKey}
                  onChange={(event) => {
                    setSelectedContextKey(event.target.value);
                    setSelectedDate("");
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400"
                  disabled={contextOptions.length === 0}
                >
                  {contextOptions.length === 0 && <option value="">ไม่มี session</option>}
                  {contextOptions.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.mode === "active" ? "ปัจจุบัน: " : "ย้อนหลัง: "}{item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-500">วันที่</span>
                <select
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400"
                >
                  {dateOptions.map((item) => (
                    <option key={item.date} value={item.date}>
                      วันที่ {item.dayNumber}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-500">อำเภอ</span>
                <select
                  value={districtFilter}
                  onChange={(event) => setDistrictFilter(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400"
                >
                  <option value="all">ทั้งหมด</option>
                  {districts.map((district) => <option key={district} value={district}>{district}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-500">ค้นหา</span>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="พื้นที่/รายละเอียด"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400"
                />
              </label>

              <button
                type="button"
                onClick={toggleMapFullscreen}
                className={`flex h-full min-h-[58px] items-center justify-center rounded-lg border px-3 py-2 text-xs font-black shadow-sm transition ${
                  isMapFullscreen
                    ? "border-slate-300 bg-slate-800 text-white hover:bg-slate-700"
                    : "border-blue-200 bg-blue-700 text-white hover:bg-blue-800"
                }`}
              >
                {isMapFullscreen ? "ออกเต็มจอ" : "เต็มจอ"}
              </button>
        </section>

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_390px]">
          <section className={`relative overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm ${isMapFullscreen ? "min-h-0" : "min-h-[560px]"}`}>
            <div className={`${isMapFullscreen ? "h-[calc(100vh-190px)] min-h-[420px]" : "h-[calc(100vh-362px)] min-h-[560px] max-lg:h-[560px]"} bg-slate-100`}>
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
              />
            </div>

            {showLayerPanel ? (
              <div className="absolute right-4 top-4 z-[500] w-[230px] max-md:left-4 max-md:right-4 max-md:w-auto">
                <MapLayerPanel
                  layers={mapLayers}
                  setLayers={setMapLayers}
                  baseMap={baseMap}
                  setBaseMap={setBaseMap}
                  showLegend={showLegend}
                  setShowLegend={setShowLegend}
                  onClose={() => setShowLayerPanel(false)}
                  urgencyFilter={urgencyFilter}
                  setUrgencyFilter={setUrgencyFilter}
                  reportTypeFilter={reportTypeFilter}
                  setReportTypeFilter={setReportTypeFilter}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowLayerPanel(true)}
                className="absolute right-4 top-4 z-[500] rounded-lg border border-blue-100 bg-white/95 px-3 py-2 text-xs font-black text-blue-700 shadow-lg backdrop-blur max-md:left-4 max-md:right-auto"
              >
                แสดงชั้นข้อมูล
              </button>
            )}

            {showLegend ? (
              <div className="absolute bottom-4 left-4 z-[500] max-w-[235px] max-md:hidden">
                <MapLegend onClose={() => setShowLegend(false)} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowLegend(true)}
                className="absolute bottom-4 left-4 z-[500] rounded-lg border border-blue-100 bg-white/95 px-3 py-2 text-xs font-black text-blue-700 shadow-lg backdrop-blur max-md:hidden"
              >
                แสดง legend
              </button>
            )}

            {visibleEventItems.length === 0 && !loadingContext && (
              <div className="pointer-events-none absolute bottom-5 left-1/2 z-[520] -translate-x-1/2 rounded-lg bg-white/95 px-4 py-2 text-sm font-bold text-slate-600 shadow-md">
                ไม่พบเหตุการณ์ในเงื่อนไขนี้
              </div>
            )}
          </section>

          <aside className={`flex flex-col gap-3 ${isMapFullscreen ? "h-[calc(100vh-190px)] min-h-0" : "min-h-[560px] xl:h-[calc(100vh-362px)]"}`}>
            <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-blue-900">สรุปเหตุการณ์ของวันที่เลือก</h3>
                  <p className="text-xs text-slate-500">{selectedDateLabel} {selectedContext?.label ? `• ${selectedContext.label}` : ""}</p>
                </div>
                <span className="text-xs font-bold text-slate-500">รายงานประชาชนและบันทึกน้ำท่วม</span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-100 p-3 text-center">
                <MiniStat label="เหตุการณ์รวม" value={visibleEventItems.length} />
                <MiniStat label="อำเภอ" value={`${affectedDistricts}/7`} />
                <MiniStat label="ผู้ได้รับผลกระทบ" value={affectedPeople} />
              </div>
            </section>

            <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-black text-blue-900">สถานการณ์สำคัญ</h3>
                <Link href="/public/help" className="text-xs font-bold text-blue-700">ดูทั้งหมด</Link>
              </div>
              <div className="max-h-[210px] space-y-2 overflow-auto pr-1">
                {visibleEventItems.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">ยังไม่มีรายการในวันที่เลือก</p>
                ) : visibleEventItems.slice(0, 5).map((item) => {
                  const isFloodRecord = item.event_kind === "flood_record";
                  const timeLabel = isFloodRecord ? formatThaiDate(item.recorded_day || selectedDate) : formatTime(item.occurred_at || item.reported_at);
                  return (
                    <div key={`important-${item.event_kind || "incident"}-${item.id}`} className="grid grid-cols-[36px_minmax(0,1fr)_72px] gap-2 rounded-lg border border-slate-100 p-3 text-sm">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-lg ${isFloodRecord ? "bg-sky-50 text-sky-700" : item.report_type === "traffic_report" ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}>{isFloodRecord ? "≈" : item.report_type === "traffic_report" ? "−" : "!"}</span>
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-800">{item.description || getEventTypeLabel(item)}</p>
                        <p className="truncate text-xs text-slate-500">
                          อ.{item.district || "-"} ต.{item.sub_district || "-"}{isFloodRecord ? ` • ${item.village_count || 0} หมู่บ้าน` : ""}
                        </p>
                      </div>
                      <span className="text-right text-xs text-slate-500">{timeLabel}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-black text-blue-900">รายการเหตุการณ์ ({formatNumber(visibleEventItems.length)})</h3>
                <button type="button" onClick={exportCsv} className="text-xs font-bold text-blue-700">ดาวน์โหลด</button>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {[
                  ["all", "ทั้งหมด", setReportTypeFilter, reportTypeFilter],
                  ["help_request", "เหตุการณ์", setReportTypeFilter, reportTypeFilter],
                  ["flood_record", "น้ำท่วม", setReportTypeFilter, reportTypeFilter],
                  ["traffic_report", "เส้นทาง", setReportTypeFilter, reportTypeFilter]
                ].map(([key, label, setter, current]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setter(key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-black ${current === key ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-100">
                {visibleEventItems.length === 0 ? (
                  <div className="p-5 text-center text-sm text-slate-500">ไม่มีรายการเหตุการณ์</div>
                ) : visibleEventItems.map((item) => {
                  const meta = getEventMeta(item);
                  const isFloodRecord = item.event_kind === "flood_record";
                  const timeLabel = isFloodRecord ? formatThaiDate(item.recorded_day || selectedDate) : formatTime(item.occurred_at || item.reported_at);
                  const areaText = isFloodRecord
                    ? `พื้นที่ท่วม: ต.${item.sub_district || "-"} อ.${item.district || "-"} • ${item.village_count || 0} หมู่บ้าน${item.water_level ? ` • ระดับน้ำสูงสุด ${item.water_level} ม.` : ""}`
                    : `อ.${item.district || "-"} ต.${item.sub_district || "-"}`;
                  return (
                    <article key={`${item.event_kind || "incident"}-${item.id}`} className="grid grid-cols-[70px_minmax(0,1fr)_86px] gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
                      <span className="font-bold text-slate-700">{timeLabel}</span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">{item.description || getEventTypeLabel(item)}</p>
                        <p className="truncate text-xs text-slate-500">{areaText}</p>
                      </div>
                      <span className={`self-center rounded-full px-2 py-1 text-center text-xs font-bold ${meta.className}`}>{meta.label}</span>
                    </article>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>

        <section className="sticky bottom-3 z-[510] rounded-xl border border-blue-100 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-700 text-white">▶</button>
              <span className="text-sm font-black text-blue-900">ไทม์ไลน์เหตุการณ์</span>
            </div>
            <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
              {timelineItems.map((item) => (
                <button
                  key={item.date}
                  type="button"
                  onClick={() => setSelectedDate(item.date)}
                  className={`min-w-[86px] rounded-lg border px-3 py-2 text-xs font-black ${selectedDate === item.date ? "border-blue-700 bg-blue-700 text-white" : "border-slate-200 bg-white text-slate-600"}`}
                >
                  {item.isToday ? "วันนี้" : item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-lg border border-blue-200 px-4 py-2 text-xs font-black text-blue-700 hover:bg-blue-50"
            >
              ดาวน์โหลดรายงานประจำวัน
            </button>
          </div>
        </section>
        </section>
      </section>
    </PublicOpsScaffold>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="px-2">
      <div className="text-3xl font-black text-blue-700">{typeof value === "number" ? formatNumber(value) : value}</div>
      <div className="mt-1 text-xs font-semibold text-slate-500">{label}</div>
    </div>
  );
}

function MapStatCard({ icon, label, value, unit, subText, tone }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    red: "border-red-200 bg-red-50 text-red-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700"
  };

  return (
    <div className={`grid min-h-[96px] grid-cols-[42px_minmax(0,1fr)] gap-3 rounded-xl border p-3 shadow-sm ${tones[tone] || tones.blue}`}>
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-2xl font-black shadow-sm">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold">{label}</p>
        <div className="mt-1 flex items-end gap-1">
          <span className="truncate text-3xl font-black leading-none">{typeof value === "number" ? formatNumber(value) : value}</span>
          {unit && <span className="pb-0.5 text-xs font-bold">{unit}</span>}
        </div>
        <p className="mt-1 truncate text-[11px] font-semibold opacity-80">{subText}</p>
      </div>
    </div>
  );
}

function MapLegend({ onClose }) {
  const items = [
    ["bg-red-600", "น้ำท่วมสูง/สูงมาก"],
    ["bg-amber-400", "น้ำท่วมปานกลาง"],
    ["bg-sky-400", "น้ำท่วมต่ำ"],
    ["bg-red-600", "เส้นทางปิด"],
    ["bg-sky-700", "เส้นทางน้ำ/คลองหลัก"],
    ["bg-orange-500", "เหตุการณ์กำลังเกิด"],
    ["bg-violet-600", "ศูนย์พักพิง"],
    ["bg-emerald-600", "โรงพยาบาล"],
    ["bg-blue-500", "จุดเฝ้าระวัง / ระดับน้ำ"]
  ];

  return (
    <aside className="rounded-xl border border-blue-100 bg-white/95 p-3 text-xs shadow-lg backdrop-blur">
      <h3 className="mb-2 text-sm font-black text-blue-900">คำอธิบายสัญลักษณ์</h3>
      <div className="space-y-2">
        {items.map(([color, label]) => (
          <div key={label} className="flex items-center gap-2 font-semibold text-slate-700">
            <span className={`h-3.5 w-3.5 rounded-full ${color}`} aria-hidden="true"></span>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={onClose} className="mt-3 w-full rounded-lg border border-blue-100 px-3 py-1.5 text-xs font-black text-blue-700">
        ซ่อน legend
      </button>
    </aside>
  );
}

function MapLayerPanel({ layers, setLayers, baseMap, setBaseMap, showLegend, setShowLegend, onClose, urgencyFilter, setUrgencyFilter, reportTypeFilter, setReportTypeFilter }) {
  const layerItems = [
    ["floodAreas", "พื้นที่น้ำท่วม"],
    ["district", "ขอบเขตอำเภอ"],
    ["tambon", "ขอบเขตตำบล"],
    ["labels", "ชื่อพื้นที่"],
    ["incidents", "เหตุการณ์"],
    ["traffic", "เส้นทาง/ถนน"],
    ["waterways", "เส้นทางน้ำ/คลอง"],
    ["hillshade", "เงาภูมิประเทศ/ความสูง"],
    ["shelters", "ศูนย์พักพิง"],
    ["hospitals", "โรงพยาบาล"],
    ["village", "ขอบเขตหมู่บ้าน"]
  ];

  return (
    <aside className="rounded-xl border border-blue-100 bg-white/95 p-3 shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-black text-blue-900">ชั้นข้อมูลแผนที่</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLayers(DEFAULT_LAYERS);
              setShowLegend(true);
            }}
            className="text-xs font-bold text-blue-700"
          >
            ค่าเริ่มต้น
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[11px] font-black text-slate-500 hover:bg-slate-100"
          >
            ซ่อน
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="mb-2 block">
          <span className="mb-1 block text-xs font-black text-blue-800">แผนที่พื้นหลัง</span>
          <select
            value={baseMap}
            onChange={(event) => setBaseMap(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-400"
          >
            {Object.entries(MAP_BASE_LAYERS).map(([key, layer]) => (
              <option key={key} value={key}>{layer.label}</option>
            ))}
          </select>
        </label>
        {layerItems.map(([key, label]) => (
          <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-xs font-semibold text-slate-700 hover:bg-blue-50">
            <input
              type="checkbox"
              checked={Boolean(layers[key])}
              onChange={(event) => setLayers((current) => ({ ...current, [key]: event.target.checked }))}
              className="h-4 w-4 accent-blue-700"
            />
            {label}
          </label>
        ))}
        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-xs font-semibold text-slate-700 hover:bg-blue-50">
          <input
            type="checkbox"
            checked={showLegend}
            onChange={(event) => setShowLegend(event.target.checked)}
            className="h-4 w-4 accent-blue-700"
          />
          แสดง legend
        </label>
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="mb-2 text-xs font-black text-blue-800">ประเภทข้อมูล</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            ["all", "ทั้งหมด"],
            ["help_request", "เหตุการณ์"],
            ["flood_record", "น้ำท่วม"],
            ["traffic_report", "เส้นทาง"]
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setReportTypeFilter(key)}
              className={`rounded-md px-2 py-1.5 text-[11px] font-black ${reportTypeFilter === key ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="mb-2 text-xs font-black text-blue-800">ระดับความเร่งด่วน</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            ["all", "ทั้งหมด"],
            ["critical", "วิกฤต"],
            ["high", "เร่งด่วน"],
            ["medium", "เฝ้าระวัง"],
            ["low", "ทั่วไป"]
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setUrgencyFilter(key)}
              className={`rounded-md px-2 py-1.5 text-[11px] font-black ${urgencyFilter === key ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

    </aside>
  );
}
