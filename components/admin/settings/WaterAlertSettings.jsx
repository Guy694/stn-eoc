"use client";

// ตั้งค่า/ตรวจสอบแจ้งเตือนระดับน้ำ (หน้าตั้งค่าระบบ → การแจ้งเตือน)
import { useCallback, useEffect, useState } from "react";
import { Play, RefreshCw, Speech, Volume2 } from "lucide-react";
import { setVoiceEnabled, speak, speechSupported, voiceEnabled, waitForVoices } from "@/lib/alertSpeech";
import { StatusPill, useNotice } from "@/components/admin/crud";
import { apiRequest, formatDateTime } from "@/lib/adminApi";

const API = "/stn-eoc/api/eoc/water-alerts";
const STATE_META = {
  critical: { tone: "red", label: "วิกฤต" },
  danger: { tone: "red", label: "อันตราย" },
  warning: { tone: "amber", label: "เตือนภัย" },
  overflow: { tone: "red", label: "ล้นตลิ่ง" },
  near: { tone: "amber", label: "ใกล้ล้นตลิ่ง" },
  severe: { tone: "red", label: "ฝนหนักมาก" },
  watch: { tone: "amber", label: "ฝนหนัก" },
  normal: { tone: "green", label: "ปกติ" }
};
const LEVEL_META = { critical: { tone: "red", label: "วิกฤต" }, serious: { tone: "amber", label: "เฝ้าระวัง" }, info: { tone: "green", label: "คลี่คลาย" } };

const Code = ({ children }) => <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-800">{children}</code>;

function bankText(value) {
  if (value === null || value === undefined) return "-";
  const number = Number(value);
  return number > 0 ? `สูงกว่าตลิ่ง ${number.toFixed(2)} ม.` : `ต่ำกว่าตลิ่ง ${Math.abs(number).toFixed(2)} ม.`;
}

