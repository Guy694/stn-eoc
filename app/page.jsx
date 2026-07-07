"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import AnnouncementPopup from "@/components/AnnouncementPopup";
import SplashScreen from "@/components/SplashScreen";
import AIChatbot from "@/components/AIChatbot";
import PDPAConsent from "@/components/PDPAConsent";
import { getPublicAssetPath } from "@/lib/publicAssetPath";
import { formatEocDisplayName } from "@/lib/eocDisplay";
import dynamic from "next/dynamic";

const FestivalPublicDashboard = dynamic(() => import("@/components/festival/FestivalPublicDashboard"), { ssr: false });
const DailyDiseaseChart = dynamic(() => import("@/components/DailyDiseaseChart"), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
      <div className="flex h-72 items-center justify-center text-sm font-semibold text-slate-500">
        กำลังโหลดกราฟข้อมูลโรค...
      </div>
    </div>
  )
});
const PublicIncidentMap = dynamic(() => import("@/components/PublicIncidentMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[520px] items-center justify-center bg-slate-950">
      <div className="text-center">
        <svg className="animate-spin h-12 w-12 text-emerald-600 mx-auto mb-3" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <p className="text-slate-300">กำลังโหลดแผนที่สถานการณ์...</p>
      </div>
    </div>
  )
});

const EOC_STYLE_CLASSES = {
  flood: {
    border: "border-blue-500",
    accent: "bg-blue-500",
    softBorder: "border-blue-100",
    bg: "bg-blue-50",
    badgeBg: "bg-blue-100",
    text: "text-blue-700",
    label: "text-blue-600",
    button: "bg-blue-600 hover:bg-blue-700",
    quick: "from-blue-50 to-blue-100 border-blue-200 hover:border-blue-300",
  },
  disease: {
    border: "border-rose-500",
    accent: "bg-rose-500",
    softBorder: "border-rose-100",
    bg: "bg-rose-50",
    badgeBg: "bg-rose-100",
    text: "text-rose-700",
    label: "text-rose-600",
    button: "bg-rose-600 hover:bg-rose-700",
    quick: "from-rose-50 to-rose-100 border-rose-200 hover:border-rose-300",
  },
  accident: {
    border: "border-orange-500",
    accent: "bg-orange-500",
    softBorder: "border-orange-100",
    bg: "bg-orange-50",
    badgeBg: "bg-orange-100",
    text: "text-orange-700",
    label: "text-orange-600",
    button: "bg-orange-600 hover:bg-orange-700",
    quick: "from-orange-50 to-orange-100 border-orange-200 hover:border-orange-300",
  },
  "festival-accidents": {
    border: "border-orange-500",
    accent: "bg-orange-500",
    softBorder: "border-orange-100",
    bg: "bg-orange-50",
    badgeBg: "bg-orange-100",
    text: "text-orange-700",
    label: "text-orange-600",
    button: "bg-orange-600 hover:bg-orange-700",
    quick: "from-orange-50 to-orange-100 border-orange-200 hover:border-orange-300",
  },
  blue: {
    quick: "from-blue-50 to-blue-100 border-blue-200 hover:border-blue-300",
  },
  red: {
    quick: "from-red-50 to-red-100 border-red-200 hover:border-red-300",
  },
  green: {
    quick: "from-emerald-50 to-emerald-100 border-emerald-200 hover:border-emerald-300",
  },
  teal: {
    quick: "from-teal-50 to-teal-100 border-teal-200 hover:border-teal-300",
  },
  orange: {
    quick: "from-orange-50 to-orange-100 border-orange-200 hover:border-orange-300",
  },
  default: {
    border: "border-gray-500",
    accent: "bg-gray-500",
    softBorder: "border-gray-200",
    bg: "bg-gray-50",
    badgeBg: "bg-gray-100",
    text: "text-gray-700",
    label: "text-gray-600",
    button: "bg-gray-600 hover:bg-gray-700",
    quick: "from-gray-50 to-gray-100 border-gray-200 hover:border-gray-300",
  }
};

function getAnnouncementContent(announcement) {
  return announcement?.content || announcement?.description || "";
}

function normalizeAnnouncement(announcement) {
  return {
    ...announcement,
    content: getAnnouncementContent(announcement),
    image_path: getPublicAssetPath(announcement?.image_path)
  };
}

function buildHomepageAlertText(announcement, dateRange) {
  if (!announcement) {
    return `ประกาศเตือนภัย: ติดตามประกาศล่าสุดจากศูนย์ EOC จังหวัดสตูล${dateRange ? ` ช่วง ${dateRange}` : ""}`;
  }

  const title = String(announcement.title || "").trim();
  const content = String(getAnnouncementContent(announcement) || "").trim();
  const baseText = title && content && title !== content ? `${title}: ${content}` : title || content;
  const alertText = /^ประกาศ/.test(baseText) ? baseText : `ประกาศเตือนภัย: ${baseText}`;
  return `${alertText}${dateRange ? ` ช่วง ${dateRange}` : ""}`;
}

function mapEocTypeToPublicDisasterType(eocType) {
  if (eocType === "disease") return "disease";
  if (eocType === "festival-accidents" || eocType === "accident") return "accident";
  return "flood";
}

