"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Download, FileText, Maximize2, Share2 } from "lucide-react";
import { formatAnnouncementDate, getAnnouncementAsset } from "@/components/announcements/announcementUtils";
import { cleanTitle, relativeThai, topicKey, topicOf } from "./announcementTopics";
import { optimizedImage, responsiveImage } from "@/lib/imageUrl";
import ImageLightbox from "@/components/ui/image-lightbox";

export default function PublicAnnouncementDetail({ item, related = [] }) {
  const [zoom, setZoom] = useState(false);
  const [shared, setShared] = useState(false);
  const image = getAnnouncementAsset(item.image_path);
  const attachment = getAnnouncementAsset(item.attachment_path);
  const topic = topicOf(item);
  const date = item.start_date || item.created_at;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    } catch {
      // ผู้ใช้ยกเลิกการแชร์
    }
  };

  return (
    <div className="bg-[#eef2f1] text-[#15232e]">
      <div className="bg-[#0c2f4a]">
        <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
          <Link href="/public/announcements" className="inline-flex items-center gap-2 text-sm font-semibold text-[#9fc9d6] hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> ประกาศทั้งหมด
          </Link>
        </div>
        {image ? (
          <div className="mx-auto max-w-5xl px-4 pb-0 pt-4 sm:px-6">
            <button type="button" onClick={() => setZoom(true)} className="group relative block w-full overflow-hidden rounded-t-[2rem] bg-[#11466e]" aria-label="ดูภาพเต็ม">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={optimizedImage(image, 64)} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img {...responsiveImage(image, [640, 1080, 1920], "(min-width: 1024px) 60rem, 100vw")} alt={item.title} className="relative mx-auto max-h-[70vh] w-auto object-contain" />
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-sm text-white backdrop-blur">
                <Maximize2 className="h-4 w-4" aria-hidden="true" /> ดูภาพเต็ม
              </span>
            </button>
          </div>
        ) : <div className="h-10" />}
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-14 sm:px-6">
        <article className={`bg-white px-6 py-8 sm:px-10 ${image ? "rounded-b-[2rem]" : "-mt-4 rounded-[2rem]"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold" style={{ backgroundColor: topic.soft, color: topic.text }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: topic.dot }} aria-hidden="true" />{topic.category || topic.label}
            </span>
            {item.display_status === "current" ? <span className="rounded-full bg-[#dcfce7] px-2.5 py-0.5 text-sm font-semibold text-[#15803d]">กำลังเผยแพร่</span> : null}
          </div>
          <h1 className="mt-4 font-[family-name:var(--font-kanit)] text-[1.9rem] font-bold leading-tight text-[#0c2f4a] sm:text-[2.5rem]">{cleanTitle(item.title)}</h1>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-6">
            <p className="text-slate-500">
              <time dateTime={date}>{formatAnnouncementDate(date, true)}</time> • {relativeThai(date)} • ศูนย์ข้อมูลสถานการณ์ฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล
            </p>
            <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-full bg-[#e3f1f4] px-4 py-2 font-semibold text-[#11466e] hover:bg-[#cfe7ed]">
              {shared ? <Check className="h-4 w-4" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
              {shared ? "คัดลอกลิงก์แล้ว" : "แชร์ให้คนในบ้าน"}
            </button>
          </div>
          <div className="max-w-[68ch] whitespace-pre-wrap py-8 text-[1.1rem] leading-9 text-slate-800">{item.description || "ไม่มีรายละเอียดเพิ่มเติม"}</div>
          {attachment ? (
            <a href={attachment} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-4 rounded-2xl bg-[#f3f7f8] p-4 ring-1 ring-[#d6e3ea] hover:bg-[#e3f1f4]">
              <span className="inline-flex min-w-0 items-center gap-3">
                <FileText className="h-8 w-8 shrink-0 text-[#0b4c86]" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm text-slate-500">เอกสารแนบ</span>
                  <span className="block truncate font-semibold text-[#0c2f4a]">{item.attachment_name || "เปิดเอกสาร"}</span>
                </span>
              </span>
              <Download className="h-5 w-5 shrink-0 text-[#0b4c86]" aria-hidden="true" />
            </a>
          ) : null}
        </article>

        {related.length > 0 ? (
          <section className="mt-10" aria-labelledby="related-title">
            <h2 id="related-title" className="font-[family-name:var(--font-kanit)] text-xl font-bold text-[#0c2f4a]">เรื่องอื่นใน{topic.label === "ทั่วไป" ? "หมวดเดียวกัน" : `หมวด${topic.label}`}</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-3">
              {related.map((other) => (
                <li key={other.id}>
                  <Link href={`/public/announcements/${other.id}`} className="group flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-[#d6e3ea] hover:ring-[#9fc9d6]">
                    <span className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#dfe9ee]">
                      {other.image_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={optimizedImage(getAnnouncementAsset(other.image_path), 256)} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-3 font-semibold leading-snug text-[#0c2f4a] group-hover:text-[#0b4c86]">{cleanTitle(other.title)}</span>
                      <span className="mt-1 block text-xs text-slate-500">{relativeThai(other.start_date || other.created_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <ImageLightbox open={zoom} onOpenChange={setZoom} src={image} alt={item.title} />
    </div>
  );
}

export { topicKey };
