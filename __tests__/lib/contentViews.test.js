import fs from "node:fs";
import path from "node:path";
import { contentHref, summarizeContentViews, validateContentView } from "@/lib/contentViews";

const ROOT = process.env.STN_ROOT || process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

describe("ยอดเข้าชมประกาศและความรู้", () => {
  test("ตรวจรหัสตามประเภท", () => {
    expect(validateContentView({ kind: "riskcom", id: "riskcom-abc_12", title: " ชื่อ\nสื่อ " }).value).toEqual({ kind: "riskcom", id: "abc_12", title: "ชื่อ สื่อ" });
    expect(validateContentView({ kind: "infographic", id: 42 }).value).toEqual({ kind: "infographic", id: "42", title: null });
    expect(validateContentView({ kind: "infographic", id: "4x" }).error).toBe("id");
    expect(validateContentView({ kind: "riskcom", id: "../x" }).error).toBe("id");
    expect(validateContentView({ kind: "video", id: 1 }).error).toBe("kind");
  });

  test("สรุปยอด เรียงมากไปน้อย แยกประเภท", () => {
    const result = summarizeContentViews([
      { kind: "riskcom", item_id: "a", views: 3, title: "สื่อ ก" },
      { kind: "announcement", item_id: 7, views: 9, title: "ประกาศ", total_views: 120 },
      { kind: "infographic", item_id: 5, views: "4", title: null },
      { kind: "announcement", item_id: 8, views: 0, title: "เก่า", total_views: 30 }
    ]);
    expect(result.total).toBe(16);
    expect(result.items.map((item) => item.id)).toEqual(["7", "5", "a", "8"]);
    expect(result.items[1].title).toBe("อินโฟกราฟิก #5");
    expect(result.by_kind.announcement).toEqual({ views: 9, items: 2 });
    expect(result.items[0].total_views).toBe(120);
    expect(result.items[2].total_views).toBeNull();
  });

  test("ลิงก์ไปยังเนื้อหา", () => {
    expect(contentHref("announcement", 7)).toBe("/public/announcements/7");
    expect(contentHref("riskcom", "a")).toBe("/public/announcements/riskcom/a");
  });

  test("หน้าเว็บส่งสัญญาณเมื่อเปิดสื่อ riskcom และอินโฟกราฟิก", () => {
    expect(read("app/public/announcements/riskcom/[id]/page.jsx")).toMatch(/reportContentView\('riskcom'/);
    expect(read("components/public/announcements/PublicAnnouncementList.jsx")).toMatch(/reportContentView\("infographic"/);
    expect(read("app/api/public/announcements/route.js")).toMatch(/recordContentView\(\{ kind: 'announcement'/);
    expect(JSON.parse(read("migrations/manifest.json")).migrations).toContain("20261024_content_views.sql");
  });
});
