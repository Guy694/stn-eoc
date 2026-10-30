import { act, fireEvent, render, screen } from "@testing-library/react";
jest.mock("next/navigation", () => ({ usePathname: () => "/public/weather-watch/" }));
import SatisfactionPrompt from "@/components/common/SatisfactionPrompt";
import { ASK_DELAY_MS, VISITS_KEY } from "@/lib/satisfaction";

beforeEach(() => {
  jest.useFakeTimers();
  window.localStorage.clear();
  window.sessionStorage.clear();
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
});
afterEach(() => jest.useRealTimers());

const visits = (state) => window.localStorage.setItem(VISITS_KEY, JSON.stringify({ first: Date.now(), days: ["2026-10-29"], sessions: 0, pages: 0, ...state }));

test("เข้าครั้งแรกไม่เด้ง", () => {
  render(<SatisfactionPrompt />);
  act(() => { jest.advanceTimersByTime(ASK_DELAY_MS + 1000); });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("เข้าหลายครั้งแล้วเด้งหลังอยู่หน้านี้สักพัก และ ไว้ทีหลัง = ไม่เด้งอีกใน 14 วัน", () => {
  visits({ sessions: 2, pages: 5 });
  const { unmount } = render(<SatisfactionPrompt />);
  expect(screen.queryByRole("dialog")).toBeNull();
  act(() => { jest.advanceTimersByTime(ASK_DELAY_MS + 100); });
  expect(screen.getByRole("dialog")).toHaveTextContent("ช่วยประเมินความพึงพอใจสักนิด");
  fireEvent.click(screen.getByRole("button", { name: "ไว้ทีหลัง" }));
  expect(JSON.parse(window.localStorage.getItem(VISITS_KEY)).dismissedAt).toBeGreaterThan(0);
  unmount();
  window.sessionStorage.clear();
  render(<SatisfactionPrompt />);
  act(() => { jest.advanceTimersByTime(ASK_DELAY_MS * 2); });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("มี popup อื่นเปิดอยู่ ไม่เด้งทับ", () => {
  visits({ sessions: 5, pages: 20 });
  const other = document.createElement("div");
  other.setAttribute("role", "alertdialog");
  document.body.appendChild(other);
  render(<SatisfactionPrompt />);
  act(() => { jest.advanceTimersByTime(ASK_DELAY_MS + 100); });
  expect(screen.queryByText("ช่วยประเมินความพึงพอใจสักนิด")).toBeNull();
  other.remove();
});
