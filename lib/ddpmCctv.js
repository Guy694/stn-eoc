// กล้อง CCTV ริมคลองของ ปภ. ในจังหวัดสตูล (cctv.disaster.go.th) — รายชื่อและพิกัดตามแผนที่น้ำท่วมของ อบจ.สตูล (cdp.satunpao.go.th/flood)
// สถานีละ 2 กล้อง: {รหัส}-01 และ {รหัส}-02 · ภาพนิ่งล่าสุดดึงผ่าน /api/public/cctv/frame (แคช 1 นาที) ไม่ให้เบราว์เซอร์ผู้ใช้ยิงไปที่ ปภ. ตรง
export const DDPM_CCTV_ORIGIN = "https://cctv.disaster.go.th";
export const DDPM_CCTV_CREDIT = "กรมป้องกันและบรรเทาสาธารณภัย (ปภ.)";

export const DDPM_CCTV_STATIONS = [
  { code: "STN01", name: "คลองละงู สะพานร้อยเมตร", place: "ต.ปาล์มพัฒนา อ.มะนัง", lat: 6.994978, lng: 99.88628 },
  { code: "STN02", name: "สะพานข้ามคลองละงู ถนน 404", place: "ต.ละงู อ.ละงู", lat: 6.885812, lng: 99.80442 },
  { code: "STN03", name: "สะพานข้ามคลองละงู", place: "ต.ละงู อ.ละงู", lat: 6.875986, lng: 99.78246 },
  { code: "STN04", name: "ฝายคลองท่าแพ ดุสน", place: "ต.ควนโดน อ.ควนโดน", lat: 6.826281, lng: 100.0293 },
  { code: "STN05", name: "สะพานข้ามคลองท่าแพ หมู่ 3", place: "ต.ท่าแพ อ.ท่าแพ", lat: 6.802582, lng: 99.96393 },
  { code: "STN06", name: "สะพานข้ามคลองโทน", place: "ต.ทุ่งนุ้ย อ.ควนกาหลง", lat: 6.855665, lng: 100.1502 },
  { code: "STN07", name: "ฝายชลประทาน ดุสน", place: "ต.ควนโดน อ.ควนโดน", lat: 6.803597, lng: 100.0968 },
  { code: "STN08", name: "สะพานเคียน", place: "ต.ควนโดน อ.ควนโดน", lat: 6.793254, lng: 100.072697 },
  { code: "STN09", name: "สะพานข้ามคลองฉลุง (ใกล้โรงเรียน)", place: "ต.ฉลุง อ.เมืองสตูล", lat: 6.720299, lng: 100.063904 },
  { code: "STN10", name: "สะพานข้ามคลองตาลีไกล", place: "ต.พิมาน อ.เมืองสตูล", lat: 6.632142, lng: 100.060978 }
];

export const cameraCodes = (station) => [`${station.code}-01`, `${station.code}-02`];

const KNOWN = new Set(DDPM_CCTV_STATIONS.flatMap(cameraCodes));
/** รับเฉพาะกล้องในรายการ (กันการใช้ตัวดึงภาพของเราไปดึงกล้องอื่น/ที่อื่น) */
export const isKnownCamera = (cam) => KNOWN.has(String(cam || ""));

/** ภาพนิ่งล่าสุดจาก ปภ. (ฝั่งเซิร์ฟเวอร์) */
export function upstreamFrameUrl(cam, now = Date.now()) {
  return `${DDPM_CCTV_ORIGIN}/api/webrtc/public-frame.jpeg?src=${encodeURIComponent(cam)}&_=${Math.floor(now / 1000)}`;
}

/** ภาพผ่านเซิร์ฟเวอร์ของเรา — bust เปลี่ยนทุก 1 นาที ให้เบราว์เซอร์ได้ภาพใหม่ */
export function frameUrl(cam, now = Date.now()) {
  return `/stn-eoc/api/public/cctv/frame/?cam=${encodeURIComponent(cam)}&t=${Math.floor(now / 60000)}`;
}
