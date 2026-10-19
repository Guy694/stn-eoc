import { fireEvent, render, screen } from "@testing-library/react";
import LanguageSwitch from "@/components/public/LanguageSwitch";

const reload = jest.fn();
beforeEach(() => {
  document.cookie = "googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  document.getElementById("stn-google-translate")?.remove();
  reload.mockClear();
});

test("เริ่มที่ TH · กดสลับ → ตั้งคุกกี้ /th/en แล้วโหลดหน้าใหม่", () => {
  render(<LanguageSwitch onReload={reload} />);
  const toggle = screen.getByRole("switch");
  expect(toggle).toHaveAttribute("aria-checked", "false");
  fireEvent.click(toggle);
  expect(document.cookie).toContain("googtrans=/th/en");
  expect(reload).toHaveBeenCalled();
});

test("เมื่อเลือก EN ไว้ → สวิตช์อยู่ที่ EN และโหลดตัวแปลภาษา · กดอีกครั้งกลับเป็น TH", () => {
  document.cookie = "googtrans=/th/en; path=/";
  render(<LanguageSwitch onReload={reload} />);
  expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  expect(document.getElementById("stn-google-translate")?.src).toContain("translate.google.com");
  fireEvent.click(screen.getByRole("switch"));
  expect(document.cookie).not.toContain("googtrans=/th/en");
});
