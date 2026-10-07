"use client";

// รายงานระดับน้ำ (ประชาชน): บอกตำแหน่ง + ระดับน้ำเทียบกับร่างกาย + แนวโน้ม/การสัญจร ภายในไม่ถึงนาที
// เข้าคิวตรวจสอบเดียวกับ "แจ้งจุดปัญหา" (ประเภทน้ำท่วม) — แสดงบนแผนที่หลังเจ้าหน้าที่ตรวจแล้วเท่านั้น
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Camera, CircleCheck, Hospital, Link2, LocateFixed, Map as MapIcon, MapPin, Phone, Search, ShieldCheck, Siren, Tent, X } from "lucide-react";
import PublicLayout from "@/components/layouts/PublicLayout";
import useHelpAvailability from "@/components/public/useHelpAvailability";
import WaterLevelFigure from "@/components/public/water/WaterLevelFigure";
import { WATER_LEVELS, WATER_PASSABILITY, WATER_TRENDS, parseLatLng, waterLevelMeta } from "@/lib/waterReport";
import { trackPublicUsage } from "@/lib/publicUsage";
import TrackingCodeCard from "@/components/public/TrackingCodeCard";
import { loadTrackingIdentity } from "@/lib/myReports";

const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const MapBehaviour = dynamic(
  () => import("react-leaflet").then((mod) => {
    // แตะแผนที่เพื่อปักหมุด และเลื่อนแผนที่ไปยังตำแหน่งใหม่เมื่อได้จาก GPS/ค้นหา/ลิงก์
    function MapBehaviourInner({ position, onPick }) {
      const map = mod.useMapEvents({ click(event) { onPick(event.latlng, "map"); } });
      const last = useRef(null);
      useEffect(() => {
        if (!position) return;
        const key = `${position.lat},${position.lng}`;
        if (last.current === key) return;
        last.current = key;
        map.setView(position, Math.max(map.getZoom(), 15));
      }, [map, position]);
      return null;
    }
    return MapBehaviourInner;
  }),
  { ssr: false }
);

const SATUN_CENTER = [6.6238, 100.075];
const MAX_NOTE = 300;
const PLACE_ICONS = { village: MapPin, health: Hospital, shelter: Tent };
const SOURCE_TEXT = { gps: "จากตำแหน่งปัจจุบัน", map: "ปักบนแผนที่", search: "จากการค้นหา", link: "จากลิงก์ที่วาง" };
const emptyForm = { level: "", trend: "", passability: "", note: "", firstName: "", lastName: "", phone: "" };

