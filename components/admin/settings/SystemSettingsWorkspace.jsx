"use client";

// ตั้งค่าระบบ (เฉพาะผู้ดูแลระบบ)
// หลักการ: ทุกอย่างในหน้านี้ "ทำงานจริง" — ค่าที่แก้ได้เฉพาะบนเซิร์ฟเวอร์ (.env / คำสั่ง) แสดงสถานะและวิธีแก้ ไม่ทำปุ่มหลอก
// ค่าความลับไม่ถูกส่งมาที่หน้าเว็บ (เห็นแค่ "ตั้งค่าแล้วหรือยัง")
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Activity, AlertTriangle, BarChart3, BellRing, CheckCircle2, Construction, DatabaseBackup, ExternalLink, Map as MapIcon,
  KeyRound, Megaphone, PlugZap, RefreshCw, ShieldCheck, Users, XCircle, FlaskConical
} from "lucide-react";
import { AdminPage, StatusPill, useNotice } from "@/components/admin/crud";
import AppDialog, { AppDialogActions, AppDialogCancel } from "@/components/ui/app-dialog";
import { useUrlState } from "@/components/admin/useUrlState";
import { apiRequest, formatDateTime, formatNumber } from "@/lib/adminApi";
import SiteVisitorStatistics from "@/components/admin/settings/SiteVisitorStatistics";
import ModulePermissions from "@/components/admin/settings/ModulePermissions";
import WaterAlertSettings from "@/components/admin/settings/WaterAlertSettings";
import MaintenanceSettings from "@/components/admin/settings/MaintenanceSettings";
import PublicPushSettings from "@/components/admin/settings/PublicPushSettings";
import TestDataSettings from "@/components/admin/settings/TestDataSettings";

const API = "/stn-eoc/api/admin/system-status";

const SECTIONS = [
  { value: "overview", label: "ภาพรวมระบบ", hint: "สุขภาพระบบและสิ่งที่ต้องแก้", icon: Activity },
  { value: "alerts", label: "การแจ้งเตือน", hint: "Telegram ของศูนย์", icon: BellRing },
  { value: "integrations", label: "การเชื่อมต่อภายนอก", hint: "สถานะและทดสอบการเชื่อมต่อ", icon: PlugZap },
  { value: "security", label: "ความปลอดภัย", hint: "นโยบายรหัสผ่านและการเข้าสู่ระบบ", icon: ShieldCheck },
  { value: "roles", label: "สิทธิ์และบทบาท", hint: "แต่ละบทบาททำอะไรได้บ้าง", icon: Users },
  { value: "modules", label: "สิทธิ์กลุ่มภารกิจ", hint: "ทีมไหนบันทึกเมนูไหนของเหตุการณ์ได้", icon: KeyRound },
  { value: "public-push", label: "แจ้งเตือนประชาชน", hint: "เด้งเตือนภัยบนมือถือประชาชน", icon: Megaphone },
  { value: "maintenance", label: "ปิดปรับปรุงระบบ", hint: "ปิดหน้าเว็บชั่วคราวระหว่างปรับปรุง", icon: Construction },
  { value: "backup", label: "สำรองข้อมูล", hint: "ไฟล์สำรองและวิธีสำรอง/กู้คืน", icon: DatabaseBackup },
  { value: "test-data", label: "ข้อมูลทดสอบ", hint: "ลบข้อมูลที่ติดป้าย [ทดสอบ] ก่อนใช้งานจริง", icon: FlaskConical },
  { value: "visitors", label: "สถิติผู้เข้าชม", hint: "เว็บไซต์สาธารณะ", icon: BarChart3 },
  { value: "data", label: "ข้อมูลพื้นที่และข้อมูลอ้างอิง", hint: "ทางลัดไปหน้าจัดการข้อมูลกลาง", icon: MapIcon }
];

