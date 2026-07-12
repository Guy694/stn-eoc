'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';
import { formatAnnouncementDate, getAnnouncementAsset, getAnnouncementCategory } from './announcementUtils';

export default function AnnouncementCarousel({ items, detailBasePath = '/announcements' }) {
  const slides = items.filter((item) => item.image_path).slice(0, 5);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) return null;
  const item = slides[Math.min(active, slides.length - 1)];
  const imageSrc = getAnnouncementAsset(item.image_path);

  return (
    <section className="group relative min-h-[280px] overflow-hidden rounded-3xl bg-slate-950 shadow-lg md:min-h-[390px]">
      <Image src={imageSrc} alt={item.title} fill priority className="object-cover opacity-70 transition duration-700 group-hover:scale-[1.02]" sizes="(max-width: 1024px) 100vw, 1200px" unoptimized />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-10">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5"><Megaphone className="h-3.5 w-3.5" />ประกาศเด่น</span>
          <span className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">{getAnnouncementCategory(item)}</span>
          <span className="text-white/70">{formatAnnouncementDate(item.start_date || item.created_at)}</span>
        </div>
        <h2 className="max-w-4xl text-2xl font-black leading-tight md:text-4xl">{item.title}</h2>
        <p className="mt-3 line-clamp-2 max-w-3xl text-sm leading-6 text-white/80 md:text-base">{item.description}</p>
        <Link href={`${detailBasePath}/${item.id}`} className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-black text-blue-800 hover:bg-blue-50">อ่านรายละเอียด</Link>
      </div>
      {slides.length > 1 && <>
        <button type="button" aria-label="ข่าวก่อนหน้า" onClick={() => setActive((active - 1 + slides.length) % slides.length)} className="absolute left-4 top-1/2 rounded-full bg-black/35 p-2 text-white backdrop-blur hover:bg-black/55"><ChevronLeft /></button>
        <button type="button" aria-label="ข่าวถัดไป" onClick={() => setActive((active + 1) % slides.length)} className="absolute right-4 top-1/2 rounded-full bg-black/35 p-2 text-white backdrop-blur hover:bg-black/55"><ChevronRight /></button>
        <div className="absolute bottom-4 right-5 flex gap-1.5">{slides.map((slide, index) => <button key={slide.id} type="button" aria-label={`ข่าวที่ ${index + 1}`} onClick={() => setActive(index)} className={`h-2 rounded-full transition-all ${index === active ? 'w-7 bg-white' : 'w-2 bg-white/50'}`} />)}</div>
      </>}
    </section>
  );
}
