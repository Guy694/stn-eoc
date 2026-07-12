import { CalendarDays, Download, FileText, UserRound } from 'lucide-react';
import AnnouncementImageViewer from './AnnouncementImageViewer';
import { formatAnnouncementDate, getAnnouncementAsset, getAnnouncementCategory, getAnnouncementStatus } from './announcementUtils';

export default function AnnouncementDetailView({ item }) {
  const image = getAnnouncementAsset(item.image_path);
  const attachment = getAnnouncementAsset(item.attachment_path);
  const status = getAnnouncementStatus(item);

  return <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
    {image && <AnnouncementImageViewer src={image} alt={item.title} priority />}
    <div className="p-6 md:p-10">
      <div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">{getAnnouncementCategory(item)}</span><span className={`rounded-full px-3 py-1.5 ${status.className}`}>{status.label}</span></div>
      <h1 className="mt-5 text-3xl font-black leading-tight text-slate-950 md:text-5xl">{item.title}</h1>
      <div className="mt-5 flex flex-wrap gap-5 border-b border-slate-100 pb-6 text-sm text-slate-500"><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" />{formatAnnouncementDate(item.start_date || item.created_at, true)}</span>{item.created_by_name && <span className="inline-flex items-center gap-2"><UserRound className="h-4 w-4" />{item.created_by_name}</span>}</div>
      <div className="whitespace-pre-wrap py-8 text-base leading-8 text-slate-700 md:text-lg">{item.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</div>
      {attachment && <a href={attachment} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-violet-900 hover:bg-violet-100"><span className="inline-flex min-w-0 items-center gap-3"><FileText className="h-8 w-8 shrink-0" /><span className="min-w-0"><span className="block text-xs font-bold text-violet-600">เอกสารแนบ</span><span className="block truncate font-black">{item.attachment_name || 'เปิดเอกสารแนบ'}</span></span></span><Download className="h-5 w-5 shrink-0" /></a>}
    </div>
  </article>;
}
