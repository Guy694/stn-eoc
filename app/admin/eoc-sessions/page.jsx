"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import EventHistoryList from "@/components/admin/event-history/EventHistoryList";

export default function EOCSessionsPage() {
  return (
    <EOCLayout>
      <EventHistoryList />
    </EOCLayout>
  );
}
