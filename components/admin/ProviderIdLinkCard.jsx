"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Link2, Unlink } from "lucide-react";
import { StatusPill } from "@/components/admin/crud";
import { formatDateTime } from "@/lib/adminApi";
import { notify } from "@/lib/notify";

const PROVIDER_ERRORS = new Set(["provider_config", "provider_failed", "provider_none", "provider_taken", "provider_link", "provider_profile"]);

/** เชื่อมบัญชี Provider ID (Health ID กระทรวงสาธารณสุข) เพื่อใช้เข้าสู่ระบบครั้งต่อไป */
export default function ProviderIdLinkCard({ className = "" }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/stn-eoc/api/auth/provider-id/link/", { cache: "no-store" });
      const json = await response.json();
      if (json.success) setStatus(json);
    } catch {
      setStatus({ enabled: false, linked: false });
    }
  }, []);

  useEffect(() => {
    load();
    // ผลจากการเชื่อมบัญชี (Health ID redirect กลับมาที่หน้าโปรไฟล์)
    const params = new URLSearchParams(window.location.search);
    if (params.get("provider") === "linked") notify.success("เชื่อมบัญชี Provider ID แล้ว ครั้งต่อไปกด “เข้าสู่ระบบด้วย Provider ID” ที่หน้าเข้าสู่ระบบได้เลย");
    else if (PROVIDER_ERRORS.has(params.get("error"))) notify.error(params.get("message") || "เชื่อมบัญชีไม่สำเร็จ");
  }, [load]);

  const unlink = async () => {
    setBusy(true);
    try {
      const response = await fetch("/stn-eoc/api/auth/provider-id/link/", { method: "DELETE" });
      const json = await response.json();
      (json.success ? notify.success : notify.error)(json.message || (json.success ? "ยกเลิกแล้ว" : "ยกเลิกไม่สำเร็จ"));
      await load();
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (!status) body = <p className="mt-3 text-sm text-slate-500">กำลังตรวจสอบ…</p>;
  else if (status.migration_required) body = <p className="mt-3 text-sm text-slate-600">ผู้ดูแลระบบยังไม่ได้เปิดใช้ (ต้องรัน migration 20261016_provider_id_login.sql)</p>;
  else if (status.linked) body = (
    <div className="mt-3 space-y-2 text-sm text-slate-700">
      <p>Provider ID <b className="tabular-nums">{status.provider_id || "-"}</b>{status.organization ? <> · {status.organization}{status.hcode ? ` (${status.hcode})` : ""}</> : null}</p>
      {status.linked_at ? <p className="text-xs text-slate-500">เชื่อมเมื่อ {formatDateTime(status.linked_at)}</p> : null}
      <button type="button" disabled={busy} onClick={unlink} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
        <Unlink className="h-4 w-4" aria-hidden="true" />{busy ? "กำลังยกเลิก…" : "ยกเลิกการเชื่อม"}
      </button>
    </div>
  );
  else if (!status.enabled) body = <p className="mt-3 text-sm text-slate-600">ผู้ดูแลระบบยังไม่ได้ตั้งค่าการเชื่อมต่อ Health ID / Provider ID</p>;
  else body = (
    <div className="mt-4">
      <a href="/stn-eoc/api/auth/provider-id/authorize/?link=1" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0b6b4f] px-4 text-sm font-bold text-white hover:bg-[#08553f]">
        <Link2 className="h-4 w-4" aria-hidden="true" />เชื่อม Provider ID
      </a>
    </div>
  );

  return (
    <section className={`rounded-xl border border-[#c9dcee] bg-white p-5 shadow-sm sm:p-6 ${className}`} aria-labelledby="provider-id-title">
      <h3 id="provider-id-title" className="flex flex-wrap items-center gap-2 font-black text-slate-900">
        <Image src="/stn-eoc/img/provider-id.png" alt="" width={326} height={128} className="h-7 w-auto" />เข้าสู่ระบบด้วย Provider ID
        {status && !status.migration_required ? (status.linked ? <StatusPill tone="green">เชื่อมแล้ว</StatusPill> : <StatusPill tone="gray">ยังไม่เชื่อม</StatusPill>) : null}
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        บุคลากรสาธารณสุขที่มีบัญชี Health ID / Provider ID ของกระทรวงสาธารณสุข เชื่อมครั้งเดียวแล้วเข้าสู่ระบบได้โดยไม่ต้องใช้รหัสผ่าน
      </p>
      {body}
    </section>
  );
}
