import { render, screen } from "@testing-library/react";
import Pm25Card from "@/components/weather/Pm25Card";
import { buildPm25Payload } from "@/lib/pm25";

const now = Date.parse("2026-10-08T01:38:00Z");
const payload = buildPm25Payload({
  now,
  provinces: [{ pv_tn: "สตูล", pv_idn: 91, pm25: 27.45, pm25Avg24hr: 20.27, dt: "2026-10-08T08:00:00.000Z" }],
  amphoes: [
    { ap_tn: "ละงู", pm25: 28.98, pm25Avg24hr: 20.5, dt: "2026-10-08T08:00:00.000Z" },
    { ap_tn: "ทุ่งหว้า", pm25: 35.46, pm25Avg24hr: 21.8, dt: "2026-10-08T08:00:00.000Z" }
  ]
});

describe("Pm25Card", () => {
  it("แสดงค่าของอำเภอที่เลือก ระดับ คำแนะนำ และรายอำเภอ", () => {
    render(<Pm25Card data={payload} districtName="ละงู" />);
    expect(screen.getByLabelText("ฝุ่น PM2.5 อ.ละงู")).toBeInTheDocument();
    expect(screen.getAllByText("29").length).toBeGreaterThan(0);
    expect(screen.getByText("ปานกลาง")).toBeInTheDocument();
    expect(screen.getByText(/กลุ่มเสี่ยง/)).toBeInTheDocument();
    expect(screen.getByText("ทุ่งหว้า")).toBeInTheDocument();
  });

  it("อำเภอที่ไม่มีข้อมูลใช้ค่าจังหวัด", () => {
    render(<Pm25Card data={payload} districtName="มะนัง" />);
    expect(screen.getByLabelText("ฝุ่น PM2.5 จ.สตูล")).toBeInTheDocument();
  });

  it("ดึงข้อมูลไม่ได้ แสดงข้อความแทน", () => {
    render(<Pm25Card data={null} error="ยังดึงข้อมูลฝุ่น PM2.5 จาก GISTDA ไม่ได้ในขณะนี้" districtName="ละงู" />);
    expect(screen.getByText(/ยังดึงข้อมูลฝุ่น/)).toBeInTheDocument();
  });
});