export default function Home() {
  const [showSplash, setShowSplash] = useState(false);
  const [activeEOCs, setActiveEOCs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eocStatus, setEocStatus] = useState({
    isOpen: false,
    openedDate: null,
    reason: ""
  });

  const [timeElapsed, setTimeElapsed] = useState({
    days: 0,
    hours: 0,
    minutes: 0
  });

  const [infographicsData, setInfographicsData] = useState({});
  const [floodStats, setFloodStats] = useState(null); // สถิติน้ำท่วมจาก database
  const [accidentStats, setAccidentStats] = useState(null); // สถิติอุบัติเหตุจาก database
  const [diseaseStats, setDiseaseStats] = useState(null); // สถิติโรคระบาดจาก database
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [eocLastUpdated, setEocLastUpdated] = useState(null);
  const [summaryLastUpdated, setSummaryLastUpdated] = useState(null);
  const [selectedDisasterType, setSelectedDisasterType] = useState("flood");
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedMapDate, setSelectedMapDate] = useState(null);
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [reportTypeFilter, setReportTypeFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [publicIncidents, setPublicIncidents] = useState([]);
  const [mapLayers, setMapLayers] = useState({
    district: true,
    tambon: false,
    village: false,
    labels: true
  });
  const [showHomeLayerPanel, setShowHomeLayerPanel] = useState(true);
  const [showHomeMapLegend, setShowHomeMapLegend] = useState(true);

  useEffect(() => {
    const hasSeenSplash = window.sessionStorage.getItem("stn-eoc-splash-seen");
    if (!hasSeenSplash) {
      setShowSplash(true);
      window.sessionStorage.setItem("stn-eoc-splash-seen", "true");
    }
  }, []);

  const activeEocTypes = useMemo(
    () => [...new Set(activeEOCs.map((eoc) => eoc.eoc_type).filter(Boolean))],
    [activeEOCs]
  );

  const latestActiveEOC = useMemo(
    () => [...activeEOCs].sort(
      (a, b) => new Date(b.session_opened_at || b.activated_at || 0) - new Date(a.session_opened_at || a.activated_at || 0)
    )[0] || null,
    [activeEOCs]
  );
  const availableDisasterTypes = useMemo(() => {
    const activeTypes = [...new Set(activeEOCs.map((eoc) => mapEocTypeToPublicDisasterType(eoc.eoc_type)))];
    return activeTypes.length > 0 ? activeTypes : ["flood"];
  }, [activeEOCs]);

  const handleMapDataChange = useCallback((items) => {
    setPublicIncidents(items || []);
  }, []);

  // ดึงข้อมูล EOC ที่เปิดอยู่
  useEffect(() => {
    const fetchActiveEOCs = async () => {
      try {
        const response = await fetch('/stn-eoc/api/eoc/status/');

        if (!response.ok) {
          console.error('Failed to fetch EOC status:', response.status);
          return;
        }

        const result = await response.json();

        if (result.success) {
          const active = result.data.filter(eoc => eoc.is_active);
          const activeSorted = [...active].sort(
            (a, b) => new Date(b.session_opened_at || b.activated_at || 0) - new Date(a.session_opened_at || a.activated_at || 0)
          );
          setActiveEOCs(activeSorted);
          setEocLastUpdated(new Date());

          // ถ้ามี EOC เปิดอยู่ตั้งค่า eocStatus เป็น true
          if (activeSorted.length > 0) {
            const latestEOC = activeSorted[0];

            setEocStatus({
              isOpen: true,
              openedDate: latestEOC.session_opened_at || latestEOC.activated_at,
              reason: latestEOC.description || `เปิดศูนย์ EOC ${getEOCTypeName(latestEOC)}`
            });
          } else {
            setEocStatus({
              isOpen: false,
              openedDate: null,
              reason: ""
            });
          }
        }
      } catch (error) {
        console.error('Error fetching EOC status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveEOCs();
    // รีเฟรชทุก 30 วินาที
    const interval = setInterval(() => {
      if (!document.hidden) fetchActiveEOCs();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeEOCs.length === 0) {
      if (selectedDisasterType !== "flood") {
        setSelectedDisasterType("flood");
        setSelectedSessionId(null);
        setSelectedMapDate(null);
      }
      return;
    }

    const activePublicTypes = new Set(activeEOCs.map((eoc) => mapEocTypeToPublicDisasterType(eoc.eoc_type)));
    if (!activePublicTypes.has(selectedDisasterType)) {
      const nextType = mapEocTypeToPublicDisasterType(latestActiveEOC?.eoc_type);
      setSelectedDisasterType(nextType);
      setSelectedSessionId(null);
      setSelectedMapDate(null);
    }
  }, [activeEOCs, latestActiveEOC, selectedDisasterType]);

  // ดึงข้อมูล infographics เฉพาะภัยที่กำลังเปิดอยู่
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_EOC_LEGACY_HOME !== "true") return;
    if (activeEocTypes.length === 0) {
      setInfographicsData({});
      return;
    }

    const fetchInfographics = async () => {
      const data = {};

      for (const type of activeEocTypes) {
        try {
          const response = await fetch(`/stn-eoc/api/public/infographics/?eocType=${type}`);

          if (!response.ok) {
            console.error(`Failed to fetch infographics for ${type}:`, response.status);
            data[type] = [];
            continue;
          }

          const result = await response.json();
          if (result.success) {
            data[type] = (result.data || [])
              .map((item) => ({
                ...item,
                image: getPublicAssetPath(item.image)
              }))
              .filter((item) => Boolean(item.image));
          } else {
            data[type] = [];
          }
        } catch (error) {
          console.error(`Error fetching infographics for ${type}:`, error);
          data[type] = [];
        }
      }

      setInfographicsData(data);
    };

    fetchInfographics();
  }, [activeEocTypes]);

  // ดึงข้อมูลสรุปภาพรวมสำหรับ dashboard หน้าแรก
  useEffect(() => {
    const fetchDashboardSummary = async () => {
      try {
        const response = await fetch('/stn-eoc/api/dashboard/summary/');
        if (!response.ok) return;

        const result = await response.json();
        if (result.success) {
          setDashboardSummary(result.data);
          setSummaryLastUpdated(new Date());
        }
      } catch (error) {
        console.error('Error fetching dashboard summary:', error);
      }
    };

    fetchDashboardSummary();
    const interval = setInterval(() => {
      if (!document.hidden) fetchDashboardSummary();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // ดึงข้อมูลสถิติจาก database ตาม EOC ที่เปิดอยู่
  useEffect(() => {
    const fetchFloodStats = async () => {
      const floodEOC = activeEOCs.find(eoc => eoc.eoc_type === 'flood');
      if (!floodEOC) return;
      try {
        const response = await fetch(`/stn-eoc/api/public/flood-stats/?session_id=${floodEOC.id}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) setFloodStats(result.data);
        }
      } catch (error) {
        console.error('Error fetching flood stats:', error);
      }
    };

    const fetchAccidentStats = async () => {
      const accidentEOC = activeEOCs.find(eoc => eoc.eoc_type === 'accident');
      if (!accidentEOC) return;
      try {
        const response = await fetch(`/stn-eoc/api/public/accident-stats/?session_id=${accidentEOC.id}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) setAccidentStats(result.data);
        }
      } catch (error) {
        console.error('Error fetching accident stats:', error);
      }
    };

    const fetchDiseaseStats = async () => {
      const diseaseEOC = activeEOCs.find(eoc => eoc.eoc_type === 'disease');
      if (!diseaseEOC) return;
      try {
        const response = await fetch(`/stn-eoc/api/public/disease-stats/?session_id=${diseaseEOC.id}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) setDiseaseStats(result.data);
        }
      } catch (error) {
        console.error('Error fetching disease stats:', error);
      }
    };

    if (activeEOCs.length > 0) {
      fetchFloodStats();
      fetchAccidentStats();
      fetchDiseaseStats();
    }
  }, [activeEOCs]);

  // คำนวณเวลาที่ผ่านไป
  useEffect(() => {
    const calculateTimeElapsed = () => {
      if (!eocStatus.isOpen || !eocStatus.openedDate) return;

      const opened = new Date(eocStatus.openedDate);
      const now = new Date();
      const diff = now - opened;

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeElapsed({ days, hours, minutes });
    };

    calculateTimeElapsed();
    const interval = setInterval(calculateTimeElapsed, 60000); // อัพเดททุกนาที

    return () => clearInterval(interval);
  }, [eocStatus]);

  // ฟังก์ชันแปลงชื่อ EOC
  const getEOCTypeName = (eocOrType) => formatEocDisplayName(eocOrType);

  const getEOCTypeIcon = (type) => {
    const icons = {
      flood: '💧',
      disease: '🦠',
      accident: '🚗',
      'festival-accidents': '🚗'
    };
    return icons[type] || '⚠️';
  };

  const getEOCTypeColor = (type) => {
    const colors = {
      flood: 'from-blue-500 to-cyan-500',
      disease: 'from-rose-500 to-red-500',
      accident: 'from-orange-500 to-red-600',
      'festival-accidents': 'from-orange-500 to-red-600'
    };
    return colors[type] || 'from-gray-500 to-gray-600';
  };

  const getEOCTypeBaseColor = (type) => {
    const colors = {
      flood: 'blue',
      disease: 'red',
      accident: 'orange',
      'festival-accidents': 'orange'
    };
    return colors[type] || 'gray';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ข้อมูลคำแนะนำและข่าวสารสำหรับแต่ละ EOC
  const getEOCContent = (eocType) => {
    const content = {
      flood: {
        infographics: infographicsData[eocType] || [],
        warnings: [
          { icon: "⚠️", text: "หลีกเลี่ยงการเดินทางผ่านพื้นที่น้ำท่วม", level: "danger" },
          { icon: "🏠", text: "ย้ายทรัพย์สินไปที่สูง ตัดไฟฟ้าก่อนน้ำท่วม", level: "warning" },
          { icon: "📱", text: "ติดตามข่าวสารและเตรียมพร้อมอพยพ", level: "info" }
        ],
        news: [
          {
            title: "พยากรณ์อากาศ 3 วันข้างหน้า",
            content: "คาดการณ์ฝนตกหนักต่อเนื่อง ระดับน้ำในลำน้ำสตูลเพิ่มสูงขึ้น",
            type: "warning",
            date: "2025-12-17"
          },
          {
            title: "แนวทางป้องกันตัวจากน้ำท่วม",
            content: "เตรียมถุงทราย ตรวจสอบเส้นทางอพยพ และเตรียมเสบียงอาหาร 3 วัน",
            type: "info",
            date: "2025-12-16"
          }
        ],
        quickActions: [
          { icon: "🗺️", title: "แผนที่รายงานจากประชาชน (ยืนยันแล้ว)", link: "/public/disaster-map", color: "blue" },
          { icon: "🚨", title: "แจ้งเหตุน้ำท่วม", link: "/public/report-incident", color: "red" },
          { icon: "🏘️", title: "ศูนย์พักพิงชั่วคราว", link: "/public/shelters", color: "green" }
        ],
        stats: floodStats ? {
          affected: floodStats.affected || 0,
          affectedHouseholds: floodStats.affectedHouseholds || 0,
          floodedVillages: floodStats.floodedVillages || 0,
          affectedAreas: floodStats.affectedAreas || 0
        } : {
          affected: 0,
          affectedHouseholds: 0,
          floodedVillages: 0,
          affectedAreas: 0
        }
      },
      accident: {
        infographics: infographicsData[eocType] || [],
        warnings: [
          { icon: "🍺", text: "เมาไม่ขับ ปฏิบัติตามกฎจราจร", level: "danger" },
          { icon: "⛑️", text: "สวมหมวกกันน็อคและคาดเข็มขัดนิรภัย", level: "warning" },
          { icon: "😴", text: "ง่วงไม่ขับ พักผ่อนให้เพียงพอ", level: "info" }
        ],
        news: [],
        quickActions: [
          { icon: "🗺️", title: "แผนที่อุบัติเหตุ", link: "/public/disaster-map", color: "orange" },
          { icon: "📝", title: "แจ้งเหตุอุบัติเหตุ", link: "/public/festival-accidents/report", color: "red" },
          { icon: "🏥", title: "หน่วยงานและจุดช่วยเหลือ", link: "/public/agencies", color: "blue" }
        ],
        stats: accidentStats ? {
          accidents: accidentStats.accidents || 0,
          injuries: accidentStats.injuries || 0,
          deaths: accidentStats.deaths || 0,
          checkpoints: accidentStats.checkpoints || 0
        } : {
          accidents: 0,
          injuries: 0,
          deaths: 0,
          checkpoints: 0
        }
      },
      disease: {
        infographics: infographicsData[eocType] || [],
        warnings: [
          { icon: "😷", text: "สวมหน้ากากอนามัย ล้างมือบ่อยๆ", level: "warning" },
          { icon: "🏥", text: "พบแพทย์ทันทีหากมีอาการป่วย", level: "danger" },
          { icon: "🚫", text: "หลีกเลี่ยงสถานที่แออัด รักษาระยะห่าง", level: "warning" }
        ],
        news: [],
        quickActions: [
          { icon: "🦠", title: "แผนที่โรคระบาด", link: "/public/disaster-map", color: "teal" },
          { icon: "💉", title: "หน่วยบริการสุขภาพ", link: "/public/agencies", color: "green" },
          { icon: "🏥", title: "โรงพยาบาล", link: "/public/disaster-map", color: "blue" }
        ],
        stats: diseaseStats ? {
          patients: diseaseStats.patients || 0,
          affectedFacilities: diseaseStats.affectedFacilities || 0,
          affectedDistricts: diseaseStats.affectedDistricts || 0,
          hospitals: diseaseStats.hospitals || 0
        } : {
          patients: 0,
          affectedFacilities: 0,
          affectedDistricts: 0,
          hospitals: 0
        }
      }
    };

    return content[eocType] || null;
  };

  const visiblePublicIncidents = useMemo(() => {
    const query = mapSearchQuery.trim().toLowerCase();
    return publicIncidents.filter((incident) => {
      if (urgencyFilter !== "all" && incident.urgency !== urgencyFilter) return false;
      if (reportTypeFilter !== "all" && incident.report_type !== reportTypeFilter) return false;
      if (districtFilter !== "all" && incident.district !== districtFilter) return false;
      if (query) {
        const searchableText = [
          incident.district,
          incident.sub_district,
          incident.village,
          incident.description
        ].filter(Boolean).join(" ").toLowerCase();
        if (!searchableText.includes(query)) return false;
      }
      return true;
    });
  }, [districtFilter, mapSearchQuery, publicIncidents, reportTypeFilter, urgencyFilter]);

  const publicDistricts = useMemo(
    () => [...new Set(publicIncidents.map((incident) => incident.district).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")),
    [publicIncidents]
  );

  const criticalCount = visiblePublicIncidents.filter((incident) => incident.urgency === "critical").length;
  const highCount = visiblePublicIncidents.filter((incident) => incident.urgency === "high").length;
  const helpRequestCount = visiblePublicIncidents.filter((incident) => (incident.report_type || "help_request") === "help_request").length;
  const trafficReportCount = visiblePublicIncidents.filter((incident) => incident.report_type === "traffic_report").length;
  const lastUpdatedAt = summaryLastUpdated || eocLastUpdated;
  const eocOverview = useMemo(() => dashboardSummary?.eocOverview || [], [dashboardSummary?.eocOverview]);
  const eocSessionOptions = useMemo(
    () => buildSessionOptions(selectedDisasterType, dashboardSummary?.eocSessions || [], eocOverview),
    [dashboardSummary?.eocSessions, eocOverview, selectedDisasterType]
  );
  const diseaseChartSession = useMemo(() => {
    const diseaseSessions = (dashboardSummary?.eocSessions || [])
      .filter((session) => session.eoc_type === "disease")
      .sort((a, b) => {
        const activeDiff = Number(b.status === "active") - Number(a.status === "active");
        if (activeDiff !== 0) return activeDiff;
        return new Date(b.opened_at || 0).getTime() - new Date(a.opened_at || 0).getTime();
      });
    return diseaseSessions[0] || null;
  }, [dashboardSummary?.eocSessions]);
  const selectedSession = useMemo(
    () => eocSessionOptions.find((session) => String(session.id) === String(selectedSessionId)) || eocSessionOptions[0] || null,
    [eocSessionOptions, selectedSessionId]
  );
  const dateOptions = useMemo(
    () => buildEocDateOptions(selectedDisasterType, eocOverview, selectedSession),
    [eocOverview, selectedDisasterType, selectedSession]
  );
  const selectedDateForMap = selectedMapDate || dateOptions[0]?.date || getTodayDateKey();

  useEffect(() => {
    if (eocSessionOptions.length === 0) {
      if (selectedSessionId) setSelectedSessionId(null);
      return;
    }
    if (!eocSessionOptions.some((session) => String(session.id) === String(selectedSessionId))) {
      setSelectedSessionId(eocSessionOptions[0].id);
    }
  }, [eocSessionOptions, selectedSessionId]);

  useEffect(() => {
    if (dateOptions.length === 0) return;
    if (!dateOptions.some((item) => item.date === selectedMapDate)) {
      setSelectedMapDate(dateOptions[0].date);
    }
  }, [dateOptions, selectedMapDate]);

  const selectedDisasterLabel = getEOCTypeName(selectedDisasterType);
  const selectedDisasterDescription = {
    flood: "ติดตามจุดเสี่ยงน้ำท่วม พื้นที่เฝ้าระวัง และศูนย์ช่วยเหลือใกล้ประชาชน",
    disease: "ดูแนวโน้มผู้ป่วย พื้นที่เฝ้าระวัง และระบบช่วยเหลือด้านสาธารณสุข",
    accident: "ติดตามอุบัติเหตุ จุดเสี่ยง และรายงานเส้นทางสัญจรที่กระทบประชาชน"
  }[selectedDisasterType] || "ติดตามสถานการณ์สาธารณะล่าสุดจากศูนย์ EOC";
  const selectedSummaryValue = {
    flood: dashboardSummary?.totalAffected ?? floodStats?.affected ?? 0,
    disease: dashboardSummary?.diseasePatients ?? diseaseStats?.patients ?? 0,
    accident: accidentStats?.accidents ?? 0
  }[selectedDisasterType] ?? 0;
  const selectedSummaryUnit = {
    flood: "คนได้รับผลกระทบ",
    disease: "รายในระบบ",
    accident: "เหตุการณ์สะสม"
  }[selectedDisasterType] || "รายการ";
  const quickActionItems = [
    {
      href: "/public/report-incident",
      title: "แจ้งเหตุหรือขอความช่วยเหลือ",
      description: "ส่งข้อมูลเข้าระบบเพื่อให้หน่วยงานตรวจสอบและตอบสนองเร็วขึ้น",
      icon: "แจ้งเหตุ",
      tone: "red"
    },
    {
      href: "/public/disaster-map",
      title: "เปิดแผนที่สาธารณะเต็มจอ",
      description: "ดูตำแหน่งเหตุ รายงานจากประชาชน และพื้นที่เฝ้าระวังแบบละเอียด",
      icon: "แผนที่",
      tone: "blue"
    },
    {
      href: "/public/help/citizen-guide",
      title: "คำแนะนำสำหรับประชาชน",
      description: "คู่มือเตรียมพร้อม อพยพ และดูแลตัวเองตามประเภทเหตุการณ์",
      icon: "คู่มือ",
      tone: "emerald"
    },
    {
      href: "/public/agencies",
      title: "หน่วยงานฉุกเฉิน",
      description: "รวมช่องทางติดต่อและหน่วยงานที่เกี่ยวข้องในกรณีฉุกเฉิน",
      icon: "หน่วยงาน",
      tone: "blue"
    }
  ];
  const databaseAnnouncements = Array.isArray(dashboardSummary?.announcements)
    ? dashboardSummary.announcements.map(normalizeAnnouncement)
    : [];
  const homepageAnnouncements = databaseAnnouncements.length
    ? databaseAnnouncements.slice(0, 3)
    : [
        { id: "static-1", title: "ประกาศจังหวัดสตูล ฉบับล่าสุด", content: "ติดตามประกาศและคำแนะนำจากหน่วยงานราชการอย่างต่อเนื่อง" },
        { id: "static-2", title: "เตรียมพร้อมพื้นที่เสี่ยง", content: "ประชาชนในพื้นที่ลุ่มต่ำควรตรวจสอบเส้นทางอพยพและอุปกรณ์จำเป็น" },
        { id: "static-3", title: "รายงานสถานการณ์สาธารณะ", content: "ระบบสรุปข้อมูลจากรายงานประชาชนและฐานข้อมูล EOC เพื่อการติดตามร่วมกัน" }
      ];

  if (process.env.NEXT_PUBLIC_EOC_LEGACY_HOME !== "true") {
    return (
      <PublicOperationalDashboard
        showSplash={showSplash}
        setShowSplash={setShowSplash}
        activeEOCs={activeEOCs}
        dashboardSummary={dashboardSummary}
        eocStatus={eocStatus}
        lastUpdatedAt={lastUpdatedAt}
        selectedDisasterType={selectedDisasterType}
        setSelectedDisasterType={setSelectedDisasterType}
        selectedSessionId={selectedSession?.id || ""}
        setSelectedSessionId={setSelectedSessionId}
        sessionOptions={eocSessionOptions}
        selectedSession={selectedSession}
        selectedMapDate={selectedDateForMap}
        setSelectedMapDate={setSelectedMapDate}
        dateOptions={dateOptions}
        urgencyFilter={urgencyFilter}
        setUrgencyFilter={setUrgencyFilter}
        reportTypeFilter={reportTypeFilter}
        setReportTypeFilter={setReportTypeFilter}
        districtFilter={districtFilter}
        setDistrictFilter={setDistrictFilter}
        mapSearchQuery={mapSearchQuery}
        setMapSearchQuery={setMapSearchQuery}
        publicDistricts={publicDistricts}
        visiblePublicIncidents={visiblePublicIncidents}
        criticalCount={criticalCount}
        highCount={highCount}
        helpRequestCount={helpRequestCount}
        trafficReportCount={trafficReportCount}
        latestActiveEOC={latestActiveEOC}
        availableDisasterTypes={availableDisasterTypes}
        mapLayers={mapLayers}
        setMapLayers={setMapLayers}
        showHomeLayerPanel={showHomeLayerPanel}
        setShowHomeLayerPanel={setShowHomeLayerPanel}
        showHomeMapLegend={showHomeMapLegend}
        setShowHomeMapLegend={setShowHomeMapLegend}
        handleMapDataChange={handleMapDataChange}
        eocOverview={eocOverview}
        homepageAnnouncements={homepageAnnouncements}
        primaryAnnouncement={databaseAnnouncements[0] || null}
        quickActionItems={quickActionItems}
        getEOCTypeName={getEOCTypeName}
        getEOCTypeIcon={getEOCTypeIcon}
        formatDate={formatDate}
      />
    );
  }


  return (
    <div className="min-h-screen bg-pattern">
      {/* Splash Screen */}
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}

      {/* Announcement Popup */}
      <AnnouncementPopup />

      {/* Hero Section - Improved */}
      <header className="eoc-bg-green-900 text-white py-8 md:py-16 shadow-lg relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/3 translate-y-1/3"></div>
        </div>

        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8">
            <div className="flex items-center gap-3 md:gap-6">
              <div className="w-16 h-16 md:w-24 md:h-24 bg-white rounded-full flex items-center justify-center shadow-2xl ring-2 md:ring-4 ring-green-400">
                <Image src="/stn-eoc/img/logo.png" alt="EOC Logo" width={80} height={80} className="w-14 h-14 md:w-20 md:h-20" />
              </div>
              <div>
                <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-1 md:mb-2 drop-shadow-lg">EOC จังหวัดสตูล</h1>
                <p className="text-sm md:text-xl text-green-100 mb-0.5 md:mb-1">Satun Geo-EOC Intelligence Platform</p>
                <p className="text-xs md:text-sm text-green-200">ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน จังหวัดสตูล</p>
              </div>
            </div>

            {/* Call-to-Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 md:gap-3 w-full md:w-auto">
              <Link
                href="/public/report-incident"
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 md:px-6 md:py-4 rounded-lg font-bold shadow-xl transition-colors text-center text-sm md:text-base ring-1 ring-white/20"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm md:text-xl">⚡</span>
                  <span>แจ้งเหตุ</span>
                </div>
              </Link>
              <Link
                href="/login"
                className="bg-white hover:bg-gray-100 text-green-800 px-4 py-3 md:px-6 md:py-4 rounded-lg font-bold shadow-xl transition-colors text-center text-sm md:text-base"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm md:text-xl">🔐</span>
                  <span>เข้าสู่ระบบ</span>
                </div>
              </Link>
              <Link
                href="/public/disaster-map"
                className="bg-green-600 hover:bg-green-500 text-white px-4 py-3 md:px-6 md:py-4 rounded-lg font-bold shadow-xl transition-colors text-center text-sm md:text-base"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm md:text-xl">🗺️</span>
                  <span>แผนที่ภัยพิบัติ</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 md:px-6 py-4 md:py-8">
        {/* EOC Status Section - Enhanced with Active EOCs List */}
        <section className="mb-8">
          {loading ? (
            <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
              <svg className="animate-spin h-12 w-12 text-green-600 mx-auto mb-4" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-gray-600">กำลังโหลดข้อมูล EOC...</p>
            </div>
          ) : (
            <>
              <div className={`rounded-xl md:rounded-2xl shadow-2xl p-4 md:p-8 relative overflow-hidden mb-4 md:mb-6 ${eocStatus.isOpen
                ? 'eoc-bg-red-900 text-white'
                : 'bg-white text-gray-900 border border-gray-200'
                }`}>
                {/* Animated Background */}
                {eocStatus.isOpen && (
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute w-64 h-64 bg-white opacity-10 rounded-full -top-32 -right-32 animate-pulse"></div>
                    <div className="absolute w-48 h-48 bg-white opacity-10 rounded-full -bottom-24 -left-24 animate-pulse delay-75"></div>
                  </div>
                )}

                <div className="relative z-10">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6">
                    <div className="flex-1 w-full">
                      <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
                        <div className={`w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-2xl flex items-center justify-center ${eocStatus.isOpen ? 'bg-white/20 animate-pulse' : 'bg-emerald-50'
                          } shadow-lg`}>
                          <span className="text-3xl md:text-4xl">{eocStatus.isOpen ? '🚨' : '✅'}</span>
                        </div>
                        <div>
                          <h2 className="text-xl md:text-3xl lg:text-4xl font-bold mb-0.5 md:mb-1">
                            สถานะ EOC: {eocStatus.isOpen ? 'เปิดใช้งาน' : 'ปิด'}
                          </h2>
                          <p className="text-sm md:text-lg lg:text-xl opacity-90">
                            {eocStatus.isOpen ? eocStatus.reason : 'เฝ้าระวังสถานการณ์ทั่วไป ไม่มีศูนย์ที่เปิดใช้งานอยู่'}
                          </p>
                          {eocLastUpdated && (
                            <p className={`text-xs md:text-sm mt-1 ${eocStatus.isOpen ? "text-white/85" : "text-gray-500"}`}>
                              อัปเดตล่าสุด {formatDate(eocLastUpdated)}
                            </p>
                          )}
                        </div>
                      </div>

                      {eocStatus.isOpen && (
                        <div className="eoc-bg-red-950 rounded-lg md:rounded-xl p-3 md:p-4">
                          <p className="text-xs md:text-sm mb-2 md:mb-3">เปิด EOC เมื่อ: {formatDate(eocStatus.openedDate)} น.</p>
                          <div className="grid grid-cols-3 gap-2 md:gap-4">
                            <div className="text-center eoc-bg-red-950 rounded-lg p-2 md:p-3">
                              <div className="text-2xl md:text-4xl font-bold">{timeElapsed.days}</div>
                              <div className="text-xs md:text-sm opacity-80">วัน</div>
                            </div>
                            <div className="text-center eoc-bg-red-950 rounded-lg p-2 md:p-3">
                              <div className="text-2xl md:text-4xl font-bold">{timeElapsed.hours}</div>
                              <div className="text-xs md:text-sm opacity-80">ชั่วโมง</div>
                            </div>
                            <div className="text-center eoc-bg-red-950 rounded-lg p-2 md:p-3">
                              <div className="text-2xl md:text-4xl font-bold">{timeElapsed.minutes}</div>
                              <div className="text-xs md:text-sm opacity-80">นาที</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-row md:flex-col gap-2 md:gap-3 w-full md:w-auto">
                      <Link
                        href="/public/report-incident"
                        className={`${eocStatus.isOpen ? "bg-white text-red-700 hover:bg-red-50" : "bg-red-600 text-white hover:bg-red-700"} px-4 py-2 md:px-6 md:py-3 rounded-lg font-bold shadow-lg transition-colors text-center text-sm md:text-base flex-1 md:flex-none`}
                      >
                        ⚡ แบบฟอร์มแจ้งเหตุ
                      </Link>
                      <Link
                        href="/public/disaster-map"
                        className={`${eocStatus.isOpen ? "bg-white/20 hover:bg-white/30 text-white border-white/30" : "bg-white hover:bg-gray-50 text-gray-800 border-gray-200"} px-4 py-2 md:px-6 md:py-3 rounded-lg font-semibold transition-colors text-center border text-sm md:text-base flex-1 md:flex-none`}
                      >
                        🗺️ แผนที่สถานการณ์
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active EOCs List */}
              {activeEOCs.length > 0 && (
                <div className="mb-4 md:mb-6">
                  <h2 className="text-lg md:text-2xl font-bold text-gray-800 mb-3 md:mb-4 px-1">🚨 EOC ที่เปิดใช้งานอยู่ ({activeEOCs.length})</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {activeEOCs.map((eoc) => {
                      const style = getEOCStyle(eoc.eoc_type);
                      return (
                        <div
                          key={eoc.eoc_type}
                          className={`bg-white rounded-lg md:rounded-xl shadow-md p-4 md:p-6 hover:shadow-lg transition-all border ${style.softBorder || "border-gray-100"}`}
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-full ${style.bg} flex items-center justify-center text-3xl shadow-sm`}>
                                {getEOCTypeIcon(eoc.eoc_type)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`h-2.5 w-2.5 rounded-full ${style.accent || "bg-gray-500"}`}></span>
                                  <h3 className="text-lg font-bold text-gray-800 leading-tight">
                                    {getEOCTypeName(eoc)}
                                  </h3>
                                </div>
                                <p className={`text-xs font-semibold ${style.label} tracking-wide`}>
                                  EOC {eoc.eoc_type.toUpperCase()}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className={`px-2 py-0.5 ${style.badgeBg} ${style.text} rounded-full text-xs font-bold mb-1`}>
                                • เปิดใช้งาน
                              </span>
                            </div>
                          </div>

                          {/* Info */}
                          <div className="space-y-3 mb-4">
                            <div className="flex items-start gap-2 text-sm text-gray-600 border-t border-gray-100 pt-3">
                              <span className="flex-shrink-0 mt-0.5">ℹ️</span>
                              <span className="line-clamp-2">{eoc.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-gray-500 px-1">
                              <span>เปิดเมื่อ:</span>
                              <span className="font-medium text-gray-700">{formatDate(eoc.activated_at)} น.</span>
                            </div>
                          </div>

                          {/* Button */}
                          <Link
                            href="/public/disaster-map"
                            className={`block w-full px-3 py-2.5 rounded-lg font-semibold text-center transition-all ${style.button} text-white shadow-sm hover:shadow-md text-sm`}
                          >
                            ดูข้อมูลสาธารณะ →
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <HomeSituationDashboard
          activeEOCs={activeEOCs}
          dashboardSummary={dashboardSummary}
          floodStats={floodStats}
          accidentStats={accidentStats}
          diseaseStats={diseaseStats}
          loading={loading}
          getEOCTypeName={getEOCTypeName}
          getEOCTypeIcon={getEOCTypeIcon}
          formatDate={formatDate}
          lastUpdated={summaryLastUpdated || eocLastUpdated}
          diseaseChartSession={diseaseChartSession}
        />

        {/* Festival Accidents Public Dashboard - แสดงเมื่อ EOC เทศกาลเปิดอยู่ */}
        {(() => {
          const festivalEOC = activeEOCs.find(eoc => eoc.eoc_type === 'festival-accidents');
          if (!festivalEOC) return null;
          return (
            <FestivalPublicDashboard
              festivalSession={{
                is_active: festivalEOC.is_active,
                session_id: festivalEOC.session_id,
                festival_type: festivalEOC.festival_type,
              }}
            />
          );
        })()}

        {/* แสดงข้อมูลแยกตาม EOC ที่เปิด */}
        {activeEOCs.length > 0 && activeEOCs.map((eoc) => {
          const content = getEOCContent(eoc.eoc_type);
          if (!content) return null;
          const style = getEOCStyle(eoc.eoc_type);

          return (
            <div key={eoc.eoc_type} className="mb-8">
              {/* Infographic Carousel - คำแนะนำสำหรับประชาชน */}
              <section className="mb-4 md:mb-6">
                <div className={`bg-white rounded-lg md:rounded-xl p-4 md:p-6 shadow-md border ${style.softBorder || "border-gray-100"}`}>
                  <div className="flex items-center gap-2 md:gap-3 mb-4 pb-3 border-b border-gray-100">
                    <span className="text-3xl md:text-3xl">{getEOCTypeIcon(eoc.eoc_type)}</span>
                    <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-gray-800">
                      คำแนะนำสำหรับประชาชน - <span className={style.label}>{getEOCTypeName(eoc)}</span>
                    </h2>
                  </div>
                  <InfographicCarousel
                    infographics={content.infographics}
                    eocType={eoc.eoc_type}
                    lightMode={true}
                  />
                </div>
              </section>

              {/* สถิติเฉพาะ EOC */}
              <section className="mb-4 md:mb-6">
                <h2 className="text-lg md:text-2xl font-bold text-gray-800 mb-3 md:mb-4 px-1">📊 สถิติ{getEOCTypeName(eoc)}</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  {Object.entries(content.stats).map(([key, value]) => {
                    const labels = {
                      affected: { icon: "👥", title: "ผู้ได้รับผลกระทบ", unit: "คน" },
                      affectedHouseholds: { icon: "🏠", title: "ครัวเรือน", unit: "หลัง" },
                      floodedVillages: { icon: "🏘️", title: "หมู่บ้านน้ำท่วม", unit: "แห่ง" },
                      affectedAreas: { icon: "📍", title: "ตำบลประสบภัย", unit: "ตำบล" },
                      shelters: { icon: "🏘️", title: "จุดพักพิง", unit: "แห่ง" },
                      teams: { icon: "⚡", title: "ทีมปฏิบัติการ", unit: "ทีม" },
                      supplies: { icon: "📦", title: "เสบียงและอุปกรณ์", unit: "หน่วย" },
                      waterPoints: { icon: "💧", title: "จุดแจกน้ำ", unit: "จุด" },
                      waterTanks: { icon: "🚰", title: "รถน้ำ", unit: "คัน" },
                      evacuationPoints: { icon: "🏃", title: "จุดอพยพ", unit: "จุด" },
                      safeZones: { icon: "✅", title: "พื้นที่ปลอดภัย", unit: "พื้นที่" },
                      alerts: { icon: "📡", title: "ระบบเตือนภัย", unit: "จุด" },
                      safeBuildings: { icon: "🏗️", title: "อาคารปลอดภัย", unit: "แห่ง" },
                      patients: { icon: "😷", title: "ผู้ป่วย", unit: "คน" },
                      affectedFacilities: { icon: "🏥", title: "สถานพยาบาลที่รายงาน", unit: "แห่ง" },
                      affectedDistricts: { icon: "📍", title: "อำเภอที่ได้รับผลกระทบ", unit: "อำเภอ" },
                      hospitals: { icon: "🏥", title: "สถานพยาบาลในระบบ", unit: "แห่ง" },
                      accidents: { icon: "💥", title: "อุบัติเหตุสะสม", unit: "ครั้ง" },
                      injuries: { icon: "🤕", title: "ผู้บาดเจ็บ", unit: "ราย" },
                      deaths: { icon: "💀", title: "ผู้เสียชีวิต", unit: "ราย" },
                      checkpoints: { icon: "🚧", title: "จุดตรวจ/จุดบริการ", unit: "จุด" }
                    };
                    const label = labels[key] || { icon: "📊", title: key, unit: "" };

                    return (
                      <div key={key} className="bg-white rounded-lg shadow-md p-3 md:p-4 text-center">
                        <div className="text-2xl md:text-3xl mb-1 md:mb-2">{label.icon}</div>
                        <div className="text-lg md:text-2xl font-bold text-gray-800 mb-0.5 md:mb-1">
                          {value} <span className="text-xs md:text-sm font-normal text-gray-600">{label.unit}</span>
                        </div>
                        <div className="text-xs text-gray-600">{label.title}</div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Quick Access เฉพาะ EOC */}
              <section className="mb-4 md:mb-6">
                <h2 className="text-lg md:text-2xl font-bold text-gray-800 mb-3 md:mb-4 px-1">🚀 เข้าถึงด่วน - {getEOCTypeName(eoc)}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                  {content.quickActions.map((action, idx) => (
                    <QuickActionLink key={idx} action={action} />
                  ))}
                </div>
              </section>
            </div>
          );
        })}


        {/* ถ้าไม่มี EOC เปิด แสดงข้อมูลทั่วไป */}
        {
          activeEOCs.length === 0 && !loading && (
            <>
              {/* Quick Access ทั่วไป - แสดงเฉพาะแผนที่ภัยพิบัติ */}
              <section className="mb-6 md:mb-8">
                <h2 className="text-xl md:text-3xl font-bold text-gray-800 mb-4 md:mb-6 px-1">🚀 เข้าถึงด่วน</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                  <QuickLinkCard icon="🗺️" title="แผนที่ภัยพิบัติ" description="ดูสถานการณ์ภัยพิบัติทั้งหมด" link="/public/disaster-map" color="blue" />
                  {/* EOC-specific items are hidden when no EOC is active */}
                </div>
              </section>
            </>
          )
        }


        {/* Emergency Contact - แสดงเสมอ */}
        <section className="mb-6 md:mb-8">
          <div className="eoc-bg-red-800 text-white rounded-lg md:rounded-xl shadow-lg p-4 md:p-8 text-center">
            <h2 className="text-xl md:text-3xl font-bold mb-3 md:mb-4">☎️ หมายเลขฉุกเฉิน</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
              <div>
                <div className="text-3xl md:text-5xl font-bold mb-1 md:mb-2">191</div>
                <div className="text-sm md:text-lg">ตำรวจ</div>
              </div>
              <div>
                <div className="text-3xl md:text-5xl font-bold mb-1 md:mb-2">1669</div>
                <div className="text-sm md:text-lg">ฉุกเฉิน EMS</div>
              </div>
              <div>
                <div className="text-3xl md:text-5xl font-bold mb-1 md:mb-2">199</div>
                <div className="text-sm md:text-lg">ดับเพลิง</div>
              </div>
              <div>
                <div className="text-3xl md:text-5xl font-bold mb-1 md:mb-2">1784</div>
                <div className="text-sm md:text-lg">ปภ. สายด่วน</div>
              </div>
            </div>
          </div>

          {/* ช่องทางติดต่อจังหวัดสตูล */}
          <div className="p-4 md:p-6 mt-3 md:mt-4">
            <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-3 text-center">📞 ช่องทางติดต่อ สนง.ปภ.จังหวัดสตูล</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-3">
                <span className="text-2xl">📱</span>
                <div>
                  <div className="text-sm font-semibold text-gray-700">โทรศัพท์</div>
                  <div className="text-blue-700 font-bold">074-711-067</div>
                </div>
              </div>
              <a href="https://www.facebook.com/profile.php?id=100064630498498" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-blue-50 rounded-lg p-3 hover:bg-blue-100 transition-colors">
                <span className="text-2xl">📘</span>
                <div>
                  <div className="text-sm font-semibold text-gray-700">Facebook</div>
                  <div className="text-blue-700 font-bold text-sm">ปภ.จังหวัดสตูล</div>
                </div>
              </a>
              <a href="https://lin.ee/satunddpm" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-green-50 rounded-lg p-3 hover:bg-green-100 transition-colors">
                <span className="text-2xl">💬</span>
                <div>
                  <div className="text-sm font-semibold text-gray-700">LINE Official</div>
                  <div className="text-green-700 font-bold text-sm">@satunddpm</div>
                </div>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 py-4 md:py-6 mt-8 md:mt-12">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <p className="text-sm md:text-base">&copy; 2025 EOC จังหวัดสตูล - Satun Geo-EOC Intelligence Platform</p>
          <p className="text-xs md:text-sm mt-1 md:mt-2">ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน จังหวัดสตูล</p>
        </div>
      </footer>

      {/* AI Chatbot */}
      <AIChatbot />

      {/* PDPA Consent */}
      <PDPAConsent />
    </div>
  );
}

function PublicOperationalDashboard({
  showSplash,
  setShowSplash,
  activeEOCs,
  dashboardSummary,
  eocStatus,
  lastUpdatedAt,
  selectedDisasterType,
  setSelectedDisasterType,
  selectedSessionId,
  setSelectedSessionId,
  sessionOptions,
  selectedSession,
  selectedMapDate,
  setSelectedMapDate,
  dateOptions,
  urgencyFilter,
  setUrgencyFilter,
  reportTypeFilter,
  setReportTypeFilter,
  districtFilter,
  setDistrictFilter,
  mapSearchQuery,
  setMapSearchQuery,
  publicDistricts,
  visiblePublicIncidents,
  criticalCount,
  highCount,
  helpRequestCount,
  trafficReportCount,
  latestActiveEOC,
  availableDisasterTypes,
  mapLayers,
  setMapLayers,
  showHomeLayerPanel,
  setShowHomeLayerPanel,
  showHomeMapLegend,
  setShowHomeMapLegend,
  handleMapDataChange,
  eocOverview,
  homepageAnnouncements,
  primaryAnnouncement,
  quickActionItems,
  getEOCTypeName,
  getEOCTypeIcon,
  formatDate
}) {
  const normalizedSelectedType = normalizeEocTypeForSession(selectedDisasterType);
  const selectedOverview = eocOverview.find((item) => item.eoc_type === normalizedSelectedType);
  const floodOverview = eocOverview.find((item) => item.eoc_type === "flood");
  const diseaseOverview = eocOverview.find((item) => item.eoc_type === "disease");
  const populationOverview = eocOverview.find((item) => item.eoc_type === "population");
  const selectedSessionAffected = Number(selectedSession?.affected_total || 0);
  const selectedSessionInjured = Number(selectedSession?.affected_injured || 0);
  const selectedSessionDeaths = Number(selectedSession?.affected_deaths || 0);
  const selectedSessionMissing = Number(selectedSession?.affected_missing || 0);
  const selectedSessionAffectedDistricts = Number(selectedSession?.affected_districts || 0);
  const selectedSessionAffectedTambons = Number(selectedSession?.affected_tambons || 0);
  const affectedDistricts =
    selectedSessionAffectedDistricts ||
    getOverviewMetric(selectedOverview, "districts");
  const activeShelters = getOverviewMetric(selectedOverview, "shelters");
  const selectedDiseasePatients = getOverviewMetric(selectedOverview, "patients");
  const selectedDiseaseCount = getOverviewMetric(selectedOverview, "diseases");
  const selectedDate = selectedMapDate || dateOptions[0]?.date || floodOverview?.period?.first_date || diseaseOverview?.period?.first_date || getTodayDateKey();
  const selectedSessionPeriod = formatSessionPeriod(selectedSession);
  const dateRange = selectedSessionPeriod || formatOverviewDateRange(floodOverview?.period || diseaseOverview?.period);
  const homepageAlertText = buildHomepageAlertText(primaryAnnouncement, dateRange);
  const latestRows = buildIncidentTimeline(visiblePublicIncidents, selectedDate);
  const publicDataCards = [
    { label: "รายงานประชาชนที่ยืนยันแล้ว", value: visiblePublicIncidents.length, unit: "รายการ", href: "/public/disaster-map", tone: "blue" },
    { label: "พื้นที่/อำเภอที่มีผลกระทบ", value: affectedDistricts, unit: "อำเภอ", href: "/public/disaster-map", tone: "orange" },
    { label: "ศูนย์พักพิงในระบบ", value: activeShelters, unit: "แห่ง", href: "/public/shelters", tone: "violet" },
    { label: "ประกาศล่าสุด", value: homepageAnnouncements.length, unit: "ประกาศ", href: "/public/announcements", tone: "amber" },
    { label: "ข้อมูลกลุ่มเปราะบาง", value: getOverviewMetric(populationOverview, "vulnerable_total"), unit: "คน", href: "/public/agencies", tone: "emerald" }
  ];

  const stats = [
    {
      label: "รายงานที่แสดงบนแผนที่",
      value: visiblePublicIncidents.length,
      unit: "เหตุการณ์",
      sub: `${criticalCount + highCount} จุดต้องติดตาม`,
      tone: "blue",
      icon: "≋"
    },
    {
      label: "อำเภอได้รับผลกระทบ",
      value: affectedDistricts,
      unit: "อำเภอ",
      sub: "จากทั้งหมด 7 อำเภอ",
      tone: "orange",
      icon: "◎"
    },
    {
      label: "ผู้ได้รับผลกระทบ",
      value: selectedSessionAffected,
      unit: "คน",
      sub: dateRange || "ตามช่วงเปิด-ปิด EOC",
      tone: "purple",
      icon: "⌂"
    },

    {
      label: "โรค/อาการที่รายงาน",
      value: selectedDiseasePatients,
      unit: "ราย",
      sub: `${selectedDiseaseCount} โรคที่รายงาน`,
      tone: "teal",
      icon: "✚"
    },
    {
      label: "ศูนย์พักพิง",
      value: activeShelters,
      unit: "แห่ง",
      sub: "",
      tone: "violet",
      icon: "⌂"
    },
    {
      label: "ระดับเตือนภัย",
      value: criticalCount > 0 ? "สูง" : highCount > 0 ? "เฝ้าระวัง" : "ปกติ",
      unit: "",
      sub: criticalCount > 0 ? `${criticalCount} จุดวิกฤต` : "",
      tone: criticalCount > 0 ? "red" : "amber",
      icon: "☁"
    }
  ];

  return (
    <div className="min-h-screen bg-[#edf5fc] text-slate-900">
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <AnnouncementPopup />

      <header className="border-b border-blue-950/20 bg-[#083865] text-white shadow-lg">
        <div className="flex min-h-[70px] items-center gap-3 px-3 py-2 sm:min-h-[78px] sm:px-4 lg:min-h-[86px] lg:gap-5 lg:px-5 lg:py-0">
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-4">
            <Image src="/stn-eoc/img/logo.png" alt="Satun EOC" width={62} height={62} className="h-10 w-10 rounded-full bg-white p-1 shadow-md sm:h-12 sm:w-12 lg:h-[62px] lg:w-[62px] lg:p-1.5" priority />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-black leading-5 sm:text-base lg:text-2xl lg:leading-7">ระบบศูนย์ปฏิบัติการฉุกเฉิน จังหวัดสตูล</h1>
              <p className="truncate text-[11px] font-semibold text-blue-100 sm:text-xs lg:text-base">Satun EOC Public Dashboard</p>
            </div>
          </div>

        

          <div className="hidden items-center gap-5 text-sm text-blue-50 lg:flex">
            <div>
              <div className="font-bold text-white">วันที่แสดงข้อมูล {formatThaiDateOnly(selectedDate)}</div>
              <div>อัปเดตล่าสุด: {lastUpdatedAt ? formatDate(lastUpdatedAt) : "กำลังตรวจสอบ"}</div>
            </div>
            <div className="h-12 border-l border-white/15"></div>
            <div className="text-white">{new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.</div>
          </div>

          <div className={`ml-auto shrink-0 rounded-xl border px-3 py-2 text-center shadow-sm sm:px-4 lg:rounded-2xl lg:px-6 lg:py-3 ${eocStatus.isOpen ? "border-emerald-300 bg-emerald-600" : "border-slate-300 bg-slate-700"}`}>
            <div className="text-sm font-black leading-none sm:text-base lg:text-xl">{eocStatus.isOpen ? "เปิด EOC" : "ปิด EOC"}</div>
              <div className="mt-0.5 text-[10px] text-white/85 sm:text-[11px] lg:mt-1 lg:text-xs">{latestActiveEOC ? getEOCTypeName(latestActiveEOC) : "สถานะศูนย์"}</div>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-87px)] grid-cols-[98px_minmax(0,1fr)] max-lg:grid-cols-1">
        <OpsSidebar />

        <main className="min-w-0 p-2 pb-24 sm:p-3 lg:pb-3">
          <div className="mb-2 flex items-center justify-between gap-2 overflow-hidden rounded-lg bg-red-600 px-3 py-2 text-white shadow-sm sm:mb-3 sm:gap-3 sm:px-4 sm:py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-base font-black sm:h-8 sm:w-8 sm:text-lg">!</span>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="public-alert-marquee flex w-max whitespace-nowrap text-xs font-bold sm:text-sm">
                  <span className="pr-10">{homepageAlertText}</span>
                  <span className="pr-10" aria-hidden="true">{homepageAlertText}</span>
                </div>
              </div>
            </div>
            <Link href="/public/announcements" className="shrink-0 rounded-md bg-white px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-50 sm:px-4">ดู</Link>
          </div>

          <section className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {stats.map((stat) => (
              <OpsMetricCard key={stat.label} {...stat} />
            ))}
          </section>

        

          <section className="grid gap-3 xl:grid-cols-[270px_minmax(0,1fr)_360px]">
            <OpsFilterPanel
              selectedDisasterType={selectedDisasterType}
              setSelectedDisasterType={(type) => {
                setSelectedDisasterType(type);
                setSelectedSessionId(null);
                setSelectedMapDate(null);
              }}
              availableDisasterTypes={availableDisasterTypes}
              selectedSessionId={selectedSessionId}
              setSelectedSessionId={(sessionId) => {
                setSelectedSessionId(sessionId);
                setSelectedMapDate(null);
              }}
              sessionOptions={sessionOptions}
              selectedSession={selectedSession}
              selectedDate={selectedDate}
              dateOptions={dateOptions}
              setSelectedMapDate={setSelectedMapDate}
              districtFilter={districtFilter}
              setDistrictFilter={setDistrictFilter}
              publicDistricts={publicDistricts}
              urgencyFilter={urgencyFilter}
              setUrgencyFilter={setUrgencyFilter}
              reportTypeFilter={reportTypeFilter}
              setReportTypeFilter={setReportTypeFilter}
              mapSearchQuery={mapSearchQuery}
              setMapSearchQuery={setMapSearchQuery}
              resetFilters={() => {
                setSelectedDisasterType(availableDisasterTypes[0] || "flood");
                setSelectedSessionId(null);
                setSelectedMapDate(null);
                setUrgencyFilter("all");
                setReportTypeFilter("all");
                setDistrictFilter("all");
                setMapSearchQuery("");
                setMapLayers({ district: true, tambon: false, village: false, labels: true });
                setShowHomeLayerPanel(true);
                setShowHomeMapLegend(true);
              }}
            />

            <div className="min-w-0 space-y-3">
              <div className="relative overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
                <div className="h-[505px] bg-slate-100 max-lg:h-[420px] max-sm:h-[340px]">
                  <PublicIncidentMap
                    disasterType={selectedDisasterType}
                    sessionId={selectedSession?.isOverviewFallback ? null : selectedSession?.id}
                    startDate={selectedDate}
                    endDate={selectedDate}
                    chrome="full"
                    heightClass="h-full"
                    layers={mapLayers}
                    onLayersChange={setMapLayers}
                    urgencyFilter={urgencyFilter}
                    reportTypeFilter={reportTypeFilter}
                    districtFilter={districtFilter}
                    searchQuery={mapSearchQuery}
                    onDataChange={handleMapDataChange}
                  />
                </div>
                {showHomeLayerPanel ? (
                  <LayerFloatingPanel
                    mapLayers={mapLayers}
                    setMapLayers={setMapLayers}
                    onClose={() => setShowHomeLayerPanel(false)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowHomeLayerPanel(true)}
                    className="absolute left-4 top-4 z-[450] rounded-lg border border-blue-100 bg-white/95 px-3 py-2 text-xs font-black text-blue-700 shadow-lg backdrop-blur max-md:left-3"
                  >
                    แสดงชั้นข้อมูล
                  </button>
                )}
                {showHomeMapLegend ? (
                  <div className="absolute bottom-4 left-4 z-[450] max-w-[250px] max-md:left-3 max-md:right-3 max-md:max-w-none">
                    <HomeMapLegend mapLayers={mapLayers} onClose={() => setShowHomeMapLegend(false)} />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowHomeMapLegend(true)}
                    className="absolute bottom-4 left-4 z-[450] rounded-lg border border-blue-100 bg-white/95 px-3 py-2 text-xs font-black text-blue-700 shadow-lg backdrop-blur max-md:left-3"
                  >
                    แสดง legend
                  </button>
                )}
              </div>

              <OpsTimeline rows={latestRows} selectedDate={selectedDate} />
            </div>

            <OpsRightPanel
              announcements={homepageAnnouncements}
              quickActionItems={quickActionItems}
              helpRequestCount={helpRequestCount}
              trafficReportCount={trafficReportCount}
              activeShelters={activeShelters}
              populationOverview={populationOverview}
            />
          </section>

          <DiseaseChartSection chartSession={selectedSession?.isOverviewFallback ? null : selectedSession} />
        </main>
        <OpsMobileNav />
      </div>

      <PDPAConsent />
    </div>
  );
}

function OpsSidebar() {
  const items = [
    { href: "/", label: "หน้าหลัก", icon: "⌂", active: true },
    { href: "/public/disaster-map", label: "แผนที่", icon: "⌖" },
    { href: "/public/announcements", label: "ประกาศ", icon: "⚑" },
    { href: "/public/shelters", label: "ศูนย์พักพิง", icon: "⌂" },
    { href: "/public/agencies", label: "หน่วยงาน", icon: "⚕" },
    { href: "/public/help/citizen-guide", label: "คู่มือ", icon: "↓" },
    { href: "/login", label: "เจ้าหน้าที่", icon: "ⓘ" }
  ];

  return (
    <aside className="flex flex-col items-center gap-2 bg-[#0b4c86] px-2 py-6 text-white max-lg:hidden">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex w-full flex-col items-center gap-1 rounded-xl px-2 py-3 text-center text-xs font-bold transition ${item.active ? "bg-white text-blue-800 shadow-md" : "text-blue-50 hover:bg-white/10"}`}
        >
          <span className="text-2xl leading-none">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
      <div className="mt-auto rounded-xl bg-white/15 p-3 text-center text-xs font-semibold leading-5">
        <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-xl">□</div>
        ข้อมูลสาธารณะ
      </div>
    </aside>
  );
}

function OpsMobileNav() {
  const items = [
    { href: "/", label: "หน้าหลัก", icon: "⌂", active: true },
    { href: "/public/announcements", label: "ประกาศ", icon: "⚑" },
    { href: "/public/shelters", label: "ศูนย์พักพิง", icon: "⌂" },
    { href: "/public/agencies", label: "หน่วยงาน", icon: "☎" }
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[1000] grid grid-cols-4 border-t border-blue-100 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.12)] lg:hidden">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-bold ${item.active ? "text-blue-700" : "text-slate-500"}`}
        >
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg ${item.active ? "bg-blue-50" : "bg-transparent"}`}>{item.icon}</span>
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function OpsMetricCard({ label, value, unit, sub, tone, icon }) {
  const tones = {
    blue: "border-blue-300 bg-blue-50 text-blue-700",
    orange: "border-orange-300 bg-orange-50 text-orange-700",
    purple: "border-violet-300 bg-violet-50 text-violet-700",
    teal: "border-cyan-300 bg-cyan-50 text-cyan-700",
    violet: "border-purple-300 bg-purple-50 text-purple-700",
    amber: "border-amber-300 bg-amber-50 text-amber-700",
    red: "border-red-300 bg-red-50 text-red-700"
  };

  return (
    <div className={`rounded-lg border bg-white p-2.5 shadow-sm sm:rounded-xl sm:p-3 ${tones[tone] || tones.blue}`}>
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-xl shadow-sm sm:h-12 sm:w-12 sm:rounded-xl sm:text-2xl">{icon}</div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold leading-4 text-slate-600 sm:text-xs">{label}</div>
          <div className="mt-0.5 flex items-end gap-1 sm:mt-1">
            <span className="text-2xl font-black leading-none sm:text-3xl">{typeof value === "number" || /^\d+$/.test(String(value)) ? formatNumber(value) : value}</span>
            {unit && <span className="pb-0.5 text-[11px] font-bold text-slate-500 sm:pb-1 sm:text-xs">{unit}</span>}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-slate-500 sm:mt-1 sm:text-xs">{sub}</div>
        </div>
      </div>
    </div>
  );
}



function OpsFilterPanel({
  selectedDisasterType,
  setSelectedDisasterType,
  availableDisasterTypes,
  selectedSessionId,
  setSelectedSessionId,
  sessionOptions,
  selectedSession,
  selectedDate,
  dateOptions,
  setSelectedMapDate,
  districtFilter,
  setDistrictFilter,
  publicDistricts,
  urgencyFilter,
  setUrgencyFilter,
  reportTypeFilter,
  setReportTypeFilter,
  mapSearchQuery,
  setMapSearchQuery,
  resetFilters
}) {
  const disasterTypeLabels = {
    flood: "น้ำท่วม",
    disease: "โรคระบาด",
    accident: "อุบัติเหตุ"
  };

  return (
    <aside className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-black text-blue-900">ตัวกรองข้อมูล</h2>
        <button type="button" onClick={resetFilters} className="text-xs  text-blue-600 hover:text-blue-800">ล้างค่า</button>
      </div>

      <div className="space-y-4 text-sm">
        <FilterBlock title="1. ประเภทเหตุการณ์">
          <select
            value={selectedDisasterType}
            onChange={(event) => setSelectedDisasterType(event.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            {availableDisasterTypes.map((type) => (
              <option key={type} value={type}>{disasterTypeLabels[type] || type}</option>
            ))}
          </select>
         
        </FilterBlock>

        <FilterBlock title="2. รอบเหตุการณ์">
          <select
            value={selectedSessionId || ""}
            onChange={(event) => setSelectedSessionId(event.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm  outline-none focus:border-blue-500"
          >
            {sessionOptions.length === 0 && <option value="">ไม่มี รอบเหตุการณ์</option>}
            {sessionOptions.map((session) => (
              <option key={session.id} value={session.id}>
                รอบเหตุการณ์ที่ {session.session_number || session.id} {session.status === "active" ? "(เปิดอยู่)" : "(ปิดแล้ว)"}
              </option>
            ))}
          </select>
          <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
            {selectedSession ? (
              <>
                <div className="font-bold text-slate-800">
                  {selectedSession.label}
                </div>
                <div>เปิด: {formatThaiDateOnly(selectedSession.opened_at)}</div>
                <div>{selectedSession.closed_at ? `ปิด: ${formatThaiDateOnly(selectedSession.closed_at)}` : "ปิด: ถึงปัจจุบัน"}</div>
              </>
            ) : (
              "เลือกประเภท EOC เพื่อดู รอบเหตุการณ์"
            )}
          </div>
        </FilterBlock>

    

        <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-xs font-black text-blue-800">ตัวกรองขั้นสูง</summary>
          <div className="mt-3 space-y-4">
            <FilterBlock title="วันที่แสดงข้อมูล">
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700">{formatThaiDateOnly(selectedDate)}</div>
              <EocDateSelector
                dateOptions={dateOptions}
                selectedDate={selectedDate}
                onSelect={setSelectedMapDate}
              />
              <MiniCalendar selectedDate={selectedDate} />
            </FilterBlock>

        

           
          </div>
        </details>
      </div>
    </aside>
  );
}

function FilterBlock({ title, children }) {
  return (
    <section className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
      <h3 className="mb-2 text-xs font-black text-blue-800">{title}</h3>
      {children}
    </section>
  );
}

function EocDateSelector({ dateOptions, selectedDate, onSelect }) {
  const selectedIndex = Math.max(0, dateOptions.findIndex((item) => item.date === selectedDate));
  const nearbyOptions = dateOptions.length > 18
    ? dateOptions.slice(Math.max(0, selectedIndex - 8), Math.min(dateOptions.length, selectedIndex + 10))
    : dateOptions;

  if (!dateOptions.length) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500">
        ยังไม่มีช่วงวันที่ของ EOC นี้
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold text-slate-600">
          วันที่เปิดรอบเหตุการณ์ - วันที่ปิด/ปัจจุบัน ({formatNumber(dateOptions.length)} วัน)
        </div>
        <select
          value={selectedDate}
          onChange={(event) => onSelect(event.target.value)}
          className="max-w-[118px] rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 outline-none focus:border-blue-500"
        >
          {dateOptions.map((item) => (
            <option key={item.date} value={item.date}>
              วันที่ {item.dayNumber} {item.shortDate}
            </option>
          ))}
        </select>
      </div>

      <div className="grid max-h-36 grid-cols-3 gap-2 overflow-y-auto pr-1">
        {nearbyOptions.map((item) => {
          const active = item.date === selectedDate;
          return (
            <button
              key={item.date}
              type="button"
              onClick={() => onSelect(item.date)}
              className={`rounded-md px-2 py-2 text-center text-[11px] font-black leading-4 transition ${active ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-emerald-50 hover:text-emerald-700"}`}
            >
              <div>วันที่ {item.dayNumber}</div>
              <div>{item.weekday} {item.shortDate}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MiniCalendar({ selectedDate }) {
  const date = new Date(`${selectedDate}T00:00:00`);
  const days = Array.from({ length: 30 }, (_, index) => index + 1);
  const selectedDay = Number.isNaN(date.getTime()) ? 30 : date.getDate();
  const monthText = Number.isNaN(date.getTime())
    ? "พฤศจิกายน 2568"
    : date.toLocaleDateString("th-TH", { month: "long", year: "numeric" });

  return (
    <div className="mt-2 rounded-lg border border-slate-200 p-2">
      <div className="mb-2 text-center text-xs font-bold text-slate-700">{monthText}</div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500">
        {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day) => <div key={day}>{day}</div>)}
        {days.map((day) => (
          <div key={day} className={`rounded-full py-1 ${day === selectedDay ? "bg-blue-600 font-black text-white" : "text-slate-600"}`}>{day}</div>
        ))}
      </div>
    </div>
  );
}

function LayerFloatingPanel({ mapLayers, setMapLayers, onClose }) {
  const items = [
    ["district", "ขอบเขตอำเภอ"],
    ["tambon", "ขอบเขตตำบล"],
    ["village", "ขอบเขตหมู่บ้าน"],
    ["labels", "ชื่อพื้นที่"]
  ];

  return (
    <div className="absolute left-4 top-4 z-[450] w-48 rounded-lg border border-slate-200 bg-white/95 p-3 text-sm shadow-lg backdrop-blur max-md:left-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="font-black text-slate-800">ชั้นข้อมูล</div>
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-[11px] font-black text-slate-500 hover:bg-slate-100">
          ซ่อน
        </button>
      </div>
      <div className="space-y-2">
        {items.map(([key, label]) => (
          <label key={key} className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={mapLayers[key]}
              onChange={(event) => setMapLayers((current) => ({ ...current, [key]: event.target.checked }))}
              className="h-4 w-4 accent-blue-600"
            />
            {label}
          </label>
        ))}
      </div>
      <Link href="/public/disaster-map" className="mt-3 block rounded-md bg-blue-600 px-3 py-2 text-center text-xs font-black text-white hover:bg-blue-700">เปิดแผนที่เต็ม</Link>
    </div>
  );
}

function HomeMapLegend({ mapLayers, onClose }) {
  const boundaryItems = [
    mapLayers.district ? ["border-slate-900", "ขอบเขตอำเภอ"] : null,
    mapLayers.tambon ? ["border-emerald-600 border-dashed", "ขอบเขตตำบล"] : null,
    mapLayers.village ? ["border-slate-500", "ขอบเขตหมู่บ้าน"] : null
  ].filter(Boolean);

  return (
    <aside className="rounded-xl border border-blue-100 bg-white/95 p-3 text-xs shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-blue-900">Legend</h3>
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-[11px] font-black text-slate-500 hover:bg-slate-100">
          ซ่อน
        </button>
      </div>

      <div className="space-y-2 font-semibold text-slate-700">
        <div>
          <p className="mb-1 font-black text-slate-800">พื้นที่น้ำท่วม</p>
          <div className="space-y-1">
            <LegendSwatch colorClass="bg-red-600" label="น้ำท่วมสูง/สูงมาก" />
            <LegendSwatch colorClass="bg-amber-400" label="น้ำท่วมปานกลาง" />
            <LegendSwatch colorClass="bg-sky-400" label="น้ำท่วมต่ำ" />
          </div>
        </div>

        {boundaryItems.length > 0 && (
          <div>
            <p className="mb-1 font-black text-slate-800">ขอบเขตพื้นที่</p>
            <div className="space-y-1">
              {boundaryItems.map(([className, label]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`h-0 w-8 border-t-2 ${className}`} aria-hidden="true"></span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 font-black text-slate-800">รายงานประชาชน</p>
          <div className="space-y-1">
            <LegendSwatch colorClass="bg-red-500" label="ขอความช่วยเหลือ/เหตุการณ์" rounded />
            <LegendSwatch colorClass="bg-emerald-500" label="เส้นทางสัญจรได้" rounded />
            <LegendSwatch colorClass="bg-orange-400" label="เส้นทางสัญจรลำบาก" rounded />
            <LegendSwatch colorClass="bg-red-700" label="เส้นทางสัญจรไม่ได้" rounded />
          </div>
        </div>
      </div>
    </aside>
  );
}

function LegendSwatch({ colorClass, label, rounded = false }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`${rounded ? "rounded-full" : "rounded-sm"} h-3 w-3 ${colorClass}`} aria-hidden="true"></span>
      <span>{label}</span>
    </div>
  );
}

function OpsTimeline({ rows, selectedDate }) {
  return (
    <section className="rounded-xl border border-blue-100 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="font-black text-blue-900">เหตุการณ์รายวัน / Daily Incident Timeline</h2>
        <span className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-black text-white">{formatThaiDateOnly(selectedDate)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              {["วันที่", "เวลา", "ประเภทเหตุ", "พื้นที่", "รายละเอียด", "ระดับ", "สถานะ"].map((head) => (
                <th key={head} className="px-3 py-2 text-left font-black">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-slate-100">
                <td colSpan={7} className="px-3 py-8 text-center text-sm font-semibold text-slate-500">
                  ยังไม่มีรายงานที่ยืนยันแล้วในวันที่เลือก
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.date}-${row.time}-${row.area}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-700">{row.date}</td>
                  <td className="px-3 py-2 text-slate-600">{row.time}</td>
                  <td className="px-3 py-2 font-bold text-blue-700">{row.type}</td>
                  <td className="px-3 py-2 text-slate-700">{row.area}</td>
                  <td className="px-3 py-2 text-slate-600">{row.detail}</td>
                  <td className="px-3 py-2"><SeverityBadge level={row.severity} /></td>
                  <td className="px-3 py-2"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{row.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OpsRightPanel({ announcements, quickActionItems, helpRequestCount, trafficReportCount, activeShelters, populationOverview }) {
  return (
    <aside className="space-y-3">
      <Panel title="ประกาศล่าสุด" actionHref="/public/announcements">
        <div className="space-y-2">
          {announcements.slice(0, 3).map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="font-bold text-slate-900">{item.title}</div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{item.content}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="คำแนะนำสำหรับประชาชน" actionHref="/public/help/citizen-guide">
        <div className="space-y-2 text-sm text-slate-700">
          {quickActionItems.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 hover:bg-blue-50">
              <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>{item.title}</span>
            </Link>
          ))}
        </div>
      </Panel>

      <Panel title="เบอร์ติดต่อฉุกเฉิน">
        <div className="grid grid-cols-3 gap-2">
          <EmergencyNumber number="1669" label="เจ็บป่วยฉุกเฉิน" tone="red" />
          <EmergencyNumber number="1784" label="ปภ." tone="blue" />
          <EmergencyNumber number="191" label="ตำรวจ" tone="green" />
        </div>
      </Panel>
    </aside>
  );
}

function Panel({ title, actionHref, children }) {
  return (
    <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-black text-blue-900">{title}</h2>
        {actionHref && <Link href={actionHref} className="text-xs font-bold text-blue-600 hover:text-blue-800">ดูทั้งหมด</Link>}
      </div>
      {children}
    </section>
  );
}

function EmergencyNumber({ number, label, tone }) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700"
  };
  return (
    <a href={`tel:${number}`} className={`block rounded-lg border p-3 text-center transition hover:shadow-sm ${tones[tone]}`}>
      <div className="text-2xl font-black leading-none">{number}</div>
      <div className="mt-1 text-[11px] font-semibold leading-4">{label}</div>
    </a>
  );
}

function SmallInfo({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xl font-black text-slate-900">{formatNumber(value)}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

function DiseaseChartSection({ chartSession }) {
  return (
    <section className="mt-3 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          
          <h2 className="mt-1 text-xl font-black text-blue-950">ข้อมูลโรคระบาดในรูปแบบกราฟ</h2>
          <p className="mt-1 text-sm text-slate-600">
            แสดงแนวโน้มผู้ป่วยรายวัน
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-right text-xs font-semibold text-slate-600">
          <div className="font-black text-slate-800">
            {chartSession ? `รอบเหตุการณ์ที่ ${chartSession.session_number || chartSession.id}` : "ข้อมูลโรคล่าสุด"}
          </div>
          <div>{chartSession ? formatSessionPeriod(chartSession) || "ช่วงวันที่ตามข้อมูล" : "จากฐานข้อมูลรายงานโรค"}</div>
        </div>
      </div>

      <DailyDiseaseChart sessionId={chartSession?.id} />
    </section>
  );
}

function SeverityBadge({ level }) {
  const styles = {
    critical: "bg-red-100 text-red-700",
    high: "bg-orange-100 text-orange-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-emerald-100 text-emerald-700"
  };
  const labels = {
    critical: "รุนแรงมาก",
    high: "รุนแรง",
    medium: "ปานกลาง",
    low: "เฝ้าระวัง"
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-bold ${styles[level] || styles.low}`}>{labels[level] || "เฝ้าระวัง"}</span>;
}

function getOverviewMetric(overview, key) {
  const metric = overview?.summary?.find((item) => item.key === key);
  return Number(metric?.value) || 0;
}

function buildSessionOptions(eocType, sessions, overviewItems) {
  const normalizedType = normalizeEocTypeForSession(eocType);
  const filteredSessions = (sessions || [])
    .filter((session) => session.eoc_type === normalizedType)
    .map((session) => ({
      ...session,
      label: `${formatEocDisplayName(session)} Session #${session.session_number || session.id}`,
      opened_at: normalizeDateKey(session.opened_at),
      closed_at: normalizeDateKey(session.closed_at)
    }));

  if (filteredSessions.length > 0) return filteredSessions;

  const overview = overviewItems.find((item) => item.eoc_type === normalizedType);
  if (!overview?.session_id && !overview?.period?.first_date) return [];

  return [{
    id: overview.session_id || `${normalizedType}-overview`,
    eoc_type: normalizedType,
    session_number: overview.session_number || "-",
    status: overview.session_status || "overview",
    disease_id: overview.disease_id,
    disease_name: overview.disease_name,
    label: overview.session_number ? `${formatEocDisplayName(overview)} Session #${overview.session_number}` : "ข้อมูลรวม",
    opened_at: normalizeDateKey(overview.opened_at || overview.period?.first_date),
    closed_at: normalizeDateKey(overview.closed_at || overview.period?.last_date),
    isOverviewFallback: true
  }];
}

function normalizeEocTypeForSession(eocType) {
  return eocType === "accident" ? "festival-accidents" : eocType;
}

function buildEocDateOptions(eocType, overviewItems, selectedSession) {
  const normalizedType = eocType === "accident" ? "festival-accidents" : eocType;
  const overview = overviewItems.find((item) => item.eoc_type === normalizedType);
  if (!overview) return [];
  const startDate = normalizeDateKey(selectedSession?.opened_at || overview?.opened_at || overview?.period?.first_date) || getTodayDateKey();
  const today = getTodayDateKey();
  const endDate = selectedSession?.closed_at || (selectedSession?.status === "active" ? today : "") || overview?.closed_at || overview?.period?.last_date || today;
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  if (!start || !end) return [];

  const safeEnd = start > end ? start : end;
  const dates = [];
  let cursor = start;
  let dayNumber = 1;
  while (cursor <= safeEnd && dates.length < 370) {
    const date = dateToKey(cursor);
    dates.push({
      date,
      dayNumber,
      weekday: cursor.toLocaleDateString("th-TH", { weekday: "short" }),
      shortDate: cursor.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
      isToday: date === today
    });
    cursor = addDays(cursor, 1);
    dayNumber += 1;
  }
  return dates;
}

function normalizeDateKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:$|\s)/.test(value)) {
    return value.slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dateToKey(date);
}

function getTodayDateKey() {
  return dateToKey(new Date());
}

function parseDateKey(value) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateToKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function buildIncidentTimeline(incidents, selectedDate) {
  return incidents.slice(0, 5).map((incident) => ({
    date: formatThaiDateOnly((incident.occurred_at || incident.reported_at || selectedDate).slice?.(0, 10) || selectedDate),
    time: new Date(incident.occurred_at || incident.reported_at || `${selectedDate}T08:00:00`).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
    type: incident.report_type === "traffic_report" ? "เส้นทางสัญจร" : incident.disaster_type === "disease" ? "โรคระบาด" : "น้ำท่วม",
    area: [incident.district, incident.sub_district || incident.village].filter(Boolean).join(" ") || "-",
    detail: incident.description || "รายงานจากประชาชน",
    severity: incident.urgency || "low",
    status: incident.status === "resolved" ? "แก้ไขแล้ว" : incident.status === "verified" ? "ยืนยันแล้ว" : "รอตรวจสอบ"
  }));
}

function HomeSituationDashboard({
  activeEOCs,
  dashboardSummary,
  floodStats,
  accidentStats,
  diseaseStats,
  loading,
  getEOCTypeName,
  getEOCTypeIcon,
  formatDate,
  lastUpdated,
  diseaseChartSession
}) {
  const hasActiveEOC = activeEOCs.length > 0;
  const primaryEOC = activeEOCs[0];
  const primaryDisasterType = mapEocTypeToPublicDisasterType(primaryEOC?.eoc_type);
  const activeTypesText = hasActiveEOC
    ? activeEOCs.map((eoc) => getEOCTypeName(eoc)).join(", ")
    : "เฝ้าระวังสถานการณ์ทั่วไป";

  const summaryCards = [
    {
      icon: "🚨",
      label: "EOC เปิดอยู่",
      value: dashboardSummary?.activeEOCs ?? activeEOCs.length,
      unit: "ศูนย์"
    },
    {
      icon: "📝",
      label: "รายงานประชาชน",
      value: dashboardSummary?.publicReports ?? 0,
      unit: "รายการ"
    },
    {
      icon: "👥",
      label: "ผู้ได้รับผลกระทบ",
      value: floodStats?.affected ?? dashboardSummary?.totalAffected ?? 0,
      unit: "คน"
    },
    {
      icon: "🦠",
      label: "ผู้ป่วย/อาการ",
      value: dashboardSummary?.diseasePatients ?? diseaseStats?.patients ?? 0,
      unit: "ราย"
    },
    {
      icon: "🏠",
      label: "ศูนย์พักพิง",
      value: dashboardSummary?.activeShelters ?? 0,
      unit: "แห่ง"
    }
  ];

  const activeTypeStats = [
    {
      show: !!floodStats,
      icon: "💧",
      label: "หมู่บ้านน้ำท่วม",
      value: floodStats?.floodedVillages ?? 0,
      unit: "แห่ง"
    },
    {
      show: !!diseaseStats,
      icon: "😷",
      label: "ผู้ป่วยในระบบ",
      value: diseaseStats?.patients ?? 0,
      unit: "คน"
    },
    {
      show: !!accidentStats,
      icon: "🚗",
      label: "อุบัติเหตุสะสม",
      value: accidentStats?.accidents ?? 0,
      unit: "ครั้ง"
    }
  ].filter((item) => item.show);

  return (
    <section className="mb-8 md:mb-10">
      <div className="mb-4 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 px-1">
        <div>
          <p className="text-sm font-semibold text-emerald-700 mb-1">Situation Dashboard</p>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">แผนที่สถานการณ์จังหวัดสตูล</h2>
          <p className="text-sm md:text-base text-gray-600 mt-1">
            {loading ? "กำลังตรวจสอบสถานะ EOC..." : activeTypesText}
          </p>
          {lastUpdated && (
            <p className="text-xs text-gray-500 mt-1">อัปเดตข้อมูลล่าสุด {formatDate(lastUpdated)}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/public/report-incident"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 text-sm font-bold shadow-sm transition-colors"
          >
            <span>⚡</span>
            <span>แจ้งเหตุ</span>
          </Link>
          <Link
            href="/public/disaster-map"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 px-4 py-2.5 text-sm font-bold shadow-sm transition-colors"
          >
            <span>🗺️</span>
            <span>เปิดแผนที่เต็ม</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 md:gap-5">
        <div className="min-h-[520px]">
          <PublicIncidentMap disasterType={primaryDisasterType} />
        </div>

        <aside className="space-y-4">
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-900">ภาพรวมขณะนี้</h3>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${hasActiveEOC ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                {hasActiveEOC ? "เปิด EOC" : "ปกติ"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {summaryCards.map((card) => (
                <DashboardMetricCard key={card.label} {...card} />
              ))}
            </div>
          </div>

          {activeTypeStats.length > 0 && (
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3">ตัวชี้วัดตามภัย</h3>
              <div className="space-y-2">
                {activeTypeStats.map((item) => (
                  <div key={item.label} className="flex items-center justify-between border-t border-gray-100 first:border-t-0 py-2.5">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-xl">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    <div className="font-bold text-gray-900">
                      {formatNumber(item.value)} <span className="text-xs font-normal text-gray-500">{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3">EOC ที่เปิดใช้งาน</h3>
            {hasActiveEOC ? (
              <div className="space-y-3">
                {activeEOCs.map((eoc) => {
                  const style = getEOCStyle(eoc.eoc_type);
                  return (
                    <Link
                      href="/public/disaster-map"
                      key={eoc.eoc_type}
                      className="block rounded-lg p-3 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg ${style.bg} flex items-center justify-center text-2xl`}>
                          {getEOCTypeIcon(eoc.eoc_type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 font-bold text-gray-900">
                            <span className={`h-2.5 w-2.5 rounded-full ${style.accent || "bg-gray-500"}`}></span>
                            <span>{getEOCTypeName(eoc)}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">เปิดเมื่อ {formatDate(eoc.activated_at)} น.</div>
                          {eoc.description && <div className="text-xs text-gray-600 mt-1 line-clamp-2">{eoc.description}</div>}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-3 text-center rounded-lg bg-emerald-50 border border-emerald-100">
                <div className="text-3xl mb-2">✅</div>
                <p className="font-semibold text-emerald-800">ไม่มี EOC ที่เปิดอยู่</p>
                <p className="text-sm text-emerald-700 mt-1">ระบบยังแสดงแผนที่รายงานที่ยืนยันแล้วเพื่อการติดตาม</p>
              </div>
            )}
          </div>

          {dashboardSummary?.announcements?.length > 0 && (
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3">ประกาศล่าสุด</h3>
              <div className="space-y-3">
                {dashboardSummary.announcements.map((item) => (
                  <div key={item.id} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                    <div className="font-semibold text-gray-900 text-sm">{item.title}</div>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <DiseaseChartSection chartSession={diseaseChartSession} />
    </section>
  );
}

function formatOverviewDateRange(period) {
  if (!period?.first_date && !period?.last_date) return "";
  const start = formatThaiDateOnly(period.first_date);
  const end = formatThaiDateOnly(period.last_date);
  if (start && end && start !== end) return `${start} - ${end}`;
  return start || end;
}

function formatSessionPeriod(session) {
  if (!session?.opened_at && !session?.closed_at) return "";
  const start = formatThaiDateOnly(session.affected_period_start || session.opened_at);
  const end = formatThaiDateOnly(session.affected_period_end || session.closed_at || getTodayDateKey());
  if (start && end && start !== end) return `${start} - ${end}`;
  return start || end;
}

function formatThaiDateOnly(value) {
  if (!value) return "";
  const date = typeof value === "string"
    ? new Date(value.includes("T") ? value : `${value.slice(0, 10)}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function SeicsMetric({ label, value, tone }) {
  const tones = {
    sky: "text-sky-700",
    red: "text-red-600",
    amber: "text-amber-600",
    emerald: "text-emerald-700"
  };

  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <div className={`text-2xl font-black leading-none ${tones[tone] || "text-white"}`}>{formatNumber(value)}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

function InfoMini({ label, value }) {
  return (
    <div className="border-r border-blue-100 px-2 last:border-r-0">
      <div className="text-xs font-semibold text-blue-600">{label}</div>
      <div className="mt-1 text-sm font-black text-blue-950">{value}</div>
    </div>
  );
}

function InfoStat({ label, value, unit }) {
  return (
    <div className="px-2">
      <div className="text-3xl font-black leading-none text-blue-700">{formatNumber(value)}</div>
      <div className="mt-1 text-xs font-semibold text-slate-500">{unit}</div>
      <div className="mt-0.5 text-xs text-slate-600">{label}</div>
    </div>
  );
}

function AlertItem({ tone, title, subtitle }) {
  const styles = {
    red: "text-red-700",
    orange: "text-orange-700",
    amber: "text-amber-700"
  };

  return (
    <div className={`flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0 ${styles[tone] || styles.amber}`}>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p>
      </div>
      <span className="text-xl">›</span>
    </div>
  );
}

function PublicHeroMetric({ eyebrow, title, value, unit, description }) {
  return (
    <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-50/80">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
      <div className="mt-4 text-4xl font-black leading-none text-white">{formatNumber(value)}</div>
      <div className="mt-1 text-sm font-semibold text-blue-50/90">{unit}</div>
      <p className="mt-3 text-sm leading-6 text-blue-50/85">{description}</p>
    </div>
  );
}

function PublicMiniMetric({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-3">
      <div className="text-2xl font-black leading-none text-white">{formatNumber(value)}</div>
      <div className="mt-1 text-xs font-semibold text-blue-50/80">{label}</div>
    </div>
  );
}

function PublicStatCard({ label, value, unit, tone }) {
  const tones = {
    blue: "from-blue-50 to-white border-blue-100 text-blue-800",
    red: "from-rose-50 to-white border-rose-100 text-rose-700",
    amber: "from-amber-50 to-white border-amber-100 text-amber-700",
    emerald: "from-emerald-50 to-white border-emerald-100 text-emerald-700"
  };

  return (
    <div className={`rounded-[24px] border bg-gradient-to-br p-5 shadow-[0_16px_42px_rgba(15,23,42,0.06)] ${tones[tone] || tones.blue}`}>
      <div className="text-sm font-bold text-slate-500">{label}</div>
      <div className="mt-3 text-4xl font-black leading-none">{formatNumber(value)}</div>
      <div className="mt-2 text-sm font-semibold text-slate-500">{unit}</div>
    </div>
  );
}

function PublicActionCard({ item }) {
  const tones = {
    red: "border-red-100 bg-red-50/70 hover:border-red-200",
    blue: "border-blue-100 bg-blue-50/70 hover:border-blue-200",
    emerald: "border-emerald-100 bg-emerald-50/70 hover:border-emerald-200"
  };

  return (
    <Link
      href={item.href}
      className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${tones[item.tone] || tones.blue}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-slate-900">{item.title}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">{item.icon}</span>
      </div>
    </Link>
  );
}

function EmergencyContactCard({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <strong className="text-lg font-black text-red-700">{value}</strong>
    </div>
  );
}

function DashboardMetricCard({ icon, label, value, unit }) {
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
        <span className="text-xl">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 leading-none">
        {formatNumber(value)}
      </div>
      <div className="text-xs text-gray-500 mt-1">{unit}</div>
    </div>
  );
}

function QuickActionLink({ action }) {
  const style = EOC_STYLE_CLASSES[action.color] || EOC_STYLE_CLASSES.default;

  return (
    <Link
      href={action.link}
      className={`bg-gradient-to-br ${style.quick} border-2 rounded-lg md:rounded-xl shadow-md p-4 md:p-6 text-center transition-all hover:shadow-xl hover:scale-105 group`}
    >
      <div className="text-4xl md:text-5xl mb-3 md:mb-4 group-hover:scale-110 transition-transform">{action.icon}</div>
      <h3 className="font-bold text-base md:text-lg text-gray-800">{action.title}</h3>
    </Link>
  );
}

function getEOCStyle(type) {
  return EOC_STYLE_CLASSES[type] || EOC_STYLE_CLASSES.default;
}

function formatNumber(value) {
  const number = Number(value) || 0;
  return number.toLocaleString("th-TH");
}

// Infographic Carousel Component
function InfographicCarousel({ infographics, eocType, lightMode = false }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const autoPlayRef = useRef(null);

  // Auto-play functionality
  useEffect(() => {
    if (isAutoPlaying) {
      autoPlayRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % infographics.length);
      }, 5000); // เปลี่ยนทุก 5 วินาที
    }

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [isAutoPlaying, infographics.length]);

  const goToSlide = (index) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false); // หยุด auto-play เมื่อผู้ใช้คลิก
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + infographics.length) % infographics.length);
    setIsAutoPlaying(false);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % infographics.length);
    setIsAutoPlaying(false);
  };

  const toggleAutoPlay = () => {
    setIsAutoPlaying(!isAutoPlaying);
  };

  // ถ้าไม่มี infographics แสดง placeholder
  if (!infographics || infographics.length === 0) {
    return (
      <div className={`rounded-lg ${lightMode ? 'bg-gray-50 border border-gray-200' : 'bg-white/10'} backdrop-blur-sm`}>
        <div className="flex aspect-video flex-col items-center justify-center p-8 text-center">
          <div className="text-6xl md:text-8xl mb-4 opacity-50">📊</div>
          <p className={`${lightMode ? 'text-gray-700' : 'text-white'} text-lg md:text-2xl font-bold mb-2`}>ยังไม่มี Infographic</p>
          <p className={`${lightMode ? 'text-gray-600' : 'text-white/85'} text-sm md:text-base`}>
            รอดำเนินการโดยฝ่าย Risk Communication
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Main Carousel */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {infographics.map((infographic) => (
            <div key={infographic.id} className="w-full flex-shrink-0">
              <div className={`flex w-full aspect-video items-center justify-center ${lightMode ? 'bg-gray-50' : 'bg-white/10'}`}>
                {/* แสดงรูป Infographic */}
                <Image
                  src={getPublicAssetPath(infographic.image)}
                  alt={infographic.alt}
                  width={1280}
                  height={720}
                  sizes="(max-width: 768px) 100vw, 900px"
                  className="h-full w-full object-contain"
                  unoptimized
                  onError={(e) => {
                    // Fallback ถ้ารูปโหลดไม่ได้
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = `
                      <div class="flex h-full w-full flex-col items-center justify-center p-8 text-center">
                        <div class="text-6xl md:text-8xl mb-4 opacity-50">📊</div>
                        <p class="${lightMode ? 'text-gray-700' : 'text-white'} text-lg md:text-2xl font-bold mb-2">${infographic.alt}</p>
                        <p class="${lightMode ? 'text-gray-600' : 'text-white/85'} text-sm md:text-base mb-4">ไม่สามารถโหลดรูปภาพได้</p>
                      </div>
                    `;
                  }}
                />
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Navigation Buttons */}
      <button
        onClick={goToPrevious}
        className={`absolute left-2 md:left-4 top-1/2 -translate-y-1/2 ${lightMode ? 'bg-white hover:bg-gray-50 text-gray-800 shadow-sm border border-gray-200' : 'bg-black/30 hover:bg-black/40 text-white'} backdrop-blur-sm rounded-full p-2 md:p-3 transition-colors z-10`}
        aria-label="Previous slide"
      >
        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        onClick={goToNext}
        className={`absolute right-2 md:right-4 top-1/2 -translate-y-1/2 ${lightMode ? 'bg-white hover:bg-gray-50 text-gray-800 shadow-sm border border-gray-200' : 'bg-black/30 hover:bg-black/40 text-white'} backdrop-blur-sm rounded-full p-2 md:p-3 transition-colors z-10`}
        aria-label="Next slide"
      >
        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Controls and Indicators */}
      <div className="flex items-center justify-between mt-3 md:mt-4">
        {/* Slide Indicators */}
        <div className="flex gap-2">
          {infographics.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-2 rounded-full transition-all ${index === currentIndex
                ? (lightMode ? 'w-8 bg-gray-600' : 'w-8 bg-white')
                : (lightMode ? 'w-2 bg-gray-400 hover:bg-gray-500' : 'w-2 bg-white/60 hover:bg-white/80')
                }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Auto-play Toggle */}
        <button
          onClick={toggleAutoPlay}
          className={`flex items-center gap-2 ${lightMode ? 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50' : 'bg-white/20 hover:bg-white/30 text-white'} backdrop-blur-sm px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold transition-all`}
        >
          {isAutoPlaying ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
              <span className="hidden md:inline">หยุดอัตโนมัติ</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="hidden md:inline">เล่นอัตโนมัติ</span>
            </>
          )}
        </button>
      </div>

      {/* Slide Counter */}
      <div className={`text-center mt-2 ${lightMode ? 'text-gray-500' : 'text-white/80'} text-xs md:text-sm`}>
        {currentIndex + 1} / {infographics.length}
      </div>
    </div>
  );
}

// Component สำหรับแสดงสถิติ
function StatCard({ icon, title, value, unit = "", color }) {
  return (
    <div className={`bg-gradient-to-br ${color} text-white rounded-lg shadow-lg p-4 md:p-6 hover:scale-105 transition-transform`}>
      <div className="text-3xl md:text-4xl mb-1 md:mb-2">{icon}</div>
      <div className="text-2xl md:text-3xl font-bold mb-1">
        {value} {unit && <span className="text-base md:text-xl">{unit}</span>}
      </div>
      <div className="text-xs md:text-sm opacity-90">{title}</div>
    </div>
  );
}

// Component สำหรับลิงก์ด่วน - Enhanced
function QuickLinkCard({ icon, title, description, link, color = "gray" }) {
  const colorClasses = {
    blue: "from-blue-50 to-blue-100 border-blue-200 hover:border-blue-300",
    cyan: "from-cyan-50 to-cyan-100 border-cyan-200 hover:border-cyan-300",
    orange: "from-orange-50 to-orange-100 border-orange-200 hover:border-orange-300",
    green: "from-green-50 to-green-100 border-green-200 hover:border-green-300",
    gray: "from-gray-50 to-gray-100 border-gray-200 hover:border-gray-300"
  };

  return (
    <Link
      href={link}
      className={`bg-gradient-to-br ${colorClasses[color]} border-2 rounded-lg md:rounded-xl shadow-md p-4 md:p-6 text-center transition-all hover:shadow-xl hover:scale-105 group`}
    >
      <div className="text-4xl md:text-5xl mb-3 md:mb-4 group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="font-bold text-base md:text-lg text-gray-800 mb-1 md:mb-2">{title}</h3>
      {description && <p className="text-xs md:text-sm text-gray-600">{description}</p>}
    </Link>
  );
}
