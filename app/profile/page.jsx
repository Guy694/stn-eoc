"use client";
// โปรไฟล์ของฉัน: ข้อมูลส่วนตัว สิทธิ์ และการรับแจ้งเตือนทาง Telegram (ใช้ธีมเดียวกับทั้งระบบ)
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Check, KeyRound, Minus, Pencil } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import { AdminPage, StatusPill, inputClass } from "@/components/admin/crud";
import { showError, showSuccess } from "@/lib/sweetAlert";
import OfficerPushCard from "@/components/admin/OfficerPushCard";

const TITLES = ["นาย", "นาง", "นางสาว", "ดร."];

const fromUser = (user) => ({
    title: user?.title || "",
    givenName: user?.givenName || "",
    familyName: user?.familyName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    department: user?.department || "",
    position: user?.position || ""
});

export default function ProfilePage() {
    const router = useRouter();
    const { user, loading, validateSession } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(fromUser(null));
    const [telegramSettings, setTelegramSettings] = useState({ telegramChatId: "", telegramNotifyEnabled: false, botLink: "" });
    const [telegramSaving, setTelegramSaving] = useState(false);

    useEffect(() => {
        if (!loading && !user) router.push("/login");
        else if (user && !isEditing) setFormData(fromUser(user));
    }, [user, loading, router, isEditing]);

    useEffect(() => {
        if (!user) return;
        fetch("/stn-eoc/api/officer/telegram")
            .then((response) => response.json())
            .then((data) => { if (data.success) setTelegramSettings(data.data); })
            .catch((error) => console.error("Error loading Telegram settings:", error));
    }, [user]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const response = await fetch("/stn-eoc/api/officer/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (data.success) {
                // โหลดข้อมูลผู้ใช้ใหม่จากเซิร์ฟเวอร์ ให้หน้านี้และแถบด้านบนแสดงค่าใหม่ทันที (เดิมต้องรีเฟรชหน้าเอง)
                await validateSession(true);
                setIsEditing(false);
                showSuccess("บันทึกข้อมูลแล้ว");
            } else {
                showError(data.message || "บันทึกข้อมูลไม่สำเร็จ");
            }
        } catch (error) {
            console.error("Error updating profile:", error);
            showError("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        } finally {
            setSaving(false);
        }
    };

    const handleTelegramSubmit = async (event) => {
        event.preventDefault();
        setTelegramSaving(true);
        try {
            const response = await fetch("/stn-eoc/api/officer/telegram", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(telegramSettings)
            });
            const data = await response.json();
            if (data.success) {
                setTelegramSettings((current) => ({ ...current, ...data.data }));
                showSuccess("บันทึกการแจ้งเตือน Telegram แล้ว");
            } else {
                showError(data.message || "บันทึก Telegram ไม่สำเร็จ");
            }
        } catch (error) {
            console.error("Error saving Telegram settings:", error);
            showError("เกิดข้อผิดพลาดในการบันทึก Telegram");
        } finally {
            setTelegramSaving(false);
        }
    };

    if (loading) {
        return <div className="flex min-h-screen items-center justify-center"><p className="text-sm text-slate-500">กำลังโหลด…</p></div>;
    }
    if (!user) return null;

    const fullName = `${user.title || ""} ${user.givenName || ""} ${user.familyName || ""}`.trim();
    const initial = (user.givenName || user.username || "?").charAt(0).toUpperCase();
    const permissions = [
        { label: "ดูแดชบอร์ด", allowed: user.permissions?.dashboard },
        { label: "ดูข้อมูล EOC", allowed: user.permissions?.eoc?.view },
        { label: "บันทึกข้อมูล", allowed: user.permissions?.eoc?.create },
        { label: "แก้ไขข้อมูล", allowed: user.permissions?.eoc?.edit },
        { label: "ลบข้อมูล", allowed: user.permissions?.eoc?.delete },
        { label: "เมนูบริหารระบบ", allowed: user.permissions?.admin?.view },
        { label: "ดูรายงาน", allowed: user.permissions?.reports?.view },
        { label: "ส่งออกรายงาน", allowed: user.permissions?.reports?.export }
    ];
    const telegramOn = Boolean(telegramSettings.telegramNotifyEnabled && telegramSettings.telegramChatId);

    return (
        <EOCLayout>
            <AdminPage title="โปรไฟล์ของฉัน" description="ข้อมูลส่วนตัวที่แสดงในระบบ สิทธิ์การใช้งาน และการรับแจ้งเตือน">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <section className="overflow-hidden rounded-xl border border-[#c9dcee] bg-white shadow-sm" aria-labelledby="profile-name">
                        <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 bg-[#edf5fc] px-5 py-5 sm:px-6">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#0b4c86] text-2xl font-black text-white" aria-hidden="true">{initial}</div>
                            <div className="min-w-0 flex-1">
                                <h2 id="profile-name" className="truncate text-xl font-black text-slate-900">{fullName || user.username}</h2>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                                    <StatusPill tone="blue">{user.roleDisplay || user.role}</StatusPill>
                                    <span>@{user.username}</span>
                                    {user.department ? <span>· {user.department}</span> : null}
                                </div>
                            </div>
                            {!isEditing ? (
                                <button type="button" onClick={() => setIsEditing(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#c9dcee] bg-white px-3 py-2 text-sm font-bold text-[#0b4c86] hover:bg-white/70">
                                    <Pencil className="h-4 w-4" aria-hidden="true" />แก้ไขข้อมูล
                                </button>
                            ) : null}
                        </div>

                        <div className="p-5 sm:p-6">
                            {!isEditing ? (
                                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                                    <Info label="ชื่อ-นามสกุล" value={fullName} />
                                    <Info label="บทบาท" value={user.roleDisplay} />
                                    <Info label="อีเมล" value={user.email} />
                                    <Info label="เบอร์โทรศัพท์" value={user.phone} />
                                    <Info label="ตำแหน่ง" value={user.position} />
                                    <Info label="หน่วยงาน" value={user.department} />
                                </dl>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="grid gap-4 sm:grid-cols-[9rem_1fr_1fr]">
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-semibold text-slate-700">คำนำหน้า</span>
                                            <select name="title" value={formData.title} onChange={handleChange} className={inputClass}>
                                                <option value="">ไม่ระบุ</option>
                                                {TITLES.map((title) => <option key={title} value={title}>{title}</option>)}
                                            </select>
                                        </label>
                                        <Field label="ชื่อ" name="givenName" value={formData.givenName} onChange={handleChange} required placeholder="เช่น สมชาย" autoComplete="given-name" />
                                        <Field label="นามสกุล" name="familyName" value={formData.familyName} onChange={handleChange} required placeholder="เช่น ใจดี" autoComplete="family-name" />
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Field label="อีเมล" name="email" type="email" value={formData.email} onChange={handleChange} required autoComplete="email" />
                                        <Field label="เบอร์โทรศัพท์" name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="เช่น 081-234-5678" autoComplete="tel" />
                                        <Field label="ตำแหน่ง" name="position" value={formData.position} onChange={handleChange} placeholder="เช่น นักวิชาการสาธารณสุข" />
                                        <Field label="หน่วยงาน" name="department" value={formData.department} onChange={handleChange} placeholder="เช่น สสจ.สตูล" />
                                    </div>
                                    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                                        <button type="submit" disabled={saving} className="rounded-lg bg-[#0b4c86] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#083865] disabled:opacity-60">
                                            {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
                                        </button>
                                        <button type="button" disabled={saving} onClick={() => { setFormData(fromUser(user)); setIsEditing(false); }} className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                                            ยกเลิก
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </section>

                    <div className="space-y-4">
                        <section className="rounded-xl border border-[#c9dcee] bg-white p-5 shadow-sm" aria-labelledby="perm-title">
                            <h3 id="perm-title" className="font-black text-slate-900">สิทธิ์การใช้งาน</h3>
                            <p className="mt-0.5 text-xs text-slate-500">ตามบทบาท {user.roleDisplay || user.role} — ขอเปลี่ยนบทบาทได้ที่ผู้ดูแลระบบ</p>
                            <ul className="mt-3 space-y-1.5">
                                {permissions.map((item) => (
                                    <li key={item.label} className={`flex items-center gap-2 text-sm ${item.allowed ? "text-slate-800" : "text-slate-400"}`}>
                                        {item.allowed
                                            ? <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                                            : <Minus className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />}
                                        {item.label}
                                        <span className="sr-only">{item.allowed ? "ได้" : "ไม่ได้"}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <Link href="/settings" className="flex items-center gap-3 rounded-xl border border-[#c9dcee] bg-white p-4 shadow-sm hover:bg-[#edf5fc]">
                            <KeyRound className="h-5 w-5 shrink-0 text-[#0b4c86]" aria-hidden="true" />
                            <span>
                                <span className="block font-black text-slate-900">เปลี่ยนรหัสผ่าน</span>
                                <span className="block text-sm text-slate-600">ที่หน้าตั้งค่าบัญชี</span>
                            </span>
                        </Link>
                    </div>

                    <form onSubmit={handleTelegramSubmit} className="rounded-xl border border-[#c9dcee] bg-white p-5 shadow-sm sm:p-6 lg:col-span-2" aria-labelledby="tg-title">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h3 id="tg-title" className="flex items-center gap-2 font-black text-slate-900">
                                    <BellRing className="h-5 w-5 text-[#0b4c86]" aria-hidden="true" />รับแจ้งเตือนทาง Telegram
                                    {telegramOn ? <StatusPill tone="green">เปิดรับอยู่</StatusPill> : <StatusPill tone="gray">ยังไม่รับ</StatusPill>}
                                </h3>
                                <p className="mt-1 text-sm text-slate-600">รับข้อความส่วนตัวเมื่อประชาชนส่งคำขอความช่วยเหลือ (แยกจากกลุ่มแจ้งเตือนของศูนย์)</p>
                            </div>
                            {telegramSettings.botLink ? (
                                <a href={telegramSettings.botLink} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[#c9dcee] bg-white px-3 py-2 text-sm font-bold text-[#0b4c86] hover:bg-[#edf5fc]">
                                    เปิด Bot ใน Telegram
                                </a>
                            ) : (
                                <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-500">ผู้ดูแลยังไม่ได้ตั้งค่า Bot</span>
                            )}
                        </div>

                        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                            {telegramSettings.botLink
                                ? <li>กด &ldquo;เปิด Bot ใน Telegram&rdquo; แล้วกด Start หรือส่งข้อความหา Bot</li>
                                : <li>ขอชื่อ Bot ของศูนย์จากผู้ดูแลระบบ แล้วส่งข้อความหา Bot ใน Telegram</li>}
                            <li>นำรหัสแชต (Chat ID) ที่ Bot ตอบกลับ หรือที่ผู้ดูแลให้มา ใส่ในช่องด้านล่าง</li>
                            <li>เลือก &ldquo;รับแจ้งเตือน&rdquo; แล้วกดบันทึก</li>
                        </ol>

                        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,22rem)_auto_auto] sm:items-end">
                            <label className="block">
                                <span className="mb-1 block text-sm font-semibold text-slate-700">รหัสแชต Telegram (Chat ID)</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={telegramSettings.telegramChatId || ""}
                                    onChange={(event) => setTelegramSettings((current) => ({ ...current, telegramChatId: event.target.value }))}
                                    placeholder="เช่น 123456789"
                                    className={inputClass}
                                />
                            </label>
                            <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={Boolean(telegramSettings.telegramNotifyEnabled)}
                                    onChange={(event) => setTelegramSettings((current) => ({ ...current, telegramNotifyEnabled: event.target.checked }))}
                                    className="h-4 w-4 accent-[#0b4c86]"
                                />
                                รับแจ้งเตือน
                            </label>
                            <button type="submit" disabled={telegramSaving} className="min-h-10 rounded-lg bg-[#0b4c86] px-4 py-2 text-sm font-bold text-white hover:bg-[#083865] disabled:opacity-60">
                                {telegramSaving ? "กำลังบันทึก…" : "บันทึกการแจ้งเตือน"}
                            </button>
                        </div>
                    </form>
                    <OfficerPushCard className="lg:col-span-2" />
                </div>
            </AdminPage>
        </EOCLayout>
    );
}

function Info({ label, value }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs font-semibold text-slate-500">{label}</dt>
            <dd className={`mt-0.5 break-words text-base ${value ? "text-slate-900" : "text-slate-400"}`}>{value || "ยังไม่ได้ระบุ"}</dd>
        </div>
    );
}

function Field({ label, name, type = "text", value, onChange, required = false, placeholder, autoComplete }) {
    return (
        <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">{label}{required ? <span className="text-red-600"> *</span> : null}</span>
            <input type={type} name={name} value={value} onChange={onChange} required={required} placeholder={placeholder} autoComplete={autoComplete} className={inputClass} />
        </label>
    );
}
