'use client';

// ห้องบัญชาการ: พาไปหน้าสรุปของเหตุการณ์ที่เปิดอยู่ (ข้อมูลชุดเดียวกับหน้าภาพรวมสถานการณ์ จึงไม่มีตัวเลขขัดกัน)
// - เปิดอยู่เหตุการณ์เดียว → ไปหน้าสรุปทันที
// - เปิดหลายเหตุการณ์ → ให้เลือก
// - ไม่มีเหตุการณ์เปิด → แจ้งและพากลับหน้าหลัก
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarClock, Presentation } from 'lucide-react';
import EOCLayout from '@/components/layouts/EOCLayout';
import { AdminPage } from '@/components/admin/crud';

const DESTINATIONS = {
    flood: { label: 'อุทกภัย (น้ำท่วม)', path: '/eoc/flood/meeting-brief', page: 'สรุปสำหรับห้องประชุม' },
    disease: { label: 'โรคระบาด', path: '/eoc/disease/overview', page: 'ภาพรวมสถานการณ์' },
    festival: { label: 'อุบัติเหตุช่วงเทศกาล', path: '/eoc/festival-accidents', page: 'ภาพรวมอุบัติเหตุ' },
    accident: { label: 'อุบัติเหตุ', path: '/eoc/accident', page: 'ภาพรวมอุบัติเหตุ' }
};
const destinationOf = (session) => DESTINATIONS[session.eoc_type] || { label: session.eoc_type, path: '/dashboard', page: 'หน้าหลัก' };
const openedText = (value) => (value ? new Date(value).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-');

export default function CommanderRoom() {
    const router = useRouter();
    const [state, setState] = useState({ loading: true, sessions: [], error: '' });

    useEffect(() => {
        let alive = true;
        fetch('/stn-eoc/api/eoc/sessions?status=active', { cache: 'no-store' })
            .then((response) => response.json())
            .then((json) => {
                if (!alive) return;
                const sessions = json?.success ? json.data || [] : [];
                if (sessions.length === 1) {
                    router.replace(destinationOf(sessions[0]).path);
                    return;
                }
                setState({ loading: false, sessions, error: json?.success ? '' : (json?.message || 'โหลดเหตุการณ์ไม่สำเร็จ') });
            })
            .catch(() => alive && setState({ loading: false, sessions: [], error: 'โหลดเหตุการณ์ไม่สำเร็จ' }));
        return () => { alive = false; };
    }, [router]);

    return (
        <EOCLayout>
            <AdminPage title="ห้องบัญชาการ" description="ภาพรวมสำหรับประชุมและตัดสินใจ ใช้ข้อมูลชุดเดียวกับหน้าภาพรวมสถานการณ์ของแต่ละเหตุการณ์">
                {state.loading ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">กำลังเปิดหน้าสรุปของเหตุการณ์ที่เปิดอยู่…</p> : null}
                {state.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}</p> : null}
                {!state.loading && !state.error && state.sessions.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                        <p className="font-black">ตอนนี้ไม่มีเหตุการณ์ที่เปิดศูนย์ปฏิบัติการ</p>
                        <p className="mt-1 text-sm">เมื่อเปิดเหตุการณ์แล้ว หน้านี้จะพาไปหน้าสรุปสำหรับห้องประชุมโดยอัตโนมัติ</p>
                        <Link href="/dashboard" className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[#0b4c86] px-4 text-sm font-bold text-white hover:bg-[#083865]">กลับหน้าหลัก</Link>
                    </div>
                ) : null}
                {state.sessions.length > 1 ? (
                    <>
                        <p className="text-sm text-slate-600">มีเหตุการณ์เปิดอยู่ {state.sessions.length} เหตุการณ์ เลือกเหตุการณ์ที่จะประชุม</p>
                        <ul className="grid gap-3 md:grid-cols-2">
                            {state.sessions.map((session) => {
                                const destination = destinationOf(session);
                                return (
                                    <li key={session.id}>
                                        <Link href={destination.path} className="flex items-center gap-4 rounded-xl border border-[#c9dcee] bg-white p-5 shadow-sm hover:border-[#0b4c86] hover:bg-[#f5f9fd]">
                                            <Presentation className="h-8 w-8 shrink-0 text-[#0b4c86]" aria-hidden="true" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-lg font-black text-slate-900">{destination.label}{session.disease_name ? ` · ${session.disease_name}` : ''} ครั้งที่ {session.session_number}</span>
                                                <span className="mt-0.5 flex items-center gap-1 text-sm text-slate-600"><CalendarClock className="h-4 w-4" aria-hidden="true" />เปิดเมื่อ {openedText(session.opened_at)}</span>
                                                <span className="mt-1 block text-sm font-semibold text-[#0b4c86]">เปิด{destination.page}</span>
                                            </span>
                                            <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                ) : null}
            </AdminPage>
        </EOCLayout>
    );
}
