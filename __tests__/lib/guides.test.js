import fs from "fs";
import path from "path";
import { GUIDES, filterSections, sectionText } from "@/lib/guides";

const ROOT = process.env.STN_ROOT || process.cwd();
const pageExists = (href) => {
  const clean = href.split(/[?#]/)[0].replace(/\/$/, "");
  return ["page.jsx", "page.js"].some((file) => fs.existsSync(path.join(ROOT, "app", clean, file)));
};

describe("guides", () => {
  test("three guides with unique section ids", () => {
    expect(Object.keys(GUIDES)).toEqual(["citizen", "officer", "admin"]);
    for (const guide of Object.values(GUIDES)) {
      const ids = guide.sections.map((section) => section.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const section of guide.sections) {
        expect(section.blocks.length).toBeGreaterThan(0);
        for (const block of section.blocks) {
          expect(["steps", "list", "note", "warn", "faq", "table"]).toContain(block.kind);
          if (block.kind === "steps" || block.kind === "list") expect(block.items.length).toBeGreaterThan(0);
          if (block.kind === "table") for (const row of block.rows) expect(row).toHaveLength(block.head.length);
        }
      }
    }
  });

  test("every section link points to an existing page", () => {
    const missing = [];
    for (const guide of Object.values(GUIDES)) {
      for (const section of guide.sections) if (section.href && !pageExists(section.href)) missing.push(`${guide.key}:${section.href}`);
    }
    expect(missing).toEqual([]);
  });

  test("citizen guide keeps the FAQ anchor used by the old FAQ link", () => {
    expect(GUIDES.citizen.sections.some((section) => section.id === "faq")).toBe(true);
  });

  test("search filters by every word", () => {
    const sections = GUIDES.officer.sections;
    expect(filterSections(sections, "").length).toBe(sections.length);
    const hits = filterSections(sections, "ออกซิเจน");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((section) => sectionText(section).includes("ออกซิเจน"))).toBe(true);
    expect(filterSections(sections, "ไม่มีคำนี้แน่นอน xyz")).toEqual([]);
  });
});
