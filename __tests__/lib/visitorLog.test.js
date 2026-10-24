import { areaOf, classifyIp, cleanPath, describeUserAgent, geoFromHeaders, geoLookupUrl, locationLabel, parseGeoLookup, referrerHost, visitorLogRetentionDays } from "@/lib/visitorLog";

test("แยก IP ภายใน/ภายนอก", () => {
  expect(classifyIp("10.1.2.3")).toBe("private");
  expect(classifyIp("172.20.0.5")).toBe("private");
  expect(classifyIp("172.40.0.5")).toBe("public");
  expect(classifyIp("192.168.1.10")).toBe("private");
  expect(classifyIp("49.228.1.1")).toBe("public");
  expect(classifyIp("unknown")).toBe("unknown");
});

test("path ตัด query (อาจมีเลขติดตาม) และ basePath ออก", () => {
  expect(cleanPath("/stn-eoc/public/track?code=ABC123")).toBe("/public/track");
  expect(cleanPath("https://evil.example/x")).toBeNull();
  expect(cleanPath("/<script>")).toBeNull();
  expect(areaOf("/admin/officers")).toBe("staff");
  expect(areaOf("/eoc/flood/overview")).toBe("staff");
  expect(areaOf("/public/my-risk")).toBe("public");
  expect(referrerHost("https://www.facebook.com/x", "eoc.go.th")).toBe("www.facebook.com");
  expect(referrerHost("https://eoc.go.th/a", "eoc.go.th")).toBeNull();
});

test("ตำแหน่งจาก header ของ CDN และจากบริการค้นหา", () => {
  const headers = new Headers({ "cf-ipcountry": "TH", "cf-ipcity": "Satun", "cf-iplatitude": "6.62", "cf-iplongitude": "100.07" });
  expect(geoFromHeaders(headers)).toMatchObject({ country: "TH", city: "Satun", latitude: 6.62, longitude: 100.07, source: "headers" });
  expect(geoFromHeaders(new Headers({ "cf-ipcountry": "XX" }))).toBeNull();
  expect(parseGeoLookup({ success: true, country_code: "TH", region: "Satun", city: "Mueang Satun", latitude: 6.6, longitude: 100.1 })).toMatchObject({ country: "TH", city: "Mueang Satun" });
  expect(parseGeoLookup({ status: "fail" })).toBeNull();
  expect(geoLookupUrl("49.228.1.1", { VISITOR_GEO_LOOKUP_URL: "https://ipwho.is/{ip}" })).toBe("https://ipwho.is/49.228.1.1");
  expect(geoLookupUrl("10.0.0.1", { VISITOR_GEO_LOOKUP_URL: "https://ipwho.is/{ip}" })).toBeNull();
  expect(geoLookupUrl("49.228.1.1", {})).toBeNull();
  expect(locationLabel({ network: "private" })).toBe("เครือข่ายภายใน");
  expect(locationLabel({ city: "Satun", country: "TH" })).toBe("Satun, ไทย");
});

test("อุปกรณ์/เบราว์เซอร์ และระยะเก็บ", () => {
  expect(describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile Safari")).toEqual({ device: "mobile", browser: "Safari" });
  expect(describeUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari")).toEqual({ device: "desktop", browser: "Chrome" });
  expect(visitorLogRetentionDays({})).toBe(365);
  expect(visitorLogRetentionDays({ VISITOR_LOG_RETENTION_DAYS: "3" })).toBe(365);
  expect(visitorLogRetentionDays({ VISITOR_LOG_RETENTION_DAYS: "180" })).toBe(180);
});

import { gpsMismatch, gpsPlaceLabel, normalizeGps } from "@/lib/visitorLog";

test("GPS ปัดเหลือ ≈ 1 กม. และตรวจค่า", () => {
  expect(normalizeGps({ lat: 6.623456, lon: 100.067891, accuracy: 25.4, context: "my-risk" })).toEqual({ latitude: 6.62, longitude: 100.07, accuracy: 25, context: "my-risk" });
  expect(normalizeGps({ lat: 6.6, lng: 100.1, context: "แปลก" }).context).toBe("staff-consent");
  expect(normalizeGps({ lat: 200, lon: 1 })).toBeNull();
  expect(normalizeGps({ lat: 0, lon: 0 })).toBeNull();
  expect(normalizeGps(null)).toBeNull();
});

test("ป้ายตำแหน่งจาก GPS และเตือนเมื่อไม่สอดคล้องกับ IP", () => {
  expect(gpsPlaceLabel({ gps_latitude: 6.85, gps_longitude: 99.78 })).toBe("ใกล้ อ.ละงู จ.สตูล");
  expect(gpsPlaceLabel({ gps_latitude: 13.75, gps_longitude: 100.5 })).toBe("นอกจังหวัดสตูล");
  expect(gpsPlaceLabel({ gps_latitude: null })).toBeNull();
  expect(gpsMismatch({ gps_latitude: 6.62, gps_longitude: 100.07, country: "TH", latitude: 13.75, longitude: 100.5 })).toBeNull(); // เน็ตมือถือขึ้นกรุงเทพฯ ไม่ถือว่าผิดปกติ
  expect(gpsMismatch({ gps_latitude: 6.62, gps_longitude: 100.07, country: "US", latitude: 37.4, longitude: -122.1 }).reason).toBe("country");
  expect(gpsMismatch({ gps_latitude: 6.62, gps_longitude: 100.07, country: "TH", latitude: 18.79, longitude: 98.98 })).toBeNull();
  expect(gpsMismatch({ gps_latitude: 35.68, gps_longitude: 139.69, country: "TH" }).reason).toBe("country");
  expect(gpsMismatch({ gps_latitude: 6.62, gps_longitude: 100.07, latitude: 51.5, longitude: -0.12 }).reason).toBe("distance");
});

import { describeIpChain } from "@/lib/clientIp";

test("ตรวจการรับ IP: บอกว่าตั้ง TRUST_PROXY เท่าไรจะได้ IP ไหน", () => {
  const request = { headers: new Headers({ "x-forwarded-for": "49.228.1.1, 203.0.113.58", "x-real-ip": "203.0.113.58" }) };
  const result = describeIpChain(request, { TRUST_PROXY: "1" });
  expect(result.chosen).toBe("203.0.113.58");
  expect(result.options).toEqual([{ trustProxy: 1, ip: "203.0.113.58" }, { trustProxy: 2, ip: "49.228.1.1" }]);
  expect(describeIpChain(request, { TRUST_PROXY: "2" }).chosen).toBe("49.228.1.1");
});
