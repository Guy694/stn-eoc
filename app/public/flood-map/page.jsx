"use client";

import { PublicDisasterMapContent } from "../disaster-map/page";

export default function PublicFloodMapPage() {
  return <PublicDisasterMapContent initialDisasterType="flood" lockDisasterType />;
}
