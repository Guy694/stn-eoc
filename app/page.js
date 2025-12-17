"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";

export default function Home() {
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

  // ดึงข้อมูล EOC ที่เปิดอยู่
  useEffect(() => {
    const fetchActiveEOCs = async () => {
      try {
        const response = await fetch('/api/eoc/status');
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
      drought: 'ภัยแล้ง',
      tsunami: 'คลื่นสึนามิ',
      earthquake: 'แผ่นดินไหว',
      disease: 'โรคระบาด'
    };
    return names[type] || type;
  };

  const getEOCTypeIcon = (type) => {
    const icons = {
      flood: '💧',
      drought: '☀️',
      tsunami: '🌊',
      earthquake: '🌍',
      disease: '🦠'
    };
    return icons[type] || '⚠️';
  };

  const getEOCTypeColor = (type) => {
    const colors = {
      flood: 'from-blue-500 to-cyan-500',
      drought: 'from-orange-500 to-yellow-500',
      tsunami: 'from-teal-500 to-blue-600',
      earthquake: 'from-red-500 to-orange-600',
      disease: 'from-purple-500 to-pink-500'
    };
    return colors[type] || 'from-gray-500 to-gray-600';
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
          { icon: "🗺️", title: "แผนที่น้ำท่วม", link: "/eoc/flood", color: "blue" },
          { icon: "🚨", title: "แจ้งเหตุน้ำท่วม", link: "/public/disaster-map", color: "red" },
          { icon: "🏘️", title: "จุดพักพิงฉุกเฉิน", link: "/eoc/village-map", color: "green" }
        ],
        stats: {
          affected: 156,
          shelters: 8,
          teams: 12,
          supplies: 45
        }
      },
      drought: {
        warnings: [
          { icon: "💧", text: "ใช้น้ำอย่างประหยัด งดล้างรถ รดน้ำต้นไม้", level: "warning" },
          { icon: "🌾", text: "เกษตรกรเก็บน้ำไว้ใช้ในการเพาะปลูก", level: "warning" },
          { icon: "🚰", text: "ตรวจสอบแหล่งน้ำสำรองในชุมชน", level: "info" }
        ],
        news: [
          {
            title: "สถานการณ์ภัยแล้งในพื้นที่",
            content: "ปริมาณน้ำในอ่างเก็บน้ำลดลง 45% จากปกติ",
            type: "warning",
            date: "2025-12-17"
          },
          {
            title: "มาตรการช่วยเหลือเกษตรกร",
            content: "จัดส่งน้ำสะอาดให้หมู่บ้านในพื้นที่ขาดแคลนน้ำ",
            type: "info",
            date: "2025-12-15"
          }
        ],
        quickActions: [
          { icon: "☀️", title: "แผนที่ภัยแล้ง", link: "/eoc/drought", color: "orange" },
          { icon: "💧", title: "จุดแจกน้ำ", link: "/eoc/village-map", color: "blue" },
          { icon: "🌾", title: "ช่วยเหลือเกษตรกร", link: "/public/disaster-map", color: "green" }
        ],
        stats: {
          affected: 89,
          waterPoints: 15,
          teams: 6,
          waterTanks: 23
        }
      },
      tsunami: {
        warnings: [
          { icon: "🚨", text: "อพยพไปพื้นที่สูงทันทีเมื่อได้รับแจ้งเตือน", level: "danger" },
          { icon: "📻", text: "ติดตามข่าวสารจากวิทยุและหอกระจายข่าว", level: "danger" },
          { icon: "🏃", text: "จำเส้นทางอพยพไปยังจุดปลอดภัย", level: "warning" }
        ],
        news: [
          {
            title: "ซ้อมแผนอพยพหนีคลื่นสึนามิ",
            content: "กำหนดซ้อมแผนอพยพประจำเดือน วันที่ 20 ธันวาคม",
            type: "info",
            date: "2025-12-17"
          }
        ],
        quickActions: [
          { icon: "🌊", title: "แผนที่สึนามิ", link: "/eoc/tsunami", color: "cyan" },
          { icon: "🏃", title: "เส้นทางอพยพ", link: "/eoc/village-map", color: "red" },
          { icon: "📡", title: "ระบบเตือนภัย", link: "/public/disaster-map", color: "orange" }
        ],
        stats: {
          evacuationPoints: 12,
          safeZones: 8,
          teams: 15,
          alerts: 24
        }
      },
      earthquake: {
        warnings: [
          { icon: "🏚️", text: "หลบใต้โต๊ะ ห่างจากหน้าต่างและของตกหล่น", level: "danger" },
          { icon: "🚪", text: "ออกจากอาคารสูง ไปยังพื้นที่โล่งแจ้ง", level: "danger" },
          { icon: "⚡", text: "ปิดแก๊ส ไฟฟ้า และน้ำประปาหลังแผ่นดินไหว", level: "warning" }
        ],
        news: [
          {
            title: "เตรียมความพร้อมรับมือแผ่นดินไหว",
            content: "ตรวจสอบโครงสร้างอาคาร เตรียมอุปกรณ์ฉุกเฉิน",
            type: "info",
            date: "2025-12-17"
          }
        ],
        quickActions: [
          { icon: "🌍", title: "แผนที่แผ่นดินไหว", link: "/eoc/earthquake", color: "red" },
          { icon: "🏗️", title: "อาคารปลอดภัย", link: "/eoc/village-map", color: "green" },
          { icon: "🆘", title: "ช่วยเหลือฉุกเฉิน", link: "/public/disaster-map", color: "orange" }
        ],
        stats: {
          shelters: 10,
          safeBuildings: 45,
          teams: 18,
          supplies: 67
        }
      },
      disease: {
        warnings: [
          { icon: "😷", text: "สวมหน้ากากอนามัย ล้างมือบ่อยๆ", level: "warning" },
          { icon: "🏥", text: "พบแพทย์ทันทีหากมีอาการป่วย", level: "danger" },
          { icon: "🚫", text: "หลีกเลี่ยงสถานที่แออัด รักษาระยะห่าง", level: "warning" }
        ],
        news: [
          {
            title: "อัพเดทสถานการณ์โรคระบาด",
            content: "จำนวนผู้ป่วยเพิ่มขึ้น ขอความร่วมมือปฏิบัติตามมาตรการป้องกัน",
            type: "warning",
            date: "2025-12-17"
          },
          {
            title: "จุดให้บริการฉีดวัคซีน",
            content: "เปิดจุดบริการฉีดวัคซีนฟรี ทุกวันจันทร์-ศุกร์ เวลา 09.00-16.00 น.",
            type: "info",
            date: "2025-12-16"
          }
        ],
        quickActions: [
          { icon: "🦠", title: "แผนที่โรคระบาด", link: "/eoc/disease", color: "purple" },
          { icon: "💉", title: "จุดฉีดวัคซีน", link: "/eoc/village-map", color: "green" },
          { icon: "🏥", title: "โรงพยาบาล", link: "/public/disaster-map", color: "blue" }
        ],
        stats: {
          patients: 234,
          vaccinated: 1456,
          teams: 20,
          hospitals: 12
        }
      }
    };

    return content[eocType] || null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Hero Section - Improved */}
      <header className="bg-gradient-to-r from-green-700 to-green-900 text-white py-16 shadow-lg relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/3 translate-y-1/3"></div>
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl ring-4 ring-green-400">
                <Image src="/img/logo.png" alt="EOC Logo" width={80} height={80} className="w-20 h-20" />
              </div>
              <div>
                <h1 className="text-5xl font-bold mb-2 drop-shadow-lg">EOC จังหวัดสตูล</h1>
                <p className="text-xl text-green-100 mb-1">Emergency Operations Center</p>
                <p className="text-sm text-green-200">ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน จังหวัดสตูล</p>
              </div>
            </div>

            {/* Call-to-Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/login"
                className="bg-white hover:bg-gray-100 text-green-700 px-8 py-4 rounded-xl font-bold shadow-xl transition-all hover:shadow-2xl hover:scale-105 text-center"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl">🔐</span>
                  <span>เข้าสู่ระบบ</span>
                </div>
              </Link>
              <Link
                href="/public/disaster-map"
                className="bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-xl font-bold shadow-xl transition-all hover:shadow-2xl hover:scale-105 text-center"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl">🗺️</span>
                  <span>แผนที่ภัยพิบัติ</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* EOC Status Section - Enhanced with Active EOCs List */}
        <section className="mb-8">
          {loading ? (
            <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">กำลังโหลดข้อมูล EOC...</p>
            </div>
          ) : (
            <>
              <div className={`rounded-2xl shadow-2xl p-8 relative overflow-hidden mb-6 ${eocStatus.isOpen
                ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white'
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
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${eocStatus.isOpen ? 'bg-white/20 animate-pulse' : 'bg-white/10'
                          } shadow-lg`}>
                          <span className="text-4xl">{eocStatus.isOpen ? '🚨' : '✅'}</span>
                        </div>
                        <div>
                          <h2 className="text-4xl font-bold mb-1">
                            สถานะ EOC: {eocStatus.isOpen ? 'เปิดใช้งาน' : 'ปิด'}
                          </h2>
                          <p className="text-xl opacity-90">
                            {eocStatus.isOpen ? eocStatus.reason : 'ไม่มีเหตุฉุกเฉิน'}
                          </p>
                        </div>
                      </div>

                      {eocStatus.isOpen && (
                        <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                          <p className="text-sm mb-3">เปิด EOC เมื่อ: {formatDate(eocStatus.openedDate)}</p>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="text-center bg-white/10 rounded-lg p-3">
                              <div className="text-4xl font-bold">{timeElapsed.days}</div>
                              <div className="text-sm opacity-80">วัน</div>
                            </div>
                            <div className="text-center bg-white/10 rounded-lg p-3">
                              <div className="text-4xl font-bold">{timeElapsed.hours}</div>
                              <div className="text-sm opacity-80">ชั่วโมง</div>
                            </div>
                            <div className="text-center bg-white/10 rounded-lg p-3">
                              <div className="text-4xl font-bold">{timeElapsed.minutes}</div>
                              <div className="text-sm opacity-80">นาที</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {eocStatus.isOpen && (
                      <div className="flex flex-col gap-3">
                        <Link
                          href="/dashboard"
                          className="bg-white text-red-600 px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105 text-center"
                        >
                          ⚡ ดูรายละเอียด
                        </Link>
                        <Link
                          href="/eoc/flood"
                          className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl font-semibold transition-all text-center backdrop-blur-sm border border-white/30"
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
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">🚨 EOC ที่เปิดใช้งานอยู่ ({activeEOCs.length})</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeEOCs.map((eoc) => (
                      <div
                        key={eoc.eoc_type}
                        className={`bg-gradient-to-br ${getEOCTypeColor(eoc.eoc_type)} text-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all hover:scale-105`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="text-4xl">{getEOCTypeIcon(eoc.eoc_type)}</div>
                            <div>
                              <h3 className="text-xl font-bold">{getEOCTypeName(eoc.eoc_type)}</h3>
                              <p className="text-xs opacity-80">EOC {eoc.eoc_type.toUpperCase()}</p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold backdrop-blur-sm">
                            เปิด
                          </span>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                            <p className="opacity-80 text-xs mb-1">เปิดเมื่อ</p>
                            <p className="font-semibold">{formatDate(eoc.activated_at)}</p>
                          </div>

                          {eoc.activated_by_name && (
                            <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                              <p className="opacity-80 text-xs mb-1">เปิดโดย</p>
                              <p className="font-semibold">{eoc.activated_by_name}</p>
                            </div>
                          )}

                          {eoc.description && (
                            <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                              <p className="opacity-80 text-xs mb-1">รายละเอียด</p>
                              <p className="font-medium text-sm">{eoc.description}</p>
                            </div>
                          )}
                        </div>

                        <Link
                          href={`/eoc/${eoc.eoc_type}`}
                          className="mt-4 block w-full bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-semibold text-center transition-all backdrop-blur-sm border border-white/30"
                        >
                          ดูข้อมูล →
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* แสดงข้อมูลแยกตาม EOC ที่เปิด */}
        {activeEOCs.length > 0 && activeEOCs.map((eoc) => {
          const content = getEOCContent(eoc.eoc_type);
          if (!content) return null;

          return (
            <div key={eoc.eoc_type} className="mb-8">
              {/* คำเตือนและคำแนะนำ */}
              <section className="mb-6">
                <div className={`bg-gradient-to-r ${getEOCTypeColor(eoc.eoc_type)} rounded-xl p-6 text-white shadow-xl`}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">{getEOCTypeIcon(eoc.eoc_type)}</span>
                    <h2 className="text-3xl font-bold">คำแนะนำสำหรับประชาชน - {getEOCTypeName(eoc.eoc_type)}</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {content.warnings.map((warning, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg ${warning.level === 'danger' ? 'bg-red-600/30 border-2 border-red-300' :
                          warning.level === 'warning' ? 'bg-yellow-600/20 border-2 border-yellow-300' :
                            'bg-blue-600/20 border-2 border-blue-300'
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-3xl flex-shrink-0">{warning.icon}</span>
                          <p className="font-semibold">{warning.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* สถิติเฉพาะ EOC */}
              <section className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">📊 สถิติ{getEOCTypeName(eoc.eoc_type)}</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(content.stats).map(([key, value]) => {
                    const labels = {
                      affected: { icon: "👥", title: "ผู้ได้รับผลกระทบ", unit: "คน" },
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
                      vaccinated: { icon: "💉", title: "ฉีดวัคซีน", unit: "คน" },
                      hospitals: { icon: "🏥", title: "โรงพยาบาล", unit: "แห่ง" }
                    };
                    const label = labels[key] || { icon: "📊", title: key, unit: "" };

                    return (
                      <div key={key} className="bg-white rounded-lg shadow-md p-4 text-center">
                        <div className="text-3xl mb-2">{label.icon}</div>
                        <div className="text-2xl font-bold text-gray-800 mb-1">
                          {value} <span className="text-sm font-normal text-gray-600">{label.unit}</span>
                        </div>
                        <div className="text-xs text-gray-600">{label.title}</div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* ข่าวประชาสัมพันธ์เฉพาะ EOC */}
              <section className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">📢 ข่าวสาร{getEOCTypeName(eoc.eoc_type)}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {content.news.map((news, idx) => (
                    <div key={idx} className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-shadow">
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${news.type === 'warning' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                          <span className="text-2xl">{news.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-gray-800 mb-1">{news.title}</h3>
                          <p className="text-sm text-gray-500 mb-2">{news.date}</p>
                          <p className="text-gray-600">{news.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Quick Access เฉพาะ EOC */}
              <section className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">🚀 เข้าถึงด่วน - {getEOCTypeName(eoc.eoc_type)}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {content.quickActions.map((action, idx) => (
                    <Link
                      key={idx}
                      href={action.link}
                      className={`bg-gradient-to-br from-${action.color}-50 to-${action.color}-100 border-2 border-${action.color}-200 hover:border-${action.color}-300 rounded-xl shadow-md p-6 text-center transition-all hover:shadow-xl hover:scale-105 group`}
                    >
                      <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">{action.icon}</div>
                      <h3 className="font-bold text-lg text-gray-800">{action.title}</h3>
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          );
        })}

        {/* ถ้าไม่มี EOC เปิด แสดงข้อมูลทั่วไป */}
        {activeEOCs.length === 0 && !loading && (
          <>
            {/* Quick Access ทั่วไป */}
            <section className="mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-6">🚀 เข้าถึงด่วน</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <QuickLinkCard icon="🗺️" title="แผนที่ภัยพิบัติ" description="ดูสถานการณ์ภัยพิบัติทั้งหมด" link="/public/disaster-map" color="blue" />
                <QuickLinkCard icon="💧" title="สถานการณ์น้ำท่วม" description="ข้อมูลน้ำท่วมรายวัน" link="/eoc/flood" color="cyan" />
                <QuickLinkCard icon="☀️" title="สถานการณ์ภัยแล้ง" description="พื้นที่ประสบภัยแล้ง" link="/eoc/drought" color="orange" />
                <QuickLinkCard icon="🏘️" title="ข้อมูลหมู่บ้าน" description="ข้อมูลหมู่บ้านทั้งหมด" link="/eoc/village-map" color="green" />
              </div>
            </section>
          </>
        )}

        {/* Infographic Stats */}
        <section className="mb-8 hidden">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">📊 สถิติภาพรวม</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          </div>
        </section>

        {/* Emergency Contact - แสดงเสมอ */}
        <section className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl shadow-lg p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">☎️ หมายเลขฉุกเฉิน</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-5xl font-bold mb-2">191</div>
              <div className="text-lg">ตำรวจ</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">1669</div>
              <div className="text-lg">ฉุกเฉิน EMS</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">199</div>
              <div className="text-lg">ดับเพลิง</div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 py-6 mt-12">
        <div className="container mx-auto px-6 text-center">
          <p>&copy; 2025 EOC จังหวัดสตูล - Emergency Operations Center</p>
          <p className="text-sm mt-2">ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน จังหวัดสตูล</p>
        </div>
      </footer>
    </div>
  );
}

// Component สำหรับแสดงสถิติ
function StatCard({ icon, title, value, unit = "", color }) {
  return (
    <div className={`bg-gradient-to-br ${color} text-white rounded-lg shadow-lg p-6 hover:scale-105 transition-transform`}>
      <div className="text-4xl mb-2">{icon}</div>
      <div className="text-3xl font-bold mb-1">
        {value} {unit && <span className="text-xl">{unit}</span>}
      </div>
      <div className="text-sm opacity-90">{title}</div>
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
      className={`bg-gradient-to-br ${colorClasses[color]} border-2 rounded-xl shadow-md p-6 text-center transition-all hover:shadow-xl hover:scale-105 group`}
    >
      <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="font-bold text-lg text-gray-800 mb-2">{title}</h3>
      {description && <p className="text-sm text-gray-600">{description}</p>}
    </Link>
  );
}

