"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Footer from "@/components/Footer";
import { satunDistricts } from "@/data/satunData";
import { showWarning } from "@/lib/sweetAlert";
import { useAuth } from "@/context/AuthContext";
import AppIcon from "@/components/icons/AppIcon";

const MapSelector = dynamic(() => import("@/components/MapSelector"), {
    ssr: false,
    loading: () => (
        <div className="h-80 bg-gray-100 rounded-xl animate-pulse flex items-center justify-center text-gray-500 text-sm">
            <AppIcon icon="mapPin" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> กำลังโหลดแผนที่...
        </div>
    ),
});

const ACCIDENT_TYPES = ["จักรยานยนต์", "รถยนต์", "รถจักรยาน", "คนเดินเท้า", "อื่นๆ"];
const FESTIVAL_LABEL = { newyear: "เทศกาลปีใหม่", songkran: "เทศกาลสงกรานต์" };

export default function CitizenFestivalReportPage() {
    const { user } = useAuth();
    const [mounted, setMounted] = useState(false);
    const [festivalSession, setFestivalSession] = useState(null);
    const [sessionLoading, setSessionLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [tambonOptions, setTambonOptions] = useState([]);

    const [form, setForm] = useState({
        reporter_name: "",
        reporter_phone: "",
        report_date: new Date().toISOString().split("T")[0],
        report_time: new Date().toTimeString().slice(0, 5),
        accident_type: "จักรยานยนต์",
        location_name: "",
        lat: "",
        lng: "",
        district: "",
        tambon: "",
        deaths: 0,
        injuries: 0,
        drunk_driving: false,
        no_helmet: false,
        no_seatbelt: false,
        speeding: false,
        notes: "",
    });

    // Fetch active festival session
    useEffect(() => {
        setMounted(true);
        const fetchSession = async () => {
            try {
                const res = await fetch("/stn-eoc/api/eoc/festival-accidents/dashboard");
                const data = await res.json();
                if (data.success && data.hasActiveSession) {
                    setFestivalSession(data.activeSession);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setSessionLoading(false);
            }
        };
        fetchSession();

        // Auto-fill time
        const now = new Date();
        setForm(prev => ({
            ...prev,
            report_date: now.toISOString().split("T")[0],
            report_time: now.toTimeString().slice(0, 5),
        }));
    }, []);

    // Auto-fill name from logged-in user
    useEffect(() => {
        if (user && (user.role === "citizen" || user.givenName)) {
            setForm(prev => ({
                ...prev,
                reporter_name: `${user.givenName || ""} ${user.familyName || ""}`.trim(),
            }));
        }
    }, [user]);

    // Tambon options from district
    useEffect(() => {
        if (form.district) {
            const dist = satunDistricts.find(d => d.name === form.district);
            setTambonOptions(dist?.tambons || []);
        } else {
            setTambonOptions([]);
        }
    }, [form.district]);

    const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.reporter_name.trim()) {
            showWarning("กรุณากรอกชื่อผู้แจ้ง");
            return;
        }
        if (!form.reporter_phone.trim()) {
            showWarning("กรุณากรอกเบอร์โทรศัพท์");
            return;
        }
        if (!form.lat || !form.lng) {
            showWarning("กรุณาปักหมุดตำแหน่งที่เกิดเหตุบนแผนที่");
            return;
        }
        if (!festivalSession) {
            showWarning("ไม่มี EOC Session ที่เปิดอยู่ ไม่สามารถส่งรายงานได้");
            return;
        }

        setSubmitting(true);
        setSubmitError("");

        try {
            const res = await fetch("/stn-eoc/api/public/accident-reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    session_id: festivalSession.id,
                    reported_by_citizen: true,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSubmitted(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                setSubmitError(data.message || "เกิดข้อผิดพลาด");
            }
        } catch (err) {
            setSubmitError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        } finally {
            setSubmitting(false);
        }
    };

    const ft = festivalSession?.festival_type;
    const festivalLabel = FESTIVAL_LABEL[ft] || "อุบัติเหตุช่วงเทศกาล";
    const themeColor = ft === "newyear" ? "blue" : "orange";
    const colors = {
        blue: { header: "from-blue-600 to-blue-700", btn: "bg-blue-600 hover:bg-blue-700", border: "border-blue-500", bg: "bg-blue-50", text: "text-blue-800" },
        orange: { header: "from-orange-500 to-orange-600", btn: "bg-orange-500 hover:bg-orange-600", border: "border-orange-500", bg: "bg-orange-50", text: "text-orange-800" },
    };
    const c = colors[themeColor];

    return (
        <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-red-50">
            {/* Header */}
            <header className={`bg-gradient-to-r ${c.header} text-white py-4 md:py-6 shadow-lg`}>
                <div className="container mx-auto px-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-2xl"><AppIcon icon="car" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold">แจ้งเหตุอุบัติเหตุ</h1>
                            <p className="text-xs opacity-80">{festivalLabel}</p>
                        </div>
                    </div>
                    <Link href="/stn-eoc" className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
                        ← กลับหน้าหลัก
                    </Link>
                </div>
            </header>

            <main className="container mx-auto max-w-2xl flex-1 px-4 py-6">
                {/* Loading session */}
                {sessionLoading && (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin h-10 w-10 border-4 border-red-500 border-t-transparent rounded-full"></div>
                    </div>
                )}

                {/* No active session */}
                {!sessionLoading && !festivalSession && (
                    <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-8 text-center">
                        <div className="text-6xl mb-4"><AppIcon icon="file" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">ยังไม่มี EOC เทศกาลเปิดอยู่</h2>
                        <p className="text-gray-600 mb-4">ไม่สามารถส่งรายงานได้ในขณะนี้ เนื่องจากยังไม่มีการเปิดศูนย์ EOC สำหรับช่วงเทศกาล</p>
                        <Link href="/stn-eoc" className="text-blue-600 hover:underline font-medium">← กลับหน้าหลัก</Link>
                    </div>
                )}

                {/* Success */}
                {submitted && (
                    <div className="bg-green-50 border-2 border-green-400 rounded-2xl p-8 text-center">
                        <div className="text-6xl mb-4"><AppIcon icon="checkCircle" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                        <h2 className="text-2xl font-bold text-green-800 mb-2">ส่งรายงานสำเร็จ!</h2>
                        <p className="text-green-700 mb-6">ขอบคุณที่แจ้งข้อมูล เจ้าหน้าที่จะดำเนินการโดยเร็วที่สุด</p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={() => { setSubmitted(false); setForm(prev => ({ ...prev, lat: "", lng: "", notes: "", deaths: 0, injuries: 0, drunk_driving: false, no_helmet: false, no_seatbelt: false, speeding: false, accident_type: "จักรยานยนต์" })); }}
                                className={`${c.btn} text-white px-6 py-3 rounded-xl font-semibold transition`}
                            >
                                + แจ้งเหตุอีกครั้ง
                            </button>
                            <Link href="/stn-eoc" className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold transition">
                                กลับหน้าหลัก
                            </Link>
                        </div>
                    </div>
                )}

                {/* Form */}
                {!sessionLoading && festivalSession && !submitted && (
                    <>
                        {/* Session Badge */}
                        <div className={`${c.bg} border ${c.border} rounded-xl p-3 mb-4 flex items-center gap-2 text-sm`}>
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block"></span>
                            <span className={`font-medium ${c.text}`}><AppIcon icon="statusGreen" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> EOC เปิดอยู่: {festivalLabel} — {festivalSession.open_reason || `Session #${festivalSession.session_number}`}</span>
                        </div>

                        {submitError && (
                            <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 mb-4 text-red-700 flex items-center gap-2">
                                <AppIcon icon="xCircle" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> {submitError}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Reporter Info */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                                <h2 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2"><AppIcon icon="user" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ข้อมูลผู้แจ้ง</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={form.reporter_name}
                                            onChange={e => set("reporter_name", e.target.value)}
                                            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-gray-700"
                                            placeholder="ระบุชื่อ-นามสกุล"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                                        <input
                                            type="tel"
                                            value={form.reporter_phone}
                                            onChange={e => set("reporter_phone", e.target.value)}
                                            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-gray-700"
                                            placeholder="0812345678"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Incident Details */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                                <h2 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2"><AppIcon icon="car" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> รายละเอียดอุบัติเหตุ</h2>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">วันที่</label>
                                        <input
                                            type="date"
                                            value={form.report_date}
                                            onChange={e => set("report_date", e.target.value)}
                                            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-gray-700"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">เวลา</label>
                                        <input
                                            type="time"
                                            value={form.report_time}
                                            onChange={e => set("report_time", e.target.value)}
                                            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-gray-700"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">ประเภทยานพาหนะ</label>
                                        <select
                                            value={form.accident_type}
                                            onChange={e => set("accident_type", e.target.value)}
                                            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-gray-700"
                                        >
                                            {ACCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">สถานที่ / เส้นทาง</label>
                                    <input
                                        type="text"
                                        value={form.location_name}
                                        onChange={e => set("location_name", e.target.value)}
                                        className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-gray-700"
                                        placeholder="เช่น ถนน 406 บริเวณกม.5 หน้าวัดสว่าง"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">อำเภอ</label>
                                        <select
                                            value={form.district}
                                            onChange={e => set("district", e.target.value)}
                                            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-gray-700"
                                        >
                                            <option value="">เลือกอำเภอ</option>
                                            {satunDistricts.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">ตำบล</label>
                                        <select
                                            value={form.tambon}
                                            onChange={e => set("tambon", e.target.value)}
                                            disabled={!form.district}
                                            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-gray-700 disabled:bg-gray-100"
                                        >
                                            <option value="">เลือกตำบล</option>
                                            {tambonOptions.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Map Pin */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                                <h2 className="font-bold text-lg text-gray-800 mb-1 flex items-center gap-2"><AppIcon icon="mapPin" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ตำแหน่งที่เกิดเหตุ <span className="text-red-500">*</span></h2>
                                <p className="text-sm text-gray-500 mb-4">ระบบจะดึง GPS อัตโนมัติ หรือคลิก/ลากหมุดเพื่อเลือกตำแหน่ง</p>
                                {mounted && (
                                    <MapSelector
                                        position={form.lat && form.lng ? { lat: parseFloat(form.lat), lng: parseFloat(form.lng) } : null}
                                        onPositionChange={pos => setForm(prev => ({ ...prev, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) }))}
                                    />
                                )}
                            </div>

                            {/* Casualties */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                                <h2 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2"><AppIcon icon="barChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ผู้ได้รับผลกระทบ</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1"><AppIcon icon="skull" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> จำนวนเสียชีวิต (คน)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={form.deaths}
                                            onChange={e => set("deaths", parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-gray-700"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1"><AppIcon icon="stethoscope" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> จำนวนบาดเจ็บ (คน)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={form.injuries}
                                            onChange={e => set("injuries", parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-gray-700"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Risk Factors */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                                <h2 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2"><AppIcon icon="alert" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> สาเหตุที่เห็นได้ (เลือกที่เกี่ยวข้อง)</h2>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { key: "drunk_driving", label: "เมาแล้วขับ", color: "purple" },
                                        { key: "no_helmet", label: "ไม่สวมหมวกกันน็อค", color: "orange" },
                                        { key: "no_seatbelt", label: "ไม่คาดเข็มขัดนิรภัย", color: "yellow" },
                                        { key: "speeding", label: "ขับรถเร็ว/ประมาท", color: "red" },
                                    ].map(({ key, label, color }) => (
                                        <label
                                            key={key}
                                            className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${form[key] ? `border-${color}-400 bg-${color}-50` : "border-gray-200 hover:border-gray-300"}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={form[key]}
                                                onChange={e => set(key, e.target.checked)}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm font-medium text-gray-700">{label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                                <h2 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2"><AppIcon icon="file" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> รายละเอียดเพิ่มเติม</h2>
                                <textarea
                                    value={form.notes}
                                    onChange={e => set("notes", e.target.value)}
                                    rows="3"
                                    className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-gray-700"
                                    placeholder="อธิบายสถานการณ์เพิ่มเติม เช่น รายละเอียดการเกิดเหตุ สภาพถนน สภาพอากาศ..."
                                />
                            </div>

                            {/* Submit */}
                            <div className="flex gap-3">
                                <Link href="/stn-eoc" className="flex-1 text-center py-3.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold transition">
                                    ยกเลิก
                                </Link>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`flex-1 py-3.5 rounded-xl ${c.btn} text-white font-bold transition disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg`}
                                >
                                    {submitting ? (
                                        <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>กำลังส่ง...</>
                                    ) : (
                                        "ส่งรายงาน"
                                    )}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </main>

            <Footer />
        </div>
    );
}
