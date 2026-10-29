"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, ChevronLeft, ChevronRight, ExternalLink, Images, Megaphone, Pause, Paperclip, Play, Search, Siren, X } from "lucide-react";
import AppDialog from "@/components/ui/app-dialog";
import { formatAnnouncementDate, getAnnouncementAsset } from "@/components/announcements/announcementUtils";
import { TOPIC_STYLE, cleanTitle, relativeThai, topicKey, topicOf } from "./announcementTopics";
import { optimizedImage, responsiveImage } from "@/lib/imageUrl";
import { mergeAnnouncementSources, RISKCOM_CREDIT, RISKCOM_SITE } from "@/lib/riskcomMedia";
import { reportContentView } from "@/lib/contentViewClient";
import CurrentWarnings from "./CurrentWarnings";
import RecommendedMedia from "./RecommendedMedia";

const hrefOf = (item) => item.href || `/public/announcements/${item.id}`;
const imageOf = (item) => item.image_url || getAnnouncementAsset(item.image_path);


const PAGE = 12; // หาร 2/3/4 คอลัมน์ลงตัว
const SLIDES = 6;
const SLIDE_MS = 7000;

function FeaturedSlide({ item, active, index, total }) {
  return (
    <Link
      href={hrefOf(item)}
      tabIndex={active ? 0 : -1}
      aria-hidden={!active}
      aria-roledescription="สไลด์"
      aria-label={`${index + 1} จาก ${total}: ${cleanTitle(item.title)}`}
      className={`featured-slide group col-start-1 row-start-1 grid overflow-hidden rounded-[2rem] bg-white ring-1 ring-[#d6e3ea] transition-[opacity,box-shadow] duration-500 hover:shadow-[0_24px_50px_-28px_rgba(12,47,74,.7)] md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] ${active ? "relative z-10 opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <Poster src={imageOf(item)} alt={item.alt_text || item.title} sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[4/3] md:aspect-auto md:min-h-[22rem]" />
      <div className="flex flex-col p-6 pb-16 sm:p-8 sm:pb-16">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#0c2f4a] px-2.5 py-0.5 text-xs font-semibold text-white">{item.display_status === "current" ? "ประกาศล่าสุด" : index === 0 ? "เรื่องล่าสุด" : "เรื่องแนะนำ"}</span>
          <TopicTag item={item} />
        </div>
        <h2 className="mt-4 font-[family-name:var(--font-kanit)] text-2xl font-bold leading-snug text-[#0c2f4a] sm:text-[2rem]">{cleanTitle(item.title)}</h2>
        {item.description ? <p className="mt-3 line-clamp-4 text-[1.05rem] leading-8 text-slate-700">{item.description}</p> : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
          <span className="text-sm text-slate-500">{formatAnnouncementDate(item.start_date || item.created_at)} • {relativeThai(item.start_date || item.created_at)}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0b4c86] px-4 py-2 font-semibold text-white group-hover:bg-[#083865]">
            อ่านต่อ <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/** เรื่องเด่นแบบหมุนเวียน: เปลี่ยนเองทุก 7 วินาที หยุดเมื่อชี้/แตะ/โฟกัส หรือผู้ใช้ตั้งลดการเคลื่อนไหว */
function FeaturedCarousel({ items }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const touch = useRef(null);
  const total = items.length;
  const go = useCallback((next) => setIndex((current) => (((typeof next === "function" ? next(current) : next) % total) + total) % total), [total]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setStopped(true);
  }, []);
  useEffect(() => { setIndex(0); }, [items]);
  useEffect(() => {
    if (total < 2 || paused || stopped) return undefined;
    const timer = window.setInterval(() => { if (!document.hidden) go((i) => i + 1); }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [total, paused, stopped, go]);

  if (!total) return null;
  return (
    <section
      aria-roledescription="ภาพหมุนเวียน"
      aria-label="เรื่องเด่น"
      className="relative mt-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go((i) => i + 1);
        if (event.key === "ArrowLeft") go((i) => i - 1);
      }}
      onTouchStart={(event) => { touch.current = event.touches[0].clientX; setPaused(true); }}
      onTouchEnd={(event) => {
        const dx = event.changedTouches[0].clientX - (touch.current ?? event.changedTouches[0].clientX);
        if (Math.abs(dx) > 40) go((i) => i + (dx < 0 ? 1 : -1));
        touch.current = null;
      }}
    >
      <div className="grid" aria-live={paused || stopped ? "polite" : "off"}>
        {items.map((item, i) => <FeaturedSlide key={item.id} item={item} active={i === index} index={i} total={total} />)}
      </div>
      {total > 1 ? (
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-full bg-white/95 p-1 shadow-[0_8px_24px_-12px_rgba(12,47,74,.6)] ring-1 ring-[#d6e3ea] md:left-[calc(45.45%+2rem)] md:right-auto">
          <button type="button" onClick={() => go((i) => i - 1)} className="rounded-full p-1.5 text-[#0b4c86] hover:bg-[#eef6f8]" aria-label="เรื่องก่อนหน้า"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
          <div className="flex items-center gap-1 px-1" role="group" aria-label="เลือกเรื่อง">
            {items.map((item, i) => (
              <button key={item.id} type="button" onClick={() => go(i)} aria-label={`เรื่องที่ ${i + 1}`} aria-current={i === index ? "true" : undefined}
                className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-[#0b4c86]" : "w-2 bg-[#c9dcee] hover:bg-[#9fc9d6]"}`} />
            ))}
          </div>
          <button type="button" onClick={() => go((i) => i + 1)} className="rounded-full p-1.5 text-[#0b4c86] hover:bg-[#eef6f8]" aria-label="เรื่องถัดไป"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
          <button type="button" onClick={() => setStopped((v) => !v)} className="rounded-full p-1.5 text-slate-500 hover:bg-[#eef6f8] hover:text-[#0b4c86]" aria-label={stopped ? "เล่นอัตโนมัติ" : "หยุดเลื่อนอัตโนมัติ"}>
            {stopped ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function alertTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} ${date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`;
}

/** แจ้งเตือนที่ส่งถึงประชาชน (ย้อนหลัง 30 วัน) — คอลัมน์ข้างรายการประกาศ */
function SentAlertsPanel({ alerts, id = "sent-alerts", tall = false }) {
  if (!alerts.length) return null;
  return (
    <aside aria-labelledby={`${id}-title`} className="lg:sticky lg:top-4">
      <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-[#d6e3ea]">
        <div className="flex items-center gap-3 bg-[#0c2f4a] px-5 py-4 text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"><BellRing className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <h2 id={`${id}-title`} className="font-[family-name:var(--font-kanit)] text-lg font-semibold leading-tight">แจ้งเตือนที่ส่งถึงประชาชน</h2>
            <p className="text-sm text-[#9fc9d6]">ข้อความเตือนภัยและข่าวด่วน 30 วันล่าสุด</p>
          </div>
        </div>
        <ol className={`relative overflow-y-auto px-5 py-4 ${tall ? "max-h-[calc(100vh-13rem)]" : "max-h-[34rem]"}`}>
          {alerts.slice(0, 8).map((alert, i) => {
            const high = alert.level === "high" || alert.level === "critical";
            return (
              <li key={alert.id} className="relative pb-5 pl-6 last:pb-0">
                {i < Math.min(alerts.length, 8) - 1 ? <span className="absolute left-[7px] top-4 h-full w-px bg-[#d6e3ea]" aria-hidden="true" /> : null}
                <span className={`absolute left-0 top-1.5 flex h-[15px] w-[15px] items-center justify-center rounded-full ring-4 ring-white ${high ? "bg-red-600" : "bg-[#2a9db0]"}`} aria-hidden="true" />
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  <span className={`inline-flex items-center gap-1 font-semibold ${high ? "text-red-700" : "text-[#11586a]"}`}>{high ? <Siren className="h-3 w-3" aria-hidden="true" /> : null}{high ? "เตือนภัย" : "ข่าวจากศูนย์ฯ"}</span>
                  <time dateTime={alert.created_at}>{alertTime(alert.created_at)}</time>
                </p>
                <Link href={`/public/alerts#alert-${alert.id}`} className="mt-0.5 block font-[family-name:var(--font-kanit)] font-semibold leading-snug text-[#0c2f4a] hover:text-[#0b4c86] hover:underline">{alert.title}</Link>
                <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm leading-6 text-slate-600">{alert.body}</p>
                {alert.districts?.length ? <p className="mt-1 text-xs text-slate-500">อ.{alert.districts.join(", อ.")}</p> : null}
              </li>
            );
          })}
        </ol>
        <Link href="/public/alerts" className="flex items-center justify-between border-t border-[#e3edf2] px-5 py-3 text-[15px] font-semibold text-[#0b4c86] hover:bg-[#f3f7f8]">
          ดูแจ้งเตือนทั้งหมด และรับแจ้งเตือนบนมือถือ <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}

