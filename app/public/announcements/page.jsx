"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import PublicOpsScaffold from "@/components/public/PublicOpsScaffold";
import { getPublicAssetPath } from "@/lib/publicAssetPath";
import { formatEocDisplayName } from "@/lib/eocDisplay";

const EOC_TYPE_LABELS = {
  flood: "อุทกภัยน้ำท่วม",
  disease: "โรคระบาด",
  accident: "อุบัติเหตุ",
  "festival-accidents": "อุบัติเหตุช่วงเทศกาล"
};

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

function getDisplayStatusMeta(status) {
  if (status === "expired") return { label: "ข่าวย้อนหลัง", className: "bg-slate-100 text-slate-600" };
  if (status === "scheduled") return { label: "รอเผยแพร่", className: "bg-amber-50 text-amber-700" };
  return { label: "กำลังเผยแพร่", className: "bg-emerald-50 text-emerald-700" };
}

function getAnnouncementImageSrc(imagePath) {
  return getPublicAssetPath(imagePath);
}

function AnnouncementCard({ item, onImageClick, compact = false }) {
  const imageSrc = getAnnouncementImageSrc(item.image_path);
  const statusMeta = getDisplayStatusMeta(item.display_status);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-md">
      <div className={`flex flex-col gap-4 ${compact ? "" : "md:flex-row"}`}>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1">{EOC_TYPE_LABELS[item.eoc_type] || item.eoc_type || "ทั่วไป"}</span>
            <span className={`rounded-full px-2.5 py-1 ${statusMeta.className}`}>{statusMeta.label}</span>
            {item.show_popup ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">Popup</span> : null}
          </div>
          <h3 className={`${compact ? "text-base" : "text-lg"} font-black leading-snug text-slate-900`}>{item.title}</h3>
          <p className={`${compact ? "line-clamp-3" : ""} mt-2 text-sm leading-6 text-slate-600`}>
            {item.description || "ไม่มีรายละเอียดเพิ่มเติม"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-400">
            <span>เผยแพร่ {formatDate(item.created_at)}</span>
            {item.created_by_name ? <span>โดย {item.created_by_name}</span> : null}
          </div>
        </div>

        {imageSrc && (
          <button
            type="button"
            onClick={() => onImageClick({ src: imageSrc, title: item.title })}
            className={`relative w-full flex-none cursor-zoom-in overflow-hidden rounded-xl bg-slate-100 text-left ${compact ? "h-44" : "h-36 md:w-44"}`}
          >
            <Image
              src={imageSrc}
              alt={item.title}
              fill
              className="object-cover transition duration-200 hover:scale-105"
              sizes={compact ? "(max-width: 1024px) 100vw, 360px" : "176px"}
              unoptimized
            />
            <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-1 text-[11px] font-bold text-white">
              ดูเต็ม
            </span>
          </button>
        )}
      </div>
    </article>
  );
}

export default function PublicAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [activeEocs, setActiveEocs] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(true);

  const latestActiveEoc = useMemo(
    () => [...activeEocs].sort(
      (a, b) => new Date(b.session_opened_at || b.activated_at || 0) - new Date(a.session_opened_at || a.activated_at || 0)
    )[0] || null,
    [activeEocs]
  );

  useEffect(() => {
    const loadAnnouncements = async () => {
      setLoading(true);
      try {
        const eocType = latestActiveEoc?.eoc_type;
        const typeScopedUrl = eocType
          ? `/stn-eoc/api/public/announcements?limit=200&include_old=1&eocType=${encodeURIComponent(eocType)}`
          : "/stn-eoc/api/public/announcements?limit=200&include_old=1";

        const scopedResponse = await fetch(typeScopedUrl);
        const scopedData = await scopedResponse.json();
        const scopedItems = scopedData.success ? (scopedData.data || []) : [];

        if (scopedItems.length > 0 || !eocType) {
          setAnnouncements(scopedItems);
          return;
        }

        // Fallback: ถ้ายังไม่มีข่าวใน EOC ที่เปิดอยู่ ให้แสดงข่าวรวมแทน
        const fallbackResponse = await fetch('/stn-eoc/api/public/announcements?limit=200&include_old=1');
        const fallbackData = await fallbackResponse.json();
        setAnnouncements(fallbackData.success ? (fallbackData.data || []) : []);
      } catch (error) {
        console.error("Error loading public announcements:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAnnouncements();
  }, [latestActiveEoc?.eoc_type]);

  useEffect(() => {
    const loadEocStatus = async () => {
      try {
        const response = await fetch("/stn-eoc/api/eoc/status/");
        const data = response.ok ? await response.json() : { success: false, data: [] };
        setActiveEocs(data.success ? (data.data || []).filter((item) => item.is_active) : []);
      } catch (error) {
        console.error("Error loading EOC status:", error);
      }
    };

    loadEocStatus();
  }, []);

  const featured = announcements[0] || null;
  const latestAnnouncements = announcements.slice(featured ? 1 : 0, featured ? 4 : 3);
  const archiveAnnouncements = announcements.slice(featured ? 4 : 3);
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

  const currentCount = announcements.filter((item) => item.display_status === "current").length;
  const archiveCount = announcements.filter((item) => item.display_status === "expired").length;
  const eocIsOpen = activeEocs.length > 0;
  const eocLabel = latestActiveEoc
    ? formatEocDisplayName(latestActiveEoc)
    : "ไม่มี EOC ที่เปิดอยู่";
  const featuredImageSrc = getAnnouncementImageSrc(featured?.image_path);

  return (
    <PublicOpsScaffold
      title="ประกาศ / Announcements"
      subtitle="ประกาศ ข่าวประชาสัมพันธ์ และ infographic สำหรับประชาชน"
      activeMenu="announce"
      eocIsOpen={eocIsOpen}
      eocStatus={eocIsOpen ? "open" : "closed"}
      eocLabel={eocLabel}
      showPageHeader={false}
    >
      <div className="space-y-3">
        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)]">
            <div>
              <div className="mb-2 inline-flex rounded-lg border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                ข่าวประชาสัมพันธ์ / ประกาศสำคัญ
              </div>
              <h1 className="text-2xl font-black leading-tight text-blue-950 md:text-3xl">
                ประกาศข่าวสารและข้อมูลประชาสัมพันธ์สำหรับประชาชน
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                รวมประกาศล่าสุดจากระบบ ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข พร้อมข่าวย้อนหลังที่ยังเปิดให้ประชาชนตรวจสอบได้
              </p>

              <div className="mt-4 grid gap-2 text-sm font-semibold sm:grid-cols-3">
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                  <p className="text-xs text-blue-600">ประกาศทั้งหมด</p>
                  <p className="text-xl font-black text-blue-950">{loading ? "-" : announcements.length.toLocaleString("th-TH")}</p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                  <p className="text-xs text-emerald-700">กำลังเผยแพร่</p>
                  <p className="text-xl font-black text-emerald-900">{loading ? "-" : currentCount.toLocaleString("th-TH")}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">ข่าวย้อนหลัง</p>
                  <p className="text-xl font-black text-slate-800">{loading ? "-" : archiveCount.toLocaleString("th-TH")}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
                <Link href="/public/shelters" className="rounded-lg bg-blue-700 px-4 py-2 text-white shadow-sm hover:bg-blue-800">
                  ดูศูนย์พักพิง
                </Link>
                <Link href="/public/agencies" className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-blue-700 hover:bg-blue-50">
                  ดูหน่วยงานฉุกเฉิน
                </Link>
              </div>
            </div>

           
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_420px]">
          <div className="space-y-5">
            {featured && (
              <article className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
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
                    {featuredImageSrc ? (
                      <button
                        type="button"
                        onClick={() => setSelectedImage({ src: featuredImageSrc, title: featured.title })}
                        className="relative block h-full min-h-[240px] w-full cursor-zoom-in overflow-hidden text-left"
                      >
                        <Image
                          src={featuredImageSrc}
                          alt={featured.title}
                          fill
                          className="object-cover transition duration-200 hover:scale-[1.02]"
                          sizes="(max-width: 768px) 100vw, 420px"
                          unoptimized
                        />
                        <span className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-3 py-1 text-xs font-bold text-white">
                          ดูภาพเต็ม
                        </span>
                      </button>
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

            <section className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">ประกาศล่าสุด</h2>
                  <p className="text-sm text-slate-500">ข่าวใหม่และประกาศสำคัญยังแสดงเด่นเหมือนเดิม</p>
                </div>
                <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                  {loading ? 'กำลังโหลด...' : `${Math.min(announcements.length, featured ? 4 : 3)} รายการล่าสุด`}
                </div>
              </div>

              <div className="space-y-3">
                {latestAnnouncements.map((item) => (
                  <AnnouncementCard key={item.id} item={item} onImageClick={setSelectedImage} />
                ))}

                {!loading && announcements.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
                    ยังไม่มีประกาศที่แสดงผลในขณะนี้
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm md:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">ข่าวย้อนหลังและประกาศทั้งหมด</h2>
                  <p className="text-sm text-slate-500">ประกาศเก่าจะเก็บไว้ให้ค้นดูต่อจากรายการล่าสุด</p>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm">
                  {loading ? 'กำลังโหลด...' : `${archiveAnnouncements.length.toLocaleString("th-TH")} รายการ`}
                </div>
              </div>

              {archiveAnnouncements.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {archiveAnnouncements.map((item) => (
                    <AnnouncementCard key={item.id} item={item} onImageClick={setSelectedImage} compact />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-500">
                  ยังไม่มีข่าวย้อนหลังเพิ่มเติม
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
            <section className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-900">พื้นที่ infographic</h2>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">พร้อมใช้งาน</span>
              </div>

              <div className="space-y-3">
                {infographicItems.map((item) => {
                  const imageSrc = getAnnouncementImageSrc(item.image_path);
                  return (
                    <div key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200">
                        {imageSrc ? (
                          <button
                            type="button"
                            onClick={() => setSelectedImage({ src: imageSrc, title: item.title })}
                            className="relative block h-full w-full cursor-zoom-in overflow-hidden text-left"
                          >
                            <Image src={imageSrc} alt={item.title} fill className="object-cover transition duration-200 hover:scale-[1.02]" sizes="(max-width: 1024px) 100vw, 420px" unoptimized />
                            <span className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-3 py-1 text-xs font-bold text-white">
                              ดูภาพเต็ม
                            </span>
                          </button>
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
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-5 shadow-sm">
              <h2 className="text-lg font-black text-blue-900">ช่องทางด่วน</h2>
              <div className="mt-4 grid gap-3">
                <Link href="/public/shelters" className="rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md">
                  <div className="text-sm font-bold text-slate-500">ตรวจศูนย์พักพิง</div>
                  <div className="mt-1 text-lg font-black text-slate-900">ดูตำแหน่งและความจุ</div>
                </Link>
                <Link href="/public/agencies" className="rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md">
                  <div className="text-sm font-bold text-slate-500">หน่วยงานฉุกเฉิน</div>
                  <div className="mt-1 text-lg font-black text-slate-900">หมายเลขติดต่อสำคัญ</div>
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 p-4">
          <button
            type="button"
            aria-label="ปิดภาพเต็ม"
            onClick={() => setSelectedImage(null)}
            className="absolute inset-0 cursor-zoom-out"
          />
          <div className="relative z-10 flex h-full w-full max-w-6xl flex-col">
            <div className="mb-3 flex items-center justify-between gap-3 text-white">
              <h2 className="line-clamp-2 text-sm font-bold md:text-base">{selectedImage.title}</h2>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-900 shadow-sm hover:bg-slate-100"
              >
                ปิด
              </button>
            </div>
            <div className="relative min-h-0 flex-1">
              <Image
                src={selectedImage.src}
                alt={selectedImage.title}
                fill
                className="object-contain"
                sizes="100vw"
                unoptimized
              />
            </div>
          </div>
        </div>
      )}
    </PublicOpsScaffold>
  );
}
