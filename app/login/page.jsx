"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ArrowLeft, ArrowRight, Clock, IdCard, Lock, MapPinned, ShieldCheck, UserRound } from "lucide-react";

// Component แยกสำหรับจัดการ error จาก ThaiD callback
function ThaiDErrorHandler({ setError }) {
    const searchParams = useSearchParams();

    useEffect(() => {
        const errorType = searchParams.get('error');
        const errorMessage = searchParams.get('message');
        const pid = searchParams.get('pid');
        const timeout = searchParams.get('timeout');

        // ตรวจสอบ session timeout
        if (timeout === 'true') {
            setError('การเข้าสู่ระบบหมดอายุเนื่องจากไม่มีการใช้งานเกิน 10 นาที\nกรุณาเข้าสู่ระบบใหม่อีกครั้ง');
            return;
        }

        // ข้อผิดพลาดจาก Provider ID (Health ID) ส่งข้อความภาษาไทยมาพร้อมกันแล้ว
        if (errorType && errorType.startsWith('provider_')) {
            setError(errorMessage || 'เข้าสู่ระบบด้วย Provider ID ไม่สำเร็จ');
            return;
        }

        if (errorType) {
            switch (errorType) {
                case 'thaiid_auth_failed':
                    if (errorMessage && decodeURIComponent(errorMessage).includes('unauthorized_client')) {
                        setError('ThaiD ยังไม่อนุญาต client นี้หรือ redirect URI นี้\n\nสาเหตุที่พบบ่อย:\n• client_id ยังไม่ได้รับสิทธิ์จาก DOPA\n• redirect URI ที่ลงทะเบียนไม่ตรงกับที่ระบบส่งไป\n• แอป ThaiD ตัวนี้ยังไม่ได้ผูกกับ environment ปัจจุบัน\n\nสิ่งที่ควรตรวจสอบ:\n• ยืนยันว่า ThaiD console อนุญาต client_id นี้\n• ตรวจว่า redirect URI ตรงกับค่าที่ลงทะเบียนกับ DOPA แบบตัวต่อตัว\n• รีสตาร์ต server หลังแก้ .env');
                        break;
                    }
                    setError(`การยืนยันตัวตนผ่าน ThaiD ล้มเหลว: ${errorMessage || 'ไม่ทราบสาเหตุ'}`);
                    break;
                case 'no_code':
                    setError('ไม่ได้รับ authorization code จาก ThaiD');
                    break;
                case 'no_pid':
                    setError('ไม่สามารถดึงเลขบัตรประชาชนจาก ThaiD ได้');
                    break;
                case 'user_not_found':
                    setError(`${errorMessage ? decodeURIComponent(errorMessage) : `ไม่พบผู้ใช้งานที่มีเลขบัตรประชาชน: ${pid || 'ไม่ระบุ'}`}\nกรุณาลงทะเบียนผู้ใช้งานก่อน หรือใช้ชื่อ-นามสกุลให้ตรงกับข้อมูลใน ThaiD`);
                    break;
                case 'callback_failed':
                    const decodedMessage = errorMessage ? decodeURIComponent(errorMessage) : 'การเข้าสู่ระบบผ่าน ThaiD ล้มเหลว';

                    if (decodedMessage.includes('unauthorized_client')) {
                        setError('ThaiD ยังไม่อนุญาต client นี้หรือ redirect URI นี้\n\nสาเหตุที่พบบ่อย:\n• client_id ยังไม่ได้รับสิทธิ์จาก DOPA\n• redirect URI ที่ลงทะเบียนไม่ตรงกับที่ระบบส่งไป\n• แอป ThaiD ตัวนี้ยังไม่ได้ผูกกับ environment ปัจจุบัน\n\nสิ่งที่ควรตรวจสอบ:\n✓ ยืนยันว่า ThaiD console อนุญาต client_id นี้\n✓ ตรวจว่า redirect URI ตรงกับค่าที่ลงทะเบียนกับ DOPA แบบตัวต่อตัว\n✓ รีสตาร์ต server หลังแก้ .env');
                        break;
                    }

                    // ตรวจสอบว่าเป็น timeout error หรือไม่
                    if (decodedMessage.includes('timeout') || decodedMessage.includes('ETIMEDOUT')) {
                        setError('การเชื่อมต่อ ThaiD หมดเวลา\n\nสาเหตุที่เป็นไปได้:\n• เครือข่ายอินเทอร์เน็ตไม่เสถียร\n• บริการ ThaiD ไม่สามารถเข้าถึงได้ชั่วคราว\n• เซิร์ฟเวอร์ไม่สามารถเชื่อมต่อกับ ThaiD API\n\nคำแนะนำ:\n✓ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต\n✓ ลองใหม่อีกครั้งในอีกสักครู่\n✓ หรือใช้ username/password แทน');
                    } else {
                        setError(`เกิดข้อผิดพลาด: ${decodedMessage}`);
                    }
                    break;
                default:
                    setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบผ่าน ThaiD');
            }
        }
    }, [searchParams, setError]);

    return null;
}

