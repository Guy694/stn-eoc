import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, FileText, ImageIcon, Paperclip } from 'lucide-react';
import { formatAnnouncementDate, getAnnouncementAsset, getAnnouncementCategory, getAnnouncementStatus } from './announcementUtils';

export default function AnnouncementGrid({ items, loading, detailBasePath = '/announcements' }) {
  if (loading) return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-96 animate-pulse rounded-2xl bg-slate-200" />)}</div>;
  if (!items.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center"><FileText className="mx-auto h-12 w-12 text-slate-300" /><h3 className="mt-3 font-black text-slate-700">ไม่พบประกาศ</h3><p className="mt-1 text-sm text-slate-500">ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p></div>;

  return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => {
    const image = getAnnouncementAsset(item.image_path);
    const status = getAnnouncementStatus(item);
    return <article key={item.id} className="group flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <Link href={`${detailBasePath}/${item.id}`} className="flex min-w-0 flex-1 flex-col">
        <div className="relative h-48 overflow-hidden bg-gradient-to-br from-blue-50 to-slate-100">
          {image ? <Image src={image} alt={item.title} fill className="object-cover transition duration-500 group-hover:scale-105" sizes="(max-width: 768px) 100vw, 33vw" unoptimized /> : <ImageIcon className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 text-blue-200" />}
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{getAnnouncementCategory(item)}</span><span className={`rounded-full px-2.5 py-1 ${status.className}`}>{status.label}</span>{item.attachment_path && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-violet-700"><Paperclip className="h-3 w-3" />เอกสารแนบ</span>}</div>
          <h3 className="mt-3 line-clamp-2 text-lg font-black leading-snug text-slate-900 group-hover:text-blue-700">{item.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{item.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
          <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500"><span>{formatAnnouncementDate(item.start_date || item.created_at)}</span><span className="inline-flex items-center gap-1 font-bold text-blue-700">อ่านต่อ <ArrowRight className="h-3.5 w-3.5" /></span></div>
        </div>
      </Link>
    </article>;
  })}</div>;
}
