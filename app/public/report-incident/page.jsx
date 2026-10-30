"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Accessibility, Camera, Car, CircleCheck, CircleHelp, DoorClosed, Footprints, House, LocateFixed, MapPin, Phone, Ship, ShieldCheck, Siren, Truck, X } from "lucide-react";
import WaterLevelFigure from "@/components/public/water/WaterLevelFigure";
import { WATER_LEVELS } from "@/lib/waterReport";
import PublicLayout from "@/components/layouts/PublicLayout";
import { showWarning } from "@/lib/sweetAlert";
import useHelpAvailability from "@/components/public/useHelpAvailability";
import { trackPublicUsage } from "@/lib/publicUsage";
import TrackingCodeCard from "@/components/public/TrackingCodeCard";
import { shareVisitGps } from "@/lib/visitorGps";
import { ACCESS_ROUTES, MEDICINE_REMAINING, MOBILITY, ON_BEHALF_RELATIONS, VULNERABLE_GROUPS } from "@/lib/helpRequestDetails";

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

const EMPTY_DETAILS = {
    onBehalf: "self",
    relation: "",
    patientName: "",
    patientPhone: "",
    peopleCount: "",
    vulnerableGroups: [],
    medicineRemaining: "",
    medicineNeeded: "",
    homeWaterLevel: "",
    mobility: "",
    accessRoute: ""
};

