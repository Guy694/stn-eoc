'use client';

import EOCLayout from '@/components/layouts/EOCLayout';
import AnnouncementHub from '@/components/announcements/AnnouncementHub';
import LinkTabs, { ANNOUNCEMENT_TABS } from '@/components/common/LinkTabs';
import { useAuth } from '@/context/AuthContext';

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  return (
    <EOCLayout>
      {/* คลังอินโฟกราฟิกเป็นแท็บของหน้าประกาศ (เฉพาะผู้ดูแลระบบ) */}
      {isAdmin ? <LinkTabs items={ANNOUNCEMENT_TABS} current="announcements" label="ประกาศและอินโฟกราฟิก" className="mb-4" /> : null}
      <AnnouncementHub canManage={isAdmin || user?.role === 'commander'} />
    </EOCLayout>
  );
}
