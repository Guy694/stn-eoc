import { moduleEditAccess, readOnlyMessage, userTeamCodes } from "@/lib/eocModulePermissions";

describe("moduleEditAccess", () => {
  const it_member = [{ team_code: "ITSUPPORT" }];
  const sat_member = [{ team_code: "SAT" }];
  it("ทีม IT บันทึก IT support ได้ ทีมอื่นดูอย่างเดียว", () => {
    expect(moduleEditAccess({ role: "staff", memberships: it_member, moduleKey: "it-support" })).toEqual({ canEdit: true, reason: null });
    expect(moduleEditAccess({ role: "SAT", memberships: sat_member, moduleKey: "it-support" })).toEqual({ canEdit: false, reason: "not_owner" });
  });
  it("แอดมิน/ผู้บัญชาการบันทึกได้ทุกเมนู แต่เหตุการณ์ที่ปิดแล้วทุกคนดูอย่างเดียว", () => {
    expect(moduleEditAccess({ role: "admin", moduleKey: "it-support" }).canEdit).toBe(true);
    expect(moduleEditAccess({ role: "commander", moduleKey: "it-support" }).canEdit).toBe(true);
    expect(moduleEditAccess({ role: "admin", sessionActive: false, moduleKey: "it-support" })).toEqual({ canEdit: false, reason: "closed" });
  });
  it("เมนูที่ยังไม่กำหนดเจ้าของ ใช้สิทธิ์เดิม", () => {
    expect(moduleEditAccess({ role: "staff", memberships: sat_member, moduleKey: "records" }).canEdit).toBe(true);
  });
  it("ข้อความบอกว่าใครบันทึกได้", () => {
    expect(readOnlyMessage("it-support", "not_owner")).toContain("เทคโนโลยีดิจิทัล");
    expect(userTeamCodes([{ team_code: "ITSUPPORT" }, { team_code: "it" }, { team_code: null }])).toEqual(["it"]);
  });
});

import { buildAdminMenu, buildMyTeamWorkSection, buildOfficerEventSections, buildOfficerMenu } from "@/src/config/navigation/admin-navigation";

describe("buildOfficerEventSections", () => {
  const eocStatus = { flood: { is_active: true, session_id: 9, session_number: 3 }, disease: { is_active: false } };
  it("แสดงเฉพาะเหตุการณ์ที่ได้รับมอบหมาย และติดป้ายดูอย่างเดียวในเมนูของทีมอื่น", () => {
    const sat = buildOfficerEventSections({ eocStatus, role: "SAT", assignments: [{ eoc_type: "flood", eoc_session_id: 9, team_code: "SAT" }] });
    expect(sat).toHaveLength(1);
    const it = sat[0].items.find((item) => item.key === "it-support");
    expect(it.readOnly).toBe(true);
    expect(sat[0].items.find((item) => item.key === "overview").readOnly).toBe(false);
    expect(sat[0].items.find((item) => item.key === "records").readOnly).toBe(false);
    // เมนูเหตุการณ์เหมือนของแอดมินทุกข้อ · งานของทีมแยกไปหมวด "งานของทีมฉัน"
    expect(sat[0].items.map((item) => item.key)).toContain("supplies");
    expect(sat[0].items.some((item) => item.teamWork)).toBe(false);

    const itTeam = buildOfficerEventSections({ eocStatus, role: "staff", assignments: [{ eoc_type: "flood", eoc_session_id: 9, team_code: "ITSUPPORT" }] });
    expect(itTeam[0].items.find((item) => item.key === "it-support").readOnly).toBe(false);
    expect(itTeam[0].items.find((item) => item.key === "records").readOnly).toBe(true);
  });
  it("ไม่แสดงเหตุการณ์ที่ไม่ได้รับมอบหมาย", () => {
    expect(buildOfficerEventSections({ eocStatus, role: "SAT", assignments: [] })).toEqual([]);
    expect(buildOfficerEventSections({ eocStatus, role: "SAT", assignments: [{ eoc_type: "flood", eoc_session_id: 2, team_code: "SAT" }] })).toEqual([]);
  });
});

