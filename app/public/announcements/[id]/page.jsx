'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import PublicAnnouncementDetail from '@/components/public/announcements/PublicAnnouncementDetail';
import { topicKey } from '@/components/public/announcements/announcementTopics';
import PublicOpsScaffold from '@/components/public/PublicOpsScaffold';

export default function PublicAnnouncementDetailPage({ params }) {
  const { id } = use(params);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [all, setAll] = useState([]);
  const trackedViewId = useRef(null);

  useEffect(() => {
    fetch(`/stn-eoc/api/public/announcements?id=${encodeURIComponent(id)}&include_old=1`)
      .then((response) => response.json())
      .then((result) => {
        const announcement = result.success ? result.data?.[0] || null : null;
        setItem(announcement);

        if (announcement && trackedViewId.current !== String(id)) {
          trackedViewId.current = String(id);
          fetch('/stn-eoc/api/public/announcements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          })
            .then((response) => response.json())
            .then((viewResult) => {
              if (viewResult.success) {
                setItem((current) => current ? { ...current, view_count: viewResult.data.view_count } : current);
              }
            })
            .catch((error) => console.error('Record public announcement view error:', error));
        }
      })
      .catch((error) => console.error('Load public announcement detail error:', error))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetch('/stn-eoc/api/public/announcements?limit=200&include_old=1')
      .then((response) => response.json())
      .then((result) => setAll(result.success ? result.data || [] : []))
      .catch(() => setAll([]));
  }, []);

  // ประกาศที่เกี่ยวข้อง: หมวดเดียวกันก่อน แล้วเติมด้วยประกาศล่าสุด ให้ได้ไม่เกิน 3 รายการ
  const related = (() => {
    if (!item) return [];
    const others = all.filter((other) => String(other.id) !== String(item.id));
    const key = topicKey(item);
    const same = others.filter((other) => topicKey(other) === key);
    const rest = others.filter((other) => topicKey(other) !== key);
    return [...same, ...rest].slice(0, 3);
  })();

  return <PublicOpsScaffold title="รายละเอียดประกาศ" subtitle="ข่าวประชาสัมพันธ์จากระบบ EOC" activeMenu="announce" showPageHeader={false} mainClassName="p-0!">
    {loading ? (
      <div className="min-h-[70vh] bg-[#eef2f1]">
        <div className="h-40 bg-[#0c2f4a]" />
        <div className="mx-auto -mt-20 max-w-5xl px-4"><div className="h-[520px] animate-pulse rounded-3xl bg-slate-200" /></div>
      </div>
    ) : !item ? (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <FileText className="mx-auto h-12 w-12 text-slate-300" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-black text-slate-700">ไม่พบประกาศนี้</h1>
        <p className="mt-1 text-sm text-slate-500">ประกาศอาจถูกลบหรือลิงก์ไม่ถูกต้อง</p>
        <Link href="/public/announcements" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#0b4c86] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0c2f4a]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />ดูประกาศทั้งหมด</Link>
      </div>
    ) : <PublicAnnouncementDetail item={item} related={related} />}
  </PublicOpsScaffold>;
}
