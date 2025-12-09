"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";

export default function Home() {
  const [eocStatus, setEocStatus] = useState({
    isOpen: true,
    openedDate: "2025-12-01T08:00:00",
    reason: "เตรียมพร้อมรับมือสถานการณ์น้ำท่วมฤดูมรสุม"
  });

  const [timeElapsed, setTimeElapsed] = useState({
    days: 0,
    hours: 0,
    minutes: 0
  });

  // คำนวณเวลาที่ผ่านไป
  useEffect(() => {
    const calculateTimeElapsed = () => {
      if (!eocStatus.isOpen) return;

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

  // ข้อมูลข่าวประชาสัมพันธ์
  const announcements = [
    {
      id: 1,
      title: "เตรียมพร้อมรับมือฤดูมรสุม",
      date: "2025-12-08",
      content: "กรมอุตุนิยมวิทยาพยากรณ์ฝนตกหนักในพื้นที่จังหวัดสตูล ระหว่างวันที่ 10-15 ธันวาคม 2568",
      type: "warning"
    },
    {
      id: 2,
      title: "แนวทางการเตรียมความพร้อม",
      date: "2025-12-07",
      content: "ขอให้ประชาชนในพื้นที่เสี่ยงภัยเตรียมพร้อมอพยพและติดตามข่าวสารอย่างใกล้ชิด",
      type: "info"
    }
  ];

  // เหตุการณ์ล่าสุด
  const recentEvents = [
    {
      id: 1,
      type: "น้ำท่วม",
      severity: "สูง",
      location: "ต.พิมาน อ.เมืองสตูล",
      date: "2025-12-09 06:30",
      status: "กำลังดำเนินการ",
      affected: 45
    },
    {
      id: 2,
      type: "ดินถ่ม",
      severity: "ปานกลาง",
      location: "ต.ควนโดน อ.ควนโดน",
      date: "2025-12-08 15:20",
      status: "กำลังดำเนินการ",
      affected: 12
    },
    {
      id: 3,
      type: "ไฟป่า",
      severity: "ต่ำ",
      location: "ต.ทุ่งหว้า อ.ทุ่งหว้า",
      date: "2025-12-08 10:00",
      status: "เสร็จสิ้น",
      affected: 8
    }
  ];

  // Infographic Stats
  const stats = {
    activeEvents: 5,
    totalAffected: 156,
    teamsDeployed: 8,
    resourcesUsed: 23
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Hero Section */}
      <header className="bg-gradient-to-r from-green-700 to-green-900 text-white py-12 shadow-lg">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
                <Image src="/img/logo.png" alt="EOC Logo" width={64} height={64} className="w-16 h-16" />
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-1">EOC จังหวัดสตูล</h1>
                <p className="text-green-100">Emergency Operations Center</p>
                <p className="text-sm text-green-200">ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน จังหวัดสตูล</p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex gap-3">
              <Link
                href="/login"
                className="bg-white hover:bg-gray-100 text-green-700 px-6 py-3 rounded-lg font-semibold shadow-lg transition-all hover:shadow-xl"
              >
                🔐 เข้าสู่ระบบ
              </Link>
              <Link
                href="/public/disaster-map"
                className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transition-all hover:shadow-xl"
              >
                🗺️ แผนที่ภัยพิบัติ
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* EOC Status Section */}
        <section className="mb-8">
          <div className={`rounded-xl shadow-lg p-8 ${eocStatus.isOpen
            ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white'
            : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
            }`}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${eocStatus.isOpen ? 'bg-white/20' : 'bg-white/10'
                    }`}>
                    <span className="text-3xl">{eocStatus.isOpen ? '🚨' : '✅'}</span>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold">
                      สถานะ EOC: {eocStatus.isOpen ? 'เปิดใช้งาน' : 'ปิด'}
                    </h2>
                    <p className="text-lg opacity-90">
                      {eocStatus.isOpen ? eocStatus.reason : 'ไม่มีเหตุฉุกเฉิน'}
                    </p>
                  </div>
                </div>

                {eocStatus.isOpen && (
                  <div className="bg-white/10 rounded-lg p-4">
                    <p className="text-sm mb-2">เปิด EOC เมื่อ: {new Date(eocStatus.openedDate).toLocaleString('th-TH')}</p>
                    <div className="grid grid-cols-3 gap-4 mt-3">
                      <div className="text-center">
                        <div className="text-4xl font-bold">{timeElapsed.days}</div>
                        <div className="text-sm opacity-80">วัน</div>
                      </div>
                      <div className="text-center">
                        <div className="text-4xl font-bold">{timeElapsed.hours}</div>
                        <div className="text-sm opacity-80">ชั่วโมง</div>
                      </div>
                      <div className="text-center">
                        <div className="text-4xl font-bold">{timeElapsed.minutes}</div>
                        <div className="text-sm opacity-80">นาที</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Infographic Stats */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">📊 สถิติภาพรวม</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              icon="🚨"
              title="เหตุการณ์กำลังดำเนินการ"
              value={stats.activeEvents}
              color="from-red-500 to-orange-500"
            />
            <StatCard
              icon="👥"
              title="ผู้ได้รับผลกระทบ"
              value={stats.totalAffected}
              unit="คน"
              color="from-blue-500 to-cyan-500"
            />
            <StatCard
              icon="⚡"
              title="ทีมปฏิบัติการ"
              value={stats.teamsDeployed}
              unit="ทีม"
              color="from-green-500 to-emerald-500"
            />
            <StatCard
              icon="🛠️"
              title="ทรัพยากรที่ใช้"
              value={stats.resourcesUsed}
              unit="หน่วย"
              color="from-purple-500 to-pink-500"
            />
          </div>
        </section>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Announcements */}
          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">📢 ข่าวประชาสัมพันธ์</h2>
            <div className="space-y-4">
              {announcements.map(announcement => (
                <div key={announcement.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${announcement.type === 'warning'
                      ? 'bg-orange-100 text-orange-600'
                      : 'bg-blue-100 text-blue-600'
                      }`}>
                      <span className="text-2xl">{announcement.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-800 mb-1">{announcement.title}</h3>
                      <p className="text-sm text-gray-500 mb-2">{announcement.date}</p>
                      <p className="text-gray-600">{announcement.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Events */}
          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">🔥 เหตุการณ์ล่าสุด</h2>
            <div className="space-y-4">
              {recentEvents.map(event => (
                <div key={event.id} className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${event.severity === 'สูง' ? 'bg-red-100 text-red-700' :
                        event.severity === 'ปานกลาง' ? 'bg-orange-100 text-orange-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                        {event.severity}
                      </span>
                      <span className="text-lg font-bold text-gray-800">{event.type}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${event.status === 'กำลังดำเนินการ'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                      }`}>
                      {event.status}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-2">📍 {event.location}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>🕐 {event.date}</span>
                    <span className="font-semibold text-red-600">👥 {event.affected} คน</span>
                  </div>
                </div>
              ))}
              
            </div>
            <Link
              href="/public/disaster-map"
              className="block mt-4 text-center bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors"
            >
              ดูเหตุการณ์ทั้งหมด →
            </Link>
          </section>
        </div>

        {/* Quick Links */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">🔗 ลิงก์ด่วน</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <QuickLinkCard
              icon="🗺️"
              title="แผนที่ภัยพิบัติ"
              link="/public/disaster-map"
            />
            <QuickLinkCard
              icon="💧"
              title="แผนที่น้ำท่วม"
              link="/flood-map"
            />
            <QuickLinkCard
              icon="☀️"
              title="แผนที่ภัยแล้ง"
              link="/drought-map"
            />
            <QuickLinkCard
              icon="🏘️"
              title="แผนที่หมู่บ้าน"
              link="/village-map"
            />
          </div>
        </section>

        {/* Emergency Contact */}
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

// Component สำหรับลิงก์ด่วน
function QuickLinkCard({ icon, title, link }) {
  return (
    <Link
      href={link}
      className="bg-white hover:bg-gray-50 rounded-lg shadow-md p-6 text-center transition-all hover:shadow-lg hover:scale-105"
    >
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-800">{title}</h3>
    </Link>
  );
}

