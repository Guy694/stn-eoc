"use client";
import { Suspense } from "react";
import EOCLayout from "@/components/layouts/EOCLayout";
import FestivalDashboard from "@/components/festival/FestivalDashboard";

export default function FestivalAccidentsPage() {
    return (
        <EOCLayout>
            <Suspense fallback={<div className="p-8 flex justify-center"><div className="animate-spin h-8 w-8 border-4 border-red-500 border-t-transparent rounded-full"></div></div>}>
                <FestivalDashboard />
            </Suspense>
        </EOCLayout>
    );
}
