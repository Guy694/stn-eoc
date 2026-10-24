import { render, screen, fireEvent } from "@testing-library/react";
import CanalStrip from "@/components/public/home/CanalStrip";

const make = (n) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, name: `สถานี ${i + 1}`, observedAt: "2026-10-15T03:00:00Z" }));

describe("CanalStrip", () => {
  it("แสดงเป็นรายการแนวตั้ง 6 สถานีแรก แล้วกดดูทั้งหมดได้", () => {
    render(<CanalStrip stations={make(9)} />);
    const list = screen.getByRole("list");
    expect(list.className).toContain("grid-cols-1");
    expect(list.className).not.toContain("overflow-x-auto");
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: /ดูทั้งหมด \(อีก 3 สถานี\)/ }));
    expect(screen.getAllByRole("listitem")).toHaveLength(9);
    expect(screen.getByRole("button", { name: /แสดงน้อยลง/ })).toBeInTheDocument();
  });

  it("ไม่แสดงปุ่มเมื่อมีสถานีไม่เกิน 6", () => {
    render(<CanalStrip stations={make(4)} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("ข้อมูลเก่าเกิน 2 ชม. → การ์ดเป็นสีเทา + ป้ายล่าช้า / ข้อมูลสด → บอกเวลาอัปเดต", () => {
    const { unmount } = render(<CanalStrip stations={make(2)} />);
    expect(screen.getByRole("list").className).toContain("grayscale");
    expect(screen.getByRole("status").textContent).toMatch(/ข้อมูลล่าสุด .* • ล่าช้า/);
    unmount();
    const fresh = make(2).map((s) => ({ ...s, observedAt: new Date(Date.now() - 10 * 60e3).toISOString() }));
    render(<CanalStrip stations={fresh} />);
    expect(screen.getByRole("list").className).not.toContain("grayscale");
    expect(screen.getByText(/^อัปเดต \d{2}:\d{2} น\.$/)).toBeInTheDocument();
  });
});
