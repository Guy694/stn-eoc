const { appendAuditLog } = require("@/lib/auditLog");

describe("appendAuditLog", () => {
  test("stores assignment context, request identity, and before/after values", async () => {
    const execute = jest.fn().mockResolvedValue({ insertId: 101 });
    const request = {
      headers: {
        get: jest.fn((name) => ({
          "x-forwarded-for": "203.0.113.10, 10.0.0.1",
          "user-agent": "audit-test",
        })[name] || null),
      },
    };

    await appendAuditLog(execute, {
      request,
      user: { id: 1, username: "admin" },
      action: "data_update",
      targetType: "eoc_team_member",
      targetId: 88,
      sessionId: 12,
      sessionTeamId: 34,
      description: "เปลี่ยนบทบาทสมาชิกทีม",
      metadata: { officerId: 7, teamCode: "SAT" },
      oldValues: { roleInTeam: "สมาชิกทีม", isActive: true },
      newValues: { roleInTeam: "หัวหน้าทีม", isActive: true },
    });

    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, values] = execute.mock.calls[0];
    expect(sql).toContain("INSERT INTO activity_logs");
    expect(values).toEqual([
      1,
      "admin",
      "data_update",
      "eoc_team_member",
      "88",
      12,
      34,
      "เปลี่ยนบทบาทสมาชิกทีม",
      "203.0.113.10",
      "audit-test",
      JSON.stringify({ officerId: 7, teamCode: "SAT" }),
      JSON.stringify({ roleInTeam: "สมาชิกทีม", isActive: true }),
      JSON.stringify({ roleInTeam: "หัวหน้าทีม", isActive: true }),
      null,
    ]);
  });

  test("accepts requests without forwarding metadata", async () => {
    const execute = jest.fn().mockResolvedValue({});

    await appendAuditLog(execute, {
      request: null,
      user: { id: 2, username: "commander" },
      action: "data_create",
      targetType: "eoc_team_member",
      targetId: 89,
      description: "เพิ่มสมาชิกทีม",
    });

    const values = execute.mock.calls[0][1];
    expect(values[8]).toBeNull();
    expect(values[9]).toBeNull();
    expect(values[10]).toBeNull();
    expect(values[11]).toBeNull();
    expect(values[12]).toBeNull();
  });
});
