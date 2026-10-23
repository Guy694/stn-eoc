"use client";

// แจ้งจุดปัญหา (ประชาชน): ข่าวสารเพื่อประชาสัมพันธ์ ไม่ใช่การขอช่วยชีวิต
// ทุกเรื่องต้องผ่านเจ้าหน้าที่ก่อนแสดงบนแผนที่ และสิ่งที่แสดงคือข้อความที่เจ้าหน้าที่เขียน ไม่ใช่ข้อความนี้
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Camera, CircleCheck, LocateFixed, MapPin, Phone, ShieldCheck, Siren } from "lucide-react";
import PublicLayout from "@/components/layouts/PublicLayout";
import useHelpAvailability from "@/components/public/useHelpAvailability";
import { PROBLEM_CATEGORIES } from "@/lib/incidentPublishing";
import { problemStyle } from "@/components/public/problemCategoryIcons";
import { trackPublicUsage } from "@/lib/publicUsage";
import TrackingCodeCard from "@/components/public/TrackingCodeCard";
import { shareVisitGps } from "@/lib/visitorGps";

const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const MapClickHandler = dynamic(
  () => import("react-leaflet").then((mod) => {
    function MapClickHandlerInner({ setPosition }) {
      mod.useMapEvents({ click(event) { setPosition(event.latlng); } });
      return null;
    }
    return MapClickHandlerInner;
  }),
  { ssr: false }
);

const PLACEHOLDERS = {
  flood: "เช่น น้ำท่วมถนนหน้าโรงเรียนประมาณครึ่งล้อ รถเล็กผ่านไม่ได้",
  road_cut: "เช่น ถนนขาดช่วงสะพาน รถทุกชนิดผ่านไม่ได้",
  power_out: "เช่น ไฟดับทั้งหมู่บ้านตั้งแต่ 2 ทุ่ม / สายไฟขาดตกพื้น",
  tree_down: "เช่น ต้นไม้ล้มขวางถนนทั้งสองเลน",
  landslide: "เช่น ดินสไลด์ปิดถนนครึ่งเลน ยังมีดินไหลลงมา",
  other: "เล่าสั้น ๆ ว่าเกิดอะไรขึ้น และกระทบการสัญจรหรือไม่"
};

const MAX_DETAIL = 300;
const emptyForm = { category: "", detail: "", firstName: "", lastName: "", phone: "", village: "", subDistrict: "", district: "" };

