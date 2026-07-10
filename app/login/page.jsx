"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ArrowRight, IdCard, Lock, MapPinned, ShieldCheck, UserRound } from "lucide-react";

// Component แยกสำหรับจัดการ error จาก ThaiID callback
function ThaiIDErrorHandler({ setError }) {
    const searchParams = useSearchParams();

    useEffect(() => {
        const errorType = searchParams.get('error');
        const errorMessage = searchParams.get('message');
        const pid = searchParams.get('pid');
        const timeout = searchParams.get('timeout');

        // ตรวจสอบ session timeout
        if (timeout === 'true') {
            setError('Session หมดอายุเนื่องจากไม่มีการใช้งานเกิน 10 นาที\nกรุณาเข้าสู่ระบบใหม่อีกครั้ง');
            return;
        }

        if (errorType) {
            switch (errorType) {
                case 'thaiid_auth_failed':
                    if (errorMessage && decodeURIComponent(errorMessage).includes('unauthorized_client')) {
                        setError('ThaiID ยังไม่อนุญาต client นี้หรือ redirect URI นี้\n\nสาเหตุที่พบบ่อย:\n• client_id ยังไม่ได้รับสิทธิ์จาก DOPA\n• redirect URI ที่ลงทะเบียนไม่ตรงกับที่ระบบส่งไป\n• แอป ThaiID ตัวนี้ยังไม่ได้ผูกกับ environment ปัจจุบัน\n\nสิ่งที่ควรตรวจสอบ:\n✓ ยืนยันว่า ThaiID console อนุญาต client_id นี้\n✓ ตรวจว่า redirect URI ตรงกับค่าที่ลงทะเบียนกับ DOPA แบบตัวต่อตัว\n✓ รีสตาร์ต server หลังแก้ .env');
                        break;
                    }
                    setError(`การยืนยันตัวตนผ่าน ThaiID ล้มเหลว: ${errorMessage || 'ไม่ทราบสาเหตุ'}`);
                    break;
                case 'no_code':
                    setError('ไม่ได้รับ authorization code จาก ThaiID');
                    break;
                case 'no_pid':
                    setError('ไม่สามารถดึงเลขบัตรประชาชนจาก ThaiID ได้');
                    break;
                case 'user_not_found':
                    setError(`${errorMessage ? decodeURIComponent(errorMessage) : `ไม่พบผู้ใช้งานที่มีเลขบัตรประชาชน: ${pid || 'ไม่ระบุ'}`}\nกรุณาลงทะเบียนผู้ใช้งานก่อน หรือใช้ชื่อ-นามสกุลให้ตรงกับข้อมูลใน ThaiID`);
                    break;
                case 'callback_failed':
                    const decodedMessage = errorMessage ? decodeURIComponent(errorMessage) : 'การเข้าสู่ระบบผ่าน ThaiID ล้มเหลว';

                    if (decodedMessage.includes('unauthorized_client')) {
                        setError('ThaiID ยังไม่อนุญาต client นี้หรือ redirect URI นี้\n\nสาเหตุที่พบบ่อย:\n• client_id ยังไม่ได้รับสิทธิ์จาก DOPA\n• redirect URI ที่ลงทะเบียนไม่ตรงกับที่ระบบส่งไป\n• แอป ThaiID ตัวนี้ยังไม่ได้ผูกกับ environment ปัจจุบัน\n\nสิ่งที่ควรตรวจสอบ:\n✓ ยืนยันว่า ThaiID console อนุญาต client_id นี้\n✓ ตรวจว่า redirect URI ตรงกับค่าที่ลงทะเบียนกับ DOPA แบบตัวต่อตัว\n✓ รีสตาร์ต server หลังแก้ .env');
                        break;
                    }

                    // ตรวจสอบว่าเป็น timeout error หรือไม่
                    if (decodedMessage.includes('timeout') || decodedMessage.includes('ETIMEDOUT')) {
                        setError('การเชื่อมต่อ ThaiID หมดเวลา\n\nสาเหตุที่เป็นไปได้:\n• เครือข่ายอินเทอร์เน็ตไม่เสถียร\n• บริการ ThaiID ไม่สามารถเข้าถึงได้ชั่วคราว\n• Server ไม่สามารถเชื่อมต่อกับ ThaiID API\n\nคำแนะนำ:\n✓ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต\n✓ ลองใหม่อีกครั้งในอีกสักครู่\n✓ หรือใช้ username/password แทน');
                    } else {
                        setError(`เกิดข้อผิดพลาด: ${decodedMessage}`);
                    }
                    break;
                default:
                    setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบผ่าน ThaiID');
            }
        }
    }, [searchParams, setError]);

    return null;
}

