'use client';

import { useState } from 'react';
import ImageLightbox from '@/components/ui/image-lightbox';
import Image from 'next/image';
import { Maximize2 } from 'lucide-react';

export default function AnnouncementImageViewer({ src, alt, priority = false }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!src) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group relative block aspect-[16/8] w-full bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-200"
        aria-label="ดูรูปประกาศแบบเต็มจอ"
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          className="object-contain"
          sizes="(max-width: 1024px) 100vw, 960px"
          unoptimized
        />
        <span className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-lg bg-slate-950/75 px-3 py-2 text-xs font-black text-white opacity-95 shadow-lg backdrop-blur transition group-hover:bg-slate-950">
          <Maximize2 className="h-4 w-4" />
          ดูเต็มจอ
        </span>
      </button>

      <ImageLightbox open={isOpen} onOpenChange={setIsOpen} src={src} alt={alt} label="รูปประกาศแบบเต็มจอ" layer="default" />
    </>
  );
}
