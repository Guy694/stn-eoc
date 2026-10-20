import { deleteOfficersInBatch } from "@/lib/officerBatch";

test("ลบหลายคน: แยกผลสำเร็จ / มีประวัติ (เสนอระงับแทน) / ผิดพลาดอื่น และทำต่อจนครบ", async () => {
  const officers = [{ id: 1, username: "a" }, { id: 2, username: "b" }, { id: 3, username: "c" }, { id: 4, username: "d" }];
  const calls = [];
  const result = await deleteOfficersInBatch(officers, async (officer) => {
    calls.push(officer.id);
    if (officer.id === 2) { const error = new Error("มีประวัติ"); error.payload = { code: "HAS_HISTORY" }; throw error; }
    if (officer.id === 3) throw new Error("เครือข่ายขัดข้อง");
  });
  expect(calls).toEqual([1, 2, 3, 4]);
  expect(result.deleted.map((o) => o.id)).toEqual([1, 4]);
  expect(result.withHistory.map((o) => o.id)).toEqual([2]);
  expect(result.failed).toEqual([{ officer: officers[2], message: "เครือข่ายขัดข้อง" }]);
});
