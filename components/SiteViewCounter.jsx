'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { usePathname } from "next/navigation";
import { isPublicPath, trackPublicUsage } from "@/lib/publicUsage";

const VISIT_SESSION_KEY = 'stn_eoc_site_visit_recorded';

export default function SiteViewCounter({ className = '' }) {
    const [totalVisits, setTotalVisits] = useState(null);
    const requested = useRef(false);
    const pathname = usePathname();

    useEffect(() => {
        if (requested.current) return;
        requested.current = true;

        let alreadyRecorded = false;
        try {
            alreadyRecorded = window.sessionStorage.getItem(VISIT_SESSION_KEY) === '1';
        } catch {
            // Continue without storage when it is blocked by the browser.
        }

        fetch('/stn-eoc/api/public/site-views', {
            method: alreadyRecorded ? 'GET' : 'POST',
            cache: 'no-store'
        })
            .then((response) => response.json())
            .then((result) => {
                if (!result.success) return;
                setTotalVisits(Number(result.data?.total_visits || 0));
                if (!alreadyRecorded) {
                    try {
                        window.sessionStorage.setItem(VISIT_SESSION_KEY, '1');
                    } catch {
                        // The counter still works when storage is unavailable.
                    }
                }
            })
            .catch((error) => console.error('Load site view count error:', error));
    }, []);

    useEffect(() => {
        if (!isPublicPath(pathname)) return;
        trackPublicUsage("page_view", pathname, { oncePerSession: true });
        if (pathname === "/public/report-incident") {
            trackPublicUsage("help_request_opened", pathname, { oncePerSession: true });
        }
    }, [pathname]);

    return (
        <span className={`inline-flex items-center justify-center gap-1.5 ${className}`}>
            <Eye className="h-4 w-4" aria-hidden="true" />
            ยอดเข้าชมเว็บไซต์ {totalVisits === null ? '–' : totalVisits.toLocaleString('th-TH')} ครั้ง
        </span>
    );
}
