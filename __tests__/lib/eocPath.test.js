import { getTeamPath, teamRecordsPath } from "@/src/features/eoc/shared/utils/eoc-path";

describe("eoc-path", () => {
  it("getTeamPath แบบเดิม", () => {
    expect(getTeamPath("flood", "mcatt", "records")).toBe("/eoc/flood/teams/mcatt/records");
  });

  it("หน้ารายงานประจำวันของทีม: ไข้เลือดออกใช้เส้นทาง /eoc/disease และแนบเหตุการณ์", () => {
    expect(teamRecordsPath({ eocType: "flood", teamCode: "MCATT", sessionId: 12 })).toBe("/eoc/flood/teams/mcatt/records?sessionId=12");
    expect(teamRecordsPath({ eocType: "dengue", teamCode: "sat", sessionId: "3" })).toBe("/eoc/disease/teams/sat/records?sessionId=3");
    expect(teamRecordsPath({ eocType: "flood", teamCode: "sat" })).toBe("/eoc/flood/teams/sat/records");
  });

  it("ข้อมูลไม่ครบหรือรหัสทีมไม่รู้จัก → หน้าหลัก", () => {
    expect(teamRecordsPath({ eocType: null, teamCode: "sat", sessionId: 1 })).toBe("/dashboard");
    expect(teamRecordsPath({ eocType: "flood", teamCode: "ไม่มีทีมนี้", sessionId: 1 })).toBe("/dashboard");
  });
});