function Poster({ src, alt = "", className = "", sizes = "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" }) {
  // อินโฟกราฟิกส่วนใหญ่เป็นภาพแนวตั้ง/จัตุรัส: แสดงทั้งภาพ บนพื้นที่เบลอจากภาพเดียวกัน แทนการครอปทิ้ง
  return (
    <div className={`relative overflow-hidden bg-[#dfe9ee] ${className}`}>
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={optimizedImage(src, 64)} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...responsiveImage(src, [640, 1080], sizes)} alt={alt} loading="lazy" className="poster-img absolute inset-0 h-full w-full object-contain" />
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-[#11466e]/40"><Megaphone className="h-14 w-14" aria-hidden="true" /></div>
      )}
    </div>
  );
}

function TopicTag({ item }) {
  const topic = topicOf(item);
  return (
    <>
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: topic.soft, color: topic.text }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: topic.dot }} aria-hidden="true" />
      {topic.category || topic.label}
    </span>
    {item.phase_label ? <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{item.phase_label}</span> : null}
    </>
  );
}

function Card({ item, index }) {
  const date = item.start_date || item.created_at;
  return (
    <li className="announce-card" style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}>
      <Link href={hrefOf(item)} className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-[#d6e3ea] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgba(12,47,74,.6)] hover:ring-[#9fc9d6] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
        <Poster src={imageOf(item)} alt={item.alt_text || ""} className="aspect-[4/3]" />
        <div className="flex flex-1 flex-col p-5">
          <div className="flex flex-wrap items-center gap-2">
            <TopicTag item={item} />
            {item.display_status === "current" ? <span className="rounded-full bg-[#dcfce7] px-2.5 py-0.5 text-xs font-semibold text-[#15803d]">กำลังเผยแพร่</span> : null}
            {item.attachment_path ? <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Paperclip className="h-3 w-3" aria-hidden="true" />มีเอกสาร</span> : null}
          </div>
          <h3 className="mt-3 line-clamp-2 font-[family-name:var(--font-kanit)] text-lg font-semibold leading-snug text-[#0c2f4a] group-hover:text-[#0b4c86]">{cleanTitle(item.title)}</h3>
          {item.description ? <p className="mt-1.5 line-clamp-2 text-[15px] leading-6 text-slate-600">{item.description}</p> : null}
          <p className="mt-auto pt-4 text-sm text-slate-500">
            <time dateTime={date}>{formatAnnouncementDate(date)}</time> • {relativeThai(date)}
            {item.source === "riskcom" ? <span className="mt-0.5 block text-xs text-slate-400">ที่มา: {RISKCOM_CREDIT}</span> : null}
          </p>
        </div>
      </Link>
    </li>
  );
}

