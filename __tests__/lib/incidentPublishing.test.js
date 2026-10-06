import {
  canPublish, defaultExpiryHours, findDuplicateCandidates, isPubliclyVisible, normalizePublishInput, suggestTitle, toPublicIncident
} from "@/lib/incidentPublishing";
import { parsePhotoPaths, parseUploadPath } from "@/lib/incidentPhotos";

const base = {
  id: 1, report_type: "problem_point", problem_category: "flood", status: "pending",
  first_name: "สมชาย", last_name: "ใจดี", phone: "0812345678",
  description: "น้ำท่วมหน้าบ้านเลขที่ 12 โทร 0812345678", latitude: 6.6238123, longitude: 100.0750456,
  photo_path: "/uploads/incidents/a.jpg", created_at: "2026-10-06T10:00:00+07:00"
};

describe("canPublish", () => {
  it("ไม่ให้เผยแพร่คำขอความช่วยเหลือเด็ดขาด", () => {
    expect(canPublish({ ...base, report_type: "help_request" }).ok).toBe(false);
    expect(canPublish({ ...base, report_type: null }).ok).toBe(false);
  });
  it("เผยแพร่จุดปัญหาและรายงานเส้นทางที่ยังไม่ปิดได้", () => {
    expect(canPublish(base).ok).toBe(true);
    expect(canPublish({ ...base, report_type: "traffic_report" }).ok).toBe(true);
  });
  it("ไม่ให้เผยแพร่เรื่องที่ปิดแล้ว ไม่ดำเนินการ หรือถูกรวมแล้ว", () => {
    expect(canPublish({ ...base, status: "rejected" }).ok).toBe(false);
    expect(canPublish({ ...base, status: "resolved" }).ok).toBe(false);
    expect(canPublish({ ...base, merged_into_id: 9 }).ok).toBe(false);
  });
});

describe("normalizePublishInput", () => {
  it("ต้องมีหัวข้อ และกันเบอร์โทรหลุดไปในข้อความเผยแพร่", () => {
    expect(normalizePublishInput({ title: "" }, base).ok).toBe(false);
    expect(normalizePublishInput({ title: "ถนนน้ำท่วม", detail: "ติดต่อ 081-234-5678" }, base).ok).toBe(false);
  });
  it("ใช้เวลาหมดอายุตามหมวดเมื่อไม่ระบุ และจำกัดไม่เกิน 7 วัน", () => {
    expect(normalizePublishInput({ title: "ถนนน้ำท่วม" }, base).value.expiresHours).toBe(12);
    expect(normalizePublishInput({ title: "ดินสไลด์ปิดถนน" }, { ...base, problem_category: "landslide" }).value.expiresHours).toBe(48);
    expect(normalizePublishInput({ title: "ถนนน้ำท่วม", expiresHours: 9999 }, base).value.expiresHours).toBe(168);
  });
});

describe("toPublicIncident", () => {
  const row = { ...base, publish_status: "published", public_title: "ถนนน้ำท่วม รถเล็กผ่านไม่ได้", public_detail: "", public_photo_path: "/uploads/incidents-public/p.jpg", report_count: 3 };
  it("ไม่ส่งชื่อ เบอร์ ข้อความต้นฉบับ หรือรูปต้นฉบับ", () => {
    const out = toPublicIncident(row);
    const json = JSON.stringify(out);
    expect(json).not.toContain("สมชาย");
    expect(json).not.toContain("0812345678");
    expect(json).not.toContain("เลขที่ 12");
    expect(json).not.toContain("/uploads/incidents/a.jpg");
    expect(out.photo_path).toBe("/stn-eoc/uploads/incidents-public/p.jpg");
    expect(out.description).toBe("ถนนน้ำท่วม รถเล็กผ่านไม่ได้");
    expect(out.report_count).toBe(3);
  });
  it("ปัดพิกัดสำหรับประชาชน แต่คงพิกัดจริงให้เจ้าหน้าที่", () => {
    expect(toPublicIncident(row).latitude).toBe(6.624);
    expect(toPublicIncident(row, { exactLocation: true }).latitude).toBeCloseTo(6.6238123, 6);
  });
});

describe("isPubliclyVisible / defaults", () => {
  it("ซ่อนเมื่อหมดอายุหรือเป็นคำขอความช่วยเหลือ", () => {
    const now = new Date("2026-10-06T12:00:00+07:00");
    expect(isPubliclyVisible({ ...base, publish_status: "published", expires_at: "2026-10-06T13:00:00+07:00" }, now)).toBe(true);
    expect(isPubliclyVisible({ ...base, publish_status: "published", expires_at: "2026-10-06T11:00:00+07:00" }, now)).toBe(false);
    expect(isPubliclyVisible({ ...base, report_type: "help_request", publish_status: "published" }, now)).toBe(false);
  });
  it("หัวข้อเริ่มต้นมาจากแม่แบบ ไม่ใช่ข้อความต้นฉบับ", () => {
    expect(suggestTitle(base)).toBe("ถนนน้ำท่วม รถเล็กผ่านไม่ได้");
    expect(suggestTitle({ report_type: "traffic_report", travel_status: "impassable" })).toBe("ถนนผ่านไม่ได้");
    expect(defaultExpiryHours({ report_type: "traffic_report" })).toBe(24);
  });
});

describe("findDuplicateCandidates", () => {
  it("หาเรื่องหมวดเดียวกันที่อยู่ใกล้และเวลาใกล้กัน", () => {
    const others = [
      { ...base, id: 2, latitude: 6.6250, longitude: 100.0750 },                       // ~130 ม.
      { ...base, id: 3, latitude: 6.6500, longitude: 100.0750 },                       // ~3 กม.
      { ...base, id: 4, problem_category: "power_out" },                                // คนละหมวด
      { ...base, id: 5, created_at: "2026-10-09T10:00:00+07:00" },                     // คนละวัน
      { ...base, id: 6, merged_into_id: 2 }                                             // ถูกรวมแล้ว
    ];
    expect(findDuplicateCandidates(base, others).map((item) => item.id)).toEqual([2]);
    expect(findDuplicateCandidates({ ...base, report_type: "help_request" }, others)).toEqual([]);
  });
});

describe("incidentPhotos path helpers", () => {
  it("อ่าน path รูปทั้งแบบเดี่ยวและ JSON และกัน path แปลก", () => {
    expect(parsePhotoPaths('["/uploads/incidents/a.jpg","/uploads/incidents/b.jpg"]')).toHaveLength(2);
    expect(parsePhotoPaths("/uploads/incidents/a.jpg")).toEqual(["/uploads/incidents/a.jpg"]);
    expect(parseUploadPath("/stn-eoc/uploads/incidents/a.jpg")).toEqual({ dir: "incidents", file: "a.jpg" });
    expect(parseUploadPath("/uploads/incidents/../../etc/passwd")).toBeNull();
  });
});
