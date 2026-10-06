"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import EOCTeamManager from "@/components/EOCTeamManager";
import { teamRegistry } from "@/src/features/eoc/registries/team.registry";
import { showConfirm, showError, showSuccess } from "@/lib/sweetAlert";

export default function EOCSessionTeamsPage() {
    const router = useRouter();
    const params = useParams();
    const { user, loading: authLoading } = useAuth();
    const sessionId = params.sessionId;
    const [readiness, setReadiness] = useState(null);
    const [checking, setChecking] = useState(false);

    const loadReadiness = useCallback(async () => {
        if (!sessionId || !user) return;
        setChecking(true);
        try {
            const response = await fetch(`/stn-eoc/api/admin/eoc-sessions/${sessionId}/readiness`, { cache: "no-store" });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.message || "ตรวจความพร้อมไม่สำเร็จ");
            setReadiness(payload.data);
        } catch (error) {
            showError(error.message);
        } finally {
            setChecking(false);
        }
    }, [sessionId, user]);

    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'admin')) {
            router.push("/dashboard");
        }
    }, [user, authLoading, router]);

    useEffect(() => { loadReadiness(); }, [loadReadiness]);

    const applyStandardTemplate = async () => {
        const confirmed = await showConfirm("เพิ่มกลุ่มภารกิจมาตรฐาน", "ระบบจะเพิ่มเฉพาะกลุ่มที่ยังไม่มีในเหตุการณ์และไม่ลบข้อมูลเดิม", "เพิ่มกลุ่ม");
        if (!confirmed) return;
        try {
            const response = await fetch(`/stn-eoc/api/admin/eoc-sessions/${sessionId}/template`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamCodes: Object.values(teamRegistry).map((team) => team.legacyCode) }),
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.message || "เพิ่มแม่แบบไม่สำเร็จ");
            showSuccess(payload.message);
            await loadReadiness();
            router.refresh();
        } catch (error) {
            showError(error.message);
        }
    };

    if (authLoading || !user) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b border-blue-500"></div>
            </div>
        );
    }

    return (
        <EOCLayout>
            <div className="container mx-auto p-6">
                <section className="mb-5 border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-black text-slate-900">ความพร้อมกลุ่มภารกิจ</h1>
                            <p className="mt-1 text-sm text-slate-600">{readiness ? `พร้อม ${readiness.ready_team_count}/${readiness.team_count} กลุ่ม` : "กำลังตรวจสอบข้อมูล"}</p>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={loadReadiness} disabled={checking} className="border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-50">{checking ? "กำลังตรวจ..." : "ตรวจอีกครั้ง"}</button>
                            <button type="button" onClick={applyStandardTemplate} className="bg-cyan-700 px-4 py-2 text-sm font-bold text-white">เพิ่ม 23 กลุ่มมาตรฐาน</button>
                        </div>
                    </div>
                    {readiness?.teams?.length ? <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{readiness.teams.map((team) => <div key={team.session_team_id} className={`border p-3 text-sm ${team.ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><p className="font-black">{team.team_code} · {team.team_name_th}</p><p className="mt-1 text-xs">{team.ready ? "พร้อมปฏิบัติงาน" : team.issues.join(" • ")}</p></div>)}</div> : null}
                </section>
                <EOCTeamManager
                    sessionId={sessionId}
                />
            </div>
        </EOCLayout>
    );
}
