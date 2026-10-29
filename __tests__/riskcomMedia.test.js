/** @jest-environment node */
import { buildRiskcomUrl, mergeAnnouncementSources, normalizeRiskcomItem, parseRecommended, riskcomHeaders, riskcomTopic } from "@/lib/riskcomMedia";
import { GET } from "@/app/api/public/riskcom-media/route";

const SAMPLE = {
  id: "0cad72c7-b081-4a01-a536-7a9b599ee45d",
  title: "[ทดสอบ] 4 กลุ่มเสี่ยงอาการรุนแรง จากไข้เลือดออก",
  description: "[ทดสอบ] กำจัดแหล่งเพาะพันธุ์ยุงลาย",
  phase: "during",
  category: "โรคไข้เลือดออก",
  eventDate: "2026-08-05T17:00:00.000Z",
  location: "จังหวัดสตูล",
  keywords: ["#ไข้เลือดออก #กำจัดยุงลาย"],
  altText: "หยุดยุง",
  thumbnailUrl: "https://drive.google.com/thumbnail?id=abc&sz=w1600",
  downloadUrl: "https://drive.google.com/uc?export=download&id=abc",
  fileName: "3.png",
  fileType: "image/png",
  createdAt: "2026-08-05T07:24:36.284Z"
};

describe("riskcom media", () => {
  test("normalize แปลงเป็นรูปประกาศพร้อมที่มา", () => {
    const item = normalizeRiskcomItem(SAMPLE);
    expect(item).toMatchObject({
      id: `riskcom-${SAMPLE.id}`,
      source: "riskcom",
      href: `/public/announcements/riskcom/${SAMPLE.id}`,
      eoc_type: "disease",
      phase_label: "ระหว่างเกิดเหตุ",
      image_url: SAMPLE.thumbnailUrl,
      keywords: ["ไข้เลือดออก", "กำจัดยุงลาย"],
      credit: "สำนักงานสาธารณสุขจังหวัดสตูล"
    });
  });

  test("ไม่รับ URL ที่ไม่ใช่ https และ id แปลก", () => {
    const item = normalizeRiskcomItem({ ...SAMPLE, id: "../x<y>", thumbnailUrl: "javascript:alert(1)" });
    expect(item.riskcom_id).toBe("xy");
    expect(item.image_url).toBeNull();
    expect(normalizeRiskcomItem({ title: "no id" })).toBeNull();
  });

  test("หมวดจากคำ", () => {
    expect(riskcomTopic({ category: "น้ำท่วม" })).toBe("flood");
    expect(riskcomTopic({ category: "อื่น ๆ" })).toBe("general");
  });

  test("buildRiskcomUrl จำกัดพารามิเตอร์", () => {
    const url = new URL(buildRiskcomUrl({ limit: "999", phase: "bad", q: "ไข้" }));
    expect(url.searchParams.get("limit")).toBe("100");
    expect(url.searchParams.get("phase")).toBeNull();
    expect(url.searchParams.get("q")).toBe("ไข้");
    expect(buildRiskcomUrl({ id: "a/b" })).toMatch(/\/media\/ab$/);
  });

  test("merge: ประกาศที่กำลังเผยแพร่ก่อน แล้วสื่อ; ดึงไม่ได้ใช้ของเดิม", () => {
    const internal = [{ id: 1, display_status: "current" }, { id: 2, display_status: "past" }];
    const rc = [normalizeRiskcomItem(SAMPLE)];
    expect(mergeAnnouncementSources(internal, rc).map((i) => i.id)).toEqual([1, rc[0].id]);
    expect(mergeAnnouncementSources(internal, null)).toBe(internal);
  });

  test("route คืนรายการ และ 502 เมื่อดึงไม่ได้", async () => {
    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [SAMPLE], pagination: { total: 1 } }) });
    let res = await GET(new Request("http://x/api/public/riskcom-media?limit=5"));
    let json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data[0].source).toBe("riskcom");
    expect(global.fetch.mock.calls[0][0]).toContain("limit=5");

    global.fetch = jest.fn().mockRejectedValue(new Error("down"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    res = await GET(new Request("http://x/api/public/riskcom-media"));
    expect(res.status).toBe(502);
    global.fetch = original;
  });
});

describe("riskcom API v1.1", () => {
  test("แปลง categories / tags / images รูปแบบใหม่", () => {
    const item = normalizeRiskcomItem({
      id: "a1", title: "[ทดสอบ] สื่อ", phase: "before", categories: ["น้ำท่วม", "ทั่วไป"],
      tags: [{ name: "#น้ำท่วม", color: "#000", backgroundColor: "#fff" }, { name: "ปลอดภัย" }],
      thumbnailUrl: "https://x.test/t.jpg", downloadUrl: "https://x.test/d.jpg", fileType: "image/jpeg",
      images: [{ id: "i1", downloadUrl: "https://x.test/1.jpg" }, { id: "i2", downloadUrl: "http://x.test/bad.jpg" }],
      imageCount: 2, viewCount: 7, isRecommended: true
    });
    expect(item.category).toBe("น้ำท่วม");
    expect(item.categories).toEqual(["น้ำท่วม", "ทั่วไป"]);
    expect(item.keywords).toEqual(["น้ำท่วม", "ปลอดภัย"]);
    expect(item.eoc_type).toBe("flood");
    expect(item.images).toEqual([{ id: "i1", url: "https://x.test/1.jpg" }]);
    expect(item.view_count).toBe(7);
    expect(item.is_recommended).toBe(true);
  });

  test("ส่ง X-API-Key เฉพาะเมื่อตั้ง RISKCOM_API_KEY", () => {
    expect(riskcomHeaders({})).toEqual({ Accept: "application/json" });
    expect(riskcomHeaders({ RISKCOM_API_KEY: "  k  " })["X-API-Key"]).toBe("k");
  });

  test("สื่อแนะนำ: รับได้ทั้ง data เป็นอาร์เรย์ และ data.media พร้อมสถานการณ์ เรียงตามอันดับ", () => {
    const a = { id: "a", title: "A", recommendationRank: 2 };
    const b = { id: "b", title: "B", recommendationRank: 1 };
    expect(parseRecommended({ data: [a, b] }).items.map((i) => i.riskcom_id)).toEqual(["b", "a"]);
    const r = parseRecommended({ data: { situation: { label: "น้ำท่วมขัง", phase: "during" }, media: [a] } });
    expect(r.items).toHaveLength(1);
    expect(r.situation).toEqual({ label: "น้ำท่วมขัง", phase: "during", phase_label: "ระหว่างเกิดเหตุ" });
    expect(parseRecommended({}).items).toEqual([]);
    expect(parseRecommended(null).situation).toBeNull();
    expect(buildRiskcomUrl({ view: "recommended", id: "x" })).toMatch(/\/media\/recommended$/);
  });
});
