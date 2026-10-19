import { render, screen } from "@testing-library/react";
import { StatStrip } from "@/components/admin/crud";
import { balancedColumns, toneFromClass } from "@/components/common/MetricCards";

test("จัดคอลัมน์ให้แถวเต็มเท่า ๆ กัน", () => {
  expect([4, 5, 6, 7, 8, 9, 10, 12].map(balancedColumns)).toEqual([4, 5, 6, 4, 4, 5, 5, 6]);
});

test("สีจาก className/สีพื้นแบบเดิม", () => {
  expect(toneFromClass("bg-red-100 text-red-700")).toBe("red");
  expect(toneFromClass("bg-[#dbeaf7] text-[#0b4c86]")).toBe("blue");
  expect(toneFromClass("bg-yellow-100")).toBe("amber");
  expect(toneFromClass(undefined)).toBe("slate");
});

test("กลุ่มการ์ด 4 ใบขนาดปกติ · 5 ใบขึ้นไปขนาดเล็กอัตโนมัติ", () => {
  const { container, rerender } = render(<StatStrip items={[1, 2, 3, 4].map((i) => ({ label: `[ทดสอบ] ${i}`, value: i }))} />);
  expect(container.querySelector(".text-2xl")).toBeTruthy();
  rerender(<StatStrip items={[1, 2, 3, 4, 5, 6].map((i) => ({ label: `[ทดสอบ] ${i}`, value: i }))} />);
  expect(container.querySelector(".text-2xl")).toBeNull();
  expect(container.querySelector(".text-lg")).toBeTruthy();
  expect(screen.getAllByRole("listitem")).toHaveLength(6);
});
