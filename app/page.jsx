"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import AnnouncementPopup from "@/components/AnnouncementPopup";
import SplashScreen from "@/components/SplashScreen";
import AIChatbot from "@/components/AIChatbot";
import PDPAConsent from "@/components/PDPAConsent";
import dynamic from "next/dynamic";

const FestivalPublicDashboard = dynamic(() => import("@/components/festival/FestivalPublicDashboard"), { ssr: false });

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
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

          // ถ้ามี EOC เปิดอยู่ตั้งค่า eocStatus เป็น true
          if (active.length > 0) {
            // ใช้ EOC แรกที่เปิด หรือจะใช้ที่เปิดล่าสุด
            const latestEOC = active.sort((a, b) =>
              new Date(b.activated_at) - new Date(a.activated_at)
            )[0];

            setEocStatus({
              isOpen: true,
              openedDate: latestEOC.activated_at,
              reason: latestEOC.description || `เปิดศูนย์ EOC ${getEOCTypeName(latestEOC.eoc_type)}`
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
    const interval = setInterval(fetchActiveEOCs, 30000);
    return () => clearInterval(interval);
  }, []);

  // ดึงข้อมูล infographics
  useEffect(() => {
    const fetchInfographics = async () => {
      const types = ['flood', 'disease', 'accident'];
      const data = {};

      for (const type of types) {
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
      accident: 'เทศกาล'
    };
    return names[type] || type;
  };

  const getEOCTypeIcon = (type) => {
    const icons = {
      flood: '💧',
      disease: '🦠',
      accident: '🚗'
    };
    return icons[type] || '⚠️';
  };

  const getEOCTypeColor = (type) => {
    const colors = {
      flood: 'from-blue-500 to-cyan-500',
      disease: 'from-purple-500 to-pink-500',
      accident: 'from-orange-500 to-red-600'
    };
    return colors[type] || 'from-gray-500 to-gray-600';
  };

  const getEOCTypeBaseColor = (type) => {
    const colors = {
      flood: 'blue',
      disease: 'purple',
      accident: 'orange'
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
          { icon: "🦠", title: "แผนที่โรคระบาด", link: "/eoc/disease", color: "purple" },
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

  return (
    <div className="min-h-screen bg-pattern">
      {/* Splash Screen */}
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}

      {/* Announcement Popup */}
      <AnnouncementPopup />

      {/* Hero Section - Improved */}
      <header className="bg-gradient-to-r from-green-700 to-green-900 text-white py-8 md:py-16 shadow-lg relative overflow-hidden">
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
            <div className="flex flex-col sm:flex-row gap-2 md:gap-4 w-full md:w-auto">
              <Link
                href="/login"
                className="bg-white hover:bg-gray-100 text-green-700 px-4 py-3 md:px-8 md:py-4 rounded-lg md:rounded-xl font-bold shadow-xl transition-all hover:shadow-2xl hover:scale-105 text-center text-sm md:text-base"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm md:text-2xl">🔐</span>
                  <span>เข้าสู่ระบบ</span>
                </div>
              </Link>
              <Link
                href="/public/disaster-map"
                className="bg-green-600 hover:bg-green-500 text-white px-4 py-3 md:px-8 md:py-4 rounded-lg md:rounded-xl font-bold shadow-xl transition-all hover:shadow-2xl hover:scale-105 text-center text-sm md:text-base"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm md:text-2xl">🗺️</span>
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">กำลังโหลดข้อมูล EOC...</p>
            </div>
          ) : (
            <>
              <div className={`rounded-xl md:rounded-2xl shadow-2xl p-4 md:p-8 relative overflow-hidden mb-4 md:mb-6 ${eocStatus.isOpen
                ? 'bg-gradient-to-r from-red-700 to-orange-700 text-white'
                : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
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
                        <div className={`w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-2xl flex items-center justify-center ${eocStatus.isOpen ? 'bg-white/20 animate-pulse' : 'bg-white/10'
                          } shadow-lg`}>
                          <span className="text-3xl md:text-4xl">{eocStatus.isOpen ? '🚨' : '✅'}</span>
                        </div>
                        <div>
                          <h2 className="text-xl md:text-3xl lg:text-4xl font-bold mb-0.5 md:mb-1">
                            สถานะ EOC: {eocStatus.isOpen ? 'เปิดใช้งาน' : 'ปิด'}
                          </h2>
                          <p className="text-sm md:text-lg lg:text-xl opacity-90">
                            {eocStatus.isOpen ? eocStatus.reason : 'ไม่มีเหตุฉุกเฉิน'}
                          </p>
                        </div>
                      </div>

                      {eocStatus.isOpen && (
                        <div className="bg-white/10 rounded-lg md:rounded-xl p-3 md:p-4 backdrop-blur-sm">
                          <p className="text-xs md:text-sm mb-2 md:mb-3">เปิด EOC เมื่อ: {formatDate(eocStatus.openedDate)} น.</p>
                          <div className="grid grid-cols-3 gap-2 md:gap-4">
                            <div className="text-center bg-white/10 rounded-lg p-2 md:p-3">
                              <div className="text-2xl md:text-4xl font-bold">{timeElapsed.days}</div>
                              <div className="text-xs md:text-sm opacity-80">วัน</div>
                            </div>
                            <div className="text-center bg-white/10 rounded-lg p-2 md:p-3">
                              <div className="text-2xl md:text-4xl font-bold">{timeElapsed.hours}</div>
                              <div className="text-xs md:text-sm opacity-80">ชั่วโมง</div>
                            </div>
                            <div className="text-center bg-white/10 rounded-lg p-2 md:p-3">
                              <div className="text-2xl md:text-4xl font-bold">{timeElapsed.minutes}</div>
                              <div className="text-xs md:text-sm opacity-80">นาที</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {eocStatus.isOpen && (
                      <div className="flex flex-row md:flex-col gap-2 md:gap-3 w-full md:w-auto">
                        <Link
                          href="/public/report-incident"
                          className="bg-white text-red-600 px-4 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105 text-center text-sm md:text-base flex-1 md:flex-none"
                        >
                          ⚡ แบบฟอร์มแจ้งเหตุ
                        </Link>
                        <Link
                          href="/eoc/flood"
                          className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl font-semibold transition-all text-center backdrop-blur-sm border border-white/30 text-sm md:text-base flex-1 md:flex-none"
                        >
                          🗺️ แผนที่สถานการณ์
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Active EOCs List */}
              {activeEOCs.length > 0 && (
                <div className="mb-4 md:mb-6">
                  <h2 className="text-lg md:text-2xl font-bold text-gray-800 mb-3 md:mb-4 px-1">🚨 EOC ที่เปิดใช้งานอยู่ ({activeEOCs.length})</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {activeEOCs.map((eoc) => {
                      const baseColor = getEOCTypeBaseColor(eoc.eoc_type);
                      return (
                        <div
                          key={eoc.eoc_type}
                          className={`bg-white rounded-lg md:rounded-xl shadow-md p-4 md:p-6 hover:shadow-lg transition-all border-l-4 border-${baseColor}-500`}
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-full bg-${baseColor}-50 flex items-center justify-center text-3xl shadow-sm`}>
                                {getEOCTypeIcon(eoc.eoc_type)}
                              </div>
                              <div>
                                <h3 className="text-lg font-bold text-gray-800 leading-tight">
                                  {getEOCTypeName(eoc.eoc_type)}
                                </h3>
                                <p className={`text-xs font-semibold text-${baseColor}-600 tracking-wide`}>
                                  EOC {eoc.eoc_type.toUpperCase()}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className={`px-2 py-0.5 bg-${baseColor}-100 text-${baseColor}-700 rounded-full text-xs font-bold mb-1`}>
                                • เปิดใช้งาน
                              </span>
                            </div>
                          </div>

                          {/* Info */}
                          <div className="space-y-3 mb-4">
                            <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
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
                            className={`block w-full py-2.5 rounded-lg font-semibold text-center transition-all bg-${baseColor}-600 hover:bg-${baseColor}-700 text-white shadow-sm hover:shadow-md text-sm`}
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
          const baseColor = getEOCTypeBaseColor(eoc.eoc_type);

          return (
            <div key={eoc.eoc_type} className="mb-8">
              {/* Infographic Carousel - คำแนะนำสำหรับประชาชน */}
              <section className="mb-4 md:mb-6">
                <div className={`bg-white rounded-lg md:rounded-xl p-4 md:p-6 shadow-md border-t-4 border-${baseColor}-500`}>
                  <div className="flex items-center gap-2 md:gap-3 mb-4 pb-3 border-b border-gray-100">
                    <span className="text-3xl md:text-3xl">{getEOCTypeIcon(eoc.eoc_type)}</span>
                    <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-gray-800">
                      คำแนะนำสำหรับประชาชน - <span className={`text-${baseColor}-600`}>{getEOCTypeName(eoc.eoc_type)}</span>
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
              </section >

              {/* Quick Access เฉพาะ EOC */}
              < section className="mb-4 md:mb-6" >
                <h2 className="text-lg md:text-2xl font-bold text-gray-800 mb-3 md:mb-4 px-1">🚀 เข้าถึงด่วน - {getEOCTypeName(eoc.eoc_type)}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                  {content.quickActions.map((action, idx) => (
                    <Link
                      key={idx}
                      href={action.link}
                      className={`bg-gradient-to-br from-${action.color}-50 to-${action.color}-100 border-2 border-${action.color}-200 hover:border-${action.color}-300 rounded-lg md:rounded-xl shadow-md p-4 md:p-6 text-center transition-all hover:shadow-xl hover:scale-105 group`}
                    >
                      <div className="text-4xl md:text-5xl mb-3 md:mb-4 group-hover:scale-110 transition-transform">{action.icon}</div>
                      <h3 className="font-bold text-base md:text-lg text-gray-800">{action.title}</h3>
                    </Link>
                  ))}
                </div>
              </section >
            </div >
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
          <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg md:rounded-xl shadow-lg p-4 md:p-8 text-center">
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
          <div className="bg-white rounded-lg md:rounded-xl shadow-md p-4 md:p-6 mt-3 md:mt-4">
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
      </main >

      {/* Footer */}
      < footer className="bg-gray-800 text-gray-300 py-4 md:py-6 mt-8 md:mt-12" >
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
      <div className={`relative overflow-hidden rounded-lg ${lightMode ? 'bg-gray-100 border border-gray-200' : 'bg-white/10'} backdrop-blur-sm`}>
        <div className={`relative w-full aspect-video bg-gradient-to-br ${lightMode ? 'from-gray-50 to-gray-100' : 'from-white/20 to-white/5'}`}>
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <div className="text-6xl md:text-8xl mb-4 opacity-50">📊</div>
            <p className={`${lightMode ? 'text-gray-600' : 'text-white'} text-lg md:text-2xl font-bold mb-2`}>ยังไม่มี Infographic</p>
            <p className={`${lightMode ? 'text-gray-500' : 'text-white/80'} text-sm md:text-base`}>
              รอดำเนินการโดยฝ่าย Risk Communication
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Main Carousel */}
      <div className={`relative overflow-hidden rounded-lg ${lightMode ? 'bg-gray-100 border border-gray-200' : 'bg-white/10'} backdrop-blur-sm`}>
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {infographics.map((infographic) => (
            <div key={infographic.id} className="w-full flex-shrink-0">
              <div className={`relative w-full aspect-video bg-gradient-to-br ${lightMode ? 'from-gray-50 to-gray-100' : 'from-white/20 to-white/5'}`}>
                {/* แสดงรูป Infographic */}
                <img
                  src={infographic.image}
                  alt={infographic.alt}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback ถ้ารูปโหลดไม่ได้
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = `
                      <div class="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                        <div class="text-6xl md:text-8xl mb-4 opacity-50">📊</div>
                        <p class="${lightMode ? 'text-gray-600' : 'text-white'} text-lg md:text-2xl font-bold mb-2">${infographic.alt}</p>
                        <p class="${lightMode ? 'text-gray-500' : 'text-white/80'} text-sm md:text-base mb-4">ไม่สามารถโหลดรูปภาพได้</p>
                      </div>
                    `;
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Buttons */}
        <button
          onClick={goToPrevious}
          className={`absolute left-2 md:left-4 top-1/2 -translate-y-1/2 ${lightMode ? 'bg-white/80 hover:bg-white text-gray-800 shadow-sm border border-gray-200' : 'bg-white/30 hover:bg-white/50 text-white'} backdrop-blur-sm rounded-full p-2 md:p-3 transition-all hover:scale-110 z-10`}
          aria-label="Previous slide"
        >
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={goToNext}
          className={`absolute right-2 md:right-4 top-1/2 -translate-y-1/2 ${lightMode ? 'bg-white/80 hover:bg-white text-gray-800 shadow-sm border border-gray-200' : 'bg-white/30 hover:bg-white/50 text-white'} backdrop-blur-sm rounded-full p-2 md:p-3 transition-all hover:scale-110 z-10`}
          aria-label="Next slide"
        >
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

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
                : (lightMode ? 'w-2 bg-gray-300 hover:bg-gray-400' : 'w-2 bg-white/40 hover:bg-white/60')
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


