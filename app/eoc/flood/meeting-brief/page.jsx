"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import MeetingBriefView from "@/components/eoc/brief/MeetingBriefView";

export default function FloodMeetingBriefPage() {
  return (
    <EOCLayout>
      <MeetingBriefView eocType="flood" />
    </EOCLayout>
  );
}
