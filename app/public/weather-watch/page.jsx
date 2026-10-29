import WeatherWatchWorkspace from "@/components/weather/WeatherWatchWorkspace";

export const metadata = {
  title: "แผนที่สถานการณ์และความเสี่ยง | ศูนย์ข้อมูลสถานการณ์ฉุกเฉิน จังหวัดสตูล",
  description: "แผนที่สถานการณ์และความเสี่ยงของจังหวัดสตูล: ระดับน้ำ–ตลิ่ง ฝนวัดจริง สถานพยาบาล เส้นทาง/ถนน คลอง ความเสี่ยงน้ำท่วม ดินถล่ม คลื่นลมรายอำเภอ พยากรณ์ฝน 7 วัน และแผนที่ Windy"
};

export default function WeatherWatchPage() {
  return <WeatherWatchWorkspace />;
}
