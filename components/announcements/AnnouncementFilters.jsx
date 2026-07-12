'use client';

import { CalendarDays, Search, SlidersHorizontal, X } from 'lucide-react';

export default function AnnouncementFilters({ filters, setFilters, categories }) {
  const reset = () => setFilters({ search: '', category: '', status: '', dateFrom: '', dateTo: '' });
  const hasFilters = Object.values(filters).some(Boolean);
  const fieldClass = 'h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.5fr)_1fr_1fr_1fr_1fr_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
          <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="ค้นหาหัวข้อหรือเนื้อหา..." className={`${fieldClass} w-full pl-10`} />
        </label>
        <label className="relative">
          <SlidersHorizontal className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
          <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} className={`${fieldClass} w-full pl-10`}>
            <option value="">ทุกหมวดหมู่</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={fieldClass}>
          <option value="">ทุกสถานะ</option><option value="current">กำลังเผยแพร่</option><option value="expired">ข่าวย้อนหลัง</option>
        </select>
        <label className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" /><input type="date" aria-label="ตั้งแต่วันที่" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className={`${fieldClass} w-full pl-10`} /></label>
        <label className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" /><input type="date" aria-label="ถึงวันที่" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className={`${fieldClass} w-full pl-10`} /></label>
        <button type="button" onClick={reset} disabled={!hasFilters} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"><X className="h-4 w-4" />ล้าง</button>
      </div>
    </section>
  );
}
