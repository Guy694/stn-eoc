import { ANONYMIZE_SQL, COUNT_DUE_SQL, HOUSEKEEPING, anonymizeParams, dueParams, incidentPhotoFile, retentionDays } from "@/lib/pdpaRetention.mjs";

const placeholders = (sql) => (sql.match(/\?/g) || []).length;

test("ระยะเก็บ: ค่าเริ่มต้น 365 วัน ต่ำสุด 30 วัน", () => {
  expect(retentionDays({})).toBe(365);
  expect(retentionDays({ PDPA_RETENTION_DAYS: "730" })).toBe(730);
  expect(retentionDays({ PDPA_RETENTION_DAYS: "7" })).toBe(365);
});

test("จำนวนพารามิเตอร์ตรงกับคำสั่ง SQL", () => {
  expect(placeholders(COUNT_DUE_SQL)).toBe(dueParams(365).length);
  expect(placeholders(ANONYMIZE_SQL)).toBe(anonymizeParams(365).length);
});

test("ลบเฉพาะเรื่องที่ปิดแล้ว และเก็บข้อมูลสถิติไว้", () => {
  expect(ANONYMIZE_SQL).toMatch(/status IN \(\?, \?\)/);
  expect(dueParams(365).slice(0, 2)).toEqual(["resolved", "rejected"]);
  expect(ANONYMIZE_SQL).not.toMatch(/report_type|district|reported_at\s*=/);
  expect(ANONYMIZE_SQL).toMatch(/phone = NULL/);
});

test("งานบ้านลบเฉพาะ session/ตัวนับที่หมดอายุ", () => {
  expect(HOUSEKEEPING.map(([, sql]) => sql).join(" ")).toMatch(/expires_at < NOW\(\)/);
});

test("ลบรูปได้เฉพาะไฟล์ในโฟลเดอร์รูปประชาชน", () => {
  expect(incidentPhotoFile("/uploads/incidents/1712-abc.jpg")).toBe("1712-abc.jpg");
  expect(incidentPhotoFile("/uploads/incidents/../../.env")).toBeNull();
  expect(incidentPhotoFile("/uploads/announcements/a.jpg")).toBeNull();
  expect(incidentPhotoFile("/uploads/incidents/.hidden")).toBeNull();
});
