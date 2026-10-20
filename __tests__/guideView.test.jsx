/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import GuideView from "@/components/guide/GuideView";
import { officerGuide } from "@/lib/guides";

jest.mock("next/link", () => ({ __esModule: true, default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));

beforeAll(() => {
  global.IntersectionObserver = class { observe() {} disconnect() {} };
  Element.prototype.scrollIntoView = jest.fn();
});

test("ค้นหาแล้วกรองหัวข้อ ไฮไลต์คำ บอกจำนวน และล้างได้", () => {
  render(<GuideView guide={officerGuide} current="officer" />);
  const total = officerGuide.sections.length;
  expect(screen.getByText(`${total} หัวข้อ`)).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText(/ค้นหาในคู่มือ/), { target: { value: "Telegram" } });
  expect(screen.getByText(/^พบ \d+ จาก \d+ หัวข้อ$/)).toBeTruthy();
  expect(document.querySelectorAll("mark").length).toBeGreaterThan(0);
  expect(document.querySelectorAll("main section, section[id]").length).toBeLessThan(total);
  fireEvent.click(screen.getByRole("button", { name: "ล้างคำค้นหา" }));
  expect(screen.getByText(`${total} หัวข้อ`)).toBeTruthy();
  expect(document.querySelectorAll("mark").length).toBe(0);
});

test("ไม่พบผลลัพธ์: บอกชัด และมีปุ่มล้างคำค้นหา", () => {
  render(<GuideView guide={officerGuide} current="officer" />);
  fireEvent.change(screen.getByPlaceholderText(/ค้นหาในคู่มือ/), { target: { value: "คำที่ไม่มีอยู่จริงแน่นอน" } });
  expect(screen.getByText(/ไม่พบหัวข้อที่ตรงกับ/)).toBeTruthy();
});

test("ซ่อนลิงก์คู่มือผู้ดูแลระบบเมื่อไม่ใช่ผู้ดูแล", () => {
  render(<GuideView guide={officerGuide} current="officer" />);
  const nav = screen.getByRole("navigation", { name: "เลือกคู่มือ" });
  expect(nav.textContent).not.toContain("ผู้ดูแลระบบ");
  expect(nav.querySelector('[aria-current="page"]').getAttribute("href")).toBe("/eoc/guide");
});
