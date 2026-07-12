'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import AnnouncementDetailView from '@/components/announcements/AnnouncementDetailView';
import PublicOpsScaffold from '@/components/public/PublicOpsScaffold';

export default function PublicAnnouncementDetailPage({ params }) {
  const { id } = use(params);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/stn-eoc/api/public/announcements?id=${encodeURIComponent(id)}&include_old=1`)
      .then((response) => response.json())
      .then((result) => setItem(result.success ? result.data?.[0] || null : null))
      .catch((error) => console.error('Load public announcement detail error:', error))
      .finally(() => setLoading(false));
  }, [id]);

  return <PublicOpsScaffold title="รายละเอียดประกาศ" subtitle="ข่าวประชาสัมพันธ์จากระบบ EOC" activeMenu="announce" showPageHeader={false}>
    <div className="mx-auto max-w-5xl">
      <Link href="/public/announcements" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-900"><ArrowLeft className="h-4 w-4" />กลับหน้าประกาศ</Link>
      {loading ? <div className="h-[560px] animate-pulse rounded-3xl bg-slate-200" /> : !item ? <div className="rounded-3xl bg-white py-20 text-center shadow-sm"><FileText className="mx-auto h-12 w-12 text-slate-300" /><h1 className="mt-3 text-xl font-black text-slate-700">ไม่พบประกาศนี้</h1></div> : <AnnouncementDetailView item={item} />}
    </div>
  </PublicOpsScaffold>;
}
