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
  expect(visitorLogRetentionDays({})).toBe(90);
  expect(visitorLogRetentionDays({ VISITOR_LOG_RETENTION_DAYS: "3" })).toBe(90);
  expect(visitorLogRetentionDays({ VISITOR_LOG_RETENTION_DAYS: "180" })).toBe(180);
});
