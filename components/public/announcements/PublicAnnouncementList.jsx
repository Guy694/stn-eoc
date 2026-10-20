"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Megaphone, Paperclip, Search, X } from "lucide-react";
import { formatAnnouncementDate, getAnnouncementAsset } from "@/components/announcements/announcementUtils";
import { TOPIC_STYLE, cleanTitle, relativeThai, topicKey, topicOf } from "./announcementTopics";
import { optimizedImage, responsiveImage } from "@/lib/imageUrl";
import { mergeAnnouncementSources, RISKCOM_CREDIT, RISKCOM_SITE } from "@/lib/riskcomMedia";

const hrefOf = (item) => item.href || `/public/announcements/${item.id}`;
const imageOf = (item) => item.image_url || getAnnouncementAsset(item.image_path);


const PAGE = 9;

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

export default function PublicAnnouncementList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [shown, setShown] = useState(PAGE);

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

  // เรื่องเด่น: ที่กำลังเผยแพร่และสำคัญที่สุดก่อน ไม่มีก็ใช้เรื่องล่าสุด
  const featured = !query && topic === "all" ? filtered[0] : null;
  const rest = featured ? filtered.slice(1) : filtered;
  const current = rest.filter((item) => item.display_status === "current");
  const past = rest.filter((item) => item.display_status !== "current");
  const pastShown = past.slice(0, Math.max(0, shown - current.length));

  const resetPaging = () => setShown(PAGE);

  return (
    <div className="bg-[#eef2f1] text-[#15232e]">
      {/* หัวหน้า + ค้นหา */}
      <section className="bg-[#0c2f4a] text-white">
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
          <p className="flex items-center gap-2 text-sm text-[#9fc9d6]"><Megaphone className="h-4 w-4" aria-hidden="true" /> ศูนย์ปฏิบัติการภาวะฉุกเฉิน จังหวัดสตูล</p>
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
      </section>

      <div className="mx-auto -mt-12 max-w-6xl px-4 pb-14 sm:px-6">
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
            {/* เรื่องเด่น */}
            {featured ? (
              <Link
                href={hrefOf(featured)}
                className="announce-card group mt-6 grid overflow-hidden rounded-[2rem] bg-white ring-1 ring-[#d6e3ea] transition hover:shadow-[0_24px_50px_-28px_rgba(12,47,74,.7)] md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
              >
                <Poster src={imageOf(featured)} alt={featured.alt_text || featured.title} sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[4/3] md:aspect-auto md:min-h-[22rem]" />
                <div className="flex flex-col p-6 sm:p-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#0c2f4a] px-2.5 py-0.5 text-xs font-semibold text-white">{featured.display_status === "current" ? "ประกาศล่าสุด" : "เรื่องล่าสุด"}</span>
                    <TopicTag item={featured} />
                  </div>
                  <h2 className="mt-4 font-[family-name:var(--font-kanit)] text-2xl font-bold leading-snug text-[#0c2f4a] sm:text-[2rem]">{cleanTitle(featured.title)}</h2>
                  {featured.description ? <p className="mt-3 line-clamp-4 text-[1.05rem] leading-8 text-slate-700">{featured.description}</p> : null}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
                    <span className="text-sm text-slate-500">{formatAnnouncementDate(featured.start_date || featured.created_at)} • {relativeThai(featured.start_date || featured.created_at)}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0b4c86] px-4 py-2 font-semibold text-white group-hover:bg-[#083865]">
                      อ่านต่อ <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            ) : null}

            {current.length > 0 ? (
              <section className="mt-12" aria-labelledby="current-title">
                <h2 id="current-title" className="font-[family-name:var(--font-kanit)] text-2xl font-bold text-[#0c2f4a]">กำลังเผยแพร่</h2>
                <ul className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {current.map((item, index) => <Card key={item.id} item={item} index={index} />)}
                </ul>
              </section>
            ) : null}

            {pastShown.length > 0 ? (
              <section className="mt-12" aria-labelledby="past-title">
                <h2 id="past-title" className="font-[family-name:var(--font-kanit)] text-2xl font-bold text-[#0c2f4a]">
                  {pastShown.some((item) => item.source === "riskcom") ? "สื่อความรู้" : current.length || featured?.display_status === "current" ? "ความรู้และประกาศที่ผ่านมา" : "ความรู้และประกาศ"}
                </h2>
                <p className="mt-1 text-slate-600">สื่อความรู้สำหรับดูแลตัวเองและคนในครอบครัว</p>
                <ul className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {pastShown.map((item, index) => <Card key={item.id} item={item} index={index} />)}
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
          </>
        )}

        {items.some((item) => item.source === "riskcom") ? (
          <p className="mt-12 border-t border-[#d6e3ea] pt-5 text-sm leading-6 text-slate-500">
            สื่อความรู้จากคลังสื่อสารความเสี่ยง {RISKCOM_CREDIT}{" "}
            <a href={RISKCOM_SITE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#0b4c86] underline-offset-4 hover:underline">
              riskcom-stn <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">(เปิดในแท็บใหม่)</span>
            </a>
          </p>
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
