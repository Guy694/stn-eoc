'use client';

import { useState, useEffect } from 'react';

export default function AnnouncementPopup() {
    const [announcement, setAnnouncement] = useState(null);
    const [showPopup, setShowPopup] = useState(false);

    useEffect(() => {
        fetchPopupAnnouncement();
    }, []);

    const fetchPopupAnnouncement = async () => {
        try {
            const response = await fetch('/api/public/announcements/popup');
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
    };

    const handleClose = () => {
        if (announcement) {
            // Save that user has seen this announcement today
            const seenKey = `announcement_seen_${announcement.id}`;
            localStorage.setItem(seenKey, new Date().toDateString());
        }
        setShowPopup(false);
    };

    if (!showPopup || !announcement) {
        return null;
    }

    return (
        <div className="fixed inset-0 backdrop-blur-md bg-white/30 flex items-center justify-center z-[9999] p-4 animate-fadeIn">
            <div className=" bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-scaleIn">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-2xl">📢</span>
                        ประกาศ/ข่าวสาร
                    </h3>
                    <button
                        onClick={handleClose}
                        className="text-white hover:text-gray-200 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
                    {/* Title */}
                    {announcement.title && (
                        <div className="px-6 pt-4 pb-2">
                            <h4 className="text-xl font-bold text-gray-800">
                                {announcement.title}
                            </h4>
                        </div>
                    )}

                    {/* Description */}
                    {announcement.description && (
                        <div className="px-6 pb-4">
                            <p className="text-gray-600 whitespace-pre-wrap">
                                {announcement.description}
                            </p>
                        </div>
                    )}

                    {/* Image */}
                    <div className="px-6 pb-6">
                        <img
                            src={announcement.image_path}
                            alt={announcement.title}
                            className="w-full h-auto rounded-lg shadow-lg"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-8 py-2 border-t flex justify-end">
                    <button
                        onClick={handleClose}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                        รับทราบ
                    </button>
                </div>
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
                        transform: scale(0.9);
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
                    animation: scaleIn 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}
