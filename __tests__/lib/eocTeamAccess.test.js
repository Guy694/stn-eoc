jest.mock("@/lib/db", () => ({
  query: jest.fn(),
}));

const { query } = require("@/lib/db");
const { getSessionTeamAccess, isReportDateWithinSession } = require("@/lib/eocTeamAccess");

describe("EOC team access", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("allows authorized team members to report after a session is closed", async () => {
    query.mockResolvedValueOnce([{
      session_id: 54,
      eoc_type: "flood",
      session_number: 3,
      session_status: "closed",
      session_opened_at: "2026-07-01T00:00:00.000Z",
      session_closed_at: "2026-07-10T00:00:00.000Z",
      session_team_id: 39,
      team_lead_officer_id: 8,
      team_code: "SAT",
      team_name_th: "กลุ่มภารกิจตระหนักรู้สถานการณ์",
      membership_id: 99,
      member_officer_id: 7,
    }]);

    const access = await getSessionTeamAccess({ id: 7, role: "staff" }, 54, 39);

    expect(access.ok).toBe(true);
    expect(access.canWrite).toBe(false);
    expect(access.canOperate).toBe(false);
    expect(access.canReport).toBe(true);
    expect(access.canSubmit).toBe(false);
  });

  test("does not let a matching legacy role bypass session membership", async () => {
    query.mockResolvedValueOnce([{
      session_id: 54,
      eoc_type: "flood",
      session_number: 3,
      session_status: "active",
      session_opened_at: "2026-07-01T00:00:00.000Z",
      session_closed_at: null,
      session_team_id: 39,
      team_lead_officer_id: 8,
      team_code: "SAT",
      team_name_th: "กลุ่มภารกิจตระหนักรู้สถานการณ์",
      membership_id: null,
      member_officer_id: null,
    }]);

    const access = await getSessionTeamAccess({ id: 7, role: "SAT" }, 54, 39);

    expect(access).toMatchObject({ ok: false, status: 403 });
  });

  test("allows operational writes only while the assigned session is active", async () => {
    query.mockResolvedValueOnce([{
      session_id: 54,
      eoc_type: "flood",
      session_number: 3,
      session_status: "active",
      session_opened_at: "2026-07-01T00:00:00.000Z",
      session_closed_at: null,
      session_team_id: 39,
      team_lead_officer_id: 7,
      team_code: "SAT",
      team_name_th: "กลุ่มภารกิจตระหนักรู้สถานการณ์",
      membership_id: 99,
      member_officer_id: 7,
    }]);

    const access = await getSessionTeamAccess({ id: 7, role: "staff" }, 54, 39);

    expect(access).toMatchObject({
      ok: true,
      canOperate: true,
      canReport: true,
      canSubmit: true,
    });
  });

  test("validates that report dates remain inside the session window", () => {
    const context = {
      session_opened_at: "2026-07-01T00:00:00.000Z",
      session_closed_at: "2026-07-10T23:59:59.000Z",
    };

    expect(isReportDateWithinSession(context, "2026-07-05T12:00:00.000Z")).toBe(true);
    expect(isReportDateWithinSession(context, "2026-06-30T23:59:59.000Z")).toBe(false);
    expect(isReportDateWithinSession(context, "2026-07-11T00:00:00.000Z")).toBe(false);
  });
});
