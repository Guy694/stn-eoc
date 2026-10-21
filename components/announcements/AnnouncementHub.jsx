'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Archive, BellRing, LayoutGrid, Plus } from 'lucide-react';
import AnnouncementCarousel from './AnnouncementCarousel';
import AnnouncementFilters from './AnnouncementFilters';
import AnnouncementGrid from './AnnouncementGrid';
import { getAnnouncementCategory } from './announcementUtils';
import PaginationControls, { paginateRows } from '@/components/common/PaginationControls';
import { PageHero, heroPrimaryButtonClass } from '@/components/common/ThemePanels';

const EMPTY_FILTERS = { search: '', category: '', status: '', dateFrom: '', dateTo: '' };

export default function AnnouncementHub({ canManage = false, detailBasePath = '/announcements' }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);
  const listRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/stn-eoc/api/public/announcements?limit=200&include_old=1', { signal: controller.signal })
      .then((response) => response.json())
      .then((result) => setItems(result.success ? result.data || [] : []))
      .catch((error) => { if (error.name !== 'AbortError') console.error('Load announcements error:', error); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const categories = useMemo(() => [...new Set(items.map(getAnnouncementCategory))].sort((a, b) => a.localeCompare(b, 'th')), [items]);
  const filteredItems = useMemo(() => items.filter((item) => {
    const search = filters.search.trim().toLocaleLowerCase('th');
    const searchable = `${item.title || ''} ${item.description || ''}`.toLocaleLowerCase('th');
    const itemDate = new Date(item.start_date || item.created_at || 0);
    if (search && !searchable.includes(search)) return false;
    if (filters.category && getAnnouncementCategory(item) !== filters.category) return false;
    if (filters.status && item.display_status !== filters.status) return false;
    if (filters.dateFrom && itemDate < new Date(`${filters.dateFrom}T00:00:00`)) return false;
    if (filters.dateTo && itemDate > new Date(`${filters.dateTo}T23:59:59`)) return false;
    return true;
  }), [filters, items]);

  const currentCount = items.filter((item) => item.display_status === 'current').length;
  const archiveCount = items.filter((item) => item.display_status === 'expired').length;
  const featured = items.filter((item) => item.display_status === 'current' && item.image_path && (item.show_popup || item.priority > 0));
  const paginatedItems = useMemo(() => paginateRows(filteredItems, page, pageSize), [filteredItems, page, pageSize]);
  const handleFilterChange = (nextFilters) => {
    setFilters(nextFilters);
    setPage(1);
  };
  const handlePageChange = (nextPage) => {
    setPage(nextPage);
    window.requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return <div className="mx-auto max-w-[1500px] space-y-4">
    <PageHero
      icon="megaphone"
      eyebrow="ศูนย์ข่าวประชาสัมพันธ์ EOC"
      title="ประกาศและข่าวสาร"
      subtitle="ประกาศสำคัญ ข่าวประชาสัมพันธ์ แบนเนอร์ และเอกสารเผยแพร่ รวมถึงข่าวย้อนหลังจากระบบ EOC"
      actions={canManage ? <Link href="/admin/announcements" className={heroPrimaryButtonClass}><Plus className="h-4 w-4" aria-hidden="true" />จัดการประกาศ</Link> : null}
    />

    {!loading && <div className="grid gap-3 font-[family-name:var(--font-kanit)] sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4"><LayoutGrid className="h-6 w-6 text-[#0b4c86]" /><p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{items.length.toLocaleString('th-TH')}</p><p className="text-sm text-slate-500">ประกาศทั้งหมด</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><BellRing className="h-6 w-6 text-emerald-600" /><p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{currentCount.toLocaleString('th-TH')}</p><p className="text-sm text-slate-500">กำลังเผยแพร่</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><Archive className="h-6 w-6 text-slate-500" /><p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{archiveCount.toLocaleString('th-TH')}</p><p className="text-sm text-slate-500">ข่าวย้อนหลัง</p></div></div>}
    <AnnouncementCarousel items={featured.length ? featured : items.filter((item) => item.display_status === 'current')} detailBasePath={detailBasePath} />
    <AnnouncementFilters filters={filters} setFilters={handleFilterChange} categories={categories} />
    <div ref={listRef} className="scroll-mt-5 flex items-end justify-between"><div><h2 className="font-[family-name:var(--font-kanit)] text-xl font-semibold text-slate-900">ข่าวและประกาศทั้งหมด</h2><p className="mt-1 text-sm text-slate-500">พบ {filteredItems.length.toLocaleString('th-TH')} รายการ</p></div></div>
    <AnnouncementGrid items={paginatedItems} loading={loading} detailBasePath={detailBasePath} />
    {filteredItems.length > 9 && <div className="overflow-hidden rounded-2xl border border-slate-200">
      <PaginationControls
        page={page}
        pageSize={pageSize}
        totalItems={filteredItems.length}
        onPageChange={handlePageChange}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[9, 18, 36]}
        itemLabel="ประกาศ"
      />
    </div>}
  </div>;
}