describe("เมนูเจ้าหน้าที่ (M1/M2)", () => {
  const eocStatus = { flood: { is_active: true, session_id: 9, session_number: 3 }, disease: { is_active: true, session_id: 4 } };
  const titles = (menu) => menu.map((section) => section.title);
  const paths = (menu, key) => menu.find((section) => section.section === key)?.items.map((item) => item.path) || [];

  it("งานของทีมฉันอยู่ถัดจากภาพรวม ก่อนเมนูเหตุการณ์", () => {
    const menu = buildOfficerMenu({ role: "staff", eocStatus, assignments: [{ eoc_type: "flood", eoc_session_id: 9, team_code: "SAT" }] });
    expect(titles(menu).slice(0, 3)).toEqual(["ภาพรวม", "งานของทีมฉัน", "เหตุการณ์ที่เปิดอยู่"]);
    expect(paths(menu, "my-team-work")).toEqual(["/eoc/flood/teams/sat/records"]);
    expect(menu.find((section) => section.section === "my-team-work").items[0].name).not.toMatch(/·/);
  });

  it("หลายเหตุการณ์: ต่อท้ายชื่องานด้วยเหตุการณ์ · ไม่มีทีม = ไม่มีหมวดงานของทีม", () => {
    const work = buildMyTeamWorkSection({ eocStatus, assignments: [
      { eoc_type: "flood", eoc_session_id: 9, team_code: "SAT" },
      { eoc_type: "disease", eoc_session_id: 4, team_code: "RISKCOM" }
    ] });
    expect(work.items.map((item) => item.name)).toEqual(expect.arrayContaining([expect.stringMatching(/· อุทกภัย$/), expect.stringMatching(/· โรคระบาด$/)]));
    expect(buildMyTeamWorkSection({ eocStatus, assignments: [] })).toBeNull();
    expect(titles(buildOfficerMenu({ role: "commander", eocStatus, assignments: [] }))).not.toContain("งานของทีมฉัน");
  });

  it("สถานะของฉันอยู่ในภาพรวมทุกบทบาท · แจ้งเตือนประชาชนอยู่ในหมวดสื่อสาร · แนวโน้มน้ำและฝนไม่ซ้ำ", () => {
    const admin = buildAdminMenu({ eocStatus });
    const commander = buildOfficerMenu({ role: "commander", eocStatus });
    const staff = buildOfficerMenu({ role: "staff", eocStatus, assignments: [{ eoc_type: "flood", eoc_session_id: 9, team_code: "SAT" }] });
    for (const menu of [admin, commander, staff]) {
      expect(paths(menu, "overview")).toContain("/eoc/readiness");
      expect(paths(menu, "account")).not.toContain("/eoc/readiness");
      expect(paths(menu, "overview")).not.toContain("/admin/public-alerts");
      const all = menu.flatMap((section) => section.items || []).map((item) => item.path);
      expect(all.filter((path) => path === "/eoc/hydro-trends")).toHaveLength(1);
    }
    expect(paths(admin, "communication")).toContain("/admin/public-alerts");
    expect(paths(commander, "communication")).toEqual(["/announcements", "/admin/public-alerts"]);
    expect(titles(staff)).not.toContain("สื่อสาร");
    expect(paths(staff, "overview")).not.toContain("/admin/officer-readiness");
    expect(paths(commander, "overview")).toContain("/admin/officer-readiness");
  });
});

