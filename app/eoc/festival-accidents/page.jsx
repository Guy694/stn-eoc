"use client";
import { Suspense } from "react";
import EOCLayout from "@/components/layouts/EOCLayout";
import FestivalDashboard from "@/components/festival/FestivalDashboard";

export default function FestivalAccidentsPage() {
    return (
        <EOCLayout>
            <Suspense fallback={<div className="p-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#0b4c86]/20 border-t-[#0b4c86] motion-reduce:animate-none"></div></div>}>
                <FestivalDashboard />
            </Suspense>
        </EOCLayout>
    );
}
