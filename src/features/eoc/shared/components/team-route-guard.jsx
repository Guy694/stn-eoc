"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import { normalizeEocType } from "../../registries/eoc-type.registry";
import { normalizeTeamCode } from "../../registries/team.registry";

export default function TeamRouteGuard({ eocType, teamCode, children }) {
  const { user, loading: authLoading } = useAuth();
  const [assignments, setAssignments] = useState(null);
  const [assignmentError, setAssignmentError] = useState("");

  useEffect(() => {
    if (authLoading || !user || ["admin", "commander"].includes(user.role)) return;
    let active = true;
    const sessionId = new URLSearchParams(window.location.search).get("sessionId");
    const assignmentPath = sessionId
      ? `/stn-eoc/api/user/my-assignments/?sessionId=${encodeURIComponent(sessionId)}`
      : "/stn-eoc/api/user/my-assignments/";
    fetch(assignmentPath)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "ไม่สามารถตรวจสอบสิทธิ์ทีมได้");
        if (active) setAssignments(result.assignments || []);
      })
      .catch((error) => {
        if (active) setAssignmentError(error.message || "ไม่สามารถตรวจสอบสิทธิ์ทีมได้");
      });
    return () => { active = false; };
  }, [authLoading, user]);

  const hasAccess = useMemo(() => {
    if (!user) return false;
    if (["admin", "commander"].includes(user.role)) return true;
    if (!assignments) return false;
    return assignments.some((assignment) =>
      normalizeEocType(assignment.eoc_type) === eocType
      && normalizeTeamCode(assignment.team_code) === teamCode
    );
  }, [assignments, eocType, teamCode, user]);

  const checkingAssignment = user
    && !["admin", "commander"].includes(user.role)
    && assignments === null
    && !assignmentError;

  if (authLoading || checkingAssignment) {
    return <EOCLayout><RouteMessage title="กำลังตรวจสอบสิทธิ์" detail="กรุณารอสักครู่..." /></EOCLayout>;
  }

  if (!user) return null;

  if (!hasAccess) {
    return (
      <EOCLayout>
        <RouteMessage
          title="ไม่มีสิทธิ์เข้าถึงกลุ่มภารกิจนี้"
          detail={assignmentError || "บัญชีของคุณไม่ได้รับมอบหมายให้ทำงานในกลุ่มภารกิจนี้"}
        >
          <Link href="/eoc/staff" className="mt-4 inline-flex bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800">
            กลับไปยังศูนย์งานเจ้าหน้าที่
          </Link>
        </RouteMessage>
      </EOCLayout>
    );
  }

  return children;
}

function RouteMessage({ title, detail, children }) {
  return (
    <section className="mx-auto max-w-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-black text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{detail}</p>
      {children}
    </section>
  );
}
