import fs from "node:fs";
import path from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
import CurrentWarnings, { sortWarnings } from "@/components/public/announcements/CurrentWarnings";

const make = (n) => Array.from({ length: n }, (_, i) => ({ issued_at: `2026-10-24 ${String(10 + (i % 10)).padStart(2, "0")}:00:00`, level: i === 3 ? "high" : "watch", message: `[ทดสอบ] ประกาศเตือน ${i + 1}`, source: "ThaiWater (สสน.)" }));

describe("ประกาศเตือนขณะนี้ (หน้าประกาศและความรู้)", () => {
  test("เรียงระดับรุนแรงก่อน แล้วใหม่ก่อน", () => {
    expect(sortWarnings(make(3).concat([{ issued_at: "2026-10-24 09:00:00", level: "high", message: "x" }])).map((w) => w.message)).toEqual(["x", "[ทดสอบ] ประกาศเตือน 3", "[ทดสอบ] ประกาศเตือน 2", "[ทดสอบ] ประกาศเตือน 1"]);
  });

  test("แสดงทุกรายการในกล่องเลื่อน และจัดชิดมุมหัวหน้าเมื่อใช้ inHero", () => {
    const { container } = render(<CurrentWarnings warnings={make(8)} inHero />);
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getByRole("list", { name: /เลื่อนเพื่อดูทั้งหมด/ })).toBeInTheDocument();
    expect(container.querySelector("section")).not.toHaveClass("mb-8");
  });

  test("ไม่มีประกาศเตือน ไม่แสดงกล่อง", () => {
    const { container } = render(<CurrentWarnings warnings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("แถบแดงหน้าแรกพาไปที่รายการในหน้าประกาศ", () => {
    const src = fs.readFileSync(path.join(process.env.STN_ROOT || process.cwd(), "components/public/home/WarningRibbon.jsx"), "utf8");
    expect(src).toMatch(/href="\/public\/announcements#current-warnings"/);
  });
});
