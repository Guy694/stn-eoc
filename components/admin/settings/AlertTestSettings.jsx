"use client";

// ทดสอบการแจ้งเตือน (ผู้ดูแลระบบ): ดูว่าช่องทางไหนพร้อม/ไม่พร้อม แล้วลองทีละขั้น
// 1) เครื่องนี้ (เสียง popup เสียงพูด แจ้งเตือนของระบบ) 2) หน้าจอเจ้าหน้าที่ทุกเครื่อง 3) แจ้งเตือนเข้ามือถือ (Web Push)
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, CheckCircle2, CloudRain, Globe, Monitor, RefreshCw, Siren, Smartphone, Speech, TriangleAlert, Volume2, XCircle } from "lucide-react";
import { Button, useNotice } from "@/components/admin/crud";
import { apiRequest, formatDateTime } from "@/lib/adminApi";
import { getAlertAudioContext, showSystemAlert, unlockAlertAudio } from "@/lib/alertSound";
import { speak, speechSupported, thaiVoice, waitForVoices } from "@/lib/alertSpeech";
import { isIos, isStandalone, pushStatus, pushSupported, subscribePush } from "@/lib/pwaClient";
import { showConfirm } from "@/lib/sweetAlert";

const API = "/stn-eoc/api/admin/alert-test";
const PUSH_API = "/stn-eoc/api/admin/public-push";

