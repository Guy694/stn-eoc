"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import EOCTeamManager from "@/components/EOCTeamManager";
import { teamRegistry } from "@/src/features/eoc/registries/team.registry";
import { showConfirm, showError, showSuccess } from "@/lib/sweetAlert";
import { PageHero, HeroProgress, heroButtonClass, heroPrimaryButtonClass } from "@/components/common/ThemePanels";

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
            <div className="flex min-h-screen items-center justify-center bg-[#edf5fc]">
                <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#0b4c86]/20 border-t-[#0b4c86] motion-reduce:animate-none" aria-label="กำลังโหลด" />
            </div>
        );
    }

    const pct = readiness?.team_count ? Math.round((readiness.ready_team_count / readiness.team_count) * 100) : 0;

    return (
        <EOCLayout>
            <div className="w-full space-y-4">
                <PageHero
                    icon="users"
                    eyebrow="เหตุการณ์ › กลุ่มภารกิจ"
                    title="ความพร้อมกลุ่มภารกิจ"
                    subtitle="ตรวจว่าทุกกลุ่มมีหัวหน้าและสมาชิกพร้อมปฏิบัติงาน แล้วจัดการสมาชิกด้านล่าง"
                    actions={(
                        <>
                            <button type="button" onClick={loadReadiness} disabled={checking} className={heroButtonClass}>{checking ? "กำลังตรวจ…" : "ตรวจอีกครั้ง"}</button>
                            <button type="button" onClick={applyStandardTemplate} className={heroPrimaryButtonClass}>เพิ่ม 23 กลุ่มมาตรฐาน</button>
                        </>
                    )}
                    aside={readiness ? <HeroProgress label="กลุ่มที่พร้อม" value={`${readiness.ready_team_count}/${readiness.team_count}`} unit="" percent={pct} note={pct >= 100 ? "พร้อมทุกกลุ่ม" : "กลุ่มที่ยังไม่พร้อมแสดงด้านล่าง"} /> : null}
                />
                {readiness?.teams?.length ? (
                    <section className="rounded-2xl border border-slate-200 bg-white p-4 font-[family-name:var(--font-kanit)]" aria-label="สถานะรายกลุ่ม">
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {readiness.teams.map((team) => (
                                <div key={team.session_team_id} className={`rounded-xl border p-3 text-sm ${team.ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                                    <p className="font-semibold text-slate-900">{team.team_code} · {team.team_name_th}</p>
                                    <p className={`mt-1 text-xs ${team.ready ? "text-emerald-800" : "text-amber-900"}`}>{team.ready ? "พร้อมปฏิบัติงาน" : team.issues.join(" • ")}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                ) : null}
                <EOCTeamManager sessionId={sessionId} />
            </div>
        </EOCLayout>
    );
}
