/** @jest-environment jsdom */
import { act, render, screen } from "@testing-library/react";
import HomeSplashScreen from "@/components/public/home/HomeSplashScreen";

jest.mock("next/image", () => ({ __esModule: true, default: () => <span data-testid="logo" /> }));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const splash = () => screen.queryByRole("status");
const advance = (ms) => act(() => { jest.advanceTimersByTime(ms); });

test("ข้อมูลพร้อมแล้ว: แสดงโลโก้ตามเวลาปกติแล้วหายไป ไม่ขึ้นข้อความโหลด", () => {
  render(<HomeSplashScreen ready />);
  expect(splash()).not.toBeNull();
  advance(1200);
  expect(screen.queryByText("กำลังโหลดข้อมูล…")).toBeNull();
  advance(300);
  expect(splash()).toBeNull();
});

test("ข้อมูลยังไม่พร้อม: ค้างหน้าโลโก้ + ข้อความกำลังโหลด จนโหลดเสร็จ", () => {
  const { rerender } = render(<HomeSplashScreen ready={false} />);
  advance(1300);
  expect(splash()).not.toBeNull();
  expect(screen.getByText("กำลังโหลดข้อมูล…")).toBeTruthy();
  advance(5000);
  expect(splash()).not.toBeNull();
  rerender(<HomeSplashScreen ready />);
  advance(300);
  expect(splash()).toBeNull();
});

test("โหลดนาน: บอกว่าเครือข่ายช้า และปิดเองเมื่อครบเวลาสูงสุด", () => {
  render(<HomeSplashScreen ready={false} />);
  advance(8100);
  expect(screen.getByText(/อินเทอร์เน็ตช้ากว่าปกติ/)).toBeTruthy();
  advance(12000);
  advance(300);
  expect(splash()).toBeNull();
});
