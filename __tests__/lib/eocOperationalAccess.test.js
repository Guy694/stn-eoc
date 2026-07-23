jest.mock("@/lib/db", () => ({ query: jest.fn() }));

const { query } = require("@/lib/db");
const { getOperationalSessionAccess } = require("@/lib/eocOperationalAccess");

describe("operational session access", () => {
  beforeEach(() => jest.clearAllMocks());

  test("assigned member can view but cannot operate a closed session", async () => {
    query
      .mockResolvedValueOnce([{ id: 54, eoc_type: "flood", status: "closed" }])
      .mockResolvedValueOnce([{ session_team_id: 39, membership_id: 99 }]);
    const access = await getOperationalSessionAccess({ id: 7, role: "staff" }, 54, "flood");
    expect(access).toMatchObject({ ok: true, canView: true, canOperate: false });
  });

  test("unassigned officer gets 403", async () => {
    query.mockResolvedValueOnce([{ id: 54, eoc_type: "flood", status: "active" }]).mockResolvedValueOnce([]);
    await expect(getOperationalSessionAccess({ id: 7, role: "staff" }, 54, "flood"))
      .resolves.toMatchObject({ ok: false, status: 403 });
  });

  test("admin can verify missions in an active session", async () => {
    query.mockResolvedValueOnce([{ id: 54, eoc_type: "flood", status: "active" }]);
    await expect(getOperationalSessionAccess({ id: 1, role: "admin" }, 54, "flood"))
      .resolves.toMatchObject({ ok: true, canOperate: true, canVerify: true });
  });
});

