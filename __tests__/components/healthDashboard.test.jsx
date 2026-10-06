import { render, screen } from "@testing-library/react";
import HealthDashboard from "@/components/eoc/flood-health/HealthDashboard";
import { buildHealthDashboard } from "@/lib/healthDashboard";

jest.mock("react-chartjs-2", () => ({
  Line: (props) => <div data-testid="line-chart">{props.data.datasets.map((set) => set.label).join("|")}</div>,
  Bar: (props) => <div data-testid="bar-chart">{props.data.labels.join("|")}</div>
}));

const payload = {
  success: true,
  session: { id: 3, status: "active" },
  generated_at: "2026-10-06T07:00:00Z",
  ...buildHealthDashboard({
    session: { opened_at: "2026-09-30" },
    community: [
      { report_date: "2026-10-05", district: "ละงู", tambon: "กำแพง", village: "บ้านA", disease: "อุจจาระร่วง", cases: 6 },
      { report_date: "2026-10-06", district: "ละงู", tambon: "กำแพง", village: "บ้านB", disease: "โรคฉี่หนู", cases: 2 }
    ],
    shelter: [{ report_date: "2026-10-06", district: "เมืองสตูล", disease: "ตาแดง", cases: 3, hospitalized: 1, deaths: 1 }]
  }, "2026-10-06")
};

describe("HealthDashboard", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload });
  });

  it("renders KPIs, actions, charts, heatmap and village list", async () => {
    render(<HealthDashboard />);
    expect(await screen.findByText("ควรทำอะไรต่อ")).toBeInTheDocument();
    expect(screen.getByText("มีผู้เสียชีวิต 1 ราย")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toHaveTextContent("ในชุมชน|ในศูนย์พักพิง|ค่าเฉลี่ย 7 วัน (รวม)");
    expect(screen.getByTestId("bar-chart")).toHaveTextContent("อ.ละงู");
    expect(screen.getByText("ความหนาแน่นผู้ป่วย อำเภอ × วัน (14 วันล่าสุด)")).toBeInTheDocument();
    expect(screen.getByText("บ้านA")).toBeInTheDocument();
  });
});
