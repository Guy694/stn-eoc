// ชั้นข้อมูลสภาพอากาศ (ใช้ในหน้าสภาพอากาศ /public/weather-watch และเรดาร์ฝนในแผนที่สถานการณ์)
//
// 1) Windy embed widget (https://embed.windy.com) — ใช้ได้ฟรีโดยไม่ต้องมี API key
//    แสดงเป็น iframe เต็มพื้นที่แผนที่ จึงซ้อนกับชั้นข้อมูล EOC ไม่ได้
//    (Windy Map Forecast API ที่ซ้อนข้อมูลเองได้ ต้องใช้ key แบบเสียเงินสำหรับ production
//     และบังคับใช้ Leaflet 1.4 ซึ่งชนกับ Leaflet 1.9 ของระบบ)
// 2) เรดาร์ฝน RainViewer — ซ้อนบนแผนที่ EOC ได้ (tile ฟรี, ความละเอียดสูงสุด zoom 7)

export const SATUN_CENTER = { lat: 6.6238, lon: 100.0673 };

export const WINDY_OVERLAYS = [
  { key: "wind", label: "ลม", icon: "Wind", tone: "from-sky-400 to-emerald-400" },
  { key: "gust", label: "ลมกระโชก", icon: "Tornado", tone: "from-teal-400 to-lime-400" },
  { key: "rain", label: "ฝน, ฟ้าผ่า", icon: "CloudRain", tone: "from-blue-500 to-cyan-400" },
  { key: "rainAccu", label: "ปริมาณฝนสะสม", icon: "Umbrella", tone: "from-indigo-500 to-sky-400" },
  { key: "thunder", label: "พายุฝนฟ้าคะนอง", icon: "CloudLightning", tone: "from-yellow-400 to-orange-500" },
  { key: "temp", label: "อุณหภูมิ", icon: "Thermometer", tone: "from-orange-400 to-red-500" },
  { key: "clouds", label: "เมฆ", icon: "Cloud", tone: "from-slate-300 to-slate-500" },
  { key: "rh", label: "ความชื้น", icon: "Droplets", tone: "from-cyan-400 to-blue-600" },
  { key: "pressure", label: "ความกดอากาศ", icon: "Gauge", tone: "from-violet-400 to-fuchsia-500" },
  { key: "waves", label: "คลื่น", icon: "Waves", tone: "from-blue-600 to-violet-500" }
];

export const WINDY_PRODUCTS = [
  { key: "ecmwf", label: "ECMWF" },
  { key: "gfs", label: "GFS" },
  { key: "icon", label: "ICON" }
];

export function buildWindyEmbedUrl({
  overlay = "wind",
  product = "ecmwf",
  lat = SATUN_CENTER.lat,
  lon = SATUN_CENTER.lon,
  zoom = 9
} = {}) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    detailLat: String(SATUN_CENTER.lat),
    detailLon: String(SATUN_CENTER.lon),
    zoom: String(zoom),
    level: "surface",
    overlay,
    product,
    menu: "",
    message: "true",
    marker: "",
    calendar: "now",
    pressure: "",
    type: "map",
    location: "coordinates",
    detail: "",
    metricWind: "km/h",
    metricTemp: "°C",
    radarRange: "-1"
  });
  return `https://embed.windy.com/embed2.html?${params.toString()}`;
}

export function buildWindyWebsiteUrl({ overlay = "wind", lat = SATUN_CENTER.lat, lon = SATUN_CENTER.lon, zoom = 9 } = {}) {
  return `https://www.windy.com/?${overlay},${lat},${lon},${zoom}`;
}

const RAINVIEWER_INDEX_URL = "https://api.rainviewer.com/public/weather-maps.json";

/** คืน tile layer ของเรดาร์ฝนล่าสุด หรือ null ถ้าเรียก RainViewer ไม่ได้ */
export async function fetchLatestRadarLayer(signal) {
  const response = await fetch(RAINVIEWER_INDEX_URL, { signal, cache: "no-store" });
  if (!response.ok) return null;
  const data = await response.json();
  const frames = data?.radar?.past || [];
  const latest = frames[frames.length - 1];
  if (!data?.host || !latest?.path) return null;
  return {
    key: "rainviewer-radar",
    url: `${data.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`,
    attribution: '<a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">RainViewer</a>',
    opacity: 0.7,
    maxNativeZoom: 7,
    zIndex: 320,
    time: latest.time ? new Date(latest.time * 1000) : null
  };
}