// ใบความรู้/สื่อความรู้: การ์ดโปสเตอร์แนวตั้ง (ภาพส่วนใหญ่เป็นอินโฟกราฟิกแนวตั้ง) — 2 คอลัมน์บนมือถือ ไม่ต้องเลื่อนยาว
function PosterCard({ item, index }) {
  const date = item.start_date || item.created_at;
  const topic = topicOf(item);
  const src = imageOf(item);
  return (
    <li className="announce-card" style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
      <Link href={hrefOf(item)} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2a9db0] focus-visible:ring-offset-2">
        <span className="relative block aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-[#d6e3ea] transition group-hover:ring-[#9fc9d6] group-hover:shadow-[0_16px_32px_-22px_rgba(12,47,74,.7)]" style={{ backgroundColor: topic.soft }}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img {...responsiveImage(src, [384, 640], "(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 46vw")} alt={item.alt_text || ""} loading="lazy" className="poster-img h-full w-full object-cover object-top" />
          ) : (
            <span className="flex h-full flex-col justify-between p-4 pt-10">
              <Megaphone className="h-8 w-8" style={{ color: topic.dot }} aria-hidden="true" />
              <span className="line-clamp-5 font-[family-name:var(--font-kanit)] text-lg font-semibold leading-snug" style={{ color: topic.text }}>{cleanTitle(item.title)}</span>
            </span>
          )}
          <span className="absolute left-2 top-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold shadow-sm" style={{ color: topic.text }}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: topic.dot }} aria-hidden="true" />
            <span className="truncate">{topic.category || topic.label}</span>
          </span>
          {item.display_status === "current" ? <span className="absolute bottom-2 left-2 rounded-full bg-[#15803d] px-2 py-0.5 text-[11px] font-semibold text-white">กำลังเผยแพร่</span> : null}
        </span>
        <span className="mt-2.5 line-clamp-2 font-[family-name:var(--font-kanit)] text-[15px] font-semibold leading-snug text-[#0c2f4a] group-hover:text-[#0b4c86] sm:text-base">{cleanTitle(item.title)}</span>
        <span className="mt-1 block text-xs text-slate-500">
          <time dateTime={date}>{formatAnnouncementDate(date)}</time>
          {item.phase_label ? ` • ${item.phase_label}` : ""}
          {item.attachment_path ? <Paperclip className="ml-1 inline h-3 w-3 align-[-1px]" aria-label="มีเอกสารแนบ" /> : null}
        </span>
      </Link>
    </li>
  );
}

