// ติดตั้งเว็บเป็นแอปบนมือถือ (PWA) — Next.js เสิร์ฟที่ /stn-eoc/manifest.webmanifest
export default function manifest() {
  return {
    id: "/stn-eoc/",
    name: "Satun Geo-EOC ศูนย์ปฏิบัติการภาวะฉุกเฉิน จ.สตูล",
    short_name: "สตูล EOC",
    description: "เตือนภัย สถานการณ์น้ำท่วม ศูนย์พักพิง และขอความช่วยเหลือ จังหวัดสตูล",
    lang: "th",
    dir: "ltr",
    start_url: "/stn-eoc/?source=pwa",
    scope: "/stn-eoc/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0b4c86",
    categories: ["government", "health", "weather"],
    icons: [
      { src: "/stn-eoc/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/stn-eoc/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/stn-eoc/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ],
    shortcuts: [
      { name: "ขอความช่วยเหลือ", url: "/stn-eoc/public/help/?source=pwa", icons: [{ src: "/stn-eoc/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "บ้านฉันเสี่ยงไหม", url: "/stn-eoc/public/my-risk/?source=pwa", icons: [{ src: "/stn-eoc/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "ศูนย์พักพิง", url: "/stn-eoc/public/shelters/?source=pwa", icons: [{ src: "/stn-eoc/pwa/icon-192.png", sizes: "192x192" }] }
    ]
  };
}
