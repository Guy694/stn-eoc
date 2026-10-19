"use client";

// แจ้งเตือนอัตโนมัติ (Telegram): ระบบตรวจทุกครั้งที่มีการบันทึกข้อมูลสำคัญ และส่งเรื่องใหม่ครั้งเดียวต่อเรื่อง
import { useCallback, useEffect, useState } from "react";
import { BellRing, CheckCircle2 } from "lucide-react";
import { Button, useNotice } from "@/components/admin/crud";
import { apiRequest, formatDateTime } from "@/lib/adminApi";

export default function AlertsPanel({ eocType = "flood" }) {
  const { notice, success, fail } = useNotice();
  const [state, setState] = useState({ loading: true, data: null });
  const [busy, setBusy] = useState(false);
  const url = `/stn-eoc/api/eoc/alerts?eoc=${eocType}`;
  const load = useCallback(async () => {
    try {
      setState({ loading: false, data: await apiRequest(url) });
    } catch {
      setState({ loading: false, data: null });
    }
  }, [url]);
  useEffect(() => { load(); }, [load]);

  const run = async () => {
    setBusy(true);
    try {
      const result = await apiRequest(url, { method: "POST", body: {} });
      success(result.message);
      load();
    } catch (error) {
      fail(error.message);
    } finally {
      setBusy(false);
    }
  };

  const data = state.data;
  if (!data?.session) return null;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 print:hidden">
      {notice}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-black text-slate-900"><BellRing className="h-4 w-4" />แจ้งเตือนอัตโนมัติ</h2>
          <p className="text-xs text-slate-500">
            ระบบตรวจทุกครั้งที่มีการบันทึกยอดศูนย์ เวชภัณฑ์ โรคในศูนย์ หรือปัญหา IT แล้วส่งเรื่องใหม่ไป Telegram ของศูนย์ (ไม่ส่งเรื่องเดิมซ้ำ)
          </p>
          {!data.telegram_ready ? <p className="mt-1 text-xs font-semibold text-amber-700">ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN / TELEGRAM_NOTIFY_CHAT_IDS — ระบบจะบันทึกเรื่องไว้แต่ยังไม่ส่ง</p> : null}
          {data.telegram_ready && data.sending_enabled === false ? <p className="mt-1 text-xs font-semibold text-amber-700">ปิดการส่ง Telegram อยู่ (EOC_ALERTS_TELEGRAM=off) — ระบบบันทึกเรื่องไว้แต่ไม่ส่งออก</p> : null}
          {!data.log_ready ? <p className="mt-1 text-xs font-semibold text-amber-700">ยังไม่มีตารางบันทึกการแจ้งเตือน ให้รัน npm run db:migrate</p> : null}
        </div>
        {data.can_run ? <Button variant="secondary" disabled={busy || !data.log_ready} onClick={run}>{busy ? "กำลังตรวจ..." : "ตรวจและส่งตอนนี้"}</Button> : null}
      </div>
      {data.pending.length ? (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-bold">รอส่ง {data.pending.length} เรื่อง</p>
          <ul className="mt-1 list-disc pl-5">{data.pending.map((alert) => <li key={alert.key}>{alert.text}</li>)}</ul>
        </div>
      ) : <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />ไม่มีเรื่องใหม่ที่ต้องแจ้ง</p>}
      {data.log.length ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">ประวัติที่แจ้งแล้ว ({data.log.length})</summary>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {data.log.map((row) => (
              <li key={row.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span className="text-slate-800">{row.message}</span>
                <span className="text-xs text-slate-500">{formatDateTime(row.created_at)}{row.delivered_count ? ` · ส่ง ${row.delivered_count} กลุ่ม` : " · ยังไม่ได้ส่ง"}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
