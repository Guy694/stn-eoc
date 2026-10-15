import { render, screen } from "@testing-library/react";
import FullReportSheet from "@/components/eoc/water-report/FullReportSheet";
import { normalizeReportConfig } from "@/lib/waterReportExtras";

const data = {
  source: "ปภ.",
  compare: "2026-10-14 16:00:00",
  columns: [
    { hour: "2026-10-14 10:00:00", label: "10.00 น.", levels: { STN01: 0.66 } },
    { hour: "2026-10-14 16:00:00", label: "16.00 น.", levels: { STN01: 0.49 } }
  ],
  report: {
    dataLabel: { date: "14 ตุลาคม 2569", time: "20.00 น." },
    headline: "ok",
    stationsWithData: 1,
    counts: { up: 1, down: 0, steady: 0, unknown: 1 },
    rows: [
      { code: "STN01", name: "สะพานร้อยเมตร", level: 0.51, bank: 3.8, belowBank: 3.29, diff: 0.02, direction: "up", malfunction: false },
      { code: "STN06", name: "สะพานข้ามคลองโตน", level: null, bank: 49.68, belowBank: null, diff: null, direction: null, malfunction: true }
    ]
  }
};
const extras = {
  basins: [
    { key: "langu", label: "คลองละงู", station: { id: "1", name: "ละงู" }, level: 7.53, bank: 12.8, warning: 11.5, belowBank: 5.27, previous: 6.6, previousSource: "yesterday", diff: 0.93, direction: "up", observedAt: "2026-10-13T23:00:00Z", compareHour: "2026-10-13 06:00:00" },
    { key: "dusan", label: "คลองดุสน (ม่าบัง)", station: null, level: null, bank: null, warning: null, belowBank: null, previous: null, diff: null, direction: null }
  ],
  rain: { rows: [{ id: "r1", name: "บ้านอุไดได้", rain24h: 63.5, label: "หนัก", color: "#f59e0b", textColor: "#111", time: "14.00 น." }], total: 1, hidden: 0, timeRange: "14.00 น." },
  rain_media: [{ url: "/stn-eoc/api/eoc/water-report/media/?image=a.png", datetime: "2026-10-14 07:00" }],
  forecast: [{ date: "2026-10-14", label: "ปานกลาง", probability: 30 }]
};
const flag = { key: "green", label: "ธงเขียว", meaning: "เฝ้าระวัง", color: "#16a34a" };

describe("FullReportSheet", () => {
  it("แสดงครบ 4 หัวข้อพร้อมคอลัมน์หลายเวลา", () => {
    render(<FullReportSheet data={data} extras={extras} config={normalizeReportConfig({ issuer: { name: "ผู้ออกรายงาน [ทดสอบ]" } })} flag={flag} flagSource="" />);
    for (const title of ["ระดับน้ำสถานีเฝ้าระวัง 2 สถานี", "ระดับลุ่มน้ำหลัก", "ฝนสะสม 24 ชม. และแนวโน้มเฝ้าระวัง", "พื้นที่เฝ้าระวังสำคัญ"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText("10.00 น.")).toBeInTheDocument();
    expect(screen.getByText("เปลี่ยนจาก 16.00 น.")).toBeInTheDocument();
    expect(screen.getByText("0.66")).toBeInTheDocument();
    expect(screen.getByText("ไม่มีข้อมูล")).toBeInTheDocument();
    expect(screen.getByText("ตลิ่ง 12.80 ม.")).toBeInTheDocument();
    expect(screen.getByText("เฝ้าระวัง 11.50 ม.")).toBeInTheDocument();
    expect(screen.getByText(/ยังไม่พบสถานีวัดของคลองดุสน/)).toBeInTheDocument();
    expect(screen.getByText("บ้านอุไดได้")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /แผนที่คาดการณ์ฝน/ })).toHaveAttribute("src", expect.stringContaining("/water-report/media/"));
    expect(screen.getByText("ผู้ออกรายงาน [ทดสอบ]")).toBeInTheDocument();
    expect(screen.getByText(/ควนโพธิ์/)).toBeInTheDocument();
  });

  it("ระหว่างโหลดข้อมูลหัวข้อ 2–3 แสดงข้อความรอ", () => {
    render(<FullReportSheet data={data} extras={null} config={normalizeReportConfig(null)} flag={flag} flagSource="" />);
    expect(screen.getByText("กำลังโหลดข้อมูลลุ่มน้ำ…")).toBeInTheDocument();
    expect(screen.getByText("กำลังโหลดข้อมูลฝน…")).toBeInTheDocument();
  });
});
