'use client';

import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getPublicAssetPath } from '@/lib/publicAssetPath';

export default function AnnouncementPopup() {
    const [announcement, setAnnouncement] = useState(null);
    const [showPopup, setShowPopup] = useState(false);

    async function fetchPopupAnnouncement() {
        try {
            const response = await fetch('/stn-eoc/api/public/announcements/popup');
            const data = await response.json();

            if (data.success && data.data) {
                // Check if user has already seen this announcement today
                const seenKey = `announcement_seen_${data.data.id}`;
                const lastSeen = localStorage.getItem(seenKey);
                const today = new Date().toDateString();

                if (lastSeen !== today) {
                    setAnnouncement(data.data);
                    setShowPopup(true);
                }
            }
        } catch (error) {
            console.error('Error fetching popup announcement:', error);
        }
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchPopupAnnouncement();
    }, []);

    const handleClose = useCallback(() => {
        if (announcement) {
            // Save that user has seen this announcement today
            const seenKey = `announcement_seen_${announcement.id}`;
            localStorage.setItem(seenKey, new Date().toDateString());
        }
        setShowPopup(false);
    }, [announcement]);

    useEffect(() => {
        if (!showPopup) return undefined;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') handleClose();
        };

        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleClose, showPopup]);

    if (!showPopup || !announcement) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm animate-fadeIn sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="ภาพประกาศข่าวสาร"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) handleClose();
            }}
        >
            <div className="relative inline-flex max-h-[85vh] max-w-[90vw] animate-scaleIn">
                {/* ใช้ขนาดธรรมชาติของภาพเพื่อให้พื้นที่นอกภาพคลิกปิดได้จริง */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={getPublicAssetPath(announcement.image_path)}
                    alt={announcement.title || 'ภาพประกาศข่าวสาร'}
                    className="h-auto max-h-[85vh] w-auto max-w-[90vw] rounded-lg object-contain shadow-2xl"
                />
                <button
                    type="button"
                    onClick={handleClose}
                    className="absolute right-0 top-0 z-10 flex h-11 w-11 -translate-y-1/3 translate-x-1/3 items-center justify-center rounded-full border border-white/30 bg-black/75 text-white shadow-xl transition hover:scale-105 hover:bg-black focus:outline-none focus:ring-2 focus:ring-white sm:h-12 sm:w-12"
                    aria-label="ปิดประกาศ"
                >
                    <X className="h-6 w-6" strokeWidth={2.5} />
                </button>
            </div>

            <style jsx>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                @keyframes scaleIn {
                    from {
                        transform: scale(0.96);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out;
                }

                .animate-scaleIn {
                    animation: scaleIn 0.22s ease-out;
                }
            `}</style>
        </div>
    );
}
