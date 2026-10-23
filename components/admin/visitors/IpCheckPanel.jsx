"use client";

// ตรวจว่าระบบอ่าน IP ของผู้เข้าชมถูกไหม: ถ้าทุกคนขึ้นเป็น IP ของเซิร์ฟเวอร์ แปลว่า TRUST_PROXY ไม่ตรงกับจำนวน proxy
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/admin/crud";
import { apiRequest } from "@/lib/adminApi";

export default function IpCheckPanel() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    try {
      setState({ ok: true, ...(await apiRequest("/stn-eoc/api/admin/visitor-log?mode=whoami")) });
    } catch (error) {
      setState({ ok: false, error: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="rounded-2xl border border-slate-200 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-800">ทุกคนขึ้น IP เดียวกัน (เป็น IP ของเซิร์ฟเวอร์)? ตรวจการรับ IP ที่นี่</summary>
      <div className="space-y-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-700">
        <ol className="list-decimal space-y-1 pl-5">
          <li>เปิด thaiware.com/tool/checkip ด้วยเครื่องนี้ จด IP ของคุณ</li>
          <li>กดปุ่มด้านล่าง แล้วดูว่า IP ของคุณอยู่แถวไหน</li>
          <li>ตั้ง <code className="rounded bg-slate-100 px-1">TRUST_PROXY</code> ใน .env บนเซิร์ฟเวอร์ตามแถวนั้น แล้วรัน <code className="rounded bg-slate-100 px-1">docker compose up -d stn-eoc-app</code></li>
        </ol>
        <Button variant="secondary" onClick={check} disabled={busy}><Search className="h-4 w-4" aria-hidden="true" /> {busy ? "กำลังตรวจ…" : "ตรวจ IP ที่ระบบเห็นจากเครื่องนี้"}</Button>
        {state && !state.ok ? <p role="alert" className="text-red-700">{state.error}</p> : null}
        {state?.ok ? (
          <div className="space-y-2">
            <p>ตอนนี้ <code className="rounded bg-slate-100 px-1">TRUST_PROXY={state.trustProxy}</code> → ระบบบันทึก IP ของคุณเป็น <strong className="font-mono">{state.chosen}</strong></p>
            {state.options?.length ? (
              <table className="w-full max-w-md text-left text-sm">
                <thead className="text-xs text-slate-500"><tr><th className="py-1 pr-3">ถ้าตั้ง TRUST_PROXY</th><th className="py-1">ระบบจะเห็น IP</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {state.options.map((option) => (
                    <tr key={option.trustProxy} className={option.trustProxy === state.trustProxy ? "bg-sky-50" : ""}>
                      <td className="py-1.5 pr-3 font-mono">{option.trustProxy}</td>
                      <td className="py-1.5 font-mono">{option.ip}{option.trustProxy === state.trustProxy ? <span className="ml-2 font-sans text-xs text-slate-500">(ค่าปัจจุบัน)</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                ไม่มี header <code>X-Forwarded-For</code> ส่งมาถึงแอป{state.realIp ? ` (X-Real-IP = ${state.realIp})` : ""} — ต้องตั้ง nginx ให้ส่ง IP ผู้ใช้มา:
                <code className="mt-1 block whitespace-pre-wrap rounded bg-white p-2 text-xs text-slate-800">{"proxy_set_header X-Real-IP $remote_addr;\nproxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"}</code>
              </p>
            )}
            {state.cfConnectingIp ? <p className="text-xs text-slate-500">พบ Cloudflare (CF-Connecting-IP = {state.cfConnectingIp}) — ถ้าเป็น IP ของคุณ ให้ตั้ง nginx ใช้ real_ip จาก Cloudflare</p> : null}
            <p className="text-xs text-slate-500">ถ้า IP ของคุณไม่อยู่ในตารางเลย แปลว่าตัวกลางชั้นนอก (เช่น proxy/ไฟร์วอลล์ที่ส่งต่อมายังเซิร์ฟเวอร์) ไม่ได้ส่ง IP จริงต่อมา ต้องตั้งที่ตัวกลางนั้น</p>
          </div>
        ) : null}
      </div>
    </details>
  );
}
