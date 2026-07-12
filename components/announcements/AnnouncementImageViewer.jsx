'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Maximize2, X } from 'lucide-react';

export default function AnnouncementImageViewer({ src, alt, priority = false }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

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

      {isOpen && (
        <div
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/95 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="รูปประกาศแบบเต็มจอ"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:right-5 sm:top-5"
            aria-label="ปิดรูปเต็มจอ"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="relative h-full max-h-[92vh] w-full max-w-7xl">
            <Image
              src={src}
              alt={alt}
              fill
              className="object-contain"
              sizes="100vw"
              unoptimized
            />
          </div>
        </div>
      )}
    </>
  );
}
