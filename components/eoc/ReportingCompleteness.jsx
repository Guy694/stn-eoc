"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, CheckCircle2, ChevronDown, CircleAlert, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/adminApi";
import { useAuth } from "@/context/AuthContext";
import { Button, useNotice } from "@/components/admin/crud";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function barTone(percent) {
  if (percent >= 100) return "bg-emerald-500";
  if (percent >= 60) return "bg-[#2a9db0]";
  if (percent > 0) return "bg-amber-500";
  return "bg-slate-300";
}

// การ์ด "ความครบของรายงานรายวัน": ห้องประชุมรู้ทันทีว่าตัวเลขวันนี้ครบหรือยัง และส่งเตือนอำเภอที่ยังไม่ส่งได้
export default function ReportingCompleteness({ eocType, sessionId = null, id }) {
  const { user } = useAuth();
  const { notice, success, fail } = useNotice();
  const [date, setDate] = useState(todayKey);
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [expanded, setExpanded] = useState(null);
  const [sending, setSending] = useState(false);
  const canNotify = ["admin", "commander"].includes(user?.role);

  const params = new URLSearchParams({ eoc: eocType, date, ...(sessionId ? { session_id: String(sessionId) } : {}) });
  const url = `/stn-eoc/api/eoc/reporting-completeness?${params}`;

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const data = await apiRequest(url);
      setState({ loading: false, data, error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  const notify = async () => {
    setSending(true);
    try {
      const result = await apiRequest(url, { method: "POST", body: {} });
      success(result.message || "ส่งแจ้งเตือนแล้ว");
    } catch (error) {
      fail(error.message);
    } finally {
      setSending(false);
    }
  };

  const data = state.data;
  const missingDistricts = data?.districts?.filter((item) => item.missing.length) || [];

  return (
    <section id={id} className="mb-6 scroll-mt-20 rounded-xl border border-[#c9dcee] bg-white p-5 shadow-sm">
      {notice}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-900">ความครบของรายงานรายวัน</h3>
          <p className="text-sm text-slate-600">นับตำบลที่มีการบันทึกข้อมูลในวันที่เลือก ใช้ตรวจก่อนนำตัวเลขเข้าห้องประชุม</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`completeness-date-${eocType}`}>วันที่</label>
          <input id={`completeness-date-${eocType}`} type="date" value={date} max={todayKey()} onChange={(event) => setDate(event.target.value || todayKey())}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b4c86]/40" />
          <Button variant="secondary" onClick={load} disabled={state.loading} aria-label="โหลดใหม่"><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} /></Button>
          {canNotify && data?.session ? (
            <Button onClick={notify} disabled={sending || !data.telegram_ready || !missingDistricts.length}
              title={!data.telegram_ready ? "ยังไม่ได้ตั้งค่า Telegram ของศูนย์" : !missingDistricts.length ? "ทุกตำบลส่งครบแล้ว" : "ส่งรายชื่อตำบลที่ยังไม่ส่งไปกลุ่ม Telegram"}>
              <BellRing className="h-4 w-4" />{sending ? "กำลังส่ง..." : "ส่งเตือนทาง Telegram"}
            </Button>
          ) : null}
        </div>
      </div>

      {state.error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}
      {!state.loading && data && !data.session ? <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{data.message}</p> : null}

      {data?.session ? (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
            <p className="text-3xl font-black text-[#0b4c86]">{data.percent}%</p>
            <p className="pb-1 text-sm text-slate-600">ส่งแล้ว <b className="text-slate-900">{data.reported}</b> จาก {data.total} ตำบล</p>
            {data.records_path ? <Link href={data.records_path} className="pb-1 text-sm font-bold text-[#0b4c86] underline-offset-2 hover:underline">ไปหน้าบันทึกข้อมูล</Link> : null}
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={data.percent} aria-valuemin={0} aria-valuemax={100} aria-label="ความครบของรายงาน">
            <div className={`h-full rounded-full ${barTone(data.percent)}`} style={{ width: `${data.percent}%` }} />
          </div>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {data.districts.map((district) => {
              const percent = district.total ? Math.round((district.reported / district.total) * 100) : 0;
              const open = expanded === district.district;
              return (
                <li key={district.district} className="rounded-lg border border-slate-200">
                  <button type="button" onClick={() => setExpanded(open ? null : district.district)} aria-expanded={open}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                    {district.missing.length ? <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-900">อ.{district.district}</span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full ${barTone(percent)}`} style={{ width: `${percent}%` }} /></span>
                    </span>
                    <span className="text-xs font-bold text-slate-600">{district.reported}/{district.total}</span>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open ? (
                    <div className="border-t border-slate-100 px-3 py-2 text-xs">
                      {district.missing.length ? <p className="text-amber-800"><b>ยังไม่ส่ง:</b> {district.missing.join(", ")}</p> : <p className="text-emerald-700">ส่งครบทุกตำบล</p>}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
}
