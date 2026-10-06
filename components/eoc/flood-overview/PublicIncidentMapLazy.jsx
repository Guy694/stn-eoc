"use client";

import dynamic from 'next/dynamic';

// แผนที่โหลดฝั่งเบราว์เซอร์เท่านั้น (Leaflet ใช้ window)
const PublicIncidentMapLazy = dynamic(() => import('@/components/PublicIncidentMap'), {
    ssr: false,
    loading: () => (
        <div className="flex h-full min-h-[420px] items-center justify-center bg-slate-100 text-slate-500">
            กำลังโหลดแผนที่...
        </div>
    )
});

export default PublicIncidentMapLazy;
