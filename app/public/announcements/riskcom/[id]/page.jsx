'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import PublicOpsScaffold from '@/components/public/PublicOpsScaffold';
import RiskcomMediaDetail from '@/components/public/announcements/RiskcomMediaDetail';

export default function RiskcomMediaPage({ params }) {
  const { id } = use(params);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/stn-eoc/api/public/riskcom-media?id=${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((result) => setItem(result.success ? result.data : null))
      .catch((error) => { if (error.name !== 'AbortError') console.error('Load riskcom media error:', error); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  return <PublicOpsScaffold title="สื่อความรู้" subtitle="สื่อจากสำนักงานสาธารณสุขจังหวัดสตูล" activeMenu="announce" showPageHeader={false} mainClassName="p-0!">
    {loading ? (
      <div className="min-h-[70vh] bg-[#eef2f1]">
        <div className="h-40 bg-[#0c2f4a]" />
        <div className="mx-auto -mt-20 max-w-5xl px-4"><div className="h-[520px] animate-pulse rounded-3xl bg-slate-200" /></div>
      </div>
    ) : !item ? (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <FileText className="mx-auto h-12 w-12 text-slate-300" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-black text-slate-700">ไม่พบสื่อนี้</h1>
        <p className="mt-1 text-sm text-slate-500">สื่ออาจถูกนำออกจากคลัง หรือเชื่อมต่อคลังสื่อไม่ได้ชั่วคราว</p>
        <Link href="/public/announcements" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#0b4c86] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0c2f4a]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />ดูประกาศทั้งหมด</Link>
      </div>
    ) : <RiskcomMediaDetail item={item} />}
  </PublicOpsScaffold>;
}