// อินโฟกราฟิกจากคลังของฝ่ายสื่อสารความเสี่ยง: ภาพย่อแนวตั้ง กดเพื่อดูภาพเต็ม
const GALLERY_PAGE = 8;
function InfographicGallery({ items }) {
  const [open, setOpen] = useState(null);
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, GALLERY_PAGE);
  return (
    <section className="mt-12" aria-labelledby="infographic-title">
      <h2 id="infographic-title" className="flex items-center gap-2 font-[family-name:var(--font-kanit)] text-2xl font-bold text-[#0c2f4a]">
        <Images className="h-6 w-6 text-[#2a9db0]" aria-hidden="true" />อินโฟกราฟิก
      </h2>
      <p className="mt-1 text-slate-600">ภาพสรุปความรู้จากศูนย์ฯ กดที่ภาพเพื่อดูขนาดเต็ม บันทึกหรือส่งต่อได้</p>
      <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((item) => {
          const topic = topicOf(item);
          return (
            <li key={item.id}>
              <button type="button" onClick={() => { setOpen(item); reportContentView("infographic", item.id, item.title); }} className="group block w-full overflow-hidden rounded-2xl bg-white text-left ring-1 ring-[#d6e3ea] transition hover:ring-[#2a9db0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2a9db0]">
                <span className="block aspect-[3/4] overflow-hidden bg-[#e3eef2]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- ภาพจากคลังของระบบ ขนาดหลากหลาย */}
                  <img src={item.image} alt="" loading="lazy" className="poster-img h-full w-full object-cover" />
                </span>
                <span className="block p-3">
                  <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: topic.text }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: topic.dot }} aria-hidden="true" />{topic.label}
                  </span>
                  <span className="mt-1 line-clamp-2 font-semibold leading-snug text-[#0c2f4a]">{item.title}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {items.length > GALLERY_PAGE ? (
        <div className="mt-6 text-center">
          <button type="button" onClick={() => setAll((value) => !value)} className="rounded-full bg-white px-6 py-3 font-semibold text-[#0b4c86] ring-1 ring-[#c9dcee] hover:bg-[#f3f7f8]">
            {all ? "ย่อกลับ" : `ดูอินโฟกราฟิกทั้งหมด ${items.length} ภาพ`}
          </button>
        </div>
      ) : null}
      <AppDialog open={Boolean(open)} onOpenChange={(value) => { if (!value) setOpen(null); }} title={open?.title} size="lg" contentClassName="bg-slate-50 p-3 sm:p-4">
        {open ? (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- ภาพเต็มจากคลังของระบบ */}
            <img src={open.image} alt={open.title} className="max-h-[70dvh] w-auto max-w-full rounded-lg object-contain" />
            <a href={open.image} target="_blank" rel="noopener noreferrer" download className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0b4c86] px-5 font-semibold text-white hover:bg-[#083865]">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />เปิดภาพขนาดเต็ม
            </a>
          </div>
        ) : null}
      </AppDialog>
    </section>
  );
}

