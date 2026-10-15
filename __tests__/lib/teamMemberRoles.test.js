import { TEAM_MEMBER_ROLES, normalizeTeamMemberRole } from "@/lib/teamMemberRoles";

describe("normalizeTeamMemberRole", () => {
  it("มีบทบาทเดียวสองแบบ: หัวหน้าทีม และสมาชิกทีม", () => {
    expect([...TEAM_MEMBER_ROLES].sort()).toEqual(["สมาชิกทีม", "หัวหน้าทีม"].sort());
  });
  it("คงค่ามาตรฐานไว้", () => {
    expect(normalizeTeamMemberRole("หัวหน้าทีม")).toBe("หัวหน้าทีม");
    expect(normalizeTeamMemberRole("สมาชิกทีม")).toBe("สมาชิกทีม");
  });
  it("แปลงค่าเก่าในฐานข้อมูล", () => {
    expect(normalizeTeamMemberRole("หัวหน้า")).toBe("หัวหน้าทีม");
    for (const old of ["รองหัวหน้าทีม", "รองหัวหน้า", "สมาชิก", "ผู้ประสานงาน", "เจ้าหน้าที่", "", null, undefined]) expect(normalizeTeamMemberRole(old)).toBe("สมาชิกทีม");
  });
});
