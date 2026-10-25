/** @jest-environment node */
jest.mock("@/lib/rateLimit", () => ({ consumeRateLimit: jest.fn(async () => ({ allowed: true })) }));
import { DDPM_CCTV_STATIONS, cameraCodes, frameUrl, isKnownCamera, upstreamFrameUrl } from "@/lib/ddpmCctv";

const { GET } = require("@/app/api/public/cctv/frame/route");
const call = (cam) => GET(new Request(`http://localhost/stn-eoc/api/public/cctv/frame/?cam=${cam}`));
const jpeg = (bytes = 10) => ({ ok: true, status: 200, headers: new Headers({ "content-type": "image/jpeg" }), arrayBuffer: async () => new Uint8Array(bytes).buffer });

beforeEach(() => { globalThis.__stnCctvCache.clear(); global.fetch = jest.fn(); });

describe("กล้อง CCTV ปภ.", () => {
  test("รายชื่อ 10 สถานี สถานีละ 2 กล้อง อยู่ในจังหวัดสตูล", () => {
    expect(DDPM_CCTV_STATIONS).toHaveLength(10);
    expect(cameraCodes(DDPM_CCTV_STATIONS[3])).toEqual(["STN04-01", "STN04-02"]);
    for (const s of DDPM_CCTV_STATIONS) {
      expect(s.lat).toBeGreaterThan(6.4); expect(s.lat).toBeLessThan(7.2);
      expect(s.lng).toBeGreaterThan(99.6); expect(s.lng).toBeLessThan(100.3);
    }
    expect(isKnownCamera("STN06-01")).toBe(true);
    expect(isKnownCamera("STN99-01")).toBe(false);
    expect(upstreamFrameUrl("STN04-01", 5000)).toBe("https://cctv.disaster.go.th/api/webrtc/public-frame.jpeg?src=STN04-01&_=5");
    expect(frameUrl("STN04-01", 120000)).toBe("/stn-eoc/api/public/cctv/frame/?cam=STN04-01&t=2");
  });

  test("ไม่รับกล้องนอกรายการ (กันการใช้เป็นตัวดึงภาพที่อื่น)", async () => {
    const response = await call("https://evil.example/x.jpg");
    expect(response.status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("ดึงภาพจาก ปภ. แล้วแคช 1 นาที", async () => {
    global.fetch.mockResolvedValue(jpeg(42));
    const first = await call("STN04-01");
    expect(first.status).toBe(200);
    expect(first.headers.get("content-type")).toBe("image/jpeg");
    expect((await first.arrayBuffer()).byteLength).toBe(42);
    await call("STN04-01");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("กล้องดับและไม่มีภาพเดิม → 503", async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 503, headers: new Headers({ "content-type": "application/json" }), arrayBuffer: async () => new ArrayBuffer(0) });
    expect((await call("STN06-01")).status).toBe(503);
  });

  test("ต้นทางล่มแต่มีภาพเดิมไม่เกิน 15 นาที → ใช้ภาพเดิม", async () => {
    globalThis.__stnCctvCache.set("STN01-01", { at: Date.now() - 5 * 60 * 1000, body: Buffer.from([1, 2, 3]), type: "image/jpeg" });
    global.fetch.mockRejectedValue(new Error("timeout"));
    const response = await call("STN01-01");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-frame-stale")).toBe("1");
  });
});
