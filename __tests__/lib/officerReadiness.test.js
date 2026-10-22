import {
  effectiveStatus, filterReadiness, isStale, normalizeReadinessInput, roleLabel, sortByUrgency, summarizeBy, summarizeReadiness
} from "@/lib/officerReadiness";

const now = new Date("2026-10-22T09:00:00Z").getTime();
const hoursAgo = (h) => new Date(now - h * 3600e3).toISOString();
const rows = [
  { id: 1, given_name: "[ทดสอบ] ก", role: "SAT", department: "รพ.สตูล", status: "ready", updated_at: hoursAgo(2) },
  { id: 2, given_name: "[ทดสอบ] ข", role: "SAT", department: "รพ.ละงู", status: "need_help", note: "น้ำท่วมบ้าน", updated_at: hoursAgo(1) },
  { id: 3, given_name: "[ทดสอบ] ค", role: "LOGISTICS", department: "รพ.สตูล", status: "unavailable", updated_at: hoursAgo(30) },
  { id: 4, given_name: "[ทดสอบ] ง", role: "LOGISTICS", department: "รพ.สตูล", status: null, updated_at: null }
];

test("ตรวจค่าที่ส่งมา: ขอความช่วยเหลือต้องมีรายละเอียด", () => {
  expect(normalizeReadinessInput({ status: "ready" })).toEqual({ ok: true, value: { status: "ready", note: null } });
  expect(normalizeReadinessInput({ status: "เล่น" }).ok).toBe(false);
  expect(normalizeReadinessInput({ status: "need_help", note: "" }).ok).toBe(false);
  expect(normalizeReadinessInput({ status: "need_help", note: "  น้ำ   ท่วม " }).value.note).toBe("น้ำ ท่วม");
  expect(normalizeReadinessInput({ status: "delayed", note: "x".repeat(256) }).ok).toBe(false);
});

test("สรุปตัวเลขและสถานะเก่า", () => {
  const summary = summarizeReadiness(rows, now);
  expect(summary.counts).toMatchObject({ ready: 1, need_help: 1, unavailable: 1, unreported: 1, delayed: 0 });
  expect(summary).toMatchObject({ total: 4, reported: 3, stale: 1, readyPercent: 25 });
  expect(isStale(hoursAgo(25), now)).toBe(true);
  expect(effectiveStatus({ status: "unknown" })).toBe("unreported");
});

test("ตัวกรองและการเรียงตามความเร่งด่วน", () => {
  expect(filterReadiness(rows, { status: "unreported" }, now).map((row) => row.id)).toEqual([4]);
  expect(filterReadiness(rows, { role: "SAT", search: "น้ำท่วม" }, now).map((row) => row.id)).toEqual([2]);
  expect(filterReadiness(rows, { staleOnly: true }, now).map((row) => row.id)).toEqual([3]);
  expect(filterReadiness(rows, { department: "รพ.สตูล" }, now)).toHaveLength(3);
  expect(sortByUrgency(rows).map((row) => row.id)).toEqual([2, 3, 4, 1]);
});

test("สรุปรายทีม: ทีมที่พร้อมน้อยขึ้นก่อน", () => {
  const groups = summarizeBy(rows, "role", roleLabel);
  expect(groups[0]).toMatchObject({ name: "ทีม LOGISTICS", total: 2, ready: 0 });
  expect(roleLabel("admin")).toBe("ผู้ดูแลระบบ");
});
