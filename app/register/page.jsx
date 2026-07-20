"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, IdCard, Lock, UserRound } from "lucide-react";

const initialForm = {
    user_type: 'citizen',
    title: '',
    given_name: '',
    family_name: '',
    agency: '',
    username: '',
    password: '',
    requested_role: 'staff',
    email: '',
    phone: ''
};

export default function RegisterPage() {
    const [formData, setFormData] = useState(initialForm);
    const [agencies, setAgencies] = useState([]);
    const [loadingAgencies, setLoadingAgencies] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);

    const isOfficer = formData.user_type === 'officer';

    useEffect(() => {
        let cancelled = false;

        async function loadAgencies() {
            try {
                const response = await fetch('/stn-eoc/api/auth/register/');
                const data = await response.json();

                if (!cancelled) {
                    if (data.success) {
                        setAgencies(data.agencies || []);
                    } else {
                        setError(data.message || 'ไม่สามารถโหลดหน่วยงานได้');
                    }
                }
            } catch (loadError) {
                console.error('Load agencies error:', loadError);
                if (!cancelled) setError('ไม่สามารถโหลดหน่วยงานได้');
            } finally {
                if (!cancelled) setLoadingAgencies(false);
            }
        }

        loadAgencies();
        return () => {
            cancelled = true;
        };
    }, []);

    const filteredAgencies = useMemo(() => agencies, [agencies]);

    const updateField = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
            ...(field === 'user_type' && value === 'citizen' ? { username: '', password: '', requested_role: 'staff' } : {})
        }));
        setError('');
        setSuccess(null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        setSuccess(null);

        try {
            const response = await fetch('/stn-eoc/api/auth/register/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();

            if (!data.success) {
                setError(data.message || 'ลงทะเบียนไม่สำเร็จ');
                return;
            }

            setSuccess(data);
        } catch (submitError) {
            console.error('Register error:', submitError);
            setError('เกิดข้อผิดพลาดในการลงทะเบียน');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#eef6f8] p-4 text-slate-900 sm:p-6">
            <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-2xl lg:grid-cols-[0.9fr_1.1fr]">
                <section className="relative flex flex-col justify-between overflow-hidden bg-[#0f5f6d] p-6 text-white sm:p-8 lg:p-10">
                    <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #ffffff 0, transparent 28%), radial-gradient(circle at 85% 15%, #67e8f9 0, transparent 24%), radial-gradient(circle at 35% 90%, #ccfbf1 0, transparent 26%)" }} />

                    <Link href="/" className="relative inline-flex w-fit items-center gap-3 rounded-full bg-white/10 px-3 py-2 text-sm font-bold text-cyan-50 hover:bg-white/15">
                        <Image src="/stn-eoc/img/logo.png" alt="EOC Logo" width={40} height={40} className="h-10 w-10 rounded-full bg-white p-1" />
                        Satun Geo-EOC
                    </Link>

                    <div className="relative my-10 max-w-lg">
                        <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-cyan-100">Account Registration</p>
                        <h1 className="text-4xl font-black leading-tight sm:text-5xl">ลงทะเบียนเข้าใช้งานระบบ</h1>
                        <p className="mt-4 text-base leading-7 text-cyan-50">
                            เลือกประเภทผู้ใช้งาน กรอกข้อมูลตามจริง และยืนยันตัวตนผ่าน ThaiD เพื่อป้องกันการลงทะเบียนด้วยข้อมูลไม่ถูกต้อง
                        </p>
                    </div>

               
                </section>

                <section className="p-5 sm:p-8 lg:p-10">
                    <div className="mx-auto max-w-2xl">
                        <div className="mb-7">
                            <h2 className="text-3xl font-black text-slate-950">สร้างบัญชีผู้ใช้งาน</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                                ประชาชนเข้าใช้งานด้วย ThaiD เท่านั้น ส่วนเจ้าหน้าที่สามารถตั้ง username/password และยืนยัน ThaiD เพิ่มเติมได้
                            </p>
                        </div>

                        {error && (
                            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                                    <div className="whitespace-pre-line">{error}</div>
                                </div>
                            </div>
                        )}

                        {success && (
                            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                                    <div className="flex-1">
                                        <div className="font-black">{success.message}</div>
                                        {success.thaiid_url && (
                                            <a
                                                href={success.thaiid_url}
                                                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800"
                                            >
                                                ยืนยันตัวตนด้วย ThaiD
                                                <ArrowRight className="h-4 w-4" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => updateField('user_type', 'citizen')}
                                    className={`rounded-xl border px-4 py-4 text-left transition ${!isOfficer ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-4 ring-emerald-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                                >
                                    <UserRound className="mb-2 h-5 w-5" />
                                    <div className="font-black">ประชาชน</div>
                                    <div className="mt-1 text-xs text-slate-500">ไม่มี username/password ใช้ ThaiD เท่านั้น</div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateField('user_type', 'officer')}
                                    className={`rounded-xl border px-4 py-4 text-left transition ${isOfficer ? 'border-blue-500 bg-blue-50 text-blue-900 ring-4 ring-blue-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                                >
                                    <Building2 className="mb-2 h-5 w-5" />
                                    <div className="font-black">เจ้าหน้าที่</div>
                                    <div className="mt-1 text-xs text-slate-500">ตั้ง username/password และรออนุมัติสิทธิ์</div>
                                </button>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-[0.7fr_1fr_1fr]">
                                <label className="block">
                                    <span className="mb-2 block text-sm font-bold text-slate-700">คำนำหน้า</span>
                                    <select
                                        value={formData.title}
                                        onChange={(event) => updateField('title', event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-800 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                    >
                                        <option value="">ไม่ระบุ</option>
                                        <option value="นาย">นาย</option>
                                        <option value="นาง">นาง</option>
                                        <option value="นางสาว">นางสาว</option>
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="mb-2 block text-sm font-bold text-slate-700">ชื่อ</span>
                                    <input
                                        type="text"
                                        value={formData.given_name}
                                        onChange={(event) => updateField('given_name', event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-800 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                        required
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-2 block text-sm font-bold text-slate-700">นามสกุล</span>
                                    <input
                                        type="text"
                                        value={formData.family_name}
                                        onChange={(event) => updateField('family_name', event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-800 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                        required
                                    />
                                </label>
                            </div>

                            <label className="block">
                                <span className="mb-2 block text-sm font-bold text-slate-700">หน่วยงาน</span>
                                <select
                                    value={formData.agency}
                                    onChange={(event) => updateField('agency', event.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-800 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                    required
                                    disabled={loadingAgencies}
                                >
                                    <option value="">{loadingAgencies ? 'กำลังโหลดหน่วยงาน...' : 'เลือกหน่วยงาน'}</option>
                                    {filteredAgencies.map((agency) => (
                                        <option key={agency} value={agency}>{agency}</option>
                                    ))}
                                </select>
                            </label>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="block">
                                    <span className="mb-2 block text-sm font-bold text-slate-700">เบอร์โทรศัพท์</span>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(event) => updateField('phone', event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-800 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-2 block text-sm font-bold text-slate-700">อีเมล</span>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(event) => updateField('email', event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-800 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                    />
                                </label>
                            </div>

                            {isOfficer && (
                                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                                    <div className="mb-4 text-sm font-black text-blue-900">ข้อมูลเข้าสู่ระบบเจ้าหน้าที่</div>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <label className="block">
                                            <span className="mb-2 block text-sm font-bold text-slate-700">username</span>
                                            <input
                                                type="text"
                                                value={formData.username}
                                                onChange={(event) => updateField('username', event.target.value)}
                                                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                autoComplete="username"
                                                required={isOfficer}
                                            />
                                        </label>

                                        <label className="block">
                                            <span className="mb-2 block text-sm font-bold text-slate-700">password</span>
                                            <input
                                                type="password"
                                                value={formData.password}
                                                onChange={(event) => updateField('password', event.target.value)}
                                                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                autoComplete="new-password"
                                                required={isOfficer}
                                            />
                                        </label>
                                    </div>

                                    <label className="mt-4 block">
                                        <span className="mb-2 block text-sm font-bold text-slate-700">สิทธิ์ที่ขอ</span>
                                        <select
                                            value={formData.requested_role}
                                            onChange={(event) => updateField('requested_role', event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        >
                                            <option value="staff">เจ้าหน้าที่ทั่วไป</option>
                                            <option value="SeRHT">ทีม SeRHT</option>
                                            <option value="SAT">ทีม SAT</option>
                                            <option value="MCATT">ทีม MCATT</option>
                                            <option value="commander">ผู้บัญชาการเหตุการณ์</option>
                                        </select>
                                    </label>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting || loadingAgencies}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f5f6d] px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-cyan-900/15 transition hover:bg-[#0b4b56] disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                                {submitting ? 'กำลังลงทะเบียน...' : 'ลงทะเบียน'}
                                {!submitting && <ArrowRight className="h-4 w-4" />}
                            </button>
                        </form>

                        <div className="mt-6 text-center text-sm text-slate-500">
                            มีบัญชีแล้ว <Link href="/login" className="font-black text-cyan-800 hover:text-cyan-950">เข้าสู่ระบบ</Link>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
