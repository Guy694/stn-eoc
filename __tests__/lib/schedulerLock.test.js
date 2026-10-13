/** @jest-environment node */
jest.mock("@/lib/db", () => ({ getPool: () => null }));
const { withSchedulerLock } = require("@/lib/schedulerLock");

function fakePool(held) {
  const calls = [];
  const connection = {
    query: async (sql, params) => {
      calls.push([sql, params]);
      if (/GET_LOCK/.test(sql)) return [[{ got: held.has(params[0]) ? 0 : (held.add(params[0]), 1) }]];
      if (/RELEASE_LOCK/.test(sql)) { held.delete(params[0]); return [[{ released: 1 }]]; }
      return [[]];
    },
    release: () => calls.push(["release"])
  };
  return { pool: { getConnection: async () => connection }, calls };
}

test("ได้ล็อกแล้วทำงาน แล้วปล่อยล็อกและคืนการเชื่อมต่อ", async () => {
  const held = new Set();
  const { pool, calls } = fakePool(held);
  await expect(withSchedulerLock("water-alerts", async () => "done", { pool })).resolves.toBe("done");
  expect(held.size).toBe(0);
  expect(calls.at(-1)).toEqual(["release"]);
});

test("อีกเครื่องถือล็อกอยู่ → ข้ามรอบนี้ ไม่เรียกงาน", async () => {
  const held = new Set(["stn-eoc:water-alerts"]);
  const { pool } = fakePool(held);
  const task = jest.fn();
  await expect(withSchedulerLock("water-alerts", task, { pool })).resolves.toEqual({ skipped: true, reason: "locked" });
  expect(task).not.toHaveBeenCalled();
});

test("งานล้มก็ยังปล่อยล็อก", async () => {
  const held = new Set();
  const { pool } = fakePool(held);
  await expect(withSchedulerLock("dpm-water", async () => { throw new Error("boom"); }, { pool })).rejects.toThrow("boom");
  expect(held.size).toBe(0);
});