function getLocalDateTimeValue() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function StepTitle({ number, children, hint }) {
    return (
        <h2 className="mb-4 flex w-full flex-wrap items-baseline gap-x-2 px-1">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-full bg-[#0b4c86] text-sm font-black text-white" aria-hidden="true">{number}</span>
            <span className="text-lg font-black text-slate-900">{children}</span>
            {hint ? <span className="text-sm text-slate-500">{hint}</span> : null}
        </h2>
    );
}

export default function ReportIncidentPage() {
    const { helpOpen } = useHelpAvailability();
    const [mounted, setMounted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [consentGiven, setConsentGiven] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [tracking, setTracking] = useState(null);
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
    const [details, setDetails] = useState(EMPTY_DETAILS);
    const setDetail = (name, value) => setDetails((current) => ({ ...current, [name]: value }));
    const toggleGroup = (value) => setDetails((current) => ({
        ...current,
        vulnerableGroups: current.vulnerableGroups.includes(value)
            ? current.vulnerableGroups.filter((item) => item !== value)
            : [...current.vulnerableGroups, value]
    }));
    const onBehalf = details.onBehalf === "other";

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
                shareVisitGps(position.coords, "report-incident");
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

        if (formData.helpCategory === "medicine" && !details.medicineRemaining) {
            showWarning("กรุณาระบุว่ายาเหลือพอใช้อีกกี่วัน");
            return;
        }

        if (formData.helpCategory === "vulnerable" && !details.vulnerableGroups.length) {
            showWarning("กรุณาเลือกกลุ่มที่ต้องดูแลพิเศษอย่างน้อย 1 กลุ่ม");
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

        if (!consentGiven) {
            showWarning("กรุณายืนยันการให้ใช้ข้อมูลส่วนบุคคลเพื่อการช่วยเหลือ");
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
            // ความเร่งด่วนจัดโดยเซิร์ฟเวอร์จากข้อมูลด้านล่าง
            Object.entries(details).forEach(([key, value]) => {
                if (key === "vulnerableGroups") payload.append(key, value.join(","));
                else if (value !== "") payload.append(key, value);
            });
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
            setTracking({ code: result.trackingCode || null, firstName: formData.firstName, lastName: formData.lastName, phone: formData.phone });
            trackPublicUsage("help_request_submitted", "/public/report-incident");
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
            setDetails(EMPTY_DETAILS);
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

    // ฟอร์มนี้รับคำขอเฉพาะตอนที่ EOC เปิดอยู่ (เซิร์ฟเวอร์ตรวจซ้ำอีกชั้น)
    if (!helpOpen) {
        return (
            <PublicLayout>
                <div className="min-h-full bg-[#f4f8fc]">
                <div className="mx-auto flex w-full max-w-2xl flex-col justify-center px-4 py-10">
                    <section className="rounded-2xl border border-[#c9dcee] bg-white p-6 text-center" role="status">
                        <h1 className="text-2xl font-black text-slate-900">ขณะนี้ยังไม่เปิดรับคำขอความช่วยเหลือ</h1>
                        <p className="mt-3 text-slate-700">
                            เว็บไซต์รับคำขอความช่วยเหลือเฉพาะเมื่อศูนย์ปฏิบัติการ (EOC) เปิดรับมือเหตุการณ์ฉุกเฉิน ขณะนี้ยังไม่มีเหตุการณ์ที่เปิดอยู่
                        </p>
                        <a href="tel:1669" className="mt-5 flex items-center justify-center rounded-xl bg-red-600 px-4 py-4 text-lg font-black text-white hover:bg-red-700">
                            เหตุฉุกเฉินโทร 1669
                        </a>
                        <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm font-bold">
                            <Link href="/public/my-risk" className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-100">บ้านฉันเสี่ยงไหม</Link>
                            <Link href="/public/announcements" className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-100">ประกาศ</Link>
                            <Link href="/" className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-100">กลับหน้าหลัก</Link>
                        </div>
                    </section>
                </div>
                </div>
            </PublicLayout>
        );
    }

    return (
        <PublicLayout>
        <div className="min-h-full bg-[#f4f8fc]">
            <header>
                <div className="mx-auto flex max-w-2xl flex-wrap items-start justify-between gap-3 px-4 pb-1 pt-5 md:pt-8">
                    <div>
                        <h1 className="text-2xl font-black text-[#083865] md:text-3xl">ขอความช่วยเหลือ</h1>
                        <p className="mt-1 text-slate-700">บอกความต้องการและตำแหน่ง เพื่อให้เจ้าหน้าที่ติดต่อกลับและประสานความช่วยเหลือ</p>
                    </div>
                    <a href="tel:1669" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-red-700"><Phone className="h-4 w-4" aria-hidden="true" /> โทรกู้ภัย</a>
                </div>
            </header>

            <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-3">
                <aside className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                    <Siren className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 font-semibold">หากมีผู้บาดเจ็บหรืออันตรายเร่งด่วน โทร 1669 ทันที</span>
                    <a href="tel:1669" className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white hover:bg-red-700">โทร 1669</a>
                </aside>
                <aside className="mb-4 rounded-xl border border-[#c9dcee] bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                    <span className="font-bold text-[#083865]">รับคำขอ 2 ด้าน: ด้านยา และด้านกลุ่มเปราะบาง</span>{" "}
                    สำนักงานสาธารณสุขจังหวัดสตูล (สสจ.) รวบรวมคำขอ แล้วส่งต่อให้ ปภ. จังหวัดสตูล เข้าพื้นที่ช่วยเหลือ
                    ยิ่งตอบข้อ 3 ได้ครบ เจ้าหน้าที่ยิ่งจัดลำดับและเตรียมการเข้าพื้นที่ได้ถูกต้อง
                </aside>
                <p className="mb-5 text-sm text-slate-600">ต้องการแจ้งน้ำท่วม ถนนขาด หรือไฟดับโดยไม่มีผู้ขอความช่วยเหลือ? <Link href="/public/report-problem" className="font-bold text-[#0b4c86] underline">แจ้งจุดปัญหา</Link></p>
                {submitSuccess && (
                    <section className="mb-5 rounded-2xl border border-emerald-200 bg-white p-4 text-emerald-800" role="status">
                        <h2 className="flex items-center gap-2 text-lg font-black"><CircleCheck className="h-5 w-5" aria-hidden="true" /> ส่งคำขอความช่วยเหลือเรียบร้อยแล้ว</h2>
                        <p className="mt-1 text-sm">เจ้าหน้าที่ได้รับข้อมูลและจะตรวจสอบเพื่อประสานความช่วยเหลือต่อไป</p>
                        {tracking ? <TrackingCodeCard code={tracking.code} firstName={tracking.firstName} lastName={tracking.lastName} phone={tracking.phone} /> : null}
                    </section>
                )}

                {submitError && (
                    <section className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
                        <h2 className="text-lg font-black">ไม่สามารถส่งคำขอได้</h2>
                        <p className="mt-1 text-sm">{submitError}</p>
                    </section>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <section className="space-y-4">
                        <div className="rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5">
                            <StepTitle number={1} hint="สำหรับให้เจ้าหน้าที่ติดต่อกลับ">ข้อมูลผู้แจ้ง</StepTitle>
                            <ChoiceGroup
                                label="แจ้งให้ใคร"
                                value={details.onBehalf}
                                onChange={(value) => setDetail("onBehalf", value || "self")}
                                options={[{ value: "self", label: "ตัวเอง/คนในบ้าน" }, { value: "other", label: "แจ้งแทนผู้อื่น" }]}
                                columns="grid-cols-2"
                            />
                            {onBehalf ? (
                                <p className="-mt-1 mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">กรอกชื่อและเบอร์ของ<strong>ท่าน (ผู้แจ้ง)</strong> ด้านล่าง ใช้ติดตามคำขอได้ และกรอกข้อมูลผู้ที่ต้องการความช่วยเหลือในช่องถัดไป</p>
                            ) : null}
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
                                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-700 outline-none focus:border-[#0b4c86] focus:ring-2 focus:ring-[#c9dcee]"
                                    />
                                </label>
                            </div>
                            {onBehalf ? (
                                <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
                                    <TextField label="ชื่อ-นามสกุล ผู้ต้องการความช่วยเหลือ" name="patientName" value={details.patientName} onChange={(event) => setDetail("patientName", event.target.value)} placeholder="เช่น นางสมใจ ใจดี" />
                                    <TextField label="เบอร์ติดต่อที่บ้าน/ในพื้นที่" name="patientPhone" type="tel" value={details.patientPhone} onChange={(event) => setDetail("patientPhone", event.target.value)} placeholder="ถ้ามี" />
                                    <label className="block md:col-span-2">
                                        <span className="mb-2 block text-sm font-bold text-slate-700">ท่านเกี่ยวข้องเป็น</span>
                                        <select
                                            value={details.relation}
                                            onChange={(event) => setDetail("relation", event.target.value)}
                                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-700 outline-none focus:border-[#0b4c86] focus:ring-2 focus:ring-[#c9dcee]"
                                        >
                                            <option value="">เลือก</option>
                                            {ON_BEHALF_RELATIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                                        </select>
                                    </label>
                                </div>
                            ) : null}
                        </div>

                        <div className="rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5">
                            <StepTitle number={2}>ประเภทและเหตุผล</StepTitle>
                            <div className="grid gap-3 md:grid-cols-2">
                                {HELP_CATEGORIES.map((category) => (
                                    <button
                                        key={category.value}
                                        type="button"
                                        onClick={() => setFormData((current) => ({ ...current, helpCategory: category.value }))}
                                        className={`rounded-xl border p-4 text-left transition ${
                                            formData.helpCategory === category.value
                                                ? "border-[#0b4c86] bg-[#edf5fc] text-[#083865] shadow-sm"
                                                : "border-slate-200 bg-white text-slate-700 hover:border-[#c9dcee] hover:bg-[#f7fbff]"
                                        }`}
                                    >
                                        <div className="font-black">{category.label}</div>
                                        <p className="mt-1 text-sm">{category.description}</p>
                                    </button>
                                ))}
                            </div>
                            {formData.helpCategory === "medicine" ? (
                                <div className="mt-4 space-y-4">
                                    <ChoiceGroup
                                        label="ยาที่ใช้ประจำเหลือพอใช้อีกกี่วัน"
                                        required
                                        value={details.medicineRemaining}
                                        onChange={(value) => setDetail("medicineRemaining", value)}
                                        options={MEDICINE_REMAINING}
                                        columns="grid-cols-2 md:grid-cols-4"
                                    />
                                    <TextField label="ชื่อยา หรือโรคประจำตัว" name="medicineNeeded" value={details.medicineNeeded} onChange={(event) => setDetail("medicineNeeded", event.target.value)} placeholder="เช่น ยาเบาหวาน, ยาความดัน, อินซูลิน (ถ้ามีสมุดยาให้ถ่ายรูปแนบ)" />
                                </div>
                            ) : null}
                            <fieldset className="mt-4">
                                <legend className="mb-2 block text-sm font-bold text-slate-700">
                                    ในบ้านมีผู้ที่ต้องดูแลพิเศษหรือไม่ {formData.helpCategory === "vulnerable" ? <span className="text-red-500">*</span> : <span className="font-normal text-slate-500">(เลือกได้หลายข้อ)</span>}
                                </legend>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {VULNERABLE_GROUPS.map((group) => {
                                        const checked = details.vulnerableGroups.includes(group.value);
                                        return (
                                            <label key={group.value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${checked ? "border-[#0b4c86] bg-[#edf5fc] font-bold text-[#083865]" : "border-slate-200 bg-white text-slate-700 hover:border-[#c9dcee]"}`}>
                                                <input type="checkbox" checked={checked} onChange={() => toggleGroup(group.value)} className="h-5 w-5 shrink-0 accent-[#0b4c86]" />
                                                <span>{group.label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </fieldset>
                            <label className="mt-4 block">
                                <span className="mb-2 block text-sm font-bold text-slate-700">เหตุผลการขอความช่วยเหลือ <span className="text-red-500">*</span></span>
                                <textarea
                                    name="helpReason"
                                    value={formData.helpReason}
                                    onChange={handleInputChange}
                                    rows={4}
                                    required
                                    placeholder="เช่น ผู้ป่วยติดเตียงต้องการยา, มีผู้สูงอายุติดอยู่ในบ้าน, ต้องการเวชภัณฑ์เร่งด่วน"
                                    className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-slate-700 outline-none focus:border-[#0b4c86] focus:ring-2 focus:ring-[#c9dcee]"
                                />
                            </label>
                        </div>

                        <div className="rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5">
                            <StepTitle number={3} hint="ใช้จัดลำดับความเร่งด่วนและเตรียมการเข้าพื้นที่">สภาพที่บ้านตอนนี้</StepTitle>
                            <div className="space-y-4">
                                <label className="block max-w-[12rem]">
                                    <span className="mb-2 block text-sm font-bold text-slate-700">จำนวนคนในบ้าน</span>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        max={999}
                                        value={details.peopleCount}
                                        onChange={(event) => setDetail("peopleCount", event.target.value.replace(/\D/g, "").slice(0, 3))}
                                        placeholder="เช่น 4"
                                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-700 outline-none focus:border-[#0b4c86] focus:ring-2 focus:ring-[#c9dcee]"
                                    />
                                </label>
                                <WaterLevelPicker value={details.homeWaterLevel} onChange={(value) => setDetail("homeWaterLevel", value)} />
                                <IconChoiceGroup label="ออกจากบ้านได้หรือไม่" value={details.mobility} onChange={(value) => setDetail("mobility", value)} options={MOBILITY} icons={MOBILITY_ICONS} columns="grid-cols-3" />
                                <IconChoiceGroup label="เจ้าหน้าที่เดินทางเข้าถึงบ้านได้อย่างไร" value={details.accessRoute} onChange={(value) => setDetail("accessRoute", value)} options={ACCESS_ROUTES} icons={ACCESS_ICONS} columns="grid-cols-2 sm:grid-cols-4" />
                            </div>
                        </div>

                        <div className="rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5">
                            <StepTitle number={4} hint="ช่วยระบุพื้นที่ให้เจ้าหน้าที่">พื้นที่โดยประมาณ</StepTitle>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="relative md:col-span-1" ref={villageInputRef}>
                                    <TextField label="หมู่บ้าน/ชุมชน" name="village" value={formData.village} onChange={handleInputChange} placeholder="พิมพ์ชื่อหมู่บ้าน" />
                                    {searchingVillage && <span className="absolute right-3 top-10 text-sm text-slate-400">ค้นหา...</span>}
                                    {showVillageDropdown && villages.length > 0 && (
                                        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-[#c9dcee] bg-white shadow-xl">
                                            {villages.map((village, index) => (
                                                <button
                                                    key={`${village.name}-${index}`}
                                                    type="button"
                                                    onClick={() => selectVillage(village)}
                                                    className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-[#edf5fc]"
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

                        <div className="rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5">
                            <StepTitle number={5} hint="ไม่บังคับ">รูปประกอบ</StepTitle>
                            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-[#c9dcee] px-4 py-3 text-slate-700 hover:bg-[#edf5fc]">
                                <Camera className="h-6 w-6 shrink-0 text-[#0b4c86]" aria-hidden="true" />
                                <span className="text-sm"><span className="font-bold">แนบรูปภาพสถานการณ์</span><span className="block text-slate-500">เช่น สภาพบ้าน/ระดับน้ำ หรือสมุดยา/ซองยา ช่วยให้เจ้าหน้าที่เตรียมยาได้ถูกต้อง</span></span>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handlePhotoChange}
                                    className="sr-only"
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
                                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50"
                                        >
                                            <X className="h-4 w-4" aria-hidden="true" /> เอารูปออก
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <aside className="space-y-4">
                        <section className="rounded-2xl border border-[#c9dcee] bg-white p-4 md:p-5">
                            <StepTitle number={6} hint="แตะแผนที่หรือใช้ GPS">ตำแหน่งที่ต้องการความช่วยเหลือ</StepTitle>
                            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm text-slate-600">ปักหมุดที่บ้านของผู้ต้องการความช่วยเหลือ{onBehalf ? " (ไม่ใช่ตำแหน่งของท่าน ถ้าท่านอยู่ที่อื่น ให้แตะแผนที่เลือกเอง)" : ""}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={requestGpsLocation}
                                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#0b4c86] px-3 py-2 text-sm font-bold text-white hover:bg-[#083865]"
                                >
                                    <LocateFixed className="h-4 w-4" aria-hidden="true" /> ใช้ตำแหน่งปัจจุบัน
                                </button>
                            </div>

                            {gpsStatus === "requesting" && <p className="mb-2 text-sm font-semibold text-slate-500">กำลังขอตำแหน่ง...</p>}
                            {gpsError && <p className="mb-2 rounded-lg bg-amber-50 p-2 text-sm font-semibold text-amber-700">{gpsError}</p>}

                            <div className="h-64 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 md:h-72">
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
                                <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#edf5fc] px-3 py-2 text-sm font-semibold text-[#083865]">
                                    <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" /> ปักหมุดแล้ว · {markerPosition.lat.toFixed(6)}, {markerPosition.lng.toFixed(6)}
                                </p>
                            )}
                        </section>

                        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
                            <h3 className="font-black">เบอร์ฉุกเฉิน</h3>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                <EmergencyCall number="1669" label="แพทย์ฉุกเฉิน" />
                                <EmergencyCall number="1784" label="ปภ." />
                                <EmergencyCall number="191" label="ตำรวจ" />
                                <EmergencyCall number="199" label="ดับเพลิง" />
                            </div>
                        </section>

                        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#c9dcee] bg-white p-4 text-sm leading-6 text-slate-700">
                            <input
                                type="checkbox"
                                checked={consentGiven}
                                onChange={(event) => setConsentGiven(event.target.checked)}
                                className="mt-1 h-5 w-5 shrink-0 accent-[#0b4c86]"
                                required
                            />
                            <span>
                                <span className="mb-1 flex items-center gap-1.5 font-bold text-slate-900"><ShieldCheck className="h-4 w-4 text-[#0b4c86]" aria-hidden="true" /> การใช้ข้อมูลส่วนบุคคล</span>
                                ยินยอมให้เจ้าหน้าที่ใช้ชื่อ เบอร์โทรศัพท์ ตำแหน่ง ข้อมูลสุขภาพ และรูปภาพที่แจ้ง เพื่อติดต่อกลับ ประสานความช่วยเหลือ (รวมถึงส่งต่อให้ ปภ. จังหวัดสตูล และหน่วยที่เข้าพื้นที่) และให้ท่านติดตามสถานะเรื่องได้เท่านั้น
                                {onBehalf ? " ท่านยืนยันว่าได้รับความยินยอมจากผู้ต้องการความช่วยเหลือ หรือผู้นั้นไม่สามารถให้ความยินยอมได้ในขณะนี้" : ""}
                                (<Link href="/privacy-policy" target="_blank" className="font-bold text-[#0b4c86] underline">อ่านนโยบายความเป็นส่วนตัว</Link>)
                            </span>
                        </label>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full rounded-xl bg-red-600 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                        >
                            {isSubmitting ? "กำลังส่งคำขอ..." : "ส่งคำขอความช่วยเหลือ"}
                        </button>
                    </aside>
                </form>
            </div>

        </div>
        </PublicLayout>
    );
}

function ChoiceGroup({ label, value, onChange, options, columns = "grid-cols-2", required = false }) {
    return (
        <fieldset className="mb-4 last:mb-0">
            <legend className="mb-2 block text-sm font-bold text-slate-700">{label} {required && <span className="text-red-500">*</span>}</legend>
            <div className={`grid gap-2 ${columns}`}>
                {options.map((option) => {
                    const selected = value === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onChange(selected && !required ? "" : option.value)}
                            className={`min-h-12 rounded-xl border px-3 py-2 text-left text-sm transition ${selected ? "border-[#0b4c86] bg-[#edf5fc] font-bold text-[#083865] shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-[#c9dcee] hover:bg-[#f7fbff]"}`}
                        >
                            {option.label}
                            {option.range ? <span className="block text-xs font-normal text-slate-500">{option.range}</span> : null}
                        </button>
                    );
                })}
            </div>
        </fieldset>
    );
}

// ระดับน้ำที่บ้าน: ใช้ภาพคนยืนในน้ำแบบเดียวกับฟอร์มรายงานระดับน้ำ (เลือกซ้ำ = ยกเลิก เพราะไม่บังคับ)
function WaterLevelPicker({ value, onChange }) {
    const pick = (next) => onChange(value === next ? "" : next);
    const none = value === "none";
    return (
        <fieldset>
            <legend className="mb-2 block text-sm font-bold text-slate-700">ระดับน้ำที่บ้าน <span className="font-normal text-slate-500">เทียบกับผู้ใหญ่ที่ยืนในน้ำ</span></legend>
            <div className="grid grid-cols-3 gap-2 sm:gap-3" role="radiogroup" aria-label="ระดับน้ำที่บ้าน">
                {WATER_LEVELS.map((item) => {
                    const active = value === item.value;
                    return (
                        <button
                            key={item.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => pick(item.value)}
                            className={`relative flex flex-col items-center rounded-2xl border bg-white px-1.5 pb-2.5 pt-3 text-center transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b4c86] ${active ? "border-transparent" : "border-slate-200 hover:border-[#c9dcee] hover:bg-[#f7fbff]"}`}
                            style={active ? { boxShadow: `0 0 0 2.5px ${item.color}`, backgroundColor: `${item.color}12` } : undefined}
                        >
                            {active ? (
                                <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full text-white" style={{ backgroundColor: item.color }}>
                                    <CircleCheck className="h-4 w-4" aria-hidden="true" />
                                </span>
                            ) : null}
                            <WaterLevelFigure id={`home-${item.value}`} fill={item.fill} color={item.color} className="h-14 w-14 sm:h-16 sm:w-16" />
                            <span className="mt-1.5 text-[13px] font-bold leading-tight text-slate-900 sm:text-sm">{item.label}</span>
                            <span className="mt-0.5 text-xs text-slate-500">{item.range}</span>
                        </button>
                    );
                })}
            </div>
            <button
                type="button"
                role="radio"
                aria-checked={none}
                onClick={() => pick("none")}
                className={`mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-bold transition ${none ? "border-transparent bg-emerald-50 text-emerald-800 shadow-[0_0_0_2.5px_#16a34a]" : "border-slate-200 bg-white text-slate-700 hover:border-[#c9dcee] hover:bg-[#f7fbff]"}`}
            >
                <House className="h-5 w-5" aria-hidden="true" /> ไม่มีน้ำท่วมที่บ้าน
                {none ? <CircleCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : null}
            </button>
        </fieldset>
    );
}

const MOBILITY_ICONS = { self: Footprints, assisted: Accessibility, trapped: DoorClosed };
const ACCESS_ICONS = { car: Car, high_vehicle: Truck, boat: Ship, unknown: CircleHelp };
// สีไอคอนบอกความยากง่าย (เขียว → ส้ม → แดง) ให้อ่านได้จากภาพ
const ICON_TONES = {
    self: "#16a34a", assisted: "#ea8a1a", trapped: "#dc2626",
    car: "#16a34a", high_vehicle: "#ea8a1a", boat: "#dc2626", unknown: "#64748b"
};

function IconChoiceGroup({ label, value, onChange, options, icons, columns }) {
    return (
        <fieldset>
            <legend className="mb-2 block text-sm font-bold text-slate-700">{label}</legend>
            <div className={`grid gap-2 sm:gap-3 ${columns}`} role="radiogroup" aria-label={label}>
                {options.map((option) => {
                    const Icon = icons[option.value];
                    const color = ICON_TONES[option.value] || "#0b4c86";
                    const active = value === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => onChange(active ? "" : option.value)}
                            className={`relative flex flex-col items-center rounded-2xl border bg-white px-1.5 pb-2.5 pt-3 text-center transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b4c86] ${active ? "border-transparent" : "border-slate-200 hover:border-[#c9dcee] hover:bg-[#f7fbff]"}`}
                            style={active ? { boxShadow: `0 0 0 2.5px ${color}`, backgroundColor: `${color}12` } : undefined}
                        >
                            {active ? (
                                <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full text-white" style={{ backgroundColor: color }}>
                                    <CircleCheck className="h-4 w-4" aria-hidden="true" />
                                </span>
                            ) : null}
                            <span className="grid h-12 w-12 place-items-center rounded-full" style={{ backgroundColor: `${color}1a`, color }}>
                                {Icon ? <Icon className="h-6 w-6" strokeWidth={2.2} aria-hidden="true" /> : null}
                            </span>
                            <span className="mt-1.5 text-[13px] font-bold leading-tight text-slate-900 sm:text-sm">{option.short || option.label}</span>
                            {option.hint ? <span className="mt-0.5 text-xs text-slate-500">{option.hint}</span> : null}
                        </button>
                    );
                })}
            </div>
        </fieldset>
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
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-700 outline-none focus:border-[#0b4c86] focus:ring-2 focus:ring-[#c9dcee]"
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