// รับเฉพาะ path ภายในแอป (กัน open redirect ไปเว็บอื่น)
function getSafeNextPath(value) {
    if (!value || typeof value !== 'string') return null;
    // กัน open redirect: ต้องเป็น path ในเว็บนี้เท่านั้น (เบราว์เซอร์ตัดช่องว่าง/แท็บทิ้ง ทำให้ "/\t/evil.com" กลายเป็น //evil.com)
    if (/[\s\u0000-\u001f\u007f]/.test(value)) return null;
    if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
    return value;
}

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        username: "",
        password: "",
    });
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const result = await login(formData.username, formData.password);

            if (result.success) {
                const nextPath = getSafeNextPath(searchParams.get('next'));
                router.push(result.mustChangePassword ? "/settings/?forcePasswordChange=1" : (nextPath || "/dashboard"));
            } else {
                setError(result.message || "เข้าสู่ระบบไม่สำเร็จ");
            }
        } catch (err) {
            setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
        } finally {
            setIsLoading(false);
        }
    };

    const refreshThaiIdLink = (event) => {
        event.currentTarget.href = `/stn-eoc/api/auth/thaiid/authorize/?ts=${Date.now()}`;
    };

    return (
        <main className="min-h-dvh bg-white text-slate-900 lg:bg-[#edf5fc] lg:p-6">
            {/* จอมือถือ/แท็บเล็ต: แถบหัวกะทัดรัด แล้วเข้าแบบฟอร์มทันที (ส่วนแนะนำระบบแสดงเฉพาะจอใหญ่) */}
            <header className="flex items-center gap-3 bg-[#083865] px-4 py-3 text-white lg:hidden">
                <Image src="/stn-eoc/img/logo.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full bg-white p-0.5" />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black leading-tight">Satun Geo-EOC</p>
                    <p className="truncate text-xs text-blue-100">ศูนย์ปฏิบัติการภาวะฉุกเฉิน สสจ.สตูล</p>
                </div>
                <Link href="/" className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-blue-50 hover:bg-white/10">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />หน้าสาธารณะ
                </Link>
            </header>
            <div className="mx-auto grid w-full max-w-6xl bg-white lg:min-h-[calc(100vh-3rem)] lg:grid-cols-[1.05fr_0.95fr] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-blue-100 lg:shadow-2xl">
                <section className="relative hidden flex-col justify-between overflow-hidden bg-[#083865] p-10 text-white lg:flex">
                    <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #ffffff 0, transparent 26%), radial-gradient(circle at 80% 10%, #7dd3fc 0, transparent 28%), radial-gradient(circle at 40% 90%, #bae6fd 0, transparent 24%)" }} />
                    <div className="relative">
                        <Link href="/" className="inline-flex items-center gap-3 rounded-full bg-white/10 px-3 py-2 text-sm font-bold text-blue-50 hover:bg-white/15">
                            <Image src="/stn-eoc/img/logo.png" alt="EOC Logo" width={40} height={40} className="h-10 w-10 rounded-full bg-white p-1" />
                            Satun Provincial Emergency Operations Center (Satun Geo-EOC)
                        </Link>
                    </div>

                    <div className="relative my-10 max-w-xl">
                        <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-blue-100">ช่องทางเข้าระบบสำหรับเจ้าหน้าที่</p>
                        <p className="text-4xl font-black leading-tight sm:text-5xl">เข้าสู่ระบบเจ้าหน้าที่</p>
                        <p className="mt-4 text-base leading-7 text-blue-50">
                            ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข จังหวัดสตูล สำหรับติดตามสถานการณ์ บันทึกข้อมูล และประสานงานหน่วยปฏิบัติการ
                        </p>
                    </div>

                    <div className="relative grid gap-3 text-sm text-blue-50 sm:grid-cols-3">
                        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                            <ShieldCheck className="mb-2 h-5 w-5" />
                            <div className="font-black">ปลอดภัย</div>
                            <div className="mt-1 text-xs text-blue-100">ตรวจสอบสิทธิ์ตามบทบาท</div>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                            <MapPinned className="mb-2 h-5 w-5" />
                            <div className="font-black">สถานการณ์</div>
                            <div className="mt-1 text-xs text-blue-100">ข้อมูลเหตุการณ์แบบรวมศูนย์</div>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                            <IdCard className="mb-2 h-5 w-5" />
                            <div className="font-black">ThaiD · Provider ID</div>
                            <div className="mt-1 text-xs text-blue-100">ยืนยันตัวตนผ่านบัญชีภาครัฐ</div>
                        </div>
                    </div>
                </section>

                <section className="flex justify-center px-5 pb-6 pt-6 sm:px-8 lg:items-center lg:p-10">
                    <div className="w-full max-w-md">
                        <div className="mb-5 lg:mb-7">
                            <Image src="/stn-eoc/img/logo.png" alt="EOC Logo" width={80} height={80} className="mx-auto hidden h-20 w-20 rounded-full bg-white p-2 lg:block" />
                            <p className="hidden text-center text-lg font-black text-[#0b4c86] lg:block">ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข</p>
                            <h1 className="text-2xl font-black text-slate-950 lg:mt-1 lg:text-3xl">เข้าสู่ระบบเจ้าหน้าที่</h1>
                            <p className="mt-1 text-sm leading-6 text-slate-500 lg:mt-2">ใช้บัญชีเจ้าหน้าที่ หรือยืนยันตัวตนผ่าน ThaiD / Provider ID</p>
                        </div>

                        {error && (() => {
                            // หมดเวลาใช้งาน = แจ้งให้ทราบ (สีส้ม) ไม่ใช่ข้อผิดพลาด
                            const expired = error.startsWith("การเข้าสู่ระบบหมดอายุ");
                            const Icon = expired ? Clock : AlertTriangle;
                            return (
                                <div role="alert" className={`mb-4 rounded-xl border px-3 py-2.5 text-sm ${expired ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-700"}`}>
                                    <div className="flex items-start gap-2">
                                        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                        <div className="flex-1 whitespace-pre-line">{expired ? "หมดเวลาใช้งาน (ไม่ได้ใช้งานเกิน 10 นาที) กรุณาเข้าสู่ระบบอีกครั้ง" : error}</div>
                                    </div>
                                </div>
                            );
                        })()}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <label htmlFor="username" className="block">
                                <span className="mb-1.5 block text-sm font-bold text-slate-700">ชื่อผู้ใช้</span>
                                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm lg:py-3 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                                    <UserRound className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                                    <input
                                        type="text"
                                        id="username"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleChange}
                                        className="w-full bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-400"
                                        placeholder="กรอกชื่อผู้ใช้"
                                        autoComplete="username"
                                        required
                                    />
                                </div>
                            </label>

                            <label htmlFor="password" className="block">
                                <span className="mb-1.5 block text-sm font-bold text-slate-700">รหัสผ่าน</span>
                                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm lg:py-3 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                                    <Lock className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                                    <input
                                        type="password"
                                        id="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="w-full bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-400"
                                        placeholder="กรอกรหัสผ่าน"
                                        autoComplete="current-password"
                                        required
                                    />
                                </div>
                            </label>

                            <div className="flex items-center justify-between gap-3 text-sm">
                                <label className="flex items-center gap-2 text-slate-600">
                                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-blue-700" />
                                    จดจำฉันไว้
                                </label>
                                <span className="text-right text-xs font-semibold text-slate-400">ลืมรหัสผ่าน ติดต่อผู้ดูแล</span>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b4c86] px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#083865] disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                                {isLoading ? (
                                    <>
                                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                                        กำลังเข้าสู่ระบบ...
                                    </>
                                ) : (
                                    <>
                                        เข้าสู่ระบบ
                                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="my-4 flex items-center gap-3 text-xs font-bold text-slate-400 lg:my-6">
                            <div className="h-px flex-1 bg-slate-200" />
                            หรือ
                            <div className="h-px flex-1 bg-slate-200" />
                        </div>

                        {/* ปุ่มยืนยันตัวตนภายนอก: โลโก้ในกรอบ + ชื่อ + คำอธิบายสั้น + ลูกศร (โครงเดียวกันทั้งสองปุ่ม) */}
                        <div className="space-y-2.5">
                            <a
                                href="/stn-eoc/api/auth/thaiid/authorize/?from=login"
                                onClick={refreshThaiIdLink}
                                className="group flex w-full items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-2 pr-4 text-left shadow-[0_1px_2px_rgba(15,23,42,.05)] transition duration-200 hover:-translate-y-px hover:border-[#1e40af]/35 hover:shadow-[0_12px_24px_-16px_rgba(30,64,175,.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                            >
                                <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-xl bg-[#f1f5fb]">
                                    <Image src="/stn-eoc/img/thaiid.png" alt="" width={40} height={40} className="h-10 w-10 rounded-lg" />
                                </span>
                                <span className="min-w-0 flex-1 leading-tight">
                                    <span className="block text-[15px] font-black text-slate-900">เข้าสู่ระบบด้วย ThaiD</span>
                                    <span className="mt-0.5 block text-xs font-medium text-slate-500">ยืนยันตัวตนผ่านแอป ThaiD (ปค.)</span>
                                </span>
                                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition duration-200 group-hover:translate-x-0.5 group-hover:text-[#1e40af] motion-reduce:transition-none" aria-hidden="true" />
                            </a>

                            <a
                                href="/stn-eoc/api/auth/provider-id/authorize/"
                                className="group flex w-full items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-2 pr-4 text-left shadow-[0_1px_2px_rgba(15,23,42,.05)] transition duration-200 hover:-translate-y-px hover:border-[#0f8a4f]/35 hover:shadow-[0_12px_24px_-16px_rgba(15,138,79,.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8a4f]/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                            >
                                <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-xl bg-[#f0f8f3] px-1">
                                    <Image src="/stn-eoc/img/provider-id.png" alt="" width={326} height={128} className="h-auto w-full" />
                                </span>
                                <span className="min-w-0 flex-1 leading-tight">
                                    <span className="block text-[15px] font-black text-slate-900">เข้าสู่ระบบด้วย Provider ID</span>
                                    <span className="mt-0.5 block text-xs font-medium text-slate-500">บุคลากรสาธารณสุข ผ่าน Health ID (สธ.)</span>
                                </span>
                                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition duration-200 group-hover:translate-x-0.5 group-hover:text-[#0f8a4f] motion-reduce:transition-none" aria-hidden="true" />
                            </a>
                        </div>

                        <div className="mt-5 flex items-center justify-center gap-4 text-center text-sm lg:mt-7">
                            <Link href="/register" className="font-bold text-blue-700 hover:text-blue-900">ลงทะเบียนผู้ใช้งาน</Link>
                            <span className="hidden text-slate-300 lg:inline" aria-hidden="true">|</span>
                            <Link href="/" className="hidden font-bold text-blue-700 hover:text-blue-900 lg:inline">กลับหน้าสาธารณะ</Link>
                        </div>

                        <p className="mt-6 text-center text-xs text-slate-400 lg:mt-8">© 2025 ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข</p>

                        <Suspense fallback={null}>
                            <ThaiDErrorHandler setError={setError} />
                        </Suspense>
                    </div>
                </section>
            </div>
        </main>
    );
}

// Main export component
export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#edf5fc] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[#0b4c86] border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-gray-600">กำลังโหลด...</p>
                </div>
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