function localNow() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function StepTitle({ number, children, hint }) {
  return (
    <legend className="flex w-full flex-wrap items-baseline gap-x-2 px-1">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-full bg-[#0b4c86] text-sm font-black text-white" aria-hidden="true">{number}</span>
      <span className="text-lg font-black text-slate-900">{children}</span>
      {hint ? <span className="text-sm text-slate-500">{hint}</span> : null}
    </legend>
  );
}

export default function ReportWaterPage() {
  const { floodOpen } = useHelpAvailability();
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [position, setPosition] = useState(null);
  const [place, setPlace] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [gps, setGps] = useState({ state: "idle", message: "" });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ state: "idle", items: [] });
  const [linkText, setLinkText] = useState("");
  const [linkMessage, setLinkMessage] = useState("");
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [tracking, setTracking] = useState(null);
  const searchRef = useRef(null);
  const searchTimer = useRef(null);

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
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  useEffect(() => {
    const close = (event) => { if (searchRef.current && !searchRef.current.contains(event.target)) setResults({ state: "idle", items: [] }); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const toggle = (name, value) => setForm((current) => ({ ...current, [name]: current[name] === value ? "" : value }));

  const pick = (latlng, source, picked = null) => {
    setPosition({ lat: Number(latlng.lat), lng: Number(latlng.lng), source });
    setPlace(picked);
    setShowMap(true);
    setError("");
  };

  // เคยแจ้งเรื่องจากเครื่องนี้แล้ว: เติมชื่อ-นามสกุลให้ (ผู้ใช้แก้ได้)
  useEffect(() => {
    const saved = loadTrackingIdentity();
    if (saved?.firstName) setForm((current) => ({ ...current, firstName: current.firstName || saved.firstName, lastName: current.lastName || saved.lastName || "" }));
  }, []);

  // เปิดจากหน้า "บ้านฉันเสี่ยงไหม" (?lat=&lng=) → ปักหมุดให้เลย
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat && lng) {
      setPosition({ lat, lng, source: "link" });
      setShowMap(true);
    }
  }, []);

  const locate = () => {
    if (!navigator.geolocation) {
      setGps({ state: "error", message: "เบราว์เซอร์นี้ระบุตำแหน่งไม่ได้ — ค้นหาสถานที่หรือแตะบนแผนที่แทน" });
      setShowMap(true);
      return;
    }
    setGps({ state: "requesting", message: "" });
    navigator.geolocation.getCurrentPosition(
      (result) => {
        pick({ lat: result.coords.latitude, lng: result.coords.longitude }, "gps");
        setGps({ state: "success", message: "" });
      },
      () => {
        setGps({ state: "error", message: "ระบุตำแหน่งอัตโนมัติไม่ได้ (อาจยังไม่อนุญาตให้เข้าถึงตำแหน่ง) — ค้นหาสถานที่หรือแตะบนแผนที่แทน" });
        setShowMap(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const search = (value) => {
    setQuery(value);
    clearTimeout(searchTimer.current);
    if (value.trim().length < 2) { setResults({ state: "idle", items: [] }); return; }
    setResults((current) => ({ ...current, state: "loading" }));
    searchTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(`/stn-eoc/api/public/place-search?q=${encodeURIComponent(value.trim())}`);
        const json = await response.json();
        setResults({ state: "done", items: json.success ? json.data || [] : [] });
      } catch {
        setResults({ state: "done", items: [] });
      }
    }, 300);
  };

  const readLink = () => {
    const result = parseLatLng(linkText);
    if (!result.ok) { setLinkMessage(result.error || "วางลิงก์หรือพิกัดก่อน"); return; }
    setLinkMessage(result.nearSatun ? "" : "พิกัดนี้อยู่นอกจังหวัดสตูล ตรวจสอบอีกครั้งว่าถูกจุด");
    pick({ lat: result.lat, lng: result.lng }, "link");
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
    if (!position) return "ระบุตำแหน่งที่พบน้ำ";
    if (!form.level) return "เลือกระดับน้ำ";
    const phone = form.phone.replace(/[\s-]/g, "");
    if (phone && !/^0\d{8,9}$/.test(phone)) return "เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก (หรือเว้นว่างไว้)";
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
      payload.append("reportSource", "water_level");
      payload.append("waterLevel", form.level);
      if (form.trend) payload.append("waterTrend", form.trend);
      if (form.passability) payload.append("passability", form.passability);
      payload.append("description", form.note.trim());
      payload.append("firstName", form.firstName.trim());
      payload.append("lastName", form.lastName.trim());
      payload.append("phone", form.phone.replace(/[\s-]/g, ""));
      payload.append("village", place?.village || "");
      payload.append("subDistrict", place?.tambon || "");
      payload.append("district", place?.district || "");
      payload.append("latitude", position.lat);
      payload.append("longitude", position.lng);
      payload.append("occurredAt", localNow());
      if (photo) payload.append("photo", photo);
      const response = await fetch("/stn-eoc/api/public/report-incident", { method: "POST", body: payload });
      const json = await response.json();
      if (!json.success) { setError(json.message || "ส่งไม่สำเร็จ กรุณาลองใหม่"); return; }
      trackPublicUsage("water_level_submitted", "/public/report-water");
      setTracking(json.trackingCode ? { code: json.trackingCode, firstName: form.firstName, lastName: form.lastName, phone: form.phone } : null);
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  };

  const reportAnother = () => {
    setForm((current) => ({ ...emptyForm, firstName: current.firstName, lastName: current.lastName, phone: current.phone }));
    setPhoto(null);
    setPreview("");
    setDone(false);
  };

  const shell = (children) => (
    <PublicLayout>
      <div className="min-h-full bg-[#f4f8fc]">
        <div className="mx-auto w-full max-w-2xl px-4 py-5 md:py-8">{children}</div>
      </div>
    </PublicLayout>
  );

  if (floodOpen === false) {
    return shell(
      <section className="rounded-2xl border border-[#c9dcee] bg-white p-6 text-center" role="status">
        <h1 className="text-2xl font-black text-slate-900">ยังไม่เปิดรับรายงานระดับน้ำ</h1>
        <p className="mt-3 text-slate-700">เปิดรับเฉพาะช่วงที่ศูนย์ปฏิบัติการด้านอุทกภัยเปิดรับมือเหตุการณ์ หากเป็นเหตุฉุกเฉินโทร 1669 หรือ ปภ. 1784</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm font-bold">
          <a href="tel:1669" className="rounded-lg bg-red-600 px-4 py-3 text-white hover:bg-red-700">โทร 1669</a>
          <a href="tel:1784" className="rounded-lg border border-slate-300 px-4 py-3 text-slate-800 hover:bg-slate-50">โทร 1784</a>
          <Link href="/" className="rounded-lg border border-slate-300 px-4 py-3 text-slate-800 hover:bg-slate-50">กลับหน้าแรก</Link>
        </div>
      </section>
    );
  }

  if (done) {
    const level = waterLevelMeta(form.level);
    return shell(
      <section className="rounded-2xl border border-emerald-200 bg-white p-6" role="status">
        <CircleCheck className="h-10 w-10 text-emerald-600" aria-hidden="true" />
        <h1 className="mt-3 text-2xl font-black text-slate-900">ได้รับรายงานระดับน้ำแล้ว</h1>
        <p className="mt-2 text-slate-700">
          {level ? `ระดับ${level.label} (${level.range}) ` : ""}เจ้าหน้าที่จะตรวจสอบก่อนแสดงบนแผนที่สถานการณ์ ขอบคุณที่ช่วยให้ทุกคนรู้สถานการณ์จริง
        </p>
        <p className="mt-2 text-sm text-slate-600">ถ้าระดับน้ำเปลี่ยน รายงานซ้ำจากจุดเดิมได้เลย</p>
        {tracking ? <TrackingCodeCard code={tracking.code} firstName={tracking.firstName} lastName={tracking.lastName} phone={tracking.phone} /> : null}
        <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
          <Link href="/public/disaster-map" className="rounded-lg bg-[#0b4c86] px-4 py-3 text-white hover:bg-[#083865]">ดูแผนที่สถานการณ์</Link>
          <button type="button" onClick={reportAnother} className="rounded-lg border border-slate-300 px-4 py-3 text-slate-800 hover:bg-slate-50">รายงานจุดเดิมอีกครั้ง</button>
          <button type="button" onClick={() => { reportAnother(); setPosition(null); setPlace(null); setShowMap(false); }} className="rounded-lg border border-slate-300 px-4 py-3 text-slate-800 hover:bg-slate-50">รายงานจุดอื่น</button>
        </div>
      </section>
    );
  }

  return shell(
    <>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#083865] md:text-3xl">รายงานระดับน้ำ</h1>
          <p className="mt-1 text-slate-700">บอกเราว่าน้ำสูงแค่ไหน ช่วยให้ศูนย์ฯ และเพื่อนบ้านวางแผนได้ทัน</p>
        </div>
        <a href="tel:1669" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-red-700">
          <Phone className="h-4 w-4" aria-hidden="true" /> โทรกู้ภัย
        </a>
      </header>

      <aside className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        <Siren className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 font-semibold">มีคนติดอยู่ บาดเจ็บ หรือต้องอพยพ? ไม่ต้องรายงานระดับน้ำ</span>
        <Link href="/public/report-incident" className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white hover:bg-red-700">ขอความช่วยเหลือ</Link>
      </aside>

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        {/* 1. ตำแหน่ง */}
        <fieldset className="space-y-3 rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5">
          <StepTitle number={1}>ตำแหน่ง</StepTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={locate} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0b4c86] px-3 py-2.5 font-bold text-white hover:bg-[#083865]">
              <LocateFixed className="h-5 w-5" aria-hidden="true" /> {gps.state === "requesting" ? "กำลังหาตำแหน่ง…" : "ใช้ตำแหน่งปัจจุบัน"}
            </button>
            <button type="button" onClick={() => setShowMap((value) => !value)} aria-expanded={showMap} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-[#c9dcee] px-3 py-2.5 font-bold text-[#083865] hover:bg-[#edf5fc]">
              <MapIcon className="h-5 w-5" aria-hidden="true" /> {showMap ? "ซ่อนแผนที่" : "เลือกจุดบนแผนที่"}
            </button>
          </div>
          {gps.message ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{gps.message}</p> : null}

          <div className="relative" ref={searchRef}>
            <label htmlFor="place-search" className="sr-only">ค้นหาหมู่บ้าน ตำบล โรงพยาบาล หรือศูนย์พักพิง</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="place-search"
              value={query}
              onChange={(event) => search(event.target.value)}
              placeholder="ค้นหาหมู่บ้าน ตำบล รพ.สต. หรือศูนย์พักพิง"
              autoComplete="off"
              className="w-full rounded-xl border border-slate-300 py-3 pl-9 pr-3 outline-none focus:border-[#0b4c86] focus:ring-2 focus:ring-[#c9dcee]"
            />
            {results.state !== "idle" ? (
              <ul className="absolute z-[1000] mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[#c9dcee] bg-white py-1 shadow-lg">
                {results.state === "loading" && !results.items.length ? <li className="px-3 py-2 text-sm text-slate-500">กำลังค้นหา…</li> : null}
                {results.state === "done" && !results.items.length ? <li className="px-3 py-2 text-sm text-slate-500">ไม่พบสถานที่นี้ — ลองชื่อหมู่บ้านหรือตำบล หรือแตะบนแผนที่</li> : null}
                {results.items.map((item, index) => {
                  const Icon = PLACE_ICONS[item.kind] || MapPin;
                  return (
                    <li key={`${item.kind}-${item.name}-${index}`}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-[#edf5fc]"
                        onClick={() => { pick(item, "search", item); setQuery(item.name); setResults({ state: "idle", items: [] }); }}
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#0b4c86]" aria-hidden="true" />
                        <span>
                          <span className="block text-sm font-bold text-slate-800">{item.name}</span>
                          <span className="block text-xs text-slate-500">{[item.tambon && `ต.${item.tambon}`, item.district && `อ.${item.district}`].filter(Boolean).join(" ")}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <div>
            <label htmlFor="map-link" className="mb-1 flex items-center gap-1.5 text-sm font-bold text-slate-700">
              <Link2 className="h-4 w-4 text-[#0b4c86]" aria-hidden="true" /> หรือวางลิงก์ Google Maps / ตำแหน่งจาก LINE
            </label>
            <div className="flex gap-2">
              <input
                id="map-link"
                value={linkText}
                onChange={(event) => { setLinkText(event.target.value); setLinkMessage(""); }}
                placeholder="เช่น https://maps.google.com/?q=6.62,100.06"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0b4c86]"
              />
              <button type="button" onClick={readLink} className="shrink-0 rounded-xl border-2 border-[#c9dcee] px-3 text-sm font-bold text-[#083865] hover:bg-[#edf5fc]">ใช้พิกัดนี้</button>
            </div>
            {linkMessage ? <p className="mt-1.5 text-sm text-amber-800">{linkMessage}</p> : null}
          </div>

          {showMap ? (
            <div className="h-64 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 md:h-72">
              {mounted ? (
                <MapContainer center={position || SATUN_CENTER} zoom={position ? 15 : 10} style={{ height: "100%", width: "100%" }}>
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapBehaviour position={position} onPick={(latlng) => pick(latlng, "map", place)} />
                  {position ? (
                    <Marker
                      position={position}
                      draggable
                      eventHandlers={{ dragend: (event) => pick(event.target.getLatLng(), "map", place) }}
                    />
                  ) : null}
                </MapContainer>
              ) : null}
            </div>
          ) : null}

          <p className={`flex items-start gap-1.5 rounded-lg px-3 py-2 text-sm ${position ? "bg-[#edf5fc] font-semibold text-[#083865]" : "bg-slate-50 text-slate-500"}`}>
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {position
              ? <span>ปักหมุดแล้ว{place?.name ? ` ใกล้ ${place.name}` : ""} · {SOURCE_TEXT[position.source]}{showMap ? " · ลากหมุดหรือแตะแผนที่เพื่อขยับ" : ""}</span>
              : <span>ยังไม่ได้ระบุตำแหน่ง</span>}
          </p>
        </fieldset>

        {/* 2. ระดับน้ำ */}
        <fieldset className="rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5">
          <StepTitle number={2} hint="เทียบกับผู้ใหญ่ที่ยืนในน้ำ">ระดับน้ำ</StepTitle>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3" role="radiogroup" aria-label="ระดับน้ำ">
            {WATER_LEVELS.map((item) => {
              const active = form.level === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set("level", item.value)}
                  className={`relative flex flex-col items-center rounded-2xl border bg-white px-1.5 pb-2.5 pt-3 text-center transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b4c86] ${active ? "border-transparent" : "border-slate-200 hover:border-[#c9dcee] hover:bg-[#f7fbff]"}`}
                  style={active ? { boxShadow: `0 0 0 2.5px ${item.color}`, backgroundColor: `${item.color}12` } : undefined}
                >
                  {active ? (
                    <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full text-white" style={{ backgroundColor: item.color }}>
                      <CircleCheck className="h-4 w-4" aria-hidden="true" />
                    </span>
                  ) : null}
                  <WaterLevelFigure id={item.value} fill={item.fill} color={item.color} className="h-14 w-14 sm:h-16 sm:w-16" />
                  <span className="mt-1.5 text-[13px] font-bold leading-tight text-slate-900 sm:text-sm">{item.label}</span>
                  <span className="mt-0.5 text-xs text-slate-500">{item.range}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 3. แนวโน้ม + การสัญจร */}
        <fieldset className="space-y-4 rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5">
          <StepTitle number={3} hint="ไม่บังคับ">แนวโน้มและการสัญจร</StepTitle>
          <div>
            <p className="mb-1.5 text-sm font-bold text-slate-700" id="trend-label">น้ำตอนนี้</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="trend-label">
              {WATER_TRENDS.map((item) => {
                const active = form.trend === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => toggle("trend", item.value)}
                    className={`min-h-12 rounded-xl border-2 px-2 py-2 text-sm font-bold ${active ? "border-[#0b4c86] bg-[#edf5fc] text-[#083865]" : "border-slate-200 text-slate-700 hover:border-[#c9dcee]"}`}
                  >
                    <span className="mr-1 text-base" aria-hidden="true">{item.arrow}</span>{item.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-bold text-slate-700" id="pass-label">รถผ่านได้ไหม</p>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-labelledby="pass-label">
              {WATER_PASSABILITY.map((item) => {
                const active = form.passability === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => toggle("passability", item.value)}
                    className={`min-h-12 rounded-xl border-2 px-3 py-2 text-sm font-bold ${active ? "border-[#0b4c86] bg-[#edf5fc] text-[#083865]" : "border-slate-200 text-slate-700 hover:border-[#c9dcee]"}`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-slate-700">หมายเหตุ</span>
            <textarea
              rows={2}
              maxLength={MAX_NOTE}
              value={form.note}
              onChange={(event) => set("note", event.target.value)}
              placeholder="เช่น น้ำท่วมถนนหน้าโรงเรียน ไหลเชี่ยว / มีขยะกีดขวาง"
              className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-slate-800 outline-none focus:border-[#0b4c86] focus:ring-2 focus:ring-[#c9dcee]"
            />
          </label>
          <div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-[#c9dcee] px-4 py-3 text-slate-700 hover:bg-[#edf5fc]">
              <Camera className="h-6 w-6 shrink-0 text-[#0b4c86]" aria-hidden="true" />
              <span className="text-sm"><span className="font-bold">แนบรูป (ไม่บังคับ)</span><span className="block text-slate-500">รูปที่ถ่ายตอนนี้ ระบบลบข้อมูลตำแหน่งในไฟล์รูปให้อัตโนมัติ</span></span>
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={pickPhoto} className="sr-only" />
            </label>
            {preview ? (
              <div className="mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="รูปที่เลือก" className="h-20 w-28 rounded-lg object-cover" />
                <button type="button" onClick={() => { setPhoto(null); setPreview(""); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  <X className="h-4 w-4" aria-hidden="true" /> เอารูปออก
                </button>
              </div>
            ) : null}
          </div>
        </fieldset>

        <details className="rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5" open={Boolean(form.firstName || form.lastName || form.phone) || undefined}>
          <summary className="cursor-pointer font-bold text-slate-800">ให้เจ้าหน้าที่ติดต่อกลับ และติดตามผลได้ (ไม่บังคับ)</summary>
          <p className="mt-2 flex items-start gap-2 text-sm text-slate-600"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0b4c86]" aria-hidden="true" /> ใช้เมื่อเจ้าหน้าที่ต้องสอบถามเพิ่ม ไม่แสดงบนแผนที่หรือหน้าสาธารณะ</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-800">ชื่อ</span>
              <input value={form.firstName} onChange={(event) => set("firstName", event.target.value)} autoComplete="given-name" maxLength={100} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-[#0b4c86]" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-800">นามสกุล</span>
              <input value={form.lastName} onChange={(event) => set("lastName", event.target.value)} autoComplete="family-name" maxLength={100} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-[#0b4c86]" />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-bold text-slate-800">เบอร์โทร</span>
              <input type="tel" inputMode="tel" value={form.phone} onChange={(event) => set("phone", event.target.value)} autoComplete="tel" placeholder="08xxxxxxxx" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-[#0b4c86] sm:max-w-[calc(50%-0.375rem)]" />
            </label>
          </div>
          <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${form.firstName.trim() && form.lastName.trim() && form.phone.replace(/\D/g, "").length >= 9 ? "bg-emerald-50 font-semibold text-emerald-800" : "bg-slate-50 text-slate-600"}`}>
            {form.firstName.trim() && form.lastName.trim() && form.phone.replace(/\D/g, "").length >= 9
              ? "กรอกครบแล้ว ดูผลการตรวจสอบได้ที่เมนู \"ติดตามคำขอ\""
              : "กรอกชื่อ นามสกุล และเบอร์โทรครบ จะดูผลการตรวจสอบได้ที่เมนู \"ติดตามคำขอ\""}
          </p>
        </details>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}

        <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#0b4c86] px-5 py-4 text-lg font-black text-white shadow-sm hover:bg-[#083865] disabled:opacity-60">
          {busy ? "กำลังส่ง…" : "ส่งรายงานระดับน้ำ"}
        </button>
        <p className="text-center text-xs text-slate-500">
          ตำแหน่ง ระดับน้ำ และรูปใช้ตรวจสอบและแสดงสถานการณ์บนแผนที่ (แสดงตำแหน่งโดยประมาณ) ส่วนชื่อและเบอร์โทรใช้ติดต่อกลับและติดตามเรื่องเท่านั้น ไม่แสดงต่อสาธารณะ ·{" "}
          <Link href="/privacy-policy" target="_blank" className="font-bold text-[#0b4c86] underline">นโยบายความเป็นส่วนตัว</Link>
        </p>
      </form>
    </>
  );
}
