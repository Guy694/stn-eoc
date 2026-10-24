"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, CheckCircle2, UserRound } from "lucide-react";
import FacilitySelect from "@/components/common/FacilitySelect";
import { TEAM_ROLE_OPTIONS } from "@/lib/eocRoles";
import { PASSWORD_POLICY_TEXT } from "@/lib/passwordPolicy";

const TITLES = ["นาย", "นาง", "นางสาว", "ดร.", "ผศ.ดร.", "รศ.ดร.", "ศ.ดร."];

const initialForm = {
    user_type: "officer",
    title: "",
    given_name: "",
    family_name: "",
    agency: "",
    username: "",
    password: "",
    requested_role: "staff",
    email: "",
    phone: ""
};

const agencyName = (facility) => facility.name;
const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-800 outline-none focus:border-[#0b4c86] focus:ring-4 focus:ring-blue-100";

// ขั้นตอนหลังกดลงทะเบียน (เป็นลำดับจริง จึงใส่เลขกำกับ)
const STEPS = {
    officer: [
        ["กรอกข้อมูลและตั้งชื่อผู้ใช้", "เลือกหน่วยงานและกลุ่มภารกิจที่ขอสิทธิ์"],
        ["ยืนยันตัวตนด้วย ThaiD", "ชื่อ-นามสกุลต้องตรงกับบัตรประชาชน"],
        ["รอผู้ดูแลระบบอนุมัติ", "ผู้ดูแลตรวจหน่วยงานและสิทธิ์ที่ขอ"],
        ["เข้าใช้งาน", "ด้วยชื่อผู้ใช้/รหัสผ่าน หรือ ThaiD · เชื่อม Provider ID ได้ที่หน้าโปรไฟล์"]
    ],
    citizen: [
        ["กรอกชื่อ-นามสกุลและหน่วยงาน", "ใช้ข้อมูลตามบัตรประชาชน"],
        ["ยืนยันตัวตนด้วย ThaiD", "ประชาชนเข้าใช้งานด้วย ThaiD เท่านั้น ไม่มีรหัสผ่าน"]
    ]
};

function Steps({ type, light = false }) {
    return (
        <ol className="space-y-3">
            {STEPS[type].map(([title, detail], index) => (
                <li key={title} className="flex gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${light ? "bg-white/15 text-white" : "bg-[#e8f0f8] text-[#0b4c86]"}`}>{index + 1}</span>
                    <span className="leading-tight">
                        <span className={`block font-bold ${light ? "text-white" : "text-slate-900"}`}>{title}</span>
                        <span className={`mt-0.5 block text-sm ${light ? "text-blue-100" : "text-slate-500"}`}>{detail}</span>
                    </span>
                </li>
            ))}
        </ol>
    );
}

export default function RegisterPage() {
    const [formData, setFormData] = useState(initialForm);
    const [agencies, setAgencies] = useState([]);
    const [loadingAgencies, setLoadingAgencies] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(null);

    const isOfficer = formData.user_type === "officer";

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const response = await fetch("/stn-eoc/api/auth/register/");
                const data = await response.json();
                if (cancelled) return;
                if (data.success) setAgencies(data.agency_facilities || (data.agencies || []).map((name) => ({ name })));
                else setError(data.message || "ไม่สามารถโหลดรายชื่อหน่วยงานได้");
            } catch (loadError) {
                console.error("Load agencies error:", loadError);
                if (!cancelled) setError("ไม่สามารถโหลดรายชื่อหน่วยงานได้ ลองรีเฟรชหน้าอีกครั้ง");
            } finally {
                if (!cancelled) setLoadingAgencies(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const updateField = (key, value) => {
        setFormData((prev) => ({
            ...prev,
            [key]: value,
            ...(key === "user_type" && value === "citizen" ? { username: "", password: "", requested_role: "staff" } : {})
        }));
        setError("");
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError("");
        try {
            const response = await fetch("/stn-eoc/api/auth/register/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (!data.success) {
                setError(data.message || "ลงทะเบียนไม่สำเร็จ");
                return;
            }
            setSuccess({ ...data, type: formData.user_type });
        } catch (submitError) {
            console.error("Register error:", submitError);
            setError("เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#edf5fc] text-slate-900 lg:p-6">
            <header className="flex items-center justify-between gap-3 bg-[#083865] px-4 py-3 text-white lg:hidden">
                <Link href="/" className="flex min-w-0 items-center gap-2 text-sm font-bold">
                    <Image src="/stn-eoc/img/logo.png" alt="" width={32} height={32} className="h-8 w-8 rounded-full bg-white p-0.5" />
                    <span className="truncate">Satun Geo-EOC</span>
                </Link>
                <Link href="/login" className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-blue-50 hover:bg-white/10">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />เข้าสู่ระบบ
                </Link>
            </header>

            <div className="mx-auto grid w-full max-w-6xl bg-white lg:min-h-[calc(100vh-3rem)] lg:grid-cols-[0.85fr_1.15fr] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-blue-100 lg:shadow-2xl">
                <section className="relative hidden flex-col justify-between overflow-hidden bg-[#083865] p-10 text-white lg:flex">
                    <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #ffffff 0, transparent 26%), radial-gradient(circle at 80% 10%, #7dd3fc 0, transparent 28%), radial-gradient(circle at 40% 90%, #bae6fd 0, transparent 24%)" }} />
                    <Link href="/" className="relative inline-flex w-fit items-center gap-3 rounded-full bg-white/10 px-3 py-2 text-sm font-bold text-blue-50 hover:bg-white/15">
                        <Image src="/stn-eoc/img/logo.png" alt="EOC Logo" width={40} height={40} className="h-10 w-10 rounded-full bg-white p-1" />
                        Satun Geo-EOC
                    </Link>

                    <div className="relative my-10 max-w-md">
                        <p className="text-4xl font-black leading-tight">ลงทะเบียนเข้าใช้งานระบบ</p>
                        <p className="mt-4 text-base leading-7 text-blue-50">
                            ศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข จังหวัดสตูล ทุกบัญชีต้องยืนยันตัวตนด้วย ThaiD เพื่อป้องกันการใช้ข้อมูลของผู้อื่น
                        </p>
                    </div>

                    <div className="relative rounded-2xl border border-white/15 bg-white/10 p-5">
                        <p className="mb-4 text-sm font-bold text-blue-100">{isOfficer ? "ขั้นตอนสำหรับเจ้าหน้าที่" : "ขั้นตอนสำหรับประชาชน"}</p>
                        <Steps type={formData.user_type} light />
                    </div>
                </section>

                <section className="px-5 py-6 sm:px-8 lg:p-10">
                    <div className="mx-auto max-w-2xl">
                        {success ? (
                            <div className="py-6">
                                <CheckCircle2 className="h-12 w-12 text-emerald-600" aria-hidden="true" />
                                <h1 className="mt-4 text-2xl font-black text-slate-950 lg:text-3xl">บันทึกข้อมูลแล้ว อีกขั้นเดียว</h1>
                                <p className="mt-2 leading-7 text-slate-600">{success.message}</p>
                                {success.thaiid_url ? (
                                    <a href={success.thaiid_url} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0b4c86] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/15 hover:bg-[#083865]">
                                        <Image src="/stn-eoc/img/thaiid.png" alt="" width={28} height={28} className="h-7 w-7 rounded-md" />
                                        ยืนยันตัวตนด้วย ThaiD
                                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                    </a>
                                ) : null}
                                <div className="mt-8 rounded-2xl border border-slate-200 p-5">
                                    <p className="mb-4 text-sm font-bold text-slate-700">ขั้นตอนถัดไป</p>
                                    <Steps type={success.type} />
                                </div>
                                <p className="mt-6 text-sm text-slate-500">
                                    ยืนยันแล้ว <Link href="/login" className="font-black text-[#0b4c86] hover:text-[#083865]">ไปหน้าเข้าสู่ระบบ</Link>
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="mb-6">
                                    <h1 className="text-2xl font-black text-slate-950 lg:text-3xl">สร้างบัญชีผู้ใช้งาน</h1>
                                    <p className="mt-1.5 text-sm leading-6 text-slate-500">
                                        กรอกข้อมูลตามบัตรประชาชน แล้วยืนยันตัวตนด้วย ThaiD ในขั้นถัดไป
                                    </p>
                                </div>

                                {error ? (
                                    <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                                            <div className="whitespace-pre-line">{error}</div>
                                        </div>
                                    </div>
                                ) : null}

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <fieldset>
                                        <legend className="mb-2 text-sm font-bold text-slate-700">ลงทะเบียนในฐานะ</legend>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {[
                                                { value: "officer", icon: Building2, title: "เจ้าหน้าที่", detail: "บุคลากรสาธารณสุขที่ปฏิบัติงานใน EOC · รอผู้ดูแลอนุมัติสิทธิ์" },
                                                { value: "citizen", icon: UserRound, title: "ประชาชน", detail: "ติดตามคำขอและข้อมูลของตนเอง · เข้าด้วย ThaiD เท่านั้น" }
                                            ].map((option) => {
                                                const active = formData.user_type === option.value;
                                                const Icon = option.icon;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        aria-pressed={active}
                                                        onClick={() => updateField("user_type", option.value)}
                                                        className={`rounded-xl border px-4 py-3.5 text-left transition ${active ? "border-[#0b4c86] bg-[#eef5fc] ring-4 ring-blue-100" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                                                    >
                                                        <span className="flex items-center gap-2 font-black text-slate-900"><Icon className={`h-5 w-5 ${active ? "text-[#0b4c86]" : "text-slate-400"}`} aria-hidden="true" />{option.title}</span>
                                                        <span className="mt-1 block text-xs leading-5 text-slate-500">{option.detail}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </fieldset>

                                    <div className="grid gap-4 sm:grid-cols-[0.7fr_1fr_1fr]">
                                        <label className="block">
                                            <span className="mb-1.5 block text-sm font-bold text-slate-700">คำนำหน้า</span>
                                            <select value={formData.title} onChange={(event) => updateField("title", event.target.value)} className={field}>
                                                <option value="">ไม่ระบุ</option>
                                                {TITLES.map((title) => <option key={title} value={title}>{title}</option>)}
                                            </select>
                                        </label>
                                        <label className="block">
                                            <span className="mb-1.5 block text-sm font-bold text-slate-700">ชื่อ <span className="text-red-600">*</span></span>
                                            <input type="text" value={formData.given_name} onChange={(event) => updateField("given_name", event.target.value)} className={field} autoComplete="given-name" required />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1.5 block text-sm font-bold text-slate-700">นามสกุล <span className="text-red-600">*</span></span>
                                            <input type="text" value={formData.family_name} onChange={(event) => updateField("family_name", event.target.value)} className={field} autoComplete="family-name" required />
                                        </label>
                                    </div>
                                    <p className="-mt-3 text-xs text-slate-500">ชื่อ-นามสกุลต้องตรงกับใน ThaiD ไม่งั้นยืนยันตัวตนไม่ผ่าน</p>

                                    <div>
                                        <span className="mb-1.5 block text-sm font-bold text-slate-700">หน่วยงาน <span className="text-red-600">*</span></span>
                                        <FacilitySelect
                                            facilities={agencies}
                                            value={formData.agency}
                                            onChange={(value) => updateField("agency", value)}
                                            getValue={agencyName}
                                            label="หน่วยงาน"
                                            placeholder={loadingAgencies ? "กำลังโหลดหน่วยงาน…" : "เลือกหน่วยงาน"}
                                            selectClassName={field}
                                            required
                                            disabled={loadingAgencies}
                                        />
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <label className="block">
                                            <span className="mb-1.5 block text-sm font-bold text-slate-700">เบอร์โทรศัพท์</span>
                                            <input type="tel" inputMode="tel" value={formData.phone} onChange={(event) => updateField("phone", event.target.value)} className={field} autoComplete="tel" placeholder="08x-xxx-xxxx" />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1.5 block text-sm font-bold text-slate-700">อีเมล</span>
                                            <input type="email" value={formData.email} onChange={(event) => updateField("email", event.target.value)} className={field} autoComplete="email" />
                                        </label>
                                    </div>

                                    {isOfficer ? (
                                        <fieldset className="rounded-2xl border border-blue-100 bg-[#f5f9fd] p-4 sm:p-5">
                                            <legend className="px-1 text-sm font-black text-[#083865]">บัญชีเข้าใช้งานของเจ้าหน้าที่</legend>
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <label className="block">
                                                    <span className="mb-1.5 block text-sm font-bold text-slate-700">ชื่อผู้ใช้ <span className="text-red-600">*</span></span>
                                                    <input type="text" value={formData.username} onChange={(event) => updateField("username", event.target.value.trim())} className={field} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
                                                    <span className="mt-1 block text-xs text-slate-500">a-z, 0-9, จุด, ขีด ยาว 4–50 ตัว</span>
                                                </label>
                                                <label className="block">
                                                    <span className="mb-1.5 block text-sm font-bold text-slate-700">รหัสผ่าน <span className="text-red-600">*</span></span>
                                                    <input type="password" value={formData.password} onChange={(event) => updateField("password", event.target.value)} className={field} autoComplete="new-password" required />
                                                    <span className="mt-1 block text-xs text-slate-500">{PASSWORD_POLICY_TEXT}</span>
                                                </label>
                                            </div>
                                            <label className="mt-4 block">
                                                <span className="mb-1.5 block text-sm font-bold text-slate-700">สิทธิ์ที่ขอ</span>
                                                <select value={formData.requested_role} onChange={(event) => updateField("requested_role", event.target.value)} className={field}>
                                                    <optgroup label="สิทธิ์ทั่วไป">
                                                        <option value="staff">เจ้าหน้าที่ทั่วไป</option>
                                                        <option value="commander">ผู้บัญชาการเหตุการณ์</option>
                                                    </optgroup>
                                                    <optgroup label="กลุ่มภารกิจ">
                                                        {TEAM_ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                                                    </optgroup>
                                                </select>
                                                <span className="mt-1 block text-xs text-slate-500">ผู้ดูแลระบบปรับสิทธิ์และมอบหมายกลุ่มภารกิจในเหตุการณ์ได้ตอนอนุมัติ</span>
                                            </label>
                                        </fieldset>
                                    ) : null}

                                    <button
                                        type="submit"
                                        disabled={submitting || loadingAgencies}
                                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b4c86] px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#083865] disabled:cursor-not-allowed disabled:bg-slate-300"
                                    >
                                        {submitting ? "กำลังบันทึก…" : "ลงทะเบียน แล้วยืนยันตัวตนด้วย ThaiD"}
                                        {!submitting ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
                                    </button>
                                </form>

                                <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 lg:hidden">
                                    <p className="mb-3 font-bold text-slate-700">{isOfficer ? "ขั้นตอนสำหรับเจ้าหน้าที่" : "ขั้นตอนสำหรับประชาชน"}</p>
                                    <Steps type={formData.user_type} />
                                </div>

                                <p className="mt-6 text-center text-sm text-slate-500">
                                    มีบัญชีแล้ว <Link href="/login" className="font-black text-[#0b4c86] hover:text-[#083865]">เข้าสู่ระบบ</Link>
                                </p>
                            </>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}
