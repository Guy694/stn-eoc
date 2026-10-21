'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BellRing, ExternalLink, Siren } from 'lucide-react';
import PublicOpsScaffold from '@/components/public/PublicOpsScaffold';
import AlertGuide from '@/components/public/alerts/AlertGuide';
import AlertSubscribeCard from '@/components/public/AlertSubscribeCard';

// หน้า "แจ้งเตือนที่ได้รับ": เปิดเมื่อกดแจ้งเตือนบนมือถือ แสดงข้อความเต็ม + แจ้งเตือน 30 วันล่าสุด
const HIGH = new Set(['high', 'critical']);

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' น.';
}

function safePath(value) {
  return typeof value === 'string' && /^\/stn-eoc\/[A-Za-z0-9/_\-.?=&%]*$/.test(value) ? value.replace(/^\/stn-eoc/, '') : null;
}

function Received() {
  const params = useSearchParams();
  const title = params.get('t');
  if (!title) return null;
  const high = HIGH.has(params.get('l'));
  const go = safePath(params.get('go'));
  const Icon = high ? Siren : BellRing;
  return (
    <article className={`overflow-hidden rounded-3xl bg-white ring-2 ${high ? 'ring-red-500' : 'ring-[#2a9db0]'}`} aria-labelledby="received-title">
      <header className={`flex items-center gap-2 px-5 py-3 text-white ${high ? 'bg-red-600' : 'bg-[#0b4c86]'}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
        <span className="font-semibold">แจ้งเตือนที่คุณเพิ่งได้รับ{params.get('at') ? ` · ${formatTime(params.get('at'))}` : ''}</span>
      </header>
      <div className="p-5 sm:p-6">
        <h1 id="received-title" className="font-[family-name:var(--font-kanit)] text-2xl font-bold leading-snug text-[#0c2f4a]">{title}</h1>
        {params.get('b') ? <p className="mt-3 whitespace-pre-line text-[1.1rem] leading-8 text-slate-800">{params.get('b')}</p> : null}
        {go ? (
          <Link href={go} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#0b4c86] px-5 py-2.5 font-semibold text-white hover:bg-[#083865]">
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> เปิดหน้าที่เกี่ยวข้อง
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export default function PublicAlertsPage() {
  const [history, setHistory] = useState(null);

  useEffect(() => {
    fetch('/stn-eoc/api/public/push/?history=1')
      .then((response) => response.json())
      .then((json) => setHistory(json.success ? json.data || [] : []))
      .catch(() => setHistory([]));
  }, []);

  return (
    <PublicOpsScaffold title="แจ้งเตือนที่ได้รับ" subtitle="แจ้งเตือนภัยและข่าวจากศูนย์ปฏิบัติการภาวะฉุกเฉิน จ.สตูล" activeMenu="announce" showPageHeader={false} mainClassName="p-0!">
      <div className="min-h-[70vh] bg-[#eef2f1] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <Suspense fallback={null}><Received /></Suspense>
          <AlertSubscribeCard />
          <section id="how-to" aria-labelledby="howto-title" className="scroll-mt-24 rounded-3xl bg-white p-5 ring-1 ring-[#d6e3ea] sm:p-6">
            <h2 id="howto-title" className="font-[family-name:var(--font-kanit)] text-xl font-bold text-[#0c2f4a]">วิธีรับแจ้งเตือนภัยบนมือถือ</h2>
            <p className="mt-1 text-slate-600">ทำครั้งเดียว ใช้เวลาไม่ถึง 1 นาที</p>
            <AlertGuide className="mt-4" />
          </section>
          <section aria-labelledby="history-title">
            <h2 id="history-title" className="font-[family-name:var(--font-kanit)] text-xl font-bold text-[#0c2f4a]">แจ้งเตือน 30 วันล่าสุด</h2>
            {history === null ? (
              <div className="mt-3 h-32 animate-pulse rounded-2xl bg-white" />
            ) : history.length === 0 ? (
              <p className="mt-3 rounded-2xl bg-white px-5 py-8 text-center text-slate-500">ยังไม่มีแจ้งเตือนในช่วงนี้</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {history.map((item) => (
                  <li key={item.id} id={`alert-${item.id}`} className="scroll-mt-24 rounded-2xl bg-white p-4 ring-1 ring-[#d6e3ea] target:ring-2 target:ring-[#0b4c86]">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      {HIGH.has(item.level) ? <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">เตือนภัย</span> : <span className="rounded-full bg-[#e3f3f5] px-2.5 py-0.5 text-xs font-bold text-[#11586a]">ข่าวจากศูนย์ฯ</span>}
                      <time dateTime={item.created_at}>{formatTime(item.created_at)}</time>
                      {item.districts?.length ? <span>· อ.{item.districts.join(', อ.')}</span> : null}
                    </div>
                    <p className="mt-1.5 font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 whitespace-pre-line leading-7 text-slate-700">{item.body}</p>
                    {safePath(item.url) && item.url !== '/stn-eoc/' ? <Link href={safePath(item.url)} className="mt-2 inline-block text-sm font-semibold text-[#0b4c86] underline-offset-4 hover:underline">เปิดหน้าที่เกี่ยวข้อง</Link> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </PublicOpsScaffold>
  );
}