export default function WaterAlertSettings() {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const { notice, success, fail } = useNotice();

  const load = useCallback(async () => {
    try {
      setState({ loading: false, data: await apiRequest(`${API}?overview=1`), error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const dryRun = async () => {
    setBusy(true);
    try {
      const result = await apiRequest(`${API}?dry=1`, { method: "POST" });
      setPreview(result);
      success(result.message);
    } catch (error) {
      fail(error.message);
    } finally {
      setBusy(false);
    }
  };
  const [voice, setVoice] = useState({ supported: false, thai: null, on: true });
  useEffect(() => {
    if (!speechSupported()) return;
    waitForVoices().then((found) => setVoice({ supported: true, thai: found ? `${found.name} (${found.lang})` : "", on: voiceEnabled() }));
  }, []);
  const toggleVoice = (on) => {
    setVoiceEnabled(on);
    setVoice((current) => ({ ...current, on }));
  };
  const testVoice = () => speak("แจ้งเตือนระดับน้ำ ทดสอบ น้ำล้นตลิ่ง สถานีตัวอย่าง อำเภอละงู สูงกว่าตลิ่ง 0.25 เมตร", { force: true });
  const testLocal = (level, kind = "water") => window.dispatchEvent(new CustomEvent("water-alert:test", { detail: { level, kind } }));

  const data = state.data;
  const waterStates = (data?.states || []).filter((row) => row.kind !== "rain");
  const rainStates = (data?.states || []).filter((row) => row.kind === "rain");
  const rainActive = rainStates.filter((row) => row.state !== "normal");
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h3 className="font-black text-slate-900">แจ้งเตือนระดับน้ำในคลองและฝนหนัก</h3>
          <p className="mt-0.5 text-sm text-slate-600">ระบบตรวจสถานีวัดระดับน้ำของ ปภ. และสถานีวัดฝนของ สสน. (ThaiWater) ในสตูลอัตโนมัติ เมื่อน้ำใกล้ล้น/ล้นตลิ่ง หรือฝนหนัก จะส่ง Telegram และเด้งหน้าจอพร้อมเสียงให้เจ้าหน้าที่ที่เปิดระบบอยู่ — ทำงานแม้ยังไม่เปิด EOC</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={dryRun} disabled={busy || !data?.can_run} className="inline-flex items-center gap-1.5 rounded-lg border border-[#c9dcee] bg-white px-3 py-2 text-sm font-bold text-[#0b4c86] hover:bg-[#edf5fc] disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" /> ตรวจตอนนี้ (ไม่ส่ง)
          </button>
          <button type="button" onClick={() => testLocal("critical")} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0b4c86] px-3 py-2 text-sm font-bold text-white hover:bg-[#083865]">
            <Volume2 className="h-4 w-4" aria-hidden="true" /> ทดสอบเสียงและ popup
          </button>
        </div>
      </div>
      <div className="space-y-4 p-5">
        {notice}
        {state.loading ? <p className="text-sm text-slate-500">กำลังโหลด…</p> : null}
        {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : null}
        {data && !data.ready ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">ยังไม่มีตารางแจ้งเตือนระดับน้ำ — รัน <Code>npm run db:migrate</Code> บนเซิร์ฟเวอร์</p> : null}

        {data?.ready ? (
          <>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">เกณฑ์แจ้งเตือนระดับน้ำ</dt><dd className="font-bold text-slate-900">ใช้สถานะเฝ้าระวังขึ้นไปตามเกณฑ์ของสถานี ปภ.</dd></div>
              <div><dt className="text-slate-500">ระดับอันตราย</dt><dd className="font-bold text-slate-900">แจ้งเมื่อสถานี ปภ. อยู่ในสถานะอันตรายหรือวิกฤต</dd></div>
              <div><dt className="text-slate-500">เกณฑ์ “ฝนหนัก” / “ฝนหนักมาก”</dt><dd className="font-bold text-slate-900">ฝน 24 ชม. ≥ {data.rain_thresholds.watchMm} / ≥ {data.rain_thresholds.severeMm} มม. ต่อสถานี</dd></div>
              <div><dt className="text-slate-500">ตรวจอัตโนมัติ</dt><dd className="font-bold text-slate-900">{data.scheduler === "off" ? <span className="text-amber-700">ปิดอยู่ (โหมดพัฒนา)</span> : `ทุก ${data.scheduler} นาที`}</dd></div>
              <div><dt className="text-slate-500">Telegram</dt><dd className="font-bold text-slate-900">{!data.telegram_ready ? <span className="text-amber-700">ยังไม่ได้ตั้งค่า</span> : data.sending_enabled ? "ส่งเข้ากลุ่มแจ้งเตือนของศูนย์" : <span className="text-amber-700">ปิดส่งชั่วคราว</span>}</dd></div>
            </dl>

            {preview?.alerts?.length ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="font-bold text-amber-950">ถ้าตรวจตอนนี้จะแจ้ง:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-950">{preview.alerts.map((item) => <li key={item.stationId}>{item.title}{item.kind === "rain" ? ` (${item.rain24h.toFixed(1)} มม.)` : ""}</li>)}</ul>
              </div>
            ) : null}

            <div>
              <h4 className="mb-2 text-sm font-black text-slate-800">สถานีวัดระดับน้ำ</h4>
              {waterStates.length ? (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {waterStates.map((row) => (
                    <li key={row.station_id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <StatusPill tone={STATE_META[row.state]?.tone}>{row.kind === "water" ? ({ normal: "ปกติ", watch: "เฝ้าระวัง", near: "เฝ้าระวัง", warning: "เตือนภัย", danger: "อันตราย", overflow: "อันตราย", critical: "วิกฤต" }[row.state] || row.state) : (STATE_META[row.state]?.label || row.state)}</StatusPill>
                      <span className="font-bold text-slate-900">{row.station_name}</span>
                      <span className="text-slate-600">{bankText(row.bank_diff)}</span>
                      <span className="ml-auto text-xs text-slate-500">วัดเมื่อ {formatDateTime(row.observed_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">ยังไม่เคยตรวจ — ระบบจะเริ่มตรวจเองหลังเซิร์ฟเวอร์เริ่มทำงาน หรือกด “ตรวจตอนนี้”</p>}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-black text-slate-800">สถานีวัดฝน</h4>
              {rainStates.length ? (
                rainActive.length ? (
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {rainActive.map((row) => (
                      <li key={row.station_id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                        <StatusPill tone={STATE_META[row.state]?.tone}>{STATE_META[row.state]?.label || row.state}</StatusPill>
                        <span className="font-bold text-slate-900">{row.station_name}</span>
                        <span className="ml-auto text-xs text-slate-500">วัดเมื่อ {formatDateTime(row.observed_at)}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-slate-600">ทั้ง {rainStates.length} สถานีฝนอยู่ต่ำกว่าเกณฑ์ฝนหนัก</p>
              ) : <p className="text-sm text-slate-500">ยังไม่เคยตรวจ</p>}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-black text-slate-800">ประวัติการแจ้งเตือน</h4>
              {data.log.length ? (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {data.log.map((row) => (
                    <li key={row.id} className="px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={LEVEL_META[row.level]?.tone}>{LEVEL_META[row.level]?.label}</StatusPill>
                        <span className="font-bold text-slate-900">{row.title}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">{formatDateTime(row.created_at)} · {row.delivered_count ? `ส่ง Telegram ${row.delivered_count} กลุ่ม` : "ไม่ได้ส่ง Telegram"}</div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">ยังไม่มีการแจ้งเตือน</p>}
            </div>
          </>
        ) : null}

        <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 font-bold text-slate-900">
              <input type="checkbox" checked={voice.on} onChange={(event) => toggleVoice(event.target.checked)} disabled={!voice.supported} />
              <Speech className="h-4 w-4" aria-hidden="true" /> อ่านแจ้งเตือนเป็นเสียงพูด
            </label>
            <button type="button" onClick={testVoice} disabled={!voice.thai} className="text-xs font-bold text-[#0b4c86] underline disabled:text-slate-400 disabled:no-underline">ทดสอบเสียงพูด</button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {!voice.supported ? "เบราว์เซอร์นี้ไม่รองรับเสียงพูด จะมีแค่เสียงสัญญาณ"
              : voice.thai ? `หลังเสียงสัญญาณจะพูดหัวข้อ เช่น “แจ้งเตือนระดับน้ำ น้ำล้นตลิ่ง สถานี…” หรือ “แจ้งเตือนปริมาณฝนตก ฝนหนักมาก…” · เสียงที่ใช้: ${voice.thai} · ตั้งค่าเฉพาะเครื่องนี้`
                : "เครื่องนี้ยังไม่มีเสียงภาษาไทย จึงมีแค่เสียงสัญญาณ — ติดตั้งเสียงภาษาไทยในการตั้งค่าภาษา/การอ่านออกเสียงของเครื่อง (Windows: Settings › Time & language › Speech, macOS: การช่วยการเข้าถึง › เนื้อหาที่พูด) แล้วเปิดเบราว์เซอร์ใหม่"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <Play className="h-3.5 w-3.5" aria-hidden="true" /> ทดสอบระดับอื่น:
          <button type="button" onClick={() => testLocal("serious")} className="font-bold text-amber-700 underline">ใกล้ล้นตลิ่ง</button>
          <button type="button" onClick={() => testLocal("info")} className="font-bold text-emerald-700 underline">น้ำลดแล้ว</button>
          <button type="button" onClick={() => testLocal("critical", "rain")} className="font-bold text-sky-700 underline">ฝนหนักมาก</button>
          <span>(ทดสอบเฉพาะเครื่องนี้ ไม่ส่งหาใคร)</span>
        </div>
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          <b className="text-slate-800">วิธีเปลี่ยน:</b> ตั้งใน <Code>.env</Code> — เกณฑ์ใกล้ล้นตลิ่ง <Code>WATER_ALERT_NEAR_M=0.5</Code> · เกณฑ์ฝน <Code>RAIN_ALERT_WATCH_MM=35.1</Code> <Code>RAIN_ALERT_SEVERE_MM=90.1</Code> · รอบตรวจ <Code>WATER_ALERTS_INTERVAL_MIN=10</Code> (5–60 นาที, <Code>off</Code> = ปิด)
          · ปิดส่ง Telegram ชั่วคราวใช้ <Code>EOC_ALERTS_TELEGRAM=off</Code> เดียวกับแจ้งเตือนอื่น · เสียงในเบราว์เซอร์จะดังได้หลังผู้ใช้แตะหน้าเว็บอย่างน้อยหนึ่งครั้ง
        </p>
      </div>
    </section>
  );
}
