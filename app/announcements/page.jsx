'use client';

import EOCLayout from '@/components/layouts/EOCLayout';
import AnnouncementHub from '@/components/announcements/AnnouncementHub';
import { useAuth } from '@/context/AuthContext';

export default function AnnouncementsPage() {
  const { user } = useAuth();
  return <EOCLayout><AnnouncementHub canManage={user?.role === 'admin' || user?.role === 'commander'} /></EOCLayout>;
}
