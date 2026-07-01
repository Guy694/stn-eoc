"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import AnnouncementPopup from "@/components/AnnouncementPopup";
import SplashScreen from "@/components/SplashScreen";
import AIChatbot from "@/components/AIChatbot";
import PDPAConsent from "@/components/PDPAConsent";
import dynamic from "next/dynamic";

const FestivalPublicDashboard = dynamic(() => import("@/components/festival/FestivalPublicDashboard"), { ssr: false });
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
          setActiveEOCs(active);
          setEocLastUpdated(new Date());

          // ถ้ามี EOC เปิดอยู่ตั้งค่า eocStatus เป็น true
          if (active.length > 0) {
            // ใช้ EOC แรกที่เปิด หรือจะใช้ที่เปิดล่าสุด
            const latestEOC = [...active].sort((a, b) =>
              new Date(b.activated_at) - new Date(a.activated_at)
            )[0];

            setEocStatus({
              isOpen: true,
              openedDate: latestEOC.activated_at,
              reason: latestEOC.description || `เปิดศูนย์ EOC ${getEOCTypeName(latestEOC.eoc_type)}`
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
            data[type] = result.data;
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
  const getEOCTypeName = (type) => {
    const names = {
      flood: 'น้ำท่วม',
      disease: 'โรคระบาด',
      accident: 'อุบัติเหตุ',
      'festival-accidents': 'อุบัติเหตุช่วงเทศกาล'
    };
    return names[type] || type;
  };

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
          { icon: "🏘️", title: "ศูนย์พักพิงชั่วคราว", link: "/eoc/flood/shelters", color: "green" }
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
          { icon: "🗺️", title: "แผนที่อุบัติเหตุ", link: "/eoc/accident", color: "orange" },
          { icon: "📝", title: "บันทึกข้อมูล", link: "/eoc/accident/records", color: "red" },
          { icon: "🏥", title: "จุดบริการ", link: "/eoc/accident/service-points", color: "blue" }
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
          { icon: "🦠", title: "แผนที่โรคระบาด", link: "/eoc/disease", color: "teal" },
          { icon: "💉", title: "จุดฉีดวัคซีน", link: "/eoc/village-map", color: "green" },
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
          incident.description,
          incident.first_name,
          incident.last_name
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
  const latestActiveEOC = activeEOCs[0];
  const lastUpdatedAt = summaryLastUpdated || eocLastUpdated;

  if (process.env.NEXT_PUBLIC_EOC_LEGACY_HOME !== "true") {
    return (
      <div className="public-flood-shell h-screen w-screen overflow-hidden bg-slate-100 text-slate-900">
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
        <AnnouncementPopup />

        <header className="h-16 border-b border-blue-950/20 bg-[#073b78] text-white shadow-lg">
          <div className="flex h-full items-center justify-between gap-4 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex items-center gap-3">
                <Image src="/stn-eoc/img/logo.png" alt="Satun Public Flood Map" width={48} height={48} className="h-12 w-12 rounded-full bg-white p-1" priority />
                <div className="min-w-0 sm:hidden">
                  <div className="truncate text-sm font-bold leading-5">แผนที่สาธารณะอุทกภัย</div>
                  <div className="truncate text-xs text-blue-100">จังหวัดสตูล</div>
                </div>
                <div className="hidden sm:block">
                  <div className="truncate text-lg font-bold leading-6">ระบบแผนที่สาธารณะเหตุอุทกภัย จังหวัดสตูล</div>
                  <div className="truncate text-sm text-blue-100">Satun Public Flood Emergency Map</div>
                </div>
              </div>
              <span className="hidden rounded-full bg-blue-500 px-3 py-1 text-xs font-bold text-white lg:inline-flex">สำหรับประชาชน</span>
            </div>

            <nav className="hidden min-w-0 items-center gap-5 text-sm font-semibold lg:flex">
              {[
                ["หน้าหลัก", "/"],
                ["แผนที่สาธารณะ", "/public/disaster-map"],
                ["รายงานสถานการณ์", "/public/disaster-map"],
                ["ข่าวสาร/ประกาศ", "/public/help"],
                ["คำแนะนำ", "/public/help/citizen-guide"],
                ["เกี่ยวกับเรา", "/public/help/faq"]
              ].map(([label, href]) => (
                <Link key={label} href={href} className="whitespace-nowrap text-blue-50 transition-colors hover:text-white">
                  {label}
                </Link>
              ))}
            </nav>

            <div className="hidden shrink-0 border-l border-white/20 pl-4 text-xs text-blue-100 xl:block">
              <div>อัปเดตล่าสุด</div>
              <div className="font-semibold text-white">{lastUpdatedAt ? formatDate(lastUpdatedAt) : "กำลังตรวจสอบ"}</div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link href="/public/report-incident" className="hidden rounded-md bg-red-600 px-3 py-2 text-sm font-bold text-white shadow-lg transition-colors hover:bg-red-700 md:inline-flex">
                แจ้งเหตุ
              </Link>
              <Link href="/login" className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15">
                ADMIN
              </Link>
            </div>
          </div>
        </header>

        <div className="grid h-[calc(100vh-64px)] min-h-0 grid-cols-[280px_minmax(0,1fr)_420px] gap-2 p-2 max-xl:grid-cols-[280px_minmax(0,1fr)] max-lg:grid-cols-1 max-lg:overflow-y-auto">
          <nav className="hidden">
            {[
              { href: "/", label: "หน้าหลัก", icon: "⌂" },
              { href: "/public/disaster-map", label: "แผนที่", icon: "▦" },
              { href: "/public/report-incident", label: "แจ้งเหตุ", icon: "✚" },
              { href: "/public/help", label: "ช่วยเหลือ", icon: "?" },
              { href: "/login", label: "เข้าสู่ระบบ", icon: "⚙" }
            ].map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex h-12 w-full items-center justify-center border-b border-white/5 text-lg transition-colors ${index === 1 ? "bg-sky-500/25 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
              >
                {item.icon}
              </Link>
            ))}
          </nav>

          <aside className="public-filter-panel flex min-h-0 flex-col rounded-lg border border-blue-100 bg-white shadow-sm max-lg:order-2 max-lg:h-[420px]">
            <div className="border-b border-blue-100 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-blue-700">เลือกข้อมูลที่ต้องการแสดง</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">ฟิลเตอร์การแสดงผล</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDisasterType("flood");
                    setUrgencyFilter("all");
                    setReportTypeFilter("all");
                    setDistrictFilter("all");
                    setMapSearchQuery("");
                    setMapLayers({ district: true, tambon: false, village: false, labels: true });
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  รีเซ็ตทั้งหมด
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <section className="space-y-3 border-b border-slate-200 pb-4">
                <h3 className="text-sm font-bold text-slate-800">ประเภทข้อมูล</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "flood", label: "น้ำท่วม" },
                    { key: "disease", label: "โรค" },
                    { key: "accident", label: "อุบัติเหตุ" }
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedDisasterType(item.key)}
                      className={`rounded-md border px-2 py-2 text-xs font-semibold transition-colors ${selectedDisasterType === item.key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-blue-900 hover:bg-blue-50"}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3 border-b border-slate-200 py-4">
                <h3 className="text-sm font-bold text-slate-800">ระดับน้ำท่วม / ความรุนแรง</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "all", label: "ทั้งหมด" },
                    { key: "critical", label: "วิกฤต" },
                    { key: "high", label: "เร่งด่วน" },
                    { key: "medium", label: "ปานกลาง" },
                    { key: "low", label: "ไม่เร่งด่วน" }
                  ].map((item) => (
                    <label key={item.key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="urgency"
                        checked={urgencyFilter === item.key}
                        onChange={() => setUrgencyFilter(item.key)}
                        className="h-4 w-4 accent-sky-500"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-3 border-b border-slate-200 py-4">
                <h3 className="text-sm font-bold text-slate-800">การแสดงผลแผนที่</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "district", label: "อำเภอ" },
                    { key: "tambon", label: "ตำบล" },
                    { key: "village", label: "หมู่บ้าน" },
                    { key: "labels", label: "ชื่อพื้นที่" }
                  ].map((item) => (
                    <label key={item.key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={mapLayers[item.key]}
                        onChange={(event) => setMapLayers((current) => ({ ...current, [item.key]: event.target.checked }))}
                        className="h-4 w-4 accent-sky-500"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-3 border-b border-slate-200 py-4">
                <h3 className="text-sm font-bold text-slate-800">พื้นที่และประเภทรายงาน</h3>
                <select
                  value={districtFilter}
                  onChange={(event) => setDistrictFilter(event.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="all">เลือกอำเภอทั้งหมด</option>
                  {publicDistricts.map((district) => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
                <select
                  value={reportTypeFilter}
                  onChange={(event) => setReportTypeFilter(event.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="all">รายงานทุกประเภท</option>
                  <option value="help_request">ขอความช่วยเหลือ</option>
                  <option value="traffic_report">เส้นทางสัญจร</option>
                </select>
              </section>

              <section className="space-y-3 border-b border-slate-200 py-4">
                <h3 className="text-sm font-bold text-slate-800">ข้อมูลสถานการณ์ปัจจุบัน</h3>
                <div className="grid grid-cols-2 gap-3">
                  <SeicsMetric label="รายงาน" value={visiblePublicIncidents.length} tone="sky" />
                  <SeicsMetric label="วิกฤต" value={criticalCount} tone="red" />
                  <SeicsMetric label="เร่งด่วน" value={highCount} tone="amber" />
                  <SeicsMetric label="EOC เปิด" value={activeEOCs.length} tone="emerald" />
                </div>
                <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-950">
                  <div className="flex items-center justify-between gap-3">
                    <span>สถานะศูนย์</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${eocStatus.isOpen ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}`}>
                      {eocStatus.isOpen ? "เปิดใช้งาน" : "ปกติ"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{latestActiveEOC ? getEOCTypeName(latestActiveEOC.eoc_type) : "เฝ้าระวังสถานการณ์ทั่วไป"}</p>
                  {lastUpdatedAt && <p className="mt-1 text-xs text-slate-500">อัปเดตล่าสุด {formatDate(lastUpdatedAt)}</p>}
                </div>
              </section>

              <section className="space-y-3 py-4">
                <h3 className="text-sm font-bold text-slate-800">อำเภอ</h3>
                <select
                  value={districtFilter}
                  onChange={(event) => setDistrictFilter(event.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="all">ทั้งหมด</option>
                  {publicDistricts.map((district) => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
                <Link href="/public/disaster-map" className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
                  ไปยังแผนที่สาธารณะเต็มจอ
                </Link>
                <h3 className="pt-2 text-sm font-bold text-slate-800">หมายเลขฉุกเฉิน</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    ["191", "ตำรวจ"],
                    ["1669", "EMS"],
                    ["199", "ดับเพลิง"],
                    ["1784", "ปภ."]
                  ].map(([phone, label]) => (
                    <div key={phone} className="rounded-md bg-slate-50 px-3 py-2">
                      <div className="text-lg font-black text-blue-700">{phone}</div>
                      <div className="text-xs text-slate-500">{label}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </aside>

          <main className="relative min-w-0 overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm max-lg:h-[620px]">
            <div className="absolute left-4 top-4 z-[450] max-w-[calc(100%-2rem)] rounded-lg bg-white/95 px-4 py-3 text-slate-900 shadow-lg backdrop-blur max-md:left-3 max-md:right-3 max-md:top-16 max-md:px-3 max-md:py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Public Situation Map</p>
              <h2 className="text-base font-bold md:text-xl">แผนที่สถานการณ์อุทกภัย จังหวัดสตูล (สด)</h2>
            </div>

            <div className="absolute right-4 top-4 z-[450] flex w-[min(360px,calc(100%-2rem))] gap-2 max-md:left-14 max-md:right-3 max-md:w-auto">
              <input
                value={mapSearchQuery}
                onChange={(event) => setMapSearchQuery(event.target.value)}
                placeholder="Search"
                className="min-w-0 flex-1 rounded-md border border-blue-100 bg-white/95 px-4 py-2 text-sm text-slate-800 shadow-lg outline-none backdrop-blur placeholder:text-slate-400 focus:border-blue-500"
              />
              <button type="button" className="rounded-md border border-blue-100 bg-white/95 px-3 py-2 text-blue-700 shadow-lg backdrop-blur">
                ▦
              </button>
            </div>

            <PublicIncidentMap
              disasterType={selectedDisasterType}
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

            <div className="absolute left-5 top-24 z-[450] hidden rounded-lg bg-white/95 p-3 text-sm text-slate-800 shadow-lg backdrop-blur md:block">
              <div className="mb-2 font-bold">สัญลักษณ์แผนที่</div>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-blue-600"></span> จุดเกิดเหตุน้ำท่วม</div>
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-yellow-400"></span> พื้นที่เฝ้าระวัง</div>
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500"></span> ศูนย์พักพิง / จุดช่วยเหลือ</div>
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500"></span> จุดปิดการจราจร / เร่งด่วน</div>
              </div>
            </div>

            <div className="absolute bottom-5 left-5 z-[450] hidden rounded-md bg-white/95 p-3 text-sm text-slate-800 shadow-xl backdrop-blur md:block">
              <div className="mb-2 font-bold">ข้อมูลสาธารณะ</div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs text-slate-600">
                <span>ขอความช่วยเหลือ</span><strong className="text-slate-900">{helpRequestCount}</strong>
                <span>เส้นทางสัญจร</span><strong className="text-slate-900">{trafficReportCount}</strong>
                <span>พื้นที่แสดงผล</span><strong className="text-slate-900">{districtFilter === "all" ? "ทุกอำเภอ" : districtFilter}</strong>
              </div>
            </div>

            <div className="absolute bottom-5 right-5 z-[450] hidden max-w-md rounded-lg border border-blue-200 bg-blue-50/95 p-3 text-sm text-blue-950 shadow-xl backdrop-blur 2xl:block">
              <div className="grid grid-cols-[1fr_140px] items-center gap-3">
                <div>
                  <h3 className="font-bold">คำแนะนำสำหรับประชาชน</h3>
                  <ul className="mt-1 list-inside list-disc text-xs text-blue-900">
                    <li>ติดตามข่าวสารและประกาศจากทางราชการอย่างใกล้ชิด</li>
                    <li>หากพบเหตุฉุกเฉิน โทร 1784 หรือหน่วยงานในพื้นที่ทันที</li>
                    <li>เตรียมของมีค่า เอกสารสำคัญ และยาประจำตัวให้พร้อม</li>
                  </ul>
                </div>
                <div className="rounded-md bg-blue-100 px-3 py-2 text-center text-xs font-bold text-blue-700">
                  เตรียมพร้อม<br />อพยพเมื่อจำเป็น
                </div>
              </div>
            </div>
          </main>

          <aside className="public-info-panel flex min-h-0 flex-col gap-2 overflow-y-auto max-xl:col-span-2 max-xl:grid max-xl:grid-cols-2 max-lg:order-3 max-lg:col-span-1 max-lg:grid-cols-1">
            <section className="rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-blue-800">สถานการณ์อุทกภัยจังหวัดสตูล</p>
                  <h2 className="mt-1 text-xl font-black text-blue-900">ศูนย์บัญชาการเหตุการณ์ (EOC)</h2>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${eocStatus.isOpen ? "bg-blue-600 text-white" : "bg-emerald-600 text-white"}`}>
                  {eocStatus.isOpen ? "เปิดทำการ" : "เฝ้าระวัง"}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-y border-blue-100 py-3 text-center">
                <InfoMini label="วันที่เปิด EOC" value={eocStatus.openedDate ? formatDate(eocStatus.openedDate).split(" ")[0] : "-"} />
                <InfoMini label="เวลาเปิด" value={eocStatus.openedDate ? new Date(eocStatus.openedDate).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-"} />
                <InfoMini label="เปิดมาแล้ว" value={eocStatus.isOpen ? `${timeElapsed.days} วัน` : "-"} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-y-4 text-center">
                <InfoStat label="เหตุอุทกภัย" value={visiblePublicIncidents.length} unit="จุด" />
                <InfoStat label="อำเภอได้รับผลกระทบ" value={publicDistricts.length} unit="อำเภอ" />
                <InfoStat label="ศูนย์พักพิงที่เปิด" value={dashboardSummary?.activeShelters ?? 0} unit="แห่ง" />
                <InfoStat label="ขอความช่วยเหลือ" value={helpRequestCount} unit="รายการ" />
                <InfoStat label="เส้นทางสัญจร" value={trafficReportCount} unit="จุด" />
                <InfoStat label="หน่วยช่วยเหลือ" value={dashboardSummary?.activeTeams ?? 0} unit="หน่วย" />
              </div>
              {lastUpdatedAt && <p className="mt-4 text-xs text-slate-500">ข้อมูล ณ วันที่ {formatDate(lastUpdatedAt)}</p>}
            </section>

            <section className="rounded-lg border border-red-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold text-red-700">แจ้งเตือนล่าสุด</h3>
                <Link href="/public/help" className="text-xs font-semibold text-blue-600">ดูทั้งหมด →</Link>
              </div>
              <div className="space-y-2">
                <AlertItem tone="red" title="น้ำท่วมฉับพลัน" subtitle={criticalCount > 0 ? `${criticalCount} จุดต้องเฝ้าระวังสูง` : "ติดตามพื้นที่เสี่ยงอย่างใกล้ชิด"} />
                <AlertItem tone="orange" title="ระดับน้ำเพิ่มสูง" subtitle={`${highCount} จุดมีรายงานเร่งด่วน`} />
                <AlertItem tone="amber" title="ถนนน้ำท่วมผ่านไม่ได้" subtitle={`${trafficReportCount} รายงานเส้นทางสัญจร`} />
                <AlertItem tone="amber" title="แจ้งอพยพเฝ้าระวัง" subtitle={districtFilter === "all" ? "ทุกอำเภอ" : districtFilter} />
              </div>
            </section>

            <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-bold text-emerald-800">ศูนย์พักพิงใกล้คุณ</h3>
                  <Link href="/eoc/flood/shelters" className="text-xs font-semibold text-blue-600">ดูทั้งหมด</Link>
                </div>
                <div className="space-y-2 text-sm text-slate-700">
                  {["โรงเรียนบ้านควนโดน", "หอประชุมอำเภอทุ่งหว้า", "โรงเรียนบ้านท่าแพ"].map((name, index) => (
                    <div key={name} className="flex items-center justify-between gap-3">
                      <span><strong className="mr-2 text-emerald-700">{index + 1}</strong>{name}</span>
                      <span className="font-bold text-slate-900">{[2.3, 4.7, 6.1][index]} กม.</span>
                    </div>
                  ))}
                </div>
                <Link href="/public/disaster-map" className="mt-4 flex items-center justify-center rounded-md border border-blue-500 bg-white px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">
                  ค้นหาศูนย์พักพิงบนแผนที่
                </Link>
              </div>

              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <h3 className="mb-3 font-bold text-red-700">เบอร์โทรฉุกเฉิน</h3>
                <div className="space-y-2 text-sm">
                  {[["แจ้งเหตุ-ขอความช่วยเหลือ", "1784"], ["ปภ.จังหวัดสตูล", "074-711-111"], ["ตำรวจ", "191"], ["หน่วยแพทย์ฉุกเฉิน", "1669"]].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 border-b border-red-100 pb-2 last:border-0 last:pb-0">
                      <span className="text-slate-700">{label}</span>
                      <strong className="text-red-700">{value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold text-blue-800">ข่าวสาร / ประกาศ</h3>
                <Link href="/public/help" className="text-xs font-semibold text-blue-600">ดูทั้งหมด</Link>
              </div>
              <div className="space-y-3 text-sm">
                {(dashboardSummary?.announcements?.length ? dashboardSummary.announcements.slice(0, 3) : [
                  { id: "static-1", title: "ประกาศจังหวัดสตูล ฉบับที่ 5/2569", content: "ติดตามประกาศและคำแนะนำจากหน่วยงานราชการ" },
                  { id: "static-2", title: "แจ้งเตือนเฝ้าระวังน้ำท่วมฉับพลัน", content: "ประชาชนในพื้นที่เสี่ยงควรเตรียมพร้อม" },
                  { id: "static-3", title: "รายงานสถานการณ์น้ำประจำวันที่ล่าสุด", content: "สรุปข้อมูลจากระบบรายงานสาธารณะ" }
                ]).map((item) => (
                  <div key={item.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <p className="font-semibold text-slate-800">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.content}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <PDPAConsent />
      </div>
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
                                    {getEOCTypeName(eoc.eoc_type)}
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
                            href={`/eoc/${eoc.eoc_type}`}
                            className={`block w-full px-3 py-2.5 rounded-lg font-semibold text-center transition-all ${style.button} text-white shadow-sm hover:shadow-md text-sm`}
                          >
                            เข้าสู่หน้าศูนย์ปฏิบัติการ →
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
                      คำแนะนำสำหรับประชาชน - <span className={style.label}>{getEOCTypeName(eoc.eoc_type)}</span>
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
                <h2 className="text-lg md:text-2xl font-bold text-gray-800 mb-3 md:mb-4 px-1">📊 สถิติ{getEOCTypeName(eoc.eoc_type)}</h2>
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
                <h2 className="text-lg md:text-2xl font-bold text-gray-800 mb-3 md:mb-4 px-1">🚀 เข้าถึงด่วน - {getEOCTypeName(eoc.eoc_type)}</h2>
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
  lastUpdated
}) {
  const hasActiveEOC = activeEOCs.length > 0;
  const primaryEOC = activeEOCs[0];
  const activeTypesText = hasActiveEOC
    ? activeEOCs.map((eoc) => getEOCTypeName(eoc.eoc_type)).join(", ")
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
      label: "กิจกรรมวันนี้",
      value: dashboardSummary?.todayReports ?? 0,
      unit: "รายการ"
    },
    {
      icon: "👥",
      label: "ผู้ได้รับผลกระทบ",
      value: floodStats?.affected ?? dashboardSummary?.totalAffected ?? 0,
      unit: "คน"
    },
    {
      icon: "⚡",
      label: "ทีมปฏิบัติการ",
      value: dashboardSummary?.activeTeams ?? 0,
      unit: "ทีม"
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
          <PublicIncidentMap disasterType={primaryEOC?.eoc_type === "disease" ? "disease" : "flood"} />
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
                      href={`/eoc/${eoc.eoc_type}`}
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
                            <span>{getEOCTypeName(eoc.eoc_type)}</span>
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
    </section>
  );
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
                  src={infographic.image}
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
