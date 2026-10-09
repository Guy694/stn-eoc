import { publicOutlookFor, publicOutlookSummary } from "@/lib/publicFloodOutlook";

const forecast = {
  dates: ["2026-10-10", "2026-10-11"],
  calibration: { source: "backtest" },
  areas: [{
    key: "ละงู|กำแพง", district: "ละงู", tambon: "กำแพง", coastal: true, riverine: true, susceptibility: 30,
    extent: { 1: { rai: 10, villages: [{ name: "ม.1", households: 200 }] } },
    forecast: { days: [
      { date: "2026-10-10", level: "normal", score: 3, rain24: 12.4, factors: [] },
      { date: "2026-10-11", level: "high", score: 24, rain24: 95, sea: "high", canal: "near", factors: [{ points: 8, label: "ฝน 24 ชม. 95 มม." }, { points: 7, label: "น้ำทะเลหนุนสูง" }], extent: { villages: [{ name: "ม.1", households: 200 }] } }
    ] }
  }]
};

describe("publicFloodOutlook", () => {
  test("returns one tambon without sensitive fields", () => {
    const out = publicOutlookFor(forecast, "อ.ละงู", "ต.กำแพง");
    expect(out.tambon).toBe("กำแพง");
    expect(out.worst).toMatchObject({ date: "2026-10-11", level: "high", rain24: 95 });
    expect(out.calibrated).toBe(true);
    const text = JSON.stringify(out);
    expect(text).not.toMatch(/households|susceptibility|score|extent|villages|points/);
  });
  test("unknown tambon → null; summary has levels only", () => {
    expect(publicOutlookFor(forecast, "ละงู", "ไม่มี")).toBeNull();
    expect(publicOutlookSummary(forecast).areas[0]).toEqual({ key: "ละงู|กำแพง", district: "ละงู", tambon: "กำแพง", levels: ["normal", "high"] });
    expect(publicOutlookFor(null, "a", "b")).toBeNull();
  });
});
