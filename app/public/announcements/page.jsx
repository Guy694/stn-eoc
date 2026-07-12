'use client';

import { useEffect, useState } from 'react';
import AnnouncementHub from '@/components/announcements/AnnouncementHub';
import PublicOpsScaffold from '@/components/public/PublicOpsScaffold';
import { formatEocDisplayName } from '@/lib/eocDisplay';

export default function PublicAnnouncementsPage() {
  const [activeEocs, setActiveEocs] = useState([]);

  useEffect(() => {
    fetch('/stn-eoc/api/eoc/status/')
      .then((response) => response.json())
      .then((result) => setActiveEocs(result.success ? (result.data || []).filter((item) => item.is_active) : []))
      .catch((error) => console.error('Load EOC status error:', error));
  }, []);

  const latestEoc = [...activeEocs].sort((a, b) => new Date(b.session_opened_at || b.activated_at || 0) - new Date(a.session_opened_at || a.activated_at || 0))[0];

  return (
    <PublicOpsScaffold
      title="ประกาศและข่าวสาร"
      subtitle="ข่าวประชาสัมพันธ์ แบนเนอร์ และเอกสารเผยแพร่จากระบบ EOC"
      activeMenu="announce"
      eocIsOpen={activeEocs.length > 0}
      eocStatus={activeEocs.length > 0 ? 'open' : 'closed'}
      eocLabel={latestEoc ? formatEocDisplayName(latestEoc) : 'ไม่มี EOC ที่เปิดอยู่'}
      showPageHeader={false}
    >
      <AnnouncementHub detailBasePath="/public/announcements" />
    </PublicOpsScaffold>
  );
}