const TONE = {
  ok: { icon: CheckCircle2, cls: "text-emerald-600", border: "border-l-emerald-600", label: "ปกติ" },
  warn: { icon: AlertTriangle, cls: "text-amber-600", border: "border-l-amber-500", label: "ควรตรวจ" },
  bad: { icon: XCircle, cls: "text-red-600", border: "border-l-red-600", label: "ต้องแก้" }
};

function Panel({ title, description, children, actions }) {
  return (
    <section className="rounded-xl border border-[#c9dcee] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h3 className="font-black text-slate-900">{title}</h3>
          {description ? <p className="mt-0.5 text-sm text-slate-600">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Row({ label, children }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2.5 last:border-0 sm:grid-cols-[14rem_1fr] sm:gap-4">
      <dt className="text-sm font-semibold text-slate-600">{label}</dt>
      <dd className="text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function HowToChange({ children }) {
  return <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600"><b className="text-slate-800">วิธีเปลี่ยน:</b> {children}</p>;
}

const Code = ({ children }) => <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-800">{children}</code>;

function Overview({ data }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {data.checks.map((check) => {
          const tone = TONE[check.tone] || TONE.warn;
          const Icon = tone.icon;
          return (
            <div key={check.key} className={`flex gap-3 rounded-xl border border-l-4 border-slate-200 bg-white p-4 shadow-sm ${tone.border}`}>
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone.cls}`} aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-black text-slate-900">{check.title} <span className="sr-only">({tone.label})</span></p>
                <p className="text-sm text-slate-600">{check.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
      <Panel title="ฐานข้อมูลและเซิร์ฟเวอร์">
        <dl>
          <Row label="ฐานข้อมูล">{data.db.ok ? `MySQL ${data.db.version}` : <span className="text-red-700">{data.db.error}</span>}</Row>
          {data.db.ok ? <>
            <Row label="ขนาด">{formatNumber(data.db.tables)} ตาราง · {data.db.sizeMb} MB</Row>
            <Row label="Time zone">ของการเชื่อมต่อ {data.db.sessionTimezone} · ของเครื่อง DB {data.db.globalTimezone === "SYSTEM" ? "ตามนาฬิกาเครื่อง" : data.db.globalTimezone}{data.db.timezoneOk ? "" : <span className="ml-2 font-bold text-amber-700">ไม่ตรงกับเวลาไทย</span>}</Row>
            <Row label="เวลาของฐานข้อมูล">{formatDateTime(data.db.dbNow)}</Row>
          </> : null}
          <Row label="Migration">{data.migrations.error || (data.migrations.pending.length
            ? <span className="text-red-700">ค้าง {data.migrations.pending.length} ไฟล์: {data.migrations.pending.join(", ")}</span>
            : `รันครบ ${data.migrations.total} ไฟล์`)}</Row>
          <Row label="Node.js">{data.runtime.node} · โหมด {data.runtime.env === "production" ? "ใช้งานจริง" : data.runtime.env}</Row>
        </dl>
        {data.migrations.pending.length ? <HowToChange>รัน <Code>npm run db:migrate</Code> บนเซิร์ฟเวอร์ แล้วรีเฟรชหน้านี้</HowToChange> : null}
      </Panel>
    </div>
  );
}

function Alerts({ data, onTest }) {
  const { alerts } = data;
  return (
    <Panel
      title="แจ้งเตือนอัตโนมัติทาง Telegram"
      description="ระบบส่งเรื่องเร่งด่วน (ผู้เสียชีวิต ศูนย์เต็ม เวชภัณฑ์หมด ปัญหา IT วิกฤต ฯลฯ) เข้ากลุ่มของศูนย์ และไม่ส่งเรื่องเดิมซ้ำ"
      actions={<button type="button" onClick={onTest} disabled={!alerts.ready} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0b4c86] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#083865] disabled:opacity-50">ส่งข้อความทดสอบ</button>}
    >
      <dl>
        <Row label="สถานะ">{alerts.ready
          ? alerts.sendingEnabled ? <StatusPill tone="green">พร้อมส่ง</StatusPill> : <StatusPill tone="amber">ปิดการส่งชั่วคราว</StatusPill>
          : <StatusPill tone="red">ยังไม่ได้ตั้งค่า</StatusPill>}</Row>
        <Row label="กลุ่มที่รับแจ้งเตือน">{alerts.chats.length ? alerts.chats.join(", ") : "-"} <span className="text-slate-500">({alerts.chatCount} กลุ่ม)</span></Row>
        <Row label="กลุ่มแจ้งเหตุความปลอดภัย">{alerts.securityChats.length
          ? <>{alerts.securityChats.join(", ")}{alerts.securityChats.join() === alerts.chats.join() ? <span className="text-slate-500"> (กลุ่มเดียวกับแจ้งเตือนศูนย์ — แยกกลุ่มได้ด้วย TELEGRAM_SECURITY_CHAT_IDS)</span> : null}</>
          : <span className="text-amber-700">ยังไม่ได้ตั้งค่า (เช่น แจ้งเมื่อบัญชีถูกล็อก)</span>}</Row>
        <Row label="ตรวจตามรอบเวลา">{alerts.cronConfigured ? "ตั้งค่าแล้ว" : <span className="text-amber-700">ยังไม่ได้ตั้งค่า — ตอนนี้ตรวจเฉพาะเมื่อมีการบันทึกข้อมูล</span>}</Row>
        <Row label="ประวัติที่แจ้งไปแล้ว"><Link href="/eoc/flood/meeting-brief" className="font-bold text-[#0b4c86] underline">ดูในหน้าสรุปสำหรับห้องประชุม</Link></Row>
      </dl>
      <HowToChange>
        ตั้งใน <Code>.env</Code> บนเซิร์ฟเวอร์: <Code>TELEGRAM_BOT_TOKEN</Code>, <Code>TELEGRAM_HELP_NOTIFY_CHAT_IDS</Code> (หลายกลุ่มคั่นด้วยจุลภาค), <Code>TELEGRAM_SECURITY_CHAT_IDS</Code>
        · ปิดส่งชั่วคราวช่วงซ้อมแผนด้วย <Code>EOC_ALERTS_TELEGRAM=off</Code> · ตรวจตามรอบเวลา: ตั้ง <Code>ALERT_CRON_SECRET</Code> แล้วให้ cron เรียก <Code>POST /stn-eoc/api/eoc/alerts?eoc=flood</Code> พร้อม header <Code>x-cron-secret</Code>
        — แก้แล้วต้องรีสตาร์ตระบบ เก็บค่าไว้ที่เซิร์ฟเวอร์เพื่อไม่ให้ token หลุดผ่านหน้าเว็บ
      </HowToChange>
    </Panel>
  );
}

function Integrations({ data }) {
  const [results, setResults] = useState({});
  const test = async (key) => {
    setResults((current) => ({ ...current, [key]: { loading: true } }));
    try {
      const result = await apiRequest(`${API}?check=${key}`);
      setResults((current) => ({ ...current, [key]: result }));
    } catch (error) {
      setResults((current) => ({ ...current, [key]: { ok: false, detail: error.message } }));
    }
  };
  return (
    <Panel title="การเชื่อมต่อภายนอก" description="ตรวจว่าตั้งค่าครบหรือยัง และทดสอบการเชื่อมต่อจริงได้ (การทดสอบไม่ส่งข้อความหาใคร)">
      <ul className="divide-y divide-slate-100">
        {data.integrations.map((item) => {
          const result = results[item.key];
          return (
            <li key={item.key} className="flex flex-wrap items-center gap-3 py-3">
              {item.configured ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" /> : <XCircle className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900">{item.label} <span className="font-normal text-slate-500">· {item.configured ? "ตั้งค่าแล้ว" : "ยังไม่ได้ตั้งค่า"}</span></p>
                <p className="text-xs text-slate-600">{item.purpose}</p>
                {item.note ? <p className="mt-0.5 text-xs text-slate-500">{item.note}</p> : null}
                {item.missing.length ? <p className="mt-0.5 text-xs text-amber-800">ต้องตั้ง: {item.missing.map((name) => <Code key={name}>{name}</Code>).reduce((acc, el) => (acc.length ? [...acc, " ", el] : [el]), [])}</p> : null}
                {result && !result.loading ? <p className={`mt-1 text-xs font-semibold ${result.ok ? "text-emerald-700" : "text-red-700"}`} role="status">{result.ok ? "เชื่อมต่อได้" : "ไม่ผ่าน"}: {result.detail}</p> : null}
              </div>
              {item.live ? (
                <button type="button" onClick={() => test(item.key)} disabled={result?.loading} className="shrink-0 rounded-lg border border-[#c9dcee] bg-white px-3 py-1.5 text-sm font-bold text-[#0b4c86] hover:bg-[#edf5fc] disabled:opacity-60">
                  {result?.loading ? "กำลังทดสอบ…" : "ทดสอบ"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <HowToChange>ค่ากุญแจและรหัสทั้งหมดตั้งใน <Code>.env</Code> บนเซิร์ฟเวอร์ (ดูตัวอย่างใน <Code>.env.example</Code>) แล้วรีสตาร์ตระบบ</HowToChange>
    </Panel>
  );
}

function Security({ data }) {
  const s = data.security;
  const events = s.events7d;
  return (
    <div className="space-y-4">
      <Panel title="นโยบายที่ใช้อยู่" description="ค่าจริงที่ระบบบังคับใช้ตอนนี้">
        <dl>
          <Row label="รหัสผ่าน">{s.passwordPolicy}</Row>
          <Row label="ล็อกบัญชี">ใส่รหัสผิด {s.lockAfterFailed} ครั้ง ล็อก {s.lockMinutes} นาที และแจ้งกลุ่มความปลอดภัย</Row>
          <Row label="จำกัดการเข้าสู่ระบบต่อ IP">{s.loginRateLimit.limit} ครั้งต่อ {Math.round(s.loginRateLimit.windowSeconds / 60)} นาที</Row>
          <Row label="จำกัดการแจ้งเหตุของประชาชน">{s.publicReportRateLimit.limit} ครั้งต่อ {Math.round(s.publicReportRateLimit.windowSeconds / 60)} นาที ต่อเครื่อง</Row>
          <Row label="หมดเวลาเมื่อไม่ได้ใช้งาน">{s.sessionIdleMinutes} นาที</Row>
          <Row label="อายุการเข้าสู่ระบบสูงสุด">{s.sessionMaxHours} ชั่วโมง</Row>
          <Row label="ยืนยันตัวตนด้วย ThaiD">{s.thaidConfigured ? <StatusPill tone="green">เปิดใช้</StatusPill> : <StatusPill tone="gray">ยังไม่ได้ตั้งค่า</StatusPill>}</Row>
        </dl>
        <HowToChange>
          ระยะหมดเวลาเมื่อไม่ได้ใช้งานตั้งด้วย <Code>SESSION_IDLE_MINUTES</Code> ใน <Code>.env</Code> · ค่าอื่นกำหนดไว้ในโค้ด (<Code>lib/passwordPolicy.js</Code>, <Code>lib/rateLimit.js</Code>)
          ตั้งใจไม่ให้แก้จากหน้าเว็บ เพราะถ้าบัญชีผู้ดูแลถูกยึด ผู้บุกรุกจะลดการป้องกันลงไม่ได้
        </HowToChange>
      </Panel>
      <Panel title="เหตุการณ์ด้านความปลอดภัย 7 วันล่าสุด" actions={<Link href="/admin/activity-logs" className="inline-flex items-center gap-1 rounded-lg border border-[#c9dcee] px-3 py-1.5 text-sm font-bold text-[#0b4c86] hover:bg-[#edf5fc]">ประวัติการใช้งาน <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></Link>}>
        {events ? (
          Object.keys(events).length ? (
            <div className="flex flex-wrap gap-2">
              {Object.entries(events).map(([severity, total]) => (
                <StatusPill key={severity} tone={severity === "critical" ? "red" : severity === "warning" || severity === "high" ? "amber" : "gray"}>
                  {({ critical: "ร้ายแรง", high: "สูง", warning: "เตือน", medium: "ปานกลาง", low: "ต่ำ", info: "ข้อมูล" })[severity] || severity} {formatNumber(total)}
                </StatusPill>
              ))}
            </div>
          ) : <p className="text-sm text-slate-600">ไม่มีเหตุการณ์ผิดปกติ</p>
        ) : <p className="text-sm text-slate-500">ยังไม่มีตารางบันทึกเหตุการณ์ความปลอดภัย</p>}
      </Panel>
    </div>
  );
}

function Roles({ data }) {
  const yes = (value) => (value ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" aria-label="ได้" /> : <span className="text-slate-300" aria-label="ไม่ได้">–</span>);
  return (
    <Panel
      title="สิทธิ์ของแต่ละบทบาท"
      description="บทบาทเป็นค่าตายตัวในระบบ การให้สิทธิ์ทำโดยกำหนดบทบาทให้เจ้าหน้าที่ และจัดคนเข้าทีมของแต่ละเหตุการณ์"
      actions={<Link href="/admin/officers" className="inline-flex items-center gap-1 rounded-lg bg-[#0b4c86] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#083865]">กำหนดบทบาทเจ้าหน้าที่</Link>}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">ตารางสิทธิ์ตามบทบาท</caption>
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-semibold">บทบาท</th>
              <th scope="col" className="px-3 py-2 font-semibold">ดูงาน EOC</th>
              <th scope="col" className="px-3 py-2 font-semibold">บันทึก</th>
              <th scope="col" className="px-3 py-2 font-semibold">แก้ไข</th>
              <th scope="col" className="px-3 py-2 font-semibold">ลบ</th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">เมนูบริหาร</th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">รายงาน</th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">บัญชีผู้ใช้</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.roles.map((row) => (
              <tr key={row.role}>
                <th scope="row" className="px-3 py-2 text-left"><span className="font-bold text-slate-900">{row.name}</span> <span className="text-xs text-slate-500">{row.role}</span></th>
                <td className="px-3 py-2 text-center">{yes(row.eoc.view)}</td>
                <td className="px-3 py-2 text-center">{yes(row.eoc.create)}</td>
                <td className="px-3 py-2 text-center">{yes(row.eoc.edit)}</td>
                <td className="px-3 py-2 text-center">{yes(row.eoc.delete)}</td>
                <td className="px-3 py-2">{row.admin}</td>
                <td className="px-3 py-2">{row.reports}</td>
                <td className="px-3 py-2">{row.users}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <HowToChange>
        ผู้รับผิดชอบรายเหตุการณ์/รายทีม กำหนดที่เมนู &ldquo;ทีมปฏิบัติการ&rdquo; ของแต่ละ EOC · การสร้างบทบาทใหม่หรือปรับสิทธิ์รายเมนูต้องแก้โค้ด
        เพราะสิทธิ์ถูกตรวจในทุก API — ทำผ่านหน้าเว็บจะเสี่ยงเปิดสิทธิ์ผิดโดยไม่รู้ตัว
      </HowToChange>
    </Panel>
  );
}

function Backup({ data }) {
  const { backups } = data;
  const keyReady = data.integrations.find((item) => item.key === "backup-key")?.configured;
  return (
    <Panel title="ไฟล์สำรองฐานข้อมูล" description={`ไฟล์ในโฟลเดอร์ ${backups.directory} ของเซิร์ฟเวอร์ (แสดง 10 ไฟล์ล่าสุด จากทั้งหมด ${backups.total})`}>
      {backups.error ? <p className="text-sm text-amber-800">{backups.error}</p> : null}
      {backups.files.length ? (
        <ul className="divide-y divide-slate-100">
          {backups.files.map((file) => (
            <li key={file.name} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 truncate font-mono text-[13px] text-slate-800">{file.name}</span>
              <span className="text-slate-600">{file.sizeMb} MB · {formatDateTime(file.modifiedAt)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="mt-3">
        <Row label="เข้ารหัสไฟล์สำรอง">{keyReady ? <StatusPill tone="green">ตั้งกุญแจแล้ว</StatusPill> : <StatusPill tone="red">ยังไม่ได้ตั้ง BACKUP_ENCRYPTION_KEY</StatusPill>}</Row>
      </dl>
      <HowToChange>
        สำรอง: <Code>npm run backup:eoc</Code> (ตั้ง cron ให้รันทุกคืนบนเซิร์ฟเวอร์) · ทดสอบกู้คืนลงฐานข้อมูลทดสอบ: <Code>npm run restore:test</Code>
        — การกู้คืนลงฐานข้อมูลจริงไม่มีปุ่มบนหน้าเว็บโดยตั้งใจ เพราะเขียนทับข้อมูลทั้งหมดและย้อนกลับไม่ได้ ต้องทำบนเซิร์ฟเวอร์โดยผู้ดูแลเท่านั้น
        และควรเก็บสำเนาไฟล์สำรองไว้นอกเครื่องเซิร์ฟเวอร์ด้วย
      </HowToChange>
    </Panel>
  );
}

const DATA_LINKS = [
  { href: "/admin/village-polygons", title: "หมู่บ้านและพื้นที่", detail: "อำเภอ ตำบล หมู่บ้าน และขอบเขตแผนที่ (polygon)" },
  { href: "/admin/data-management", title: "ตรวจคุณภาพข้อมูล", detail: "หาข้อมูลซ้ำ ขาด หรือผิดปกติ" },
  { href: "/admin/master-data/agencies", title: "ข้อมูลอ้างอิงอื่น", detail: "หน่วยงาน โรค ภัย ความเสี่ยง เส้นทาง" },
  { href: "/admin/health-facilities", title: "หน่วยบริการสุขภาพ", detail: "รพ. รพ.สต. และพิกัด" },
  { href: "/admin/trash", title: "ถังขยะ", detail: "ข้อมูลที่ถูกลบ กู้คืนได้" },
  { href: "/admin/activity-logs", title: "ประวัติการใช้งาน", detail: "ใครแก้อะไร เมื่อไร" }
];

function DataLinks() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {DATA_LINKS.map((item) => (
        <Link key={item.href} href={item.href} className="rounded-xl border border-[#c9dcee] bg-white p-4 shadow-sm hover:bg-[#edf5fc]">
          <p className="font-black text-slate-900">{item.title}</p>
          <p className="text-sm text-slate-600">{item.detail}</p>
        </Link>
      ))}
    </div>
  );
}

export default function SystemSettingsWorkspace() {
  const [section, setSection] = useUrlState("section", "overview", SECTIONS.map((item) => item.value));
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [confirmTest, setConfirmTest] = useState(false);
  const [sending, setSending] = useState(false);
  const { notice, success, fail } = useNotice();

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      setState({ loading: false, data: await apiRequest(API), error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message || "โหลดสถานะระบบไม่สำเร็จ" });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const sendTest = async () => {
    setSending(true);
    try {
      const result = await apiRequest(API, { method: "POST", body: { action: "test_telegram" } });
      success(result.message);
      setConfirmTest(false);
    } catch (error) {
      fail(error.message);
    } finally {
      setSending(false);
    }
  };

  const current = SECTIONS.find((item) => item.value === section) || SECTIONS[0];
  const needsData = !["visitors", "data", "modules", "maintenance", "public-push"].includes(section);
  const problems = state.data?.checks?.filter((check) => check.tone !== "ok").length || 0;

  return (
    <AdminPage
      title="ตั้งค่าระบบ"
      description="สถานะและการตั้งค่าของทั้งระบบ สำหรับผู้ดูแลระบบ — การตั้งค่าส่วนตัว (รหัสผ่าน) อยู่ที่เมนูบัญชีของฉัน"
      actions={needsData ? (
        <button type="button" onClick={load} disabled={state.loading} className="inline-flex items-center gap-1.5 rounded-lg border border-[#c9dcee] bg-white px-3 py-2 text-sm font-bold text-[#0b4c86] hover:bg-[#edf5fc] disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} aria-hidden="true" />ตรวจอีกครั้ง
        </button>
      ) : null}
    >
      {notice}
      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="หมวดการตั้งค่า" className="flex gap-1 overflow-x-auto rounded-xl border border-[#c9dcee] bg-white p-1.5 shadow-sm lg:flex-col lg:self-start">
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = item.value === section;
            return (
              <button key={item.value} type="button" onClick={() => setSection(item.value)} aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-start gap-2.5 rounded-lg px-3 py-2 text-left ${active ? "bg-[#0b4c86] text-white" : "text-slate-700 hover:bg-[#edf5fc]"}`}>
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-bold">
                    {item.label}
                    {item.value === "overview" && problems ? <span className={`ml-1.5 rounded-full px-1.5 text-[11px] ${active ? "bg-white text-red-700" : "bg-red-600 text-white"}`}>{problems}</span> : null}
                  </span>
                  <span className={`hidden text-xs lg:block ${active ? "text-blue-100" : "text-slate-500"}`}>{item.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-4">
          <h2 className="sr-only">{current.label}</h2>
          {section === "visitors" ? <SiteVisitorStatistics /> : null}
          {section === "data" ? <DataLinks /> : null}
          {section === "modules" ? <ModulePermissions /> : null}
          {section === "maintenance" ? <MaintenanceSettings /> : null}
          {section === "public-push" ? <PublicPushSettings /> : null}
          {section === "test-data" ? <TestDataSettings /> : null}
          {needsData ? (
            state.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error} <button type="button" onClick={load} className="ml-2 font-bold underline">ลองใหม่</button></p>
              : !state.data ? <p className="rounded-xl border border-[#c9dcee] bg-white p-10 text-center text-sm text-slate-500">กำลังตรวจสถานะระบบ…</p>
                : <>
                  {section === "overview" ? <Overview data={state.data} /> : null}
                  {section === "alerts" ? <Alerts data={state.data} onTest={() => setConfirmTest(true)} /> : null}
                  {section === "alerts" ? <WaterAlertSettings /> : null}
                  {section === "integrations" ? <Integrations data={state.data} /> : null}
                  {section === "security" ? <Security data={state.data} /> : null}
                  {section === "roles" ? <Roles data={state.data} /> : null}
                  {section === "backup" ? <Backup data={state.data} /> : null}
                  <p className="text-xs text-slate-500">ตรวจล่าสุด {formatDateTime(state.data.generatedAt)}</p>
                </>
          ) : null}
        </div>
      </div>

      <AppDialog open={confirmTest} onOpenChange={setConfirmTest} title="ส่งข้อความทดสอบเข้ากลุ่ม Telegram?" description="ข้อความจริงจะถูกส่งเข้าทุกกลุ่มที่รับแจ้งเตือนของศูนย์ สมาชิกในกลุ่มจะเห็นข้อความนี้" busy={sending}>
        <p className="text-sm text-slate-700">ข้อความ: &ldquo;ทดสอบการแจ้งเตือนจากหน้าตั้งค่าระบบ … ไม่ต้องดำเนินการใด ๆ&rdquo;</p>
        <AppDialogActions>
          <AppDialogCancel disabled={sending} />
          <button type="button" onClick={sendTest} disabled={sending} className="rounded-lg bg-[#0b4c86] px-4 py-2 text-sm font-bold text-white hover:bg-[#083865] disabled:opacity-60">{sending ? "กำลังส่ง…" : "ส่งข้อความทดสอบ"}</button>
        </AppDialogActions>
      </AppDialog>
    </AdminPage>
  );
}
