import { loginFailureCode, loginFailureMessage } from "@/context/AuthContext";

test("ข้อความเมื่อเซิร์ฟเวอร์ไม่ส่งข้อความมา", () => {
  expect(loginFailureMessage(401)).toBe("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  expect(loginFailureMessage(429)).toContain("รอสักครู่");
  expect(loginFailureMessage(502)).toContain("ระบบขัดข้องชั่วคราว");
  expect(loginFailureCode(401)).toBe("invalid_credentials");
});
