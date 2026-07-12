"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import Footer from "@/components/Footer";
import { showWarning } from "@/lib/sweetAlert";

const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });

const MapClickHandler = dynamic(
    () => import("react-leaflet").then((mod) => {
        const { useMapEvents } = mod;

        function MapClickHandlerInner({ setPosition }) {
            useMapEvents({
                click(event) {
                    setPosition(event.latlng);
                }
            });
            return null;
        }

        return MapClickHandlerInner;
    }),
    { ssr: false }
);

const HELP_CATEGORIES = [
    { value: "medicine", label: "ด้านยา", description: "ยา เวชภัณฑ์ หรืออุปกรณ์ดูแลสุขภาพ" },
    { value: "vulnerable", label: "ด้านกลุ่มเปราะบาง", description: "ผู้สูงอายุ ผู้พิการ เด็ก ผู้ป่วยติดเตียง หรือผู้ที่ต้องดูแลพิเศษ" }
];

function LocationMarker({ position, setPosition }) {
    return (
        <>
            <MapClickHandler setPosition={setPosition} />
            {position && <Marker position={position} />}
        </>
    );
}

function getLocalDateTimeValue() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function ReportIncidentPage() {
    const [mounted, setMounted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [markerPosition, setMarkerPosition] = useState(null);
    const [gpsStatus, setGpsStatus] = useState("idle");
    const [gpsError, setGpsError] = useState("");
    const [villages, setVillages] = useState([]);
    const [showVillageDropdown, setShowVillageDropdown] = useState(false);
    const [searchingVillage, setSearchingVillage] = useState(false);
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
    const villageInputRef = useRef(null);

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        phone: "",
        helpCategory: "medicine",
        helpReason: "",
        village: "",
        subDistrict: "",
        district: "",
        occurredAt: getLocalDateTimeValue()
    });

    useEffect(() => {
        setMounted(true);

        if (typeof window !== "undefined") {
            import("leaflet").then((L) => {
                delete L.Icon.Default.prototype._getIconUrl;
                L.Icon.Default.mergeOptions({
                    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
                    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
                    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png"
                });
            });

            requestGpsLocation();
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (villageInputRef.current && !villageInputRef.current.contains(event.target)) {
                setShowVillageDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        return () => {
            if (photoPreviewUrl) {
                URL.revokeObjectURL(photoPreviewUrl);
            }
        };
    }, [photoPreviewUrl]);

    const requestGpsLocation = () => {
        if (!navigator.geolocation) {
            setGpsStatus("error");
            setGpsError("เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง");
            return;
        }

        setGpsStatus("requesting");
        setGpsError("");

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setMarkerPosition({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
                setGpsStatus("success");
            },
            (error) => {
                setGpsStatus(error.code === error.PERMISSION_DENIED ? "denied" : "error");
                setGpsError("ไม่สามารถดึงตำแหน่งอัตโนมัติได้ กรุณาปักหมุดบนแผนที่");
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    };

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormData((current) => ({ ...current, [name]: value }));

        if (name === "village" && value.length >= 2) {
            searchVillages(value);
        } else if (name === "village") {
            setVillages([]);
            setShowVillageDropdown(false);
        }
    };

    const searchVillages = async (searchTerm) => {
        setSearchingVillage(true);
        try {
            const response = await fetch(`/stn-eoc/api/public/villages?search=${encodeURIComponent(searchTerm)}`);
            const result = await response.json();
            if (result.success) {
                setVillages(result.data || []);
                setShowVillageDropdown((result.data || []).length > 0);
            }
        } catch (error) {
            console.error("Village search error:", error);
        } finally {
            setSearchingVillage(false);
        }
    };

    const selectVillage = (village) => {
        setFormData((current) => ({
            ...current,
            village: village.name,
            subDistrict: village.subDistrict,
            district: village.district
        }));
        setShowVillageDropdown(false);
        setVillages([]);
    };

    const handlePhotoChange = (event) => {
        const file = event.target.files?.[0];

        if (!file) {
            setPhotoFile(null);
            setPhotoPreviewUrl("");
            return;
        }

        if (!file.type.startsWith("image/")) {
            showWarning("กรุณาแนบไฟล์รูปภาพเท่านั้น");
            event.target.value = "";
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            showWarning("ไฟล์รูปภาพต้องมีขนาดไม่เกิน 10MB");
            event.target.value = "";
            return;
        }

        setPhotoFile(file);
        setPhotoPreviewUrl(URL.createObjectURL(file));
    };

    const clearPhoto = () => {
        setPhotoFile(null);
        setPhotoPreviewUrl("");
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitSuccess(false);
        setSubmitError("");

        if (!formData.firstName || !formData.lastName) {
            showWarning("กรุณากรอกชื่อและนามสกุล");
            return;
        }

        if (!formData.phone) {
            showWarning("กรุณากรอกเบอร์โทรศัพท์");
            return;
        }

        if (!formData.helpCategory) {
            showWarning("กรุณาเลือกประเภทความช่วยเหลือ");
            return;
        }

        if (!formData.helpReason.trim()) {
            showWarning("กรุณาระบุเหตุผลการขอความช่วยเหลือ");
            return;
        }

        if (!markerPosition) {
            showWarning("กรุณาปักหมุดจุดขอความช่วยเหลือบนแผนที่");
            return;
        }

        setIsSubmitting(true);

        try {
            const payload = new FormData();
            payload.append("firstName", formData.firstName);
            payload.append("lastName", formData.lastName);
            payload.append("phone", formData.phone);
            payload.append("helpCategory", formData.helpCategory);
            payload.append("helpReason", formData.helpReason);
            payload.append("description", formData.helpReason);
            payload.append("village", formData.village);
            payload.append("subDistrict", formData.subDistrict);
            payload.append("district", formData.district);
            payload.append("occurredAt", formData.occurredAt || getLocalDateTimeValue());
            payload.append("latitude", markerPosition.lat);
            payload.append("longitude", markerPosition.lng);
            payload.append("reportType", "help_request");
            payload.append("disasterType", "assistance");
            payload.append("urgency", "high");
            if (photoFile) {
                payload.append("photo", photoFile);
            }

            const response = await fetch("/stn-eoc/api/public/report-incident", {
                method: "POST",
                body: payload
            });
            const result = await response.json();

            if (!result.success) {
                setSubmitError(result.message || "เกิดข้อผิดพลาดในการส่งข้อมูล");
                return;
            }

            setSubmitSuccess(true);
            setFormData({
                firstName: "",
                lastName: "",
                phone: "",
                helpCategory: "medicine",
                helpReason: "",
                village: "",
                subDistrict: "",
                district: "",
                occurredAt: getLocalDateTimeValue()
            });
            setMarkerPosition(null);
            clearPhoto();
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (error) {
            console.error("Submit help request error:", error);
            setSubmitError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-slate-50">
            <header className="border-b border-red-100 bg-white">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
                    <div>
                        <p className="text-sm font-bold text-red-700">ขอความช่วยเหลือจาก EOC</p>
                        <h1 className="text-2xl font-black text-slate-900 md:text-3xl">แจ้งขอความช่วยเหลือ</h1>
                    </div>
                    <Link href="/" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">
                        กลับหน้าหลัก
                    </Link>
                </div>
            </header>

            <main className="mx-auto max-w-6xl flex-1 px-4 py-5 md:py-8">
                {submitSuccess && (
                    <section className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 shadow-sm">
                        <h2 className="text-lg font-black">ส่งคำขอความช่วยเหลือเรียบร้อยแล้ว</h2>
                        <p className="mt-1 text-sm">เจ้าหน้าที่ได้รับข้อมูลและจะตรวจสอบเพื่อประสานความช่วยเหลือต่อไป</p>
                    </section>
                )}

                {submitError && (
                    <section className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm">
                        <h2 className="text-lg font-black">ไม่สามารถส่งคำขอได้</h2>
                        <p className="mt-1 text-sm">{submitError}</p>
                    </section>
                )}

                <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
                    <section className="space-y-5">
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
                            <h2 className="mb-4 text-xl font-black text-slate-900">ข้อมูลผู้ขอความช่วยเหลือ</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                <TextField label="ชื่อ" name="firstName" value={formData.firstName} onChange={handleInputChange} required />
                                <TextField label="นามสกุล" name="lastName" value={formData.lastName} onChange={handleInputChange} required />
                                <TextField label="เบอร์โทรศัพท์" name="phone" type="tel" value={formData.phone} onChange={handleInputChange} required placeholder="0812345678" />
                                <label className="block">
                                    <span className="mb-2 block text-sm font-bold text-slate-700">วันที่/เวลา</span>
                                    <input
                                        type="datetime-local"
                                        name="occurredAt"
                                        value={formData.occurredAt}
                                        onChange={handleInputChange}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-700 outline-none focus:border-red-400"
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
                            <h2 className="mb-4 text-xl font-black text-slate-900">ประเภทและเหตุผล</h2>
                            <div className="grid gap-3 md:grid-cols-2">
                                {HELP_CATEGORIES.map((category) => (
                                    <button
                                        key={category.value}
                                        type="button"
                                        onClick={() => setFormData((current) => ({ ...current, helpCategory: category.value }))}
                                        className={`rounded-xl border p-4 text-left transition ${
                                            formData.helpCategory === category.value
                                                ? "border-red-500 bg-red-50 text-red-900 shadow-sm"
                                                : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50"
                                        }`}
                                    >
                                        <div className="font-black">{category.label}</div>
                                        <p className="mt-1 text-sm">{category.description}</p>
                                    </button>
                                ))}
                            </div>
                            <label className="mt-4 block">
                                <span className="mb-2 block text-sm font-bold text-slate-700">เหตุผลการขอความช่วยเหลือ <span className="text-red-500">*</span></span>
                                <textarea
                                    name="helpReason"
                                    value={formData.helpReason}
                                    onChange={handleInputChange}
                                    rows={5}
                                    required
                                    placeholder="เช่น ผู้ป่วยติดเตียงต้องการยา, มีผู้สูงอายุติดอยู่ในบ้าน, ต้องการเวชภัณฑ์เร่งด่วน"
                                    className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-slate-700 outline-none focus:border-red-400"
                                />
                            </label>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
                            <h2 className="mb-4 text-xl font-black text-slate-900">พื้นที่โดยประมาณ</h2>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="relative md:col-span-1" ref={villageInputRef}>
                                    <TextField label="หมู่บ้าน/ชุมชน" name="village" value={formData.village} onChange={handleInputChange} placeholder="พิมพ์ชื่อหมู่บ้าน" />
                                    {searchingVillage && <span className="absolute right-3 top-10 text-sm text-slate-400">ค้นหา...</span>}
                                    {showVillageDropdown && villages.length > 0 && (
                                        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-red-200 bg-white shadow-xl">
                                            {villages.map((village, index) => (
                                                <button
                                                    key={`${village.name}-${index}`}
                                                    type="button"
                                                    onClick={() => selectVillage(village)}
                                                    className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-red-50"
                                                >
                                                    <div className="font-bold text-slate-800">{village.name}</div>
                                                    <div className="text-slate-500">ต.{village.subDistrict} อ.{village.district}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <TextField label="ตำบล" name="subDistrict" value={formData.subDistrict} onChange={handleInputChange} />
                                <TextField label="อำเภอ" name="district" value={formData.district} onChange={handleInputChange} />
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
                            <h2 className="mb-4 text-xl font-black text-slate-900">รูปประกอบ</h2>
                            <label className="block">
                                <span className="mb-2 block text-sm font-bold text-slate-700">แนบรูปภาพสถานการณ์ (ถ้ามี)</span>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handlePhotoChange}
                                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-3 file:py-2 file:font-bold file:text-red-700 hover:file:bg-red-100"
                                />
                            </label>
                            {photoPreviewUrl && (
                                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                    <Image
                                        src={photoPreviewUrl}
                                        alt="ตัวอย่างรูปที่แนบ"
                                        width={900}
                                        height={500}
                                        unoptimized
                                        className="max-h-72 w-full object-contain"
                                    />
                                    <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-3 py-2 text-sm">
                                        <span className="min-w-0 truncate font-semibold text-slate-600">{photoFile?.name}</span>
                                        <button
                                            type="button"
                                            onClick={clearPhoto}
                                            className="shrink-0 rounded-lg bg-slate-200 px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-300"
                                        >
                                            ลบรูป
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <aside className="space-y-5">
                        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                            <div className="mb-3 flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">ปักหมุดจุดขอความช่วยเหลือ</h2>
                                    <p className="mt-1 text-sm text-slate-600">แตะบนแผนที่เพื่อระบุตำแหน่ง หรือใช้ตำแหน่งปัจจุบัน</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={requestGpsLocation}
                                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700"
                                >
                                    ใช้ GPS
                                </button>
                            </div>

                            {gpsStatus === "requesting" && <p className="mb-2 text-sm font-semibold text-slate-500">กำลังขอตำแหน่ง...</p>}
                            {gpsError && <p className="mb-2 rounded-lg bg-amber-50 p-2 text-sm font-semibold text-amber-700">{gpsError}</p>}

                            <div className="h-[380px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                                {mounted && (
                                    <MapContainer center={markerPosition || [6.6238, 100.0750]} zoom={11} style={{ height: "100%", width: "100%" }}>
                                        <TileLayer
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        />
                                        <LocationMarker position={markerPosition} setPosition={setMarkerPosition} />
                                    </MapContainer>
                                )}
                            </div>

                            {markerPosition && (
                                <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs font-bold text-red-800">
                                    พิกัด: {markerPosition.lat.toFixed(6)}, {markerPosition.lng.toFixed(6)}
                                </p>
                            )}
                        </section>

                        <section className="rounded-xl border border-red-100 bg-red-50 p-4 text-red-900">
                            <h3 className="font-black">เบอร์ฉุกเฉิน</h3>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                <EmergencyCall number="1669" label="แพทย์ฉุกเฉิน" />
                                <EmergencyCall number="1784" label="ปภ." />
                                <EmergencyCall number="191" label="ตำรวจ" />
                                <EmergencyCall number="199" label="ดับเพลิง" />
                            </div>
                        </section>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full rounded-xl bg-red-600 px-5 py-4 text-lg font-black text-white shadow-lg transition hover:bg-red-700 disabled:bg-red-200 disabled:text-red-900"
                        >
                            {isSubmitting ? "กำลังส่งคำขอ..." : "ส่งคำขอความช่วยเหลือ"}
                        </button>
                    </aside>
                </form>
            </main>

            <Footer />
        </div>
    );
}

function TextField({ label, name, value, onChange, type = "text", required = false, placeholder = "" }) {
    return (
        <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
                {label} {required && <span className="text-red-500">*</span>}
            </span>
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                required={required}
                placeholder={placeholder}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-700 outline-none focus:border-red-400"
            />
        </label>
    );
}

function EmergencyCall({ number, label }) {
    return (
        <a href={`tel:${number}`} className="rounded-lg bg-white px-3 py-2 text-center shadow-sm hover:bg-red-100">
            <div className="text-xl font-black">{number}</div>
            <div className="text-xs font-semibold">{label}</div>
        </a>
    );
}
