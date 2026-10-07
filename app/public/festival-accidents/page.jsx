"use client";
import FestivalPublicDashboard from "@/components/festival/FestivalPublicDashboard";
import PublicOpsScaffold from "@/components/public/PublicOpsScaffold";

export default function PublicFestivalAccidentsPage() {
    return (
        <PublicOpsScaffold
            title="อุบัติเหตุช่วงเทศกาล"
            activeMenu="map"
            showPageHeader={false}
        >
            <div className="mx-auto w-full max-w-6xl">
                <FestivalPublicDashboard />
            </div>
        </PublicOpsScaffold>
    );
}
