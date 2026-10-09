"use client";

// รับแจ้งเตือนภัยบนมือถือ (Web Push) + ติดตั้งเป็นแอป — ไม่ต้องสมัครสมาชิก ไม่เก็บชื่อ/เบอร์โทร
import { useCallback, useEffect, useState } from "react";
import { BellOff, BellRing, Download, Share, SquarePlus } from "lucide-react";
import { SATUN_DISTRICT_NAMES } from "@/lib/satunDistricts";
import { canPromptInstall, isIos, isStandalone, promptInstall, pushStatus, subscribePush, unsubscribePush } from "@/lib/pwaClient";

const areaText = (areas) => {
  if (!areas || areas.scope !== "areas") return "ทั้งจังหวัด";
  const tambons = (areas.tambons || []).map((key) => `ต.${key.split("|")[1]}`);
  const districts = (areas.districts || []).map((d) => `อ.${d}`);
  return [...tambons, ...districts].join(", ");
};

export default function AlertSubscribeCard({ defaultDistrict: rawDistrict = "", tambon = null, className = "", tone = "light" }) {
  const defaultDistrict = SATUN_DISTRICT_NAMES.includes(rawDistrict) ? rawDistrict : "";
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [scope, setScope] = useState(defaultDistrict || tambon ? "areas" : "all");
  const [districts, setDistricts] = useState(defaultDistrict ? [defaultDistrict] : []);
  const [installable, setInstallable] = useState(false);
  const [env, setEnv] = useState({ ios: false, standalone: false });

  const refresh = useCallback(() => pushStatus().then(setStatus).catch(() => setStatus({ supported: false })), []);
  useEffect(() => {
    setEnv({ ios: isIos(), standalone: isStandalone() });
    setInstallable(canPromptInstall());
    const onInstall = () => setInstallable(canPromptInstall());
    window.addEventListener("stn-install-available", onInstall);
    refresh();
    return () => window.removeEventListener("stn-install-available", onInstall);
  }, [refresh]);
  useEffect(() => {
    if (defaultDistrict && !status?.subscribed) setDistricts((current) => (current.length ? current : [defaultDistrict]));
  }, [defaultDistrict, status?.subscribed]);

  const toggleDistrict = (name) => setDistricts((current) => (current.includes(name) ? current.filter((d) => d !== name) : [...current, name]));
  const areasPayload = () => {
    const tambons = scope === "areas" && tambon ? [tambon.key] : [];
    const ds = scope === "areas" ? districts : [];
    return ds.length || tambons.length ? { scope: "areas", districts: ds, tambons } : { scope: "all" };
  };

  const subscribe = async () => {
    setBusy(true);
    setMessage("");
    try {
      await subscribePush(areasPayload());
      setEditing(false);
      setMessage("เปิดรับแจ้งเตือนแล้ว เมื่อมีเตือนภัยระดับสูงในพื้นที่ที่เลือก เครื่องนี้จะเด้งแจ้งเตือนทันที");
      await refresh();
    } catch (error) {
      setMessage(error.message);
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  const unsubscribe = async () => {
    setBusy(true);
    setMessage("");
    try {
      await unsubscribePush();
      setMessage("ยกเลิกการแจ้งเตือนแล้ว");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const dark = tone === "dark";
  const box = `rounded-3xl p-5 ${dark ? "bg-[#0c2f4a] text-white" : "border border-[#cfe0ea] bg-white text-[#0c2f4a]"} ${className}`;
  const muted = dark ? "text-[#c9dcee]" : "text-slate-600";
  const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0b4c86] px-4 font-bold text-white hover:bg-[#083865] disabled:opacity-60";
  const secondary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold ${dark ? "bg-white/10 hover:bg-white/20" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`;

  if (!status) return <div className={`${box} h-40 animate-pulse`} aria-hidden="true" />;

  // iPhone/iPad: แจ้งเตือนได้เฉพาะเมื่อเพิ่มลงหน้าจอโฮมแล้วเปิดจากไอคอน
  const iosNeedsInstall = env.ios && !env.standalone;
  const header = (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${status.subscribed ? "bg-emerald-500 text-white" : "bg-[#fde68a] text-[#7c2d12]"}`}>
        <BellRing className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h3 className="font-[family-name:var(--font-kanit)] text-lg font-semibold leading-snug">{status.subscribed ? "เครื่องนี้รับแจ้งเตือนภัยอยู่" : "รับแจ้งเตือนภัยบนมือถือ"}</h3>
        <p className={`mt-0.5 text-[15px] leading-6 ${muted}`}>
          {status.subscribed ? `พื้นที่: ${areaText(status.areas)}` : "เด้งเตือนทันทีเมื่อมีน้ำล้นตลิ่ง ฝนตกหนักมาก หรือประกาศสำคัญ ไม่ต้องเปิดเว็บค้างไว้ ไม่ต้องสมัครสมาชิก"}
        </p>
      </div>
    </div>
  );

  const installButton = !env.standalone && installable ? (
    <button type="button" className={secondary} onClick={() => promptInstall().then(() => setInstallable(canPromptInstall()))}>
      <Download className="h-4 w-4" aria-hidden="true" />ติดตั้งเป็นแอป
    </button>
  ) : null;

  let body;
  if (iosNeedsInstall) {
    body = (
      <ol className={`mt-4 space-y-2 text-[15px] leading-6 ${muted}`}>
        <li className="flex gap-2"><span className="font-bold">1.</span><span>กดปุ่ม <Share className="inline h-4 w-4 align-[-2px]" aria-label="แชร์" /> ด้านล่างของ Safari</span></li>
        <li className="flex gap-2"><span className="font-bold">2.</span><span>เลือก <b>เพิ่มไปยังหน้าจอโฮม</b> <SquarePlus className="inline h-4 w-4 align-[-2px]" aria-hidden="true" /></span></li>
        <li className="flex gap-2"><span className="font-bold">3.</span><span>เปิดจากไอคอน &quot;สตูล EOC&quot; แล้วกดรับแจ้งเตือนในหน้านี้อีกครั้ง</span></li>
      </ol>
    );
  } else if (!status.supported) {
    body = <p className={`mt-3 text-[15px] ${muted}`}>เบราว์เซอร์นี้ยังรับแจ้งเตือนไม่ได้ ลองเปิดด้วย Chrome หรือ Safari รุ่นใหม่</p>;
  } else if (!status.enabled) {
    body = <p className={`mt-3 text-[15px] ${muted}`}>ระบบแจ้งเตือนกำลังเตรียมพร้อม เร็ว ๆ นี้</p>;
  } else if (status.permission === "denied") {
    body = <p className={`mt-3 text-[15px] ${muted}`}>เครื่องนี้ปิดการแจ้งเตือนของเว็บนี้ไว้ เปิดได้ที่ การตั้งค่าเบราว์เซอร์ › การแจ้งเตือน › อนุญาต แล้วกลับมากดอีกครั้ง</p>;
  } else if (status.subscribed && !editing) {
    body = (
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={secondary} onClick={() => { setEditing(true); setScope(status.areas?.scope || "all"); setDistricts(status.areas?.districts || []); }}>เปลี่ยนพื้นที่</button>
        <button type="button" className={secondary} disabled={busy} onClick={unsubscribe}><BellOff className="h-4 w-4" aria-hidden="true" />ยกเลิก</button>
        {installButton}
      </div>
    );
  } else {
    body = (
      <div className="mt-4">
        <fieldset>
          <legend className="text-sm font-semibold">รับเตือนของ</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" aria-pressed={scope === "all"} onClick={() => setScope("all")} className={`min-h-10 rounded-full px-3.5 text-sm font-semibold ring-1 ${scope === "all" ? "bg-[#0b4c86] text-white ring-[#0b4c86]" : dark ? "ring-white/30" : "ring-slate-300"}`}>ทั้งจังหวัด</button>
            <button type="button" aria-pressed={scope === "areas"} onClick={() => setScope("areas")} className={`min-h-10 rounded-full px-3.5 text-sm font-semibold ring-1 ${scope === "areas" ? "bg-[#0b4c86] text-white ring-[#0b4c86]" : dark ? "ring-white/30" : "ring-slate-300"}`}>เฉพาะพื้นที่ของฉัน</button>
          </div>
          {scope === "areas" ? (
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="เลือกอำเภอ">
              {tambon ? <span className="inline-flex min-h-9 items-center rounded-full bg-[#e0f2f5] px-3 text-sm font-semibold text-[#11466e]">ต.{tambon.tambon}</span> : null}
              {SATUN_DISTRICT_NAMES.map((name) => (
                <button key={name} type="button" aria-pressed={districts.includes(name)} onClick={() => toggleDistrict(name)}
                  className={`min-h-9 rounded-full px-3 text-sm ${districts.includes(name) ? "bg-[#2a9db0] font-semibold text-white" : dark ? "bg-white/10" : "bg-slate-100 text-slate-700"}`}>
                  อ.{name}
                </button>
              ))}
            </div>
          ) : null}
        </fieldset>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={primary} disabled={busy || (scope === "areas" && !districts.length && !tambon)} onClick={subscribe}>
            <BellRing className="h-4 w-4" aria-hidden="true" />{busy ? "กำลังเปิด…" : status.subscribed ? "บันทึกพื้นที่" : "รับแจ้งเตือนภัย"}
          </button>
          {editing ? <button type="button" className={secondary} onClick={() => setEditing(false)}>ยกเลิก</button> : installButton}
        </div>
      </div>
    );
  }

  return (
    <section className={box} aria-label="รับแจ้งเตือนภัย">
      {header}
      {body}
      {message ? <p className={`mt-3 text-sm ${dark ? "text-amber-200" : "text-[#11466e]"}`} role="status">{message}</p> : null}
    </section>
  );
}
