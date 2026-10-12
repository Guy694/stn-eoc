import { escalationStep, helpAlertItem, officerHelpPayload, summaryText, waitedText, MAX_ESCALATIONS } from "@/lib/helpAlerts";

const desc = "ประเภทความช่วยเหลือ: อพยพ/เคลื่อนย้าย\nเหตุผลการขอความช่วยเหลือ: น้ำท่วมบ้าน มีผู้สูงอายุติดเตียง 1 คน";

describe("helpAlerts", () => {
  test("summary and category come from the help description", () => {
    expect(summaryText(desc)).toBe("น้ำท่วมบ้าน มีผู้สูงอายุติดเตียง 1 คน");
    expect(summaryText("x".repeat(200), 20)).toHaveLength(20);
    const item = helpAlertItem({ id: 7, created_at: "2026-10-10T03:00:00Z", district: "ละงู", sub_district: "กำแพง", village: "ทุ่งเสม็ด", description: desc, urgency: "high", phone: "0812345678", first_name: "สมชาย" }, Date.parse("2026-10-10T03:45:00Z"));
    expect(item).toMatchObject({ id: 7, waited_min: 45, escalation: 1, category: "อพยพ/เคลื่อนย้าย", place: "บ.ทุ่งเสม็ด ต.กำแพง อ.ละงู" });
    expect(JSON.stringify(item)).not.toMatch(/0812345678|สมชาย/);
  });

  test("escalation every 30 minutes, capped", () => {
    expect(escalationStep(29)).toBe(0);
    expect(escalationStep(30)).toBe(1);
    expect(escalationStep(95)).toBe(3);
    expect(escalationStep(10_000)).toBe(MAX_ESCALATIONS);
  });

  test("waited text and push payload", () => {
    expect(waitedText(45)).toBe("45 นาที");
    expect(waitedText(135)).toBe("2 ชม. 15 นาที");
    expect(waitedText(60 * 50)).toBe("2 วัน 2 ชม.");
    const item = { id: 9, waited_min: 65, place: "ต.ฉลุง อ.เมืองสตูล", urgency: "critical", category: "อาหาร/น้ำ", summary: "ติดอยู่ในบ้าน" };
    expect(officerHelpPayload(item, 0).title).toContain("ใหม่ #9");
    const late = officerHelpPayload(item, 2);
    expect(late.title).toContain("1 ชม. 5 นาที");
    expect(late.url).toBe("/stn-eoc/admin/incident-reports/?status=pending&id=9");
    expect(late.body).toContain("ความเร่งด่วนวิกฤต");
  });
});

describe("visibleHelpAlerts", () => {
  test("new items show until acknowledged; overdue items show once per escalation step", async () => {
    const { visibleHelpAlerts } = await import("@/components/admin/HelpRequestWatcher");
    const pending = [
      { id: 5, waited_min: 95, escalation: 3 },
      { id: 8, waited_min: 10, escalation: 0 },
      { id: 9, waited_min: 2, escalation: 0 }
    ];
    // ยังไม่เคยรับทราบอะไร: เรื่องที่ยังไม่ถึง 30 นาทีเป็น "ใหม่" เรื่องเก่ากว่าเป็น "ค้าง"
    expect(visibleHelpAlerts(pending, 0, {}).map((i) => [i.id, i.kind])).toEqual([[8, "new"], [9, "new"], [5, "overdue"]]);
    // รับทราบถึง #8 แล้ว: #9 ใหม่, #5 ค้าง 3 รอบ (ยังไม่เคยรับทราบรอบไหน), #8 ยังไม่ถึง 30 นาที
    const after = visibleHelpAlerts(pending, 8, {});
    expect(after.map((i) => [i.id, i.kind])).toEqual([[9, "new"], [5, "overdue"]]);
    // รับทราบรอบที่ 3 ของ #5 แล้ว → ไม่แสดงจนกว่าจะถึงรอบ 4
    expect(visibleHelpAlerts(pending, 9, { 5: 3 })).toEqual([]);
    expect(visibleHelpAlerts([{ id: 5, waited_min: 125, escalation: 4 }], 9, { 5: 3 })[0].kind).toBe("overdue");
  });
});