function LoginForm() {
    const router = useRouter();
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
                router.push("/dashboard");
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
        <main className="min-h-screen bg-[#edf5fc] p-4 text-slate-900 sm:p-6">
            <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
                <section className="relative flex min-h-[360px] flex-col justify-between overflow-hidden bg-[#083865] p-6 text-white sm:p-8 lg:p-10">
                    <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #ffffff 0, transparent 26%), radial-gradient(circle at 80% 10%, #7dd3fc 0, transparent 28%), radial-gradient(circle at 40% 90%, #bae6fd 0, transparent 24%)" }} />
                    <div className="relative">
                        <Link href="/" className="inline-flex items-center gap-3 rounded-full bg-white/10 px-3 py-2 text-sm font-bold text-blue-50 hover:bg-white/15">
                            <Image src="/stn-eoc/img/logo.png" alt="EOC Logo" width={40} height={40} className="h-10 w-10 rounded-full bg-white p-1" />
                            Satun Provincial Emergency Operations Center (Satun Geo-EOC)
                        </Link>
                    </div>

                    <div className="relative my-10 max-w-xl">
                        <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-blue-100">Officer Command Access</p>
                        <h1 className="text-4xl font-black leading-tight sm:text-5xl">เข้าสู่ระบบเจ้าหน้าที่</h1>
                        <p className="mt-4 text-base leading-7 text-blue-50">
                            ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข จังหวัดสตูล สำหรับติดตามสถานการณ์ บันทึกข้อมูล และประสานงานหน่วยปฏิบัติการ
                        </p>
                    </div>

                    <div className="relative grid gap-3 text-sm text-blue-50 sm:grid-cols-3">
                        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                            <ShieldCheck className="mb-2 h-5 w-5" />
                            <div className="font-black">Secure</div>
                            <div className="mt-1 text-xs text-blue-100">ตรวจสอบสิทธิ์ตามบทบาท</div>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                            <MapPinned className="mb-2 h-5 w-5" />
                            <div className="font-black">Situation</div>
                            <div className="mt-1 text-xs text-blue-100">ข้อมูลเหตุการณ์แบบรวมศูนย์</div>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                            <IdCard className="mb-2 h-5 w-5" />
                            <div className="font-black">ThaiID</div>
                            <div className="mt-1 text-xs text-blue-100">รองรับการยืนยันตัวตน</div>
                        </div>
                    </div>
                </section>

                <section className="flex items-center justify-center p-5 sm:p-8 lg:p-10">
                    <div className="w-full max-w-md">
                        <div className="mb-7">
                            <Image src="/stn-eoc/img/logo.png" alt="EOC Logo" width={80} height={80} className="mx-auto h-20 w-20 rounded-full bg-white p-2" />
                            <p className="text-lg font-black text-[#0b4c86] text-center">ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข</p>
                            <h2 className="mt-1 text-3xl font-black text-slate-950">เข้าสู่ระบบ</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-500">ใช้บัญชีเจ้าหน้าที่ หรือยืนยันตัวตนผ่าน ThaiID เพื่อเข้าสู่พื้นที่ปฏิบัติงาน</p>
                        </div>

                        {error && (
                            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                                    <div className="flex-1 whitespace-pre-line">{error}</div>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <label htmlFor="username" className="block">
                                <span className="mb-2 block text-sm font-bold text-slate-700">ชื่อผู้ใช้</span>
                                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                                    <UserRound className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                                    <input
                                        type="text"
                                        id="username"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleChange}
                                        className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
                                        placeholder="กรอกชื่อผู้ใช้"
                                        autoComplete="username"
                                        required
                                    />
                                </div>
                            </label>

                            <label htmlFor="password" className="block">
                                <span className="mb-2 block text-sm font-bold text-slate-700">รหัสผ่าน</span>
                                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                                    <Lock className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                                    <input
                                        type="password"
                                        id="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
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
                                <span className="font-semibold text-slate-400">ติดต่อผู้ดูแลหากลืมรหัสผ่าน</span>
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

                        <div className="my-6 flex items-center gap-3 text-xs font-bold text-slate-400">
                            <div className="h-px flex-1 bg-slate-200" />
                            หรือ
                            <div className="h-px flex-1 bg-slate-200" />
                        </div>

                        <a
                            href="/stn-eoc/api/auth/thaiid/authorize/?from=login"
                            onClick={refreshThaiIdLink}
                            className="flex w-full items-center justify-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-blue-800 transition hover:border-blue-200 hover:bg-blue-100"
                        >
                            <Image src="/stn-eoc/img/thaiid.png" alt="ThaiID" width={36} height={36} className="h-9 w-9" />
                            เข้าสู่ระบบด้วย ThaiID
                        </a>

                        <div className="mt-7 flex flex-col gap-3 text-center text-sm sm:flex-row sm:items-center sm:justify-center sm:text-center">
                            <Link href="/register" className="font-bold text-blue-700 hover:text-blue-900">ลงทะเบียนผู้ใช้งาน</Link>
                            <Link href="/" className="font-bold text-blue-700 hover:text-blue-900">กลับหน้าสาธารณะ</Link>
                        </div>

                        <p className="mt-8 text-center text-xs text-slate-400">© 2025 ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข</p>

                        <Suspense fallback={null}>
                            <ThaiIDErrorHandler setError={setError} />
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
