import { act, fireEvent, render, screen } from "@testing-library/react";
import PublicAnnouncementList from "@/components/public/announcements/PublicAnnouncementList";

jest.mock("next/link", () => ({ __esModule: true, default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }));

const items = [1, 2, 3].map((n) => ({ id: n, title: `[ทดสอบ] เรื่องที่ ${n}`, description: "x", image_path: `/uploads/${n}.png`, display_status: n === 1 ? "current" : "past", start_date: "2026-10-20" }));
const alerts = [{ id: 9, level: "high", title: "⚠️ เตือนภัย จ.สตูล", body: "[ทดสอบ] น้ำล้นตลิ่ง สถานีA อ.ละงู", districts: ["ละงู"], created_at: "2026-10-20T03:00:00Z" }];

beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn(async (url) => ({
    json: async () => (String(url).includes("push") ? { success: true, data: alerts } : String(url).includes("riskcom") ? { success: true, data: [] } : { success: true, data: items })
  }));
});
afterEach(() => jest.useRealTimers());

test("เรื่องเด่นหมุนเวียนเอง กดถัดไปได้ และแสดงแจ้งเตือนที่ส่งถึงประชาชน", async () => {
  render(<PublicAnnouncementList />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
  const current = () => screen.getAllByRole("link").find((a) => a.getAttribute("aria-roledescription") === "สไลด์" && a.getAttribute("aria-hidden") === "false");
  expect(current().getAttribute("aria-label")).toMatch(/^1 จาก 3/);
  await act(async () => { jest.advanceTimersByTime(7100); });
  expect(current().getAttribute("aria-label")).toMatch(/^2 จาก 3/);
  fireEvent.click(screen.getByLabelText("เรื่องถัดไป"));
  expect(current().getAttribute("aria-label")).toMatch(/^3 จาก 3/);
  expect(screen.getByText("แจ้งเตือนที่ส่งถึงประชาชน")).toBeInTheDocument();
  expect(screen.getByText(/น้ำล้นตลิ่ง สถานีA/)).toBeInTheDocument();
});
