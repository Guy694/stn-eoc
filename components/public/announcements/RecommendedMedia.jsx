"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cleanTitle } from "./announcementTopics";
import { responsiveImage } from "@/lib/imageUrl";

/** สื่อแนะนำจากคลังสื่อ สสจ.สตูล ที่ตรงกับสถานการณ์ตอนนี้ (GET /media/recommended)
 *  โหลดไม่ได้หรือไม่มีรายการ = ไม่แสดงส่วนนี้ ไม่กระทบหน้าอื่น */
export default function RecommendedMedia() {
  const [data, setData] = useState({ items: [], situation: null });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/stn-eoc/api/public/riskcom-media?view=recommended", { signal: controller.signal })
      .then((response) => response.json())
      .then((json) => { if (json.success) setData({ items: json.data || [], situation: json.situation || null }); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!data.items.length) return null;
  const { situation } = data;
  const hint = [situation?.label, situation?.phase_label].filter(Boolean).join(" • ");

  return (
    <section id="recommended-media" className="mb-8" aria-labelledby="recommended-title">
      <h2 id="recommended-title" className="flex items-center gap-2 font-[family-name:var(--font-kanit)] text-2xl font-bold text-[#0c2f4a]">
        <Sparkles className="h-6 w-6 text-[#2a9db0]" aria-hidden="true" /> สื่อแนะนำสำหรับสถานการณ์ตอนนี้
      </h2>
      {hint ? <p className="mt-1 text-sm text-slate-600">{hint}</p> : null}
      <ul className="mt-4 flex snap-x gap-4 overflow-x-auto pb-3">
        {data.items.map((item) => (
          <li key={item.id} className="w-40 shrink-0 snap-start sm:w-48">
            <Link href={item.href} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2a9db0] focus-visible:ring-offset-2">
              <span className="relative block aspect-[3/4] overflow-hidden rounded-2xl bg-[#dfe9ee] ring-1 ring-[#d6e3ea] transition group-hover:ring-[#9fc9d6]">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img {...responsiveImage(item.image_url, [384, 640], "192px")} alt={item.alt_text || ""} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center p-3 font-[family-name:var(--font-kanit)] font-semibold text-[#11466e]">{cleanTitle(item.title)}</span>
                )}
              </span>
              <span className="mt-2 line-clamp-2 block font-[family-name:var(--font-kanit)] text-[15px] font-semibold leading-snug text-[#0c2f4a] group-hover:text-[#0b4c86]">{cleanTitle(item.title)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
