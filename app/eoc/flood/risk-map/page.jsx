"use client";

import EOCLayout from "@/components/layouts/EOCLayout";
import WeatherWatchWorkspace from "@/components/weather/WeatherWatchWorkspace";

// แผนที่สถานการณ์และความเสี่ยง (ชุดเดียวกับหน้าประชาชน) ในเมนูเหตุการณ์อุทกภัยของเจ้าหน้าที่
export default function FloodRiskMapPage() {
  return (
    <EOCLayout>
      <WeatherWatchWorkspace embedded />
    </EOCLayout>
  );
}
