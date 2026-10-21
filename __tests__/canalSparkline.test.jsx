import { render, screen } from "@testing-library/react";
import CanalStrip, { sparkPoints } from "@/components/public/home/CanalStrip";

jest.mock("next/link", () => ({ __esModule: true, default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }));

const station = { id: "1095881", name: "[ทดสอบ] เมืองสตูล", river: "คลองน้ำพระ", amphoe: "เมืองสตูล", bankDiff: -0.92, waterLevelMsl: 2.08, bankLevelMsl: 3, observedAt: "2026-10-21T02:40:00Z", trend: { value: "rising", label: "น้ำขึ้น", arrow: "↑" } };
const history = [
  { t: "2026-10-20 10:00:00", level: 1.9 },
  { t: "2026-10-20 20:00:00", level: 1.95 },
  { t: "2026-10-21 09:00:00", level: 2.05 }
];

test("แนวโน้ม 24 ชม.: รวมค่าที่บันทึกกับค่าล่าสุด และแสดงการเปลี่ยนแปลง", () => {
  const points = sparkPoints(history, station);
  expect(points).toHaveLength(4);
  expect(points.at(-1).level).toBe(2.08);
  render(<CanalStrip stations={[station]} history={{ [station.id]: history }} />);
  expect(screen.getByText("+0.18 ม.")).toBeInTheDocument();
  expect(screen.getByLabelText(/แนวโน้ม \d+ ชม\. เพิ่มขึ้น 0\.18 เมตร/)).toBeInTheDocument();
});

test("ข้อมูลยังไม่พอ: บอกว่ากำลังสะสม", () => {
  render(<CanalStrip stations={[station]} history={{}} />);
  expect(screen.getByText(/กำลังสะสมข้อมูล/)).toBeInTheDocument();
});
