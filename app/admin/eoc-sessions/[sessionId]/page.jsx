"use client";

import { useParams } from "next/navigation";
import EOCLayout from "@/components/layouts/EOCLayout";
import EventHistoryDetail from "@/components/admin/event-history/EventHistoryDetail";

export default function EOCSessionHistoryPage() {
  const { sessionId } = useParams();
  return (
    <EOCLayout>
      <EventHistoryDetail sessionId={sessionId} />
    </EOCLayout>
  );
}
