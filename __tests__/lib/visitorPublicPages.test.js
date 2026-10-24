import { publicPageKey, publicPageLabel, summarizePublicPages } from "@/lib/visitorLog";

describe("หน้าที่ประชาชนเข้าชม", () => {
  test("รวมหน้ารายเรื่องและตัด / ท้าย", () => {
    expect(publicPageKey("/")).toBe("/");
    expect(publicPageKey("/public/my-risk/")).toBe("/public/my-risk");
    expect(publicPageKey("/public/announcements/123/")).toBe("/public/announcements/[id]");
    expect(publicPageKey("/public/announcements/riskcom/45")).toBe("/public/announcements/riskcom/[id]");
    expect(publicPageLabel("/public/my-risk")).toBe("บ้านฉันเสี่ยงไหม");
    expect(publicPageLabel("/public/unknown")).toBeNull();
  });

  test("รวมยอด เรียงมากไปน้อย และคิด %", () => {
    const pages = summarizePublicPages([
      { path: "/", visits: 50, ips: 30 },
      { path: "/public/announcements/1/", visits: 20, ips: 10 },
      { path: "/public/announcements/2/", visits: 10, ips: 8 },
      { path: "/public/my-risk/", visits: 20, ips: 15 }
    ]);
    expect(pages.map((page) => page.key)).toEqual(["/", "/public/announcements/[id]", "/public/my-risk"]);
    expect(pages[1]).toMatchObject({ visits: 30, ips: 18, paths: 2, share: 30, label: "ประกาศ (อ่านรายเรื่อง)" });
    expect(summarizePublicPages([])).toEqual([]);
  });
});
