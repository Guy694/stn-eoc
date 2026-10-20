"use client";

import Link from "next/link";
import { ArrowLeft, Download, ExternalLink, MapPin } from "lucide-react";
import { formatAnnouncementDate } from "@/components/announcements/announcementUtils";
import { cleanTitle, relativeThai, topicOf } from "./announcementTopics";
import { RISKCOM_SITE } from "@/lib/riskcomMedia";

/** หน้ารายละเอียดสื่อจากคลังสื่อ สสจ.สตูล: แสดงภาพตามต้นฉบับ (ไม่ครอป/ไม่ดัดแปลง) พร้อมที่มา */
export default function RiskcomMediaDetail({ item }) {
  const topic = topicOf(item);
  const date = item.start_date || item.created_at;
  const isImage = !item.file_type || item.file_type.startsWith("image/");

  return (
    <div className="bg-[#eef2f1] pb-14 text-[#15232e]">
      <div className="bg-[#0c2f4a] text-white">
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6">
          <Link href="/public/announcements" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#9fc9d6] hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> ประกาศและความรู้ทั้งหมด
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: topic.soft, color: topic.text }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: topic.dot }} aria-hidden="true" />
              {item.category || topic.label}
            </span>
            {item.phase_label ? <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white">{item.phase_label}</span> : null}
          </div>
          <h1 className="mt-3 font-[family-name:var(--font-kanit)] text-[1.8rem] font-bold leading-tight sm:text-[2.3rem]">{cleanTitle(item.title)}</h1>
          <p className="mt-2 text-[#d5e7ec]">
            {date ? <><time dateTime={date}>{formatAnnouncementDate(date)}</time> • {relativeThai(date)}</> : null}
            {item.location ? <span className="ml-2 inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden="true" />{item.location}</span> : null}
          </p>
        </div>
      </div>

      <div className="mx-auto -mt-16 grid max-w-5xl gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <figure className="overflow-hidden rounded-3xl bg-white ring-1 ring-[#d6e3ea]">
          {item.image_url && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt={item.alt_text || item.title} className="mx-auto max-h-[80vh] w-full bg-[#dfe9ee] object-contain" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center bg-[#dfe9ee] text-[#11466e]">{item.file_name || "ไฟล์สื่อ"}</div>
          )}
          <figcaption className="px-5 py-3 text-sm text-slate-500">ที่มา: {item.credit}</figcaption>
        </figure>

        <div className="space-y-5">
          <section className="rounded-3xl bg-white p-6 ring-1 ring-[#d6e3ea]">
            {item.description ? <p className="whitespace-pre-line text-[1.05rem] leading-8 text-slate-700">{item.description}</p> : <p className="text-slate-500">ไม่มีคำอธิบายเพิ่มเติม</p>}
            {item.keywords?.length ? (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="คำค้น">
                {item.keywords.map((word) => <li key={word} className="rounded-full bg-[#e3f3f5] px-3 py-1 text-sm text-[#11586a]">#{word}</li>)}
              </ul>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-2">
              {item.download_url ? (
                <a href={item.download_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#0b4c86] px-5 py-2.5 font-semibold text-white hover:bg-[#083865]">
                  <Download className="h-4 w-4" aria-hidden="true" /> ดาวน์โหลดไฟล์
                </a>
              ) : null}
              {item.image_url ? (
                <a href={item.image_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-semibold text-[#0b4c86] ring-1 ring-[#c9dcee] hover:bg-[#f3f7f8]">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" /> ดูภาพเต็ม
                </a>
              ) : null}
            </div>
          </section>
          <p className="px-1 text-sm leading-6 text-slate-500">
            สื่อนี้มาจากคลังสื่อสารความเสี่ยง {item.credit}{" "}
            <a href={RISKCOM_SITE} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0b4c86] underline-offset-4 hover:underline">riskcom-stn</a>
          </p>
        </div>
      </div>
    </div>
  );
}
