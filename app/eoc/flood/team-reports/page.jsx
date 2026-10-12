"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import TeamReportsWorkspace from "@/components/eoc/team-reports/TeamReportsWorkspace";

export default function FloodTeamReportsPage() {
  return (
    <EOCLayout>
      <TeamReportsWorkspace eocType="flood" />
    </EOCLayout>
  );
}
