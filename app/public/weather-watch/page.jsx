import WeatherWatchWorkspace from "@/components/weather/WeatherWatchWorkspace";

export const metadata = {
  title: "พยากรณ์และความเสี่ยง | Satun Geo-EOC",
  description: "พยากรณ์ฝน 7 วันและความเสี่ยงฝนตกหนัก น้ำท่วม ดินถล่ม และคลื่นลมทะเลรายอำเภอของจังหวัดสตูล พร้อมแผนที่พยากรณ์อากาศจาก Windy"
};

export default function WeatherWatchPage() {
  return <WeatherWatchWorkspace />;
}
