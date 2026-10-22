import { failedAttemptBlock, loginPolicy } from "@/lib/loginPolicy";

test("ค่าเริ่มต้นสูงกว่าเดิม และปรับผ่าน .env ได้", () => {
  const policy = loginPolicy({});
  expect(policy).toMatchObject({ ipRequestLimit: 100, failedPerAccount: 10, failedPerIp: 40, lockAfterFailures: 10, lockMinutes: 15 });
  expect(loginPolicy({ LOGIN_MAX_FAILED_PER_IP: "80" }).failedPerIp).toBe(80);
  expect(loginPolicy({ LOGIN_MAX_FAILED_PER_IP: "abc" }).failedPerIp).toBe(40);
  expect(loginPolicy({ LOGIN_MAX_FAILED_PER_IP: "0" }).failedPerIp).toBe(40);
});

test("รหัสผิดของคนอื่นในเครือข่ายเดียวกัน 5 ครั้งไม่บล็อกอีกต่อไป", () => {
  const policy = loginPolicy({});
  expect(failedAttemptBlock({ byAccount: 0, byIp: 5 }, policy)).toBeNull();
  expect(failedAttemptBlock({ byAccount: 9, byIp: 20 }, policy)).toBeNull();
  expect(failedAttemptBlock({ byAccount: 10, byIp: 10 }, policy).scope).toBe("account");
  expect(failedAttemptBlock({ byAccount: 1, byIp: 40 }, policy).scope).toBe("ip");
});
