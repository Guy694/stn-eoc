"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import PublicLayout from "@/components/layouts/PublicLayout";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function getPriorityTone(priority) {
  if (priority >= 7) return "from-red-600 to-red-500";
  if (priority >= 4) return "from-orange-600 to-orange-500";
  return "from-blue-600 to-blue-500";
}

export default function PublicAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        const response = await fetch("/stn-eoc/api/public/announcements?limit=24");
        const data = await response.json();
        setAnnouncements(data.success ? data.data : []);
      } catch (error) {
        console.error("Error loading public announcements:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAnnouncements();
  }, []);

  const featured = announcements[0] || null;
  const infographicItems = useMemo(() => {
    const withImages = announcements.filter((item) => Boolean(item.image_path));
    if (withImages.length > 0) return withImages;
    return [
      {
        id: 'placeholder-1',
        title: 'พื้นที่สำหรับ Infographic',
        description: 'สามารถวางภาพสรุปสถานการณ์ แผนผัง หรือคู่มือสำคัญไว้ในโซนนี้',
        image_path: null
      },
      {
        id: 'placeholder-2',
        title: 'ชุดประชาสัมพันธ์',
        description: 'เหมาะสำหรับภาพมาตรการ เตือนภัย และข้อควรปฏิบัติ',
        image_path: null
      }
    ];
  }, [announcements]);

  const popupCount = announcements.filter((item) => Boolean(item.show_popup)).length;

  return (
    <PublicLayout>
      <div className="container mx-auto max-w-7xl px-4 py-6 md:py-8">
        <section className="mb-5 rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-sky-900 p-6 text-white shadow-2xl md:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_360px]">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1 text-sm font-semibold text-blue-50">
                ข่าวประชาสัมพันธ์ / ประกาศสำคัญ
              </div>
              <h1 className="text-3xl font-black leading-tight md:text-5xl">
                ประกาศข่าวสารและข้อมูลประชาสัมพันธ์สำหรับประชาชน
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 md:text-base">
                รวมประกาศล่าสุดจากระบบ EOC จังหวัดสตูล ข่าวประชาสัมพันธ์ และพื้นที่สำหรับแสดง infographic เพื่อสื่อสารข้อมูลสำคัญอย่างรวดเร็วและชัดเจน
              </p>

              <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold">
                <Link href="/public/shelters" className="rounded-xl bg-white px-4 py-2 text-blue-900 shadow-sm hover:bg-blue-50">
                  ดูศูนย์พักพิง
                </Link>
                <Link href="/public/agencies" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-white hover:bg-white/15">
                  ดูหน่วยงานฉุกเฉิน
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <div className="text-sm text-blue-100">ประกาศทั้งหมด</div>
                <div className="mt-2 text-4xl font-black">{announcements.length}</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <div className="text-sm text-blue-100">แสดง Popup</div>
                <div className="mt-2 text-4xl font-black">{popupCount}</div>
              </div>
              <div className="col-span-2 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="text-sm text-blue-100">พื้นที่สำหรับ infographic</div>
                <div className="mt-2 text-lg font-bold">รองรับภาพสรุป, แผนผัง, และสื่อประชาสัมพันธ์</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_420px]">
          <div className="space-y-5">
            {featured && (
              <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
                <div className={`bg-gradient-to-r ${getPriorityTone(featured.priority)} p-4 text-white`}>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">ข่าวประชาสัมพันธ์เด่น</p>
                  <h2 className="mt-1 text-2xl font-black md:text-3xl">{featured.title}</h2>
                </div>
                <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
                  <div className="p-5 md:p-6">
                    <p className="text-sm leading-6 text-slate-600">{featured.description || "-"}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                      <span className="rounded-full bg-slate-100 px-3 py-1">วันที่ {formatDate(featured.created_at)}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">เวลา {formatTime(featured.created_at)}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">ผู้เผยแพร่ {featured.created_by_name || '-'}</span>
                    </div>
                  </div>
                  <div className="relative min-h-[240px] bg-slate-100">
                    {featured.image_path ? (
                      <Image
                        src={featured.image_path}
                        alt={featured.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 420px"
                      />
                    ) : (
                      <div className="flex h-full min-h-[240px] items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-center text-slate-500">
                        <div>
                          <div className="text-5xl">📰</div>
                          <p className="mt-2 text-sm font-semibold">ไม่มีภาพประกอบ</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )}

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg md:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">ประกาศล่าสุด</h2>
                  <p className="text-sm text-slate-500">เรียงตามความสำคัญและความใหม่ล่าสุด</p>
                </div>
                <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                  {loading ? 'กำลังโหลด...' : `${announcements.length} รายการ`}
                </div>
              </div>

              <div className="space-y-3">
                {announcements.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-slate-200 p-4 transition hover:shadow-md">
                    <div className="flex flex-col gap-4 md:flex-row">
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">{item.eoc_type || 'ทั่วไป'}</span>
                          {item.show_popup ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">Popup</span> : null}
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">Priority {item.priority ?? 0}</span>
                        </div>
                        <h3 className="text-lg font-black text-slate-900">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                        <p className="mt-3 text-xs text-slate-400">เผยแพร่วันที่ {formatDate(item.created_at)}</p>
                      </div>

                      {item.image_path && (
                        <div className="relative h-36 w-full overflow-hidden rounded-xl bg-slate-100 md:w-44 md:flex-none">
                          <Image src={item.image_path} alt={item.title} fill className="object-cover" sizes="176px" />
                        </div>
                      )}
                    </div>
                  </article>
                ))}

                {!loading && announcements.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
                    ยังไม่มีประกาศที่แสดงผลในขณะนี้
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-900">พื้นที่ infographic</h2>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">พร้อมใช้งาน</span>
              </div>

              <div className="space-y-3">
                {infographicItems.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200">
                      {item.image_path ? (
                        <div className="relative h-full w-full">
                          <Image src={item.image_path} alt={item.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 420px" />
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center text-center text-slate-500">
                          <div>
                            <div className="text-5xl">📊</div>
                            <p className="mt-2 text-sm font-semibold">พื้นที่วาง infographic</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-black text-slate-900">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.description || 'ใช้สำหรับข้อมูลสรุปภาพ, แผนผัง, หรือสื่อแจ้งเตือนสำคัญ'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-5 shadow-lg">
              <h2 className="text-lg font-black text-blue-900">ช่องทางด่วน</h2>
              <div className="mt-4 grid gap-3">
                <Link href="/public/shelters" className="rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md">
                  <div className="text-sm font-bold text-slate-500">ตรวจศูนย์พักพิง</div>
                  <div className="mt-1 text-lg font-black text-slate-900">ดูตำแหน่งและความจุ</div>
                </Link>
                <Link href="/public/agencies" className="rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md">
                  <div className="text-sm font-bold text-slate-500">หน่วยงานฉุกเฉิน</div>
                  <div className="mt-1 text-lg font-black text-slate-900">หมายเลขติดต่อสำคัญ</div>
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </PublicLayout>
  );
}
