import { diffItems, normalizeItems, numberItems, versionOf } from "@/lib/dailyDirectives";

describe("dailyDirectives", () => {
  it("cleans items, drops blanks and fixes indentation jumps", () => {
    const result = normalizeItems([
      { content: "  ฝนตกหนัก อ.ละงู  ", level: 1 },
      { content: "   " },
      { content: "ให้ทีม MCATT ลงพื้นที่", level: 2, status: "done" },
      { content: "ติดตามระดับน้ำ", level: 1, id: "7" }
    ]);
    expect(result.ok).toBe(true);
    expect(result.items).toEqual([
      { id: null, content: "ฝนตกหนัก อ.ละงู", level: 0, status: "open", order: 0 },
      { id: null, content: "ให้ทีม MCATT ลงพื้นที่", level: 1, status: "done", order: 1 },
      { id: 7, content: "ติดตามระดับน้ำ", level: 1, status: "open", order: 2 }
    ]);
  });

  it("rejects bad payloads", () => {
    expect(normalizeItems("x").ok).toBe(false);
    expect(normalizeItems([{ content: "ก".repeat(2001) }]).error).toContain("ข้อที่ 1");
    expect(normalizeItems(Array.from({ length: 201 }, () => ({ content: "a" }))).ok).toBe(false);
  });

  it("diffs against stored rows", () => {
    const existing = [
      { id: 1, content: "เดิม", item_level: 0, item_order: 0, item_status: "open" },
      { id: 2, content: "ลบ", item_level: 0, item_order: 1, item_status: "open" },
      { id: 3, content: "ไม่เปลี่ยน", item_level: 0, item_order: 1, item_status: "open" }
    ];
    const { items } = normalizeItems([{ id: 1, content: "แก้แล้ว", status: "done" }, { id: 3, content: "ไม่เปลี่ยน" }, { content: "ใหม่" }]);
    const diff = diffItems(existing, items);
    expect(diff.inserts.map((item) => item.content)).toEqual(["ใหม่"]);
    expect(diff.updates).toHaveLength(1);
    expect(diff.updates[0]).toMatchObject({ id: 1, statusChanged: true });
    expect(diff.deletes).toEqual([2]);
  });

  it("numbers nested items", () => {
    expect(numberItems([{ level: 0 }, { level: 1 }, { level: 1 }, { level: 2 }, { level: 0 }, { level: 1 }]))
      .toEqual(["1", "1.1", "1.2", "1.2.1", "2", "2.1"]);
  });

  it("builds a version string", () => {
    expect(versionOf([])).toBe("empty");
    expect(versionOf([{ id: 1, updated_at: "2026-10-06T07:00:00Z" }])).toBe(`1-${Date.parse("2026-10-06T07:00:00Z")}-1`);
  });
});
