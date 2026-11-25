"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import EventHistoryList from "@/components/admin/event-history/EventHistoryList";
import LinkTabs, { EOC_ADMIN_TABS } from "@/components/common/LinkTabs";

export default function EOCSessionsPage() {
  return (
    <EOCLayout>
      <LinkTabs items={EOC_ADMIN_TABS} current="history" label="เหตุการณ์ EOC" className="mb-4" />
      <EventHistoryList />
    </EOCLayout>
  );
}
