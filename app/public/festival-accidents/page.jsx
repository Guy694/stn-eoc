"use client";
import Footer from "@/components/Footer";
import FestivalPublicDashboard from "@/components/festival/FestivalPublicDashboard";

export default function PublicFestivalAccidentsPage() {
    return (
        <div className="flex min-h-screen flex-col bg-slate-50">
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
                <FestivalPublicDashboard />
            </main>
            <Footer />
        </div>
    );
}