function localNow() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function ReportProblemPage() {
  const { helpOpen } = useHelpAvailability();
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [position, setPosition] = useState(null);
  const [gps, setGps] = useState({ state: "idle", message: "" });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [tracking, setTracking] = useState(null);
  const [villages, setVillages] = useState([]);
  const villageRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    import("leaflet").then((L) => {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png"
      });
    });
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    const close = (event) => { if (villageRef.current && !villageRef.current.contains(event.target)) setVillages([]); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const locate = () => {
    if (!navigator.geolocation) {
      setGps({ state: "error", message: "เบราว์เซอร์นี้ระบุตำแหน่งไม่ได้ กรุณาแตะบนแผนที่" });
      return;
    }
    setGps({ state: "requesting", message: "" });
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({ lat: result.coords.latitude, lng: result.coords.longitude });
        shareVisitGps(result.coords, "report-problem");
        setGps({ state: "success", message: "" });
      },
      () => setGps({ state: "error", message: "ระบุตำแหน่งอัตโนมัติไม่ได้ กรุณาแตะจุดที่เกิดปัญหาบนแผนที่" }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const searchVillage = async (value) => {
    set("village", value);
    if (value.trim().length < 2) { setVillages([]); return; }
    try {
      const response = await fetch(`/stn-eoc/api/public/villages?search=${encodeURIComponent(value)}`);
      const json = await response.json();
      setVillages(json.success ? (json.data || []).slice(0, 8) : []);
    } catch {
      setVillages([]);
    }
  };

  const pickPhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("แนบได้เฉพาะรูป JPG, PNG หรือ WebP");
      event.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("รูปต้องมีขนาดไม่เกิน 10MB");
      event.target.value = "";
      return;
    }
    setError("");
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const missing = () => {
    if (!form.category) return "เลือกประเภทปัญหา";
    if (form.detail.trim().length < 3) return "เล่าสั้น ๆ ว่าเกิดอะไรขึ้น";
    if (!position) return "ระบุตำแหน่งบนแผนที่";
    if (!form.firstName.trim() || !form.lastName.trim()) return "กรอกชื่อและนามสกุล";
    if (!/^0\d{8,9}$/.test(form.phone.replace(/[\s-]/g, ""))) return "กรอกเบอร์โทรศัพท์ 9–10 หลัก";
    if (!consent) return "ยืนยันการให้ใช้ข้อมูลเพื่อตรวจสอบ";
    return "";
  };

  const submit = async (event) => {
    event.preventDefault();
    const problem = missing();
    if (problem) { setError(`ยังส่งไม่ได้: ${problem}`); return; }
    setBusy(true);
    setError("");
    try {
      const payload = new FormData();
      payload.append("reportType", "problem_point");
      payload.append("problemCategory", form.category);
      payload.append("description", form.detail.trim());
      payload.append("firstName", form.firstName.trim());
      payload.append("lastName", form.lastName.trim());
      payload.append("phone", form.phone.replace(/[\s-]/g, ""));
      payload.append("village", form.village);
      payload.append("subDistrict", form.subDistrict);
      payload.append("district", form.district);
      payload.append("latitude", position.lat);
      payload.append("longitude", position.lng);
      payload.append("occurredAt", localNow());
      payload.append("urgency", form.category === "road_cut" || form.category === "landslide" ? "high" : "medium");
      if (photo) payload.append("photo", photo);
      const response = await fetch("/stn-eoc/api/public/report-incident", { method: "POST", body: payload });
      const json = await response.json();
      if (!json.success) { setError(json.message || "ส่งไม่สำเร็จ กรุณาลองใหม่"); return; }
      trackPublicUsage("problem_point_submitted", "/public/report-problem");
      setTracking({ code: json.trackingCode || null, firstName: form.firstName, lastName: form.lastName, phone: form.phone });
      setDone(true);
      setForm(emptyForm);
      setPosition(null);
      setPhoto(null);
      setPreview("");
      setConsent(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  };

  const shell = (children) => (
    <PublicLayout>
      <div className="min-h-full bg-[#f4f8fc]">
        <div className="mx-auto w-full max-w-2xl px-4 py-5 md:py-8">{children}</div>
      </div>
    </PublicLayout>
  );

  if (helpOpen === false) {
    return shell(
      <section className="rounded-2xl border border-[#c9dcee] bg-white p-6 text-center" role="status">
        <h1 className="text-2xl font-black text-slate-900">ยังไม่เปิดรับแจ้งจุดปัญหา</h1>
        <p className="mt-3 text-slate-700">เปิดรับเฉพาะช่วงที่ศูนย์ปฏิบัติการ (EOC) เปิดรับมือเหตุการณ์ หากเป็นเหตุฉุกเฉินโทร 1669 หรือ ปภ. 1784</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm font-bold">
          <a href="tel:1669" className="rounded-lg bg-red-600 px-4 py-3 text-white hover:bg-red-700">โทร 1669</a>
          <a href="tel:1784" className="rounded-lg border border-slate-300 px-4 py-3 text-slate-800 hover:bg-slate-50">โทร 1784</a>
          <Link href="/public/disaster-map" className="rounded-lg border border-slate-300 px-4 py-3 text-slate-800 hover:bg-slate-50">ดูแผนที่</Link>
        </div>
      </section>
    );
  }

  if (done) {
    return shell(
      <section className="rounded-2xl border border-emerald-200 bg-white p-6" role="status">
        <CircleCheck className="h-10 w-10 text-emerald-600" aria-hidden="true" />
        <h1 className="mt-3 text-2xl font-black text-slate-900">ส่งข้อมูลจุดปัญหาแล้ว</h1>
        <p className="mt-2 text-slate-700">
          เจ้าหน้าที่จะตรวจสอบก่อนแสดงบนแผนที่ ชื่อและเบอร์โทรของคุณใช้ติดต่อสอบถามเท่านั้น ไม่แสดงต่อสาธารณะ
        </p>
        {tracking ? <TrackingCodeCard code={tracking.code} firstName={tracking.firstName} lastName={tracking.lastName} phone={tracking.phone} /> : null}
        <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
          <Link href="/public/disaster-map" className="rounded-lg bg-[#0b4c86] px-4 py-3 text-white hover:bg-[#083865]">ดูแผนที่สถานการณ์</Link>
          <button type="button" onClick={() => setDone(false)} className="rounded-lg border border-slate-300 px-4 py-3 text-slate-800 hover:bg-slate-50">แจ้งจุดอื่นเพิ่ม</button>
        </div>
      </section>
    );
  }

  return shell(
    <>
      <header>
        <h1 className="text-2xl font-black text-[#083865] md:text-3xl">แจ้งจุดปัญหา</h1>
        <p className="mt-1 text-slate-700">น้ำท่วม ถนนขาด ไฟฟ้าดับ ต้นไม้ล้ม ดินสไลด์ — เจ้าหน้าที่ตรวจสอบก่อนแสดงบนแผนที่ให้ทุกคนเห็น</p>
      </header>

      <aside className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        <Siren className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 font-semibold">มีคนติดอยู่ บาดเจ็บ หรือต้องการยา? อย่ารอการตรวจสอบ</span>
        <span className="flex gap-2">
          <Link href="/public/report-incident" className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white hover:bg-red-700">ขอความช่วยเหลือ</Link>
          <a href="tel:1669" className="rounded-lg border border-red-300 bg-white px-3 py-2 font-bold hover:bg-red-100">1669</a>
          <a href="tel:1784" className="rounded-lg border border-red-300 bg-white px-3 py-2 font-bold hover:bg-red-100">1784</a>
        </span>
      </aside>

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <fieldset className="rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5">
          <legend className="px-1 text-lg font-black text-slate-900">เกิดอะไรขึ้น</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PROBLEM_CATEGORIES.map((item) => {
              const style = problemStyle(item.value);
              const Icon = style.icon;
              const active = form.category === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set("category", item.value)}
                  className={`flex min-h-16 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left font-bold transition ${active ? "border-[#0b4c86] bg-[#edf5fc] text-[#083865]" : "border-slate-200 text-slate-700 hover:border-[#c9dcee]"}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: style.bg, color: style.color }}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-bold text-slate-800">รายละเอียดสั้น ๆ</span>
            <textarea
              rows={3}
              maxLength={MAX_DETAIL}
              value={form.detail}
              onChange={(event) => set("detail", event.target.value)}
              placeholder={PLACEHOLDERS[form.category] || PLACEHOLDERS.other}
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-slate-800 outline-none focus:border-[#0b4c86] focus:ring-2 focus:ring-[#c9dcee]"
            />
            <span className="mt-1 block text-right text-xs text-slate-500">{form.detail.length}/{MAX_DETAIL}</span>
          </label>
        </fieldset>

        <fieldset className="rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5">
          <legend className="px-1 text-lg font-black text-slate-900">ตรงไหน</legend>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={locate} className="inline-flex items-center gap-2 rounded-lg bg-[#0b4c86] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#083865]">
              <LocateFixed className="h-4 w-4" aria-hidden="true" /> {gps.state === "requesting" ? "กำลังหาตำแหน่ง…" : "ใช้ตำแหน่งปัจจุบัน"}
            </button>
            <span className="text-sm text-slate-600">หรือแตะจุดที่เกิดปัญหาบนแผนที่</span>
          </div>
          {gps.message ? <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{gps.message}</p> : null}
          <div className="mt-3 h-72 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 md:h-80">
            {mounted ? (
              <MapContainer center={position || [6.6238, 100.075]} zoom={position ? 15 : 10} style={{ height: "100%", width: "100%" }}>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapClickHandler setPosition={setPosition} />
                {position ? <Marker position={position} /> : null}
              </MapContainer>
            ) : null}
          </div>
          <p className={`mt-2 flex items-center gap-1.5 text-sm ${position ? "font-semibold text-[#083865]" : "text-slate-500"}`}>
            <MapPin className="h-4 w-4" aria-hidden="true" /> {position ? "ปักหมุดแล้ว — บนแผนที่สาธารณะจะแสดงตำแหน่งโดยประมาณ" : "ยังไม่ได้ปักหมุด"}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="relative block" ref={villageRef}>
              <span className="mb-1.5 block text-sm font-bold text-slate-800">หมู่บ้าน/ชุมชน</span>
              <input value={form.village} onChange={(event) => searchVillage(event.target.value)} placeholder="พิมพ์ชื่อหมู่บ้าน" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-[#0b4c86]" />
              {villages.length ? (
                <ul className="absolute z-[1000] mt-1 max-h-56 w-full overflow-auto rounded-lg border border-[#c9dcee] bg-white shadow-lg">
                  {villages.map((village, index) => (
                    <li key={`${village.name}-${index}`}>
                      <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-[#edf5fc]" onClick={() => { setForm((current) => ({ ...current, village: village.name, subDistrict: village.subDistrict, district: village.district })); setVillages([]); }}>
                        <span className="font-bold text-slate-800">{village.name}</span>
                        <span className="block text-slate-500">ต.{village.subDistrict} อ.{village.district}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-800">ตำบล</span>
              <input value={form.subDistrict} onChange={(event) => set("subDistrict", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-[#0b4c86]" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-800">อำเภอ</span>
              <input value={form.district} onChange={(event) => set("district", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-[#0b4c86]" />
            </label>
          </div>
        </fieldset>

        <fieldset className="rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5">
          <legend className="px-1 text-lg font-black text-slate-900">รูปถ่าย (ถ้ามี)</legend>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-[#c9dcee] px-4 py-4 text-slate-700 hover:bg-[#edf5fc]">
            <Camera className="h-6 w-6 shrink-0 text-[#0b4c86]" aria-hidden="true" />
            <span className="text-sm"><span className="font-bold">ถ่ายหรือเลือกรูป 1 รูป</span><span className="block text-slate-500">ใช้รูปที่ถ่ายวันนี้ ระบบลบข้อมูลตำแหน่งในไฟล์รูปให้อัตโนมัติ</span></span>
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={pickPhoto} className="sr-only" />
          </label>
          {preview ? (
            <div className="mt-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="รูปที่เลือก" className="h-20 w-28 rounded-lg object-cover" />
              <button type="button" onClick={() => { setPhoto(null); setPreview(""); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">เอารูปออก</button>
            </div>
          ) : null}
        </fieldset>

        <fieldset className="rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5">
          <legend className="px-1 text-lg font-black text-slate-900">ติดต่อกลับ</legend>
          <p className="mb-3 flex items-start gap-2 text-sm text-slate-600"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0b4c86]" aria-hidden="true" /> ใช้เมื่อเจ้าหน้าที่ต้องสอบถามเพิ่ม ไม่แสดงบนแผนที่หรือหน้าสาธารณะ</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-800">ชื่อ</span>
              <input value={form.firstName} onChange={(event) => set("firstName", event.target.value)} autoComplete="given-name" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-[#0b4c86]" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-800">นามสกุล</span>
              <input value={form.lastName} onChange={(event) => set("lastName", event.target.value)} autoComplete="family-name" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-[#0b4c86]" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-800">เบอร์โทร</span>
              <span className="relative block">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input type="tel" inputMode="tel" value={form.phone} onChange={(event) => set("phone", event.target.value)} autoComplete="tel" placeholder="08xxxxxxxx" className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 outline-none focus:border-[#0b4c86]" />
              </span>
            </label>
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#c9dcee] bg-white p-4 text-sm leading-6 text-slate-700">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#0b4c86]" />
          <span>
            ยินยอมให้เจ้าหน้าที่ใช้ชื่อ เบอร์โทร ตำแหน่ง และรูปที่แจ้ง เพื่อตรวจสอบและประชาสัมพันธ์สถานการณ์ เจ้าหน้าที่อาจเลือกรูปนี้ไปแสดงบนแผนที่ (ไม่แสดงชื่อและเบอร์โทร)
            {" "}(<Link href="/privacy-policy" target="_blank" className="font-bold text-[#0b4c86] underline">นโยบายความเป็นส่วนตัว</Link>)
          </span>
        </label>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}

        <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#0b4c86] px-5 py-4 text-lg font-black text-white shadow-sm hover:bg-[#083865] disabled:opacity-60">
          {busy ? "กำลังส่ง…" : "ส่งให้เจ้าหน้าที่ตรวจสอบ"}
        </button>
      </form>
    </>
  );
}
