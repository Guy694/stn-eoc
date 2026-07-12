import { getPublicAssetPath } from '@/lib/publicAssetPath';

export const EOC_CATEGORIES = {
  flood: 'อุทกภัยน้ำท่วม',
  disease: 'โรคระบาด',
  accident: 'อุบัติเหตุ',
  'festival-accidents': 'อุบัติเหตุช่วงเทศกาล',
  drought: 'ภัยแล้ง',
  tsunami: 'สึนามิ',
  earthquake: 'แผ่นดินไหว'
};

export function formatAnnouncementDate(value, withTime = false) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {})
  }).format(date);
}

export function getAnnouncementCategory(item) {
  return item.category || EOC_CATEGORIES[item.eoc_type] || 'ทั่วไป';
}

export function getAnnouncementStatus(item) {
  if (item.display_status === 'expired') return { key: 'expired', label: 'ข่าวย้อนหลัง', className: 'bg-slate-100 text-slate-600' };
  if (item.display_status === 'scheduled') return { key: 'scheduled', label: 'รอเผยแพร่', className: 'bg-amber-50 text-amber-700' };
  return { key: 'current', label: 'กำลังเผยแพร่', className: 'bg-emerald-50 text-emerald-700' };
}

export function getAnnouncementAsset(path) {
  return getPublicAssetPath(path);
}