function Check({ ok, label, detail, fix }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex gap-3 py-3">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ok ? "text-emerald-600" : "text-red-600"}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-bold text-slate-900">{label}</p>
        {detail ? <p className="text-sm text-slate-600">{detail}</p> : null}
        {!ok && fix ? <p className="mt-0.5 text-sm font-semibold text-amber-800">วิธีแก้: {fix}</p> : null}
      </div>
    </li>
  );
}

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf5fc] text-[#0b4c86]"><Icon className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0">
          <h2 className="font-[family-name:var(--font-kanit)] text-lg font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-slate-600">{description}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function readSoundSetting() {
  try { return window.localStorage.getItem("stn-water-alert-sound") !== "off"; } catch { return true; }
}

async function deviceChecks() {
  const ctx = getAlertAudioContext();
  await waitForVoices().catch(() => null);
  const push = pushSupported() ? await pushStatus().catch(() => ({ supported: true })) : { supported: false };
  const permission = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  const ios = isIos();
  return {
    push,
    list: [
      { key: "audio", ok: Boolean(ctx) && ctx.state === "running", label: "เสียงสัญญาณบนเครื่องนี้", detail: !ctx ? "เบราว์เซอร์นี้เล่นเสียงไม่ได้" : ctx.state === "running" ? "พร้อมเล่นเสียง" : "เบราว์เซอร์ยังล็อกเสียง (ต้องแตะหน้าเว็บก่อน 1 ครั้ง)", fix: "กดปุ่ม \"ทดสอบ\" ด้านล่าง 1 ครั้งเพื่อปลดล็อกเสียง และเช็กว่าไม่ได้ปิดเสียงเครื่อง/แท็บ" },
      { key: "sound", ok: readSoundSetting(), label: "สวิตช์เสียงแจ้งเตือนน้ำ/ฝน", detail: readSoundSetting() ? "เปิด" : "ปิดไว้ (เคยกดไอคอนลำโพงใน popup)", fix: "ทดสอบ popup แล้วกดไอคอนลำโพงให้เป็นเปิด" },
      { key: "voice", ok: speechSupported() && Boolean(thaiVoice()), label: "เสียงพูดภาษาไทย", detail: !speechSupported() ? "เบราว์เซอร์นี้ไม่รองรับเสียงพูด" : thaiVoice() ? `ใช้เสียง ${thaiVoice().name}` : "เครื่องนี้ไม่มีเสียงภาษาไทย (ยังมีเสียงสัญญาณ)", fix: "ติดตั้งเสียงภาษาไทยในการตั้งค่าภาษาของเครื่อง หรือใช้ Chrome/Edge" },
      { key: "notify", ok: permission === "granted", label: "สิทธิ์แจ้งเตือนของเว็บ (เด้งแม้ย่อหน้าต่าง)", detail: { granted: "อนุญาตแล้ว", denied: "ถูกปิดไว้ในเบราว์เซอร์", default: "ยังไม่ได้ถาม", unsupported: "เบราว์เซอร์นี้ไม่รองรับ" }[permission], fix: permission === "denied" ? "เปิดที่ไอคอนแม่กุญแจหน้า URL → การแจ้งเตือน → อนุญาต" : "กด \"ทดสอบแจ้งเตือนของระบบ\" แล้วกดอนุญาต" },
      { key: "push", ok: Boolean(push.subscribed), label: "เครื่องนี้สมัครรับแจ้งเตือนเข้ามือถือ (Web Push)", detail: !push.supported ? (ios && !isStandalone() ? "iPhone/iPad ต้อง \"เพิ่มไปยังหน้าจอโฮม\" แล้วเปิดจากไอคอนก่อน จึงรับแจ้งเตือนได้" : "เบราว์เซอร์นี้ไม่รองรับ") : push.subscribed ? (push.areas?.scope === "areas" ? "สมัครเฉพาะบางพื้นที่" : "สมัครทั้งจังหวัด") : "ยังไม่ได้สมัคร", fix: "กด \"ส่งทดสอบถึงเครื่องนี้\" ระบบจะสมัครให้ก่อนส่ง" }
    ]
  };
}

export default function AlertTestSettings() {
  const { success, fail, warn } = useNotice();
  const [server, setServer] = useState(null);
  const [device, setDevice] = useState(null);
  const [busy, setBusy] = useState("");
  const [links, setLinks] = useState(null);

  const checkLinks = async () => {
    setBusy("links");
    try {
      const json = await apiRequest(API, { method: "POST", body: { action: "connectivity" } });
      setLinks(json.data);
    } catch (error) {
      fail(error.message || "ทดสอบการเชื่อมต่อไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  };

  const refresh = useCallback(async () => {
    setBusy("refresh");
    try {
      const [json, local] = await Promise.all([apiRequest(API), deviceChecks()]);
      setServer(json.data);
      setDevice(local);
    } catch (error) {
      fail(error.message || "ตรวจสถานะไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }, [fail]);

  useEffect(() => { refresh(); }, [refresh]);

  const localPopup = (kind, level) => {
    unlockAlertAudio().catch(() => {});
    window.dispatchEvent(new CustomEvent("water-alert:test", { detail: { kind, level } }));
    setTimeout(() => deviceChecks().then(setDevice), 800);
  };

  const testVoice = async () => {
    const ok = await speak("ทดสอบเสียงแจ้งเตือน ศูนย์ข้อมูลสถานการณ์ฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล", { force: true });
    if (!ok) warn("เครื่องนี้ไม่มีเสียงพูดภาษาไทย (ยังมีเสียงสัญญาณตามปกติ)");
  };

  const testSystem = async () => {
    if (typeof Notification === "undefined") return fail("เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน");
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") { fail("ยังไม่ได้อนุญาตการแจ้งเตือนของเว็บนี้"); return deviceChecks().then(setDevice); }
    const ok = await showSystemAlert("🚨 [ทดสอบ] แจ้งเตือนของระบบ", { body: "ถ้าเห็นข้อความนี้ แสดงว่าเครื่องนี้เด้งแจ้งเตือนได้แม้ย่อหน้าต่าง", tag: "alert-test" });
    if (ok) success("ส่งแจ้งเตือนของระบบแล้ว ดูที่มุมจอ/ศูนย์การแจ้งเตือน");
    else fail("เด้งแจ้งเตือนไม่ได้ ตรวจว่าเปิดโหมดห้ามรบกวนอยู่หรือไม่");
    deviceChecks().then(setDevice);
  };

  const testAllOfficers = async (kind, level) => {
    const ok = await showConfirm("ส่งแจ้งเตือนทดสอบถึงหน้าจอเจ้าหน้าที่ทุกเครื่อง?", "เจ้าหน้าที่ทุกคนที่เปิดระบบอยู่จะเห็น popup พร้อมเสียงภายใน 1 นาที (ข้อความมีคำว่า [ทดสอบ] ชัดเจน) ไม่ส่ง Telegram", "ส่งทดสอบ");
    if (!ok) return;
    setBusy("officers");
    try {
      const json = await apiRequest(API, { method: "POST", body: { kind, level } });
      success(json.message);
      refresh();
    } catch (error) {
      fail(error.message || "ส่งทดสอบไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  };

  const testPush = async () => {
    setBusy("push");
    try {
      let endpoint = device?.push?.endpoint || null;
      if (!device?.push?.subscribed) endpoint = await subscribePush({ scope: "all" });
      const json = await apiRequest(PUSH_API, { method: "POST", body: { action: "test", endpoint, title: "[ทดสอบ] แจ้งเตือนเข้ามือถือ", body: "ถ้าเห็นข้อความนี้ เครื่องนี้รับแจ้งเตือนภัยจากระบบได้ (ส่งถึงเครื่องนี้เท่านั้น)", level: "high" } });
      if (json.data?.delivered) success("ส่งแล้ว — ควรเห็นแจ้งเตือนภายในไม่กี่วินาที (แม้ปิดแท็บนี้)");
      else warn(json.message);
    } catch (error) {
      fail(error.message || "ส่งทดสอบไม่สำเร็จ");
    } finally {
      setBusy("");
      deviceChecks().then(setDevice);
    }
  };

  const failing = [...(server?.checks || []), ...(device?.list || [])].filter((item) => !item.ok).length;

  // ใช้เป็นหัวข้อหนึ่งในหน้าตั้งค่าระบบ (ตั้งค่าระบบ › ทดสอบการแจ้งเตือน)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">ตรวจว่าเสียง popup และแจ้งเตือนเข้ามือถือพร้อมใช้หรือไม่ แล้วลองทีละช่องทาง ทุกข้อความทดสอบมีคำว่า [ทดสอบ] และไม่ส่ง Telegram · ตั้งแบบเสียงได้ที่หัวข้อ “เสียงแจ้งเตือน”</p>
        <Button variant="secondary" onClick={refresh} disabled={busy === "refresh"}><RefreshCw className={`h-4 w-4 ${busy === "refresh" ? "animate-spin" : ""}`} aria-hidden="true" />ตรวจใหม่</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={BellRing} title="ความพร้อมของระบบ" description={server ? (failing ? `มี ${failing} ข้อที่ยังไม่พร้อม (รวมเครื่องนี้)` : "ทุกช่องทางพร้อม") : "กำลังตรวจ…"}>
          <ul className="divide-y divide-slate-100">
            {(server?.checks || []).map((item) => <Check key={item.key} {...item} />)}
          </ul>
        </Section>
        <Section icon={Monitor} title="เครื่องที่ใช้อยู่ตอนนี้" description="ตรวจจากเบราว์เซอร์นี้ เครื่องอื่นต้องเปิดหน้านี้ตรวจเอง">
          <ul className="divide-y divide-slate-100">
            {(device?.list || []).map((item) => <Check key={item.key} {...item} />)}
          </ul>
        </Section>
      </div>

      <Section icon={Globe} title="การเชื่อมต่อจากเซิร์ฟเวอร์" description="เซิร์ฟเวอร์ต้องออกอินเทอร์เน็ตไปยังผู้ให้บริการเหล่านี้ได้ ถ้า Apple เชื่อมต่อไม่ได้ iPhone/iPad จะไม่ได้รับแจ้งเตือนเลย (Android ยังได้)">
        <Button variant="secondary" disabled={busy === "links"} onClick={checkLinks}><Globe className={`h-4 w-4 ${busy === "links" ? "animate-pulse" : ""}`} aria-hidden="true" />{busy === "links" ? "กำลังทดสอบ (ไม่เกิน 15 วินาที)…" : "ทดสอบการเชื่อมต่อ"}</Button>
        {links ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {links.map((item) => (
              <Check
                key={item.key}
                ok={item.ok}
                label={item.label}
                detail={item.ok ? `เชื่อมต่อได้ (${(item.ms / 1000).toFixed(1)} วินาที)` : `เชื่อมต่อไม่ได้: ${item.reason} (${(item.ms / 1000).toFixed(1)} วินาที)`}
                fix={item.reason === "ENOTFOUND" || item.reason === "EAI_AGAIN" ? "เซิร์ฟเวอร์หาชื่อโดเมนไม่เจอ ตรวจ DNS ของเครื่อง/Docker" : "ให้ฝ่ายเครือข่ายเปิดทางออก HTTPS (443) ไปยังโดเมนนี้ (Apple: *.push.apple.com) หรือตรวจ firewall/proxy ของหน่วยงาน"}
              />
            ))}
          </ul>
        ) : null}
      </Section>

      <Section icon={Volume2} title="1. ทดสอบบนเครื่องนี้" description="เด้ง popup พร้อมเสียงเหมือนแจ้งเตือนจริง เฉพาะเครื่องนี้ ไม่บันทึกและไม่ส่งหาใคร">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => localPopup("water", "critical")} className="bg-red-600 hover:bg-red-700"><Siren className="h-4 w-4" aria-hidden="true" />น้ำล้นตลิ่ง (วิกฤต)</Button>
          <Button onClick={() => localPopup("water", "serious")} className="bg-amber-500 hover:bg-amber-600"><TriangleAlert className="h-4 w-4" aria-hidden="true" />น้ำใกล้ตลิ่ง (เฝ้าระวัง)</Button>
          <Button onClick={() => localPopup("rain", "critical")} className="bg-indigo-600 hover:bg-indigo-700"><CloudRain className="h-4 w-4" aria-hidden="true" />ฝนหนักมาก</Button>
          <Button variant="secondary" onClick={() => localPopup("water", "info")}><CheckCircle2 className="h-4 w-4" aria-hidden="true" />คลี่คลาย</Button>
          <Button variant="secondary" onClick={testVoice}><Speech className="h-4 w-4" aria-hidden="true" />เสียงพูดภาษาไทย</Button>
          <Button variant="secondary" onClick={testSystem}><BellRing className="h-4 w-4" aria-hidden="true" />แจ้งเตือนของระบบ</Button>
        </div>
        <p className="mt-3 text-sm text-slate-500">น้ำล้นตลิ่งจะดังซ้ำทุก 2 นาทีจนกว่าจะกด “รับทราบ” (สูงสุด 5 ครั้ง) เหมือนของจริง</p>
      </Section>

      <Section icon={Monitor} title="2. ทดสอบหน้าจอเจ้าหน้าที่ทุกเครื่อง" description="สร้างแจ้งเตือน [ทดสอบ] ในระบบจริง ใช้ตรวจเส้นทางทั้งหมดตั้งแต่เซิร์ฟเวอร์ถึงหน้าจอ: ทุกเครื่องที่เปิดหน้าเจ้าหน้าที่อยู่จะเด้งภายใน 1 นาที">
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy === "officers"} onClick={() => testAllOfficers("water", "critical")}><Siren className="h-4 w-4" aria-hidden="true" />ส่งทดสอบ น้ำล้นตลิ่ง</Button>
          <Button variant="secondary" disabled={busy === "officers"} onClick={() => testAllOfficers("rain", "serious")}><CloudRain className="h-4 w-4" aria-hidden="true" />ส่งทดสอบ ฝนหนัก</Button>
        </div>
        {server?.last_alert ? <p className="mt-3 text-sm text-slate-500">แจ้งเตือนล่าสุดในระบบ: {server.last_alert.title} · {formatDateTime(server.last_alert.created_at)}</p> : null}
        <p className="mt-1 text-sm text-slate-500">หน้าจอที่เพิ่งเปิดจะดึงเฉพาะแจ้งเตือนใน 2 ชม.ล่าสุด เรื่องที่เก่ากว่าดูได้ที่ ตั้งค่าระบบ › แจ้งเตือนน้ำล้นตลิ่ง</p>
      </Section>

      <Section icon={Smartphone} title="3. ทดสอบแจ้งเตือนเข้ามือถือ (เมนูรับการแจ้งเตือนในพื้นที่)" description="ส่งถึงเครื่องนี้เครื่องเดียว ใช้ช่องทางเดียวกับที่ประชาชนได้รับ (เด้งแม้ปิดเว็บ)">
        <Button disabled={busy === "push" || device?.push?.supported === false} onClick={testPush}><Smartphone className="h-4 w-4" aria-hidden="true" />ส่งทดสอบถึงเครื่องนี้</Button>
        <div className="mt-4 rounded-xl bg-[#f6f9fc] p-4 text-sm leading-6 text-slate-700">
          <p className="font-bold text-slate-900">ประชาชนจะได้รับแจ้งเตือนอัตโนมัติเมื่อ</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>เปิด “ส่งเตือนภัยอัตโนมัติ” ไว้ (ค่าเริ่มต้นปิด) และตั้ง VAPID แล้ว</li>
            <li>มีเหตุตามระดับที่เลือกไว้: <b>เฉพาะเหตุรุนแรง</b> (น้ำล้นตลิ่ง ฝนหนักมาก 24 ชม. ≥ 90.1 มม. ประกาศเตือนระดับสูงจาก สสน.) หรือ <b>รวมระดับเฝ้าระวัง</b> (เพิ่มน้ำใกล้ตลิ่ง ฝนหนัก ≥ 35.1 มม.)</li>
            <li>น้ำลดต่ำกว่าตลิ่งแล้ว ระบบแจ้ง &quot;น้ำลดแล้ว&quot; ให้เองในอำเภอนั้น</li>
            <li>อยู่ในพื้นที่ที่สมัครไว้ (เลือกอำเภอ) เรื่องเดียวกันส่งวันละครั้ง</li>
          </ul>
          <p className="mt-2">ส่งข้อความถึงประชาชนเอง หรือเปิด/ปิดการส่งอัตโนมัติ ได้ที่ <Link href="/admin/public-alerts" className="font-bold text-[#0b4c86] underline">เมนู แจ้งเตือนประชาชน</Link></p>
        </div>
      </Section>
    </div>
  );
}