describe("MODULE_OWNERS (ตารางที่ยืนยันแล้ว)", () => {
  const can = (team, moduleKey) => moduleEditAccess({ role: "staff", memberships: [{ team_code: team }], moduleKey }).canEdit;
  it("แต่ละเมนูบันทึกได้เฉพาะทีมเจ้าของ", () => {
    expect(can("SAT", "affected")).toBe(true);
    expect(can("LOGISTICS", "affected")).toBe(false);
    expect(can("LOGISTICS", "shelters")).toBe(true);
    expect(can("LOGISTICS", "supplies")).toBe(true);
    expect(can("SAT", "supplies")).toBe(false);
    expect(can("CASE_MGMT", "vulnerable")).toBe(true);
    expect(can("MCATT", "vulnerable")).toBe(true);
    expect(can("CASE_MGMT", "health")).toBe(true);
    expect(can("SAT", "health")).toBe(true);
    expect(can("EOC_MGMT", "team")).toBe(true);
    expect(can("SAT", "team")).toBe(false);
    expect(can("RISKCOM", "command")).toBe(true); // ข้อสั่งการ: ทุกทีม
  });
});

import { buildOwnerOverrides, normalizeOwnerInput, resolveOwners } from "@/lib/eocModulePermissions";

describe("สิทธิ์ที่แอดมินตั้งเอง (eoc_module_permissions)", () => {
  const overrides = buildOwnerOverrides([
    { eoc_type: "flood", module_key: "shelters", team_code: "SAT" },
    { eoc_type: "flood", module_key: "shelters", team_code: "logistics" },
    { eoc_type: "flood", module_key: "supplies", team_code: "*" },
    { eoc_type: "disease", module_key: "records", team_code: "JIT" }
  ]);
  it("ใช้ค่าที่ตั้งไว้ก่อน ไม่มีจึงใช้ค่าเริ่มต้น และแยกตามประเภทเหตุการณ์", () => {
    expect(resolveOwners("flood", "shelters", overrides)).toEqual(["sat", "logistics"]);
    expect(resolveOwners("flood", "supplies", overrides)).toBeNull();
    expect(resolveOwners("flood", "records", overrides)).toEqual(["sat"]);
    expect(resolveOwners("disease", "records", overrides)).toEqual(["jit"]);
  });
  it("สิทธิ์ตามค่าที่ตั้ง", () => {
    const owners = resolveOwners("flood", "shelters", overrides);
    expect(moduleEditAccess({ role: "staff", memberships: [{ team_code: "SAT" }], moduleKey: "shelters", owners }).canEdit).toBe(true);
    expect(moduleEditAccess({ role: "staff", memberships: [{ team_code: "MCATT" }], moduleKey: "supplies", owners: null }).canEdit).toBe(true);
    expect(readOnlyMessage("shelters", "not_owner", ["sat"])).toContain("ตระหนักรู้สถานการณ์");
  });
  it("ตรวจค่าที่ส่งมา", () => {
    expect(normalizeOwnerInput([]).ok).toBe(false);
    expect(normalizeOwnerInput(["SAT", "sat", "ไม่มีทีมนี้"]).value).toEqual(["sat"]);
    expect(normalizeOwnerInput(["*", "sat"]).value).toEqual(["*"]);
  });
});

describe("ประกาศธงเตือนภัย/Trigger ใช้สิทธิ์ตามกล่องภารกิจ ไม่ใช่บทบาทของบัญชี", () => {
  const sat = [{ team_code: "sat" }];
  test("ทีม SAT ในเหตุการณ์ประกาศได้ แม้บัญชีเป็นเจ้าหน้าที่ทั่วไป", () => {
    expect(moduleEditAccess({ role: "staff", memberships: sat, moduleKey: "triggers" }).canEdit).toBe(true);
  });
  test("บัญชีบทบาท SAT ที่อยู่ทีมอื่นในเหตุการณ์ ประกาศไม่ได้", () => {
    expect(moduleEditAccess({ role: "SAT", memberships: [{ team_code: "logistics" }], moduleKey: "triggers" })).toEqual({ canEdit: false, reason: "not_owner" });
  });
  test("ผู้บัญชาการประกาศได้เสมอขณะเหตุการณ์เปิด", () => {
    expect(moduleEditAccess({ role: "commander", moduleKey: "triggers" }).canEdit).toBe(true);
    expect(moduleEditAccess({ role: "commander", moduleKey: "triggers", sessionActive: false }).canEdit).toBe(false);
  });
});