export default function PublicAnnouncementList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const [alerts, setAlerts] = useState([]);
  const [infographics, setInfographics] = useState([]);
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    const load = (url) => fetch(url, { signal: controller.signal })
      .then((response) => response.json())
      .then((json) => (json.success ? json.data || [] : null))
      .catch((error) => { if (error.name !== "AbortError") console.error("Load announcements error:", error); return null; });
    Promise.all([
      load("/stn-eoc/api/public/announcements?limit=200&include_old=1"),
      load("/stn-eoc/api/public/riskcom-media?limit=100")
    ]).then(([internal, riskcom]) => {
      if (controller.signal.aborted) return;
      setItems(mergeAnnouncementSources(internal || [], riskcom));
      setLoading(false);
    });
    fetch("/stn-eoc/api/public/infographic-gallery", { signal: controller.signal })
      .then((response) => response.json())
      .then((json) => { if (json.success) setInfographics(json.data || []); })
      .catch(() => {});
    // ประกาศเตือนขณะนี้ (ชุดเดียวกับแถบแดงหน้าแรก) — โหลดไม่ได้ก็ไม่แสดง
    fetch("/stn-eoc/api/public/weather-watch/?view=warnings", { signal: controller.signal })
      .then((response) => response.json())
      .then((json) => { if (json.success) setWarnings(json.weather_warnings || []); })
      .catch(() => {});
    // แจ้งเตือนที่ส่งถึงประชาชน (ไม่บังคับ — โหลดไม่ได้ก็ไม่แสดงคอลัมน์นี้)
    fetch("/stn-eoc/api/public/push/?history=1", { signal: controller.signal })
      .then((response) => response.json())
      .then((json) => { if (json.success) setAlerts(json.data || []); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const topics = useMemo(() => {
    const counts = new Map();
    items.forEach((item) => counts.set(topicKey(item), (counts.get(topicKey(item)) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const filtered = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("th");
    return items.filter((item) => {
      if (topic !== "all" && topicKey(item) !== topic) return false;
      if (!text) return true;
      return `${item.title || ""} ${item.description || ""} ${item.category || ""} ${(item.keywords || []).join(" ")}`.toLocaleLowerCase("th").includes(text);
    });
  }, [items, query, topic]);

  const shownInfographics = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("th");
    return infographics.filter((item) => (topic === "all" || topicKey(item) === topic) && (!text || item.title.toLocaleLowerCase("th").includes(text)));
  }, [infographics, query, topic]);

  // เรื่องเด่น: ที่กำลังเผยแพร่และสำคัญที่สุดก่อน ไม่มีก็ใช้เรื่องล่าสุด
  // หมุนเวียนเรื่องเด่นไม่เกิน 6 เรื่อง (ประกาศที่กำลังเผยแพร่ขึ้นก่อน แล้วตามด้วยเรื่องล่าสุดที่มีภาพ)
  const slides = useMemo(() => {
    if (query || topic !== "all") return [];
    const withImage = filtered.filter((item) => imageOf(item));
    return [...new Set([filtered[0], ...withImage].filter(Boolean))].slice(0, SLIDES);
  }, [filtered, query, topic]);
  const featured = slides[0] || null;
  const rest = featured ? filtered.filter((item) => item !== featured) : filtered;
  const current = rest.filter((item) => item.display_status === "current");
  const past = rest.filter((item) => item.display_status !== "current");
  const pastShown = past.slice(0, Math.max(0, shown - current.length));

  const resetPaging = () => setShown(PAGE);

  return (
    <div className="bg-[#eef2f1] text-[#15232e]">
      {/* หัวหน้า + ค้นหา */}
      <section className="bg-[#0c2f4a] text-white">
        <div className={`mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 2xl:max-w-[94rem] ${warnings.length ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-start lg:gap-10" : ""}`}>
          <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-[#9fc9d6]"><Megaphone className="h-4 w-4" aria-hidden="true" /> ศูนย์ข้อมูลสถานการณ์ฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล</p>
          <h1 className="mt-2 font-[family-name:var(--font-kanit)] text-[2rem] font-bold leading-tight sm:text-[2.6rem]">ประกาศและความรู้</h1>
          <p className="mt-2 max-w-2xl text-[1.05rem] leading-8 text-[#d5e7ec]">ประกาศจากศูนย์ฯ และสื่อความรู้จาก{RISKCOM_CREDIT} สำหรับดูแลตัวเองช่วงน้ำท่วม โรคระบาด และเหตุฉุกเฉิน</p>
          <label className="relative mt-6 block max-w-xl">
            <span className="sr-only">ค้นหาประกาศ</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => { setQuery(event.target.value); resetPaging(); }}
              placeholder="ค้นหา เช่น น้ำกัดเท้า ไฟฟ้าดูด ยุงลาย"
              className="h-14 w-full rounded-2xl bg-white pl-12 pr-12 text-[1.05rem] text-[#15232e] outline-none ring-2 ring-transparent placeholder:text-slate-400 focus:ring-[#2a9db0]"
            />
            {query ? (
              <button type="button" onClick={() => { setQuery(""); resetPaging(); }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="ล้างคำค้นหา">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </label>
          </div>
          {/* จอคอมพิวเตอร์: ประกาศเตือนขณะนี้อยู่มุมขวาของหัวหน้า; จอเล็กเรียงต่อใต้ช่องค้นหา */}
          <div className="mt-6 min-w-0 lg:mt-0"><CurrentWarnings warnings={warnings} inHero /></div>
        </div>
      </section>

      {/* จอกว้างมาก (≥1536px): แจ้งเตือนที่ส่งถึงประชาชนย้ายไปคอลัมน์ขวาสุด ข้างเรื่องเด่น · จอเล็กกว่าอยู่ข้างรายการประกาศ */}
      <div className={`mx-auto -mt-12 max-w-6xl px-4 pb-14 sm:px-6 2xl:max-w-[94rem] ${alerts.length ? "2xl:grid 2xl:grid-cols-[minmax(0,1fr)_23rem] 2xl:items-start 2xl:gap-8" : ""}`}>
        <div className="min-w-0">
        <RecommendedMedia />
        {/* หมวด */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="เลือกหมวด">
          {[["all", "ทั้งหมด", items.length], ...topics.map(([key, count]) => [key, TOPIC_STYLE[key].label, count])].map(([key, label, count]) => {
            const active = topic === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setTopic(key); resetPaging(); }}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[15px] font-semibold shadow-sm transition ${active ? "bg-[#2a9db0] text-white" : "bg-white text-[#0c2f4a] hover:bg-[#f3f7f8]"}`}
              >
                {key !== "all" ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: active ? "#fff" : TOPIC_STYLE[key].dot }} aria-hidden="true" /> : null}
                {label}
                <span className={`text-sm ${active ? "text-white/80" : "text-slate-400"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-96 animate-pulse rounded-3xl bg-white" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6 rounded-3xl bg-white px-6 py-16 text-center">
            <Megaphone className="mx-auto h-12 w-12 text-[#9fc9d6]" aria-hidden="true" />
            <p className="mt-3 font-[family-name:var(--font-kanit)] text-xl font-semibold text-[#0c2f4a]">{items.length ? "ไม่พบประกาศที่ตรงกับคำค้น" : "ยังไม่มีประกาศ"}</p>
            {items.length ? (
              <button type="button" onClick={() => { setQuery(""); setTopic("all"); resetPaging(); }} className="mt-4 rounded-full bg-[#0b4c86] px-5 py-2.5 font-semibold text-white hover:bg-[#083865]">ดูประกาศทั้งหมด</button>
            ) : null}
          </div>
        ) : (
          <>
            {/* เรื่องเด่น (หมุนเวียน) */}
            <FeaturedCarousel items={slides} />

            <div className={alerts.length ? "mt-12 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start 2xl:block" : ""}>
            <div className="min-w-0">
            {current.length > 0 ? (
              <section className={alerts.length ? "" : "mt-12"} aria-labelledby="current-title">
                <h2 id="current-title" className="font-[family-name:var(--font-kanit)] text-2xl font-bold text-[#0c2f4a]">กำลังเผยแพร่</h2>
                <ul className={`mt-4 grid gap-5 md:grid-cols-2 ${alerts.length ? "2xl:grid-cols-3" : "lg:grid-cols-3"}`}>
                  {current.map((item, index) => <Card key={item.id} item={item} index={index} />)}
                </ul>
              </section>
            ) : null}

            {pastShown.length > 0 ? (
              <section className={current.length || !alerts.length ? "mt-12" : ""} aria-labelledby="past-title">
                <h2 id="past-title" className="font-[family-name:var(--font-kanit)] text-2xl font-bold text-[#0c2f4a]">
                  {pastShown.some((item) => item.source === "riskcom") ? "สื่อความรู้" : current.length || featured?.display_status === "current" ? "ความรู้และประกาศที่ผ่านมา" : "ความรู้และประกาศ"}
                </h2>
                <p className="mt-1 text-slate-600">ใบความรู้สำหรับดูแลตัวเองและคนในครอบครัว แตะเพื่อดูภาพเต็มและดาวน์โหลด</p>
                <ul className={`mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 ${alerts.length ? "2xl:grid-cols-4" : "lg:grid-cols-4"}`}>
                  {pastShown.map((item, index) => <PosterCard key={item.id} item={item} index={index} />)}
                </ul>
              </section>
            ) : null}

            {past.length > pastShown.length ? (
              <div className="mt-8 text-center">
                <button type="button" onClick={() => setShown((value) => value + PAGE)} className="rounded-full bg-white px-6 py-3 font-semibold text-[#0b4c86] ring-1 ring-[#c9dcee] hover:bg-[#f3f7f8]">
                  ดูเพิ่มอีก {Math.min(PAGE, past.length - pastShown.length)} เรื่อง
                </button>
              </div>
            ) : null}
            </div>
            <div className="2xl:hidden"><SentAlertsPanel alerts={alerts} id="sent-alerts-inline" /></div>
            </div>
          </>
        )}

        {!loading ? <InfographicGallery items={shownInfographics} /> : null}

        {items.some((item) => item.source === "riskcom") ? (
          <p className="mt-12 border-t border-[#d6e3ea] pt-5 text-sm leading-6 text-slate-500">
            สื่อความรู้จากคลังสื่อสารความเสี่ยง {RISKCOM_CREDIT}{" "}
            <a href={RISKCOM_SITE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#0b4c86] underline-offset-4 hover:underline">
              riskcom-stn <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">(เปิดในแท็บใหม่)</span>
            </a>
          </p>
        ) : null}
        </div>
        {alerts.length ? (
          <div className="hidden 2xl:sticky 2xl:top-4 2xl:mt-16 2xl:block"><SentAlertsPanel alerts={alerts} id="sent-alerts-side" tall /></div>
        ) : null}
      </div>

      <style>{`
        .announce-card { animation: announce-in .45s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes announce-in { from { opacity: 0; transform: translateY(10px); } }
        .group:hover .poster-img { transform: scale(1.03); }
        .poster-img { transition: transform .5s ease; }
        @media (prefers-reduced-motion: reduce) { .announce-card { animation: none; } .poster-img { transition: none; } .group:hover .poster-img { transform: none; } }
      `}</style>
    </div>
  );
}
