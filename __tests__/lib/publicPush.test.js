import { buildWarningPayload, districtsInText, subscriptionWants, validateBroadcastInput, validateSubscriptionInput, warningCandidates, warningKey } from "@/lib/publicPush";

const sub = (extra = {}) => ({ subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "B".padEnd(87, "x"), auth: "a".repeat(22) } }, ...extra });

describe("publicPush", () => {
  test("validateSubscriptionInput keeps only Satun areas", () => {
    const ok = validateSubscriptionInput(sub({ scope: "areas", districts: ["ละงู", "หาดใหญ่"], tambons: ["ละงู|กำแพง", "x|y", "bad"] }), { isAllowedEndpoint: () => true });
    expect(ok.value).toMatchObject({ scope: "areas", districts: ["ละงู"], tambons: ["ละงู|กำแพง"] });
    expect(validateSubscriptionInput(sub({ scope: "areas", districts: [] }), {}).value.scope).toBe("all");
    expect(validateSubscriptionInput(sub(), { isAllowedEndpoint: () => false }).error).toBeTruthy();
    expect(validateSubscriptionInput({ subscription: { endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "short", auth: "a" } } }).error).toBeTruthy();
  });

  test("districtsInText reads district names from Thai warnings", () => {
    expect(districtsInText("ฝนตกหนักมาก สถานีรร.ผังปาล์ม 4 ต.ปาล์มพัฒนา อ.มะนัง จ.สตูล")).toEqual(["มะนัง"]);
    expect(districtsInText("น้ำล้นตลิ่ง สถานีบ้านควน อ.เมือง")).toEqual(["เมืองสตูล"]);
    expect(districtsInText("อำเภอละงู และ อ.ทุ่งหว้า").sort()).toEqual(["ทุ่งหว้า", "ละงู"].sort());
    expect(districtsInText("เตือนภัยทั้งภาคใต้")).toEqual([]);
  });

  test("warningKey ignores changing numbers but not changing words, and resets daily", () => {
    const now = Date.parse("2026-10-09T10:00:00+07:00");
    const a = warningKey({ message: "ฝนตกหนัก สถานีA อ.ละงู ฝน 24 ชม. 95.2 มม." }, now);
    expect(warningKey({ message: "ฝนตกหนัก สถานีA อ.ละงู ฝน 24 ชม. 120.4 มม." }, now)).toBe(a);
    expect(warningKey({ message: "น้ำล้นตลิ่ง สถานีA อ.ละงู" }, now)).not.toBe(a);
    expect(warningKey({ message: "ฝนตกหนัก สถานีA อ.ละงู ฝน 24 ชม. 95.2 มม." }, now + 864e5)).not.toBe(a);
  });

  test("warningCandidates keeps high level only, deduplicated", () => {
    const list = warningCandidates([
      { level: "watch", message: "น้ำใกล้ตลิ่ง อ.ละงู" },
      { level: "high", message: "น้ำล้นตลิ่ง อ.ละงู 0.20 ม." },
      { level: "high", message: "น้ำล้นตลิ่ง อ.ละงู 0.35 ม." }
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].districts).toEqual(["ละงู"]);
  });

  test("subscriptionWants routes by district", () => {
    expect(subscriptionWants({ scope: "all" }, ["ละงู"])).toBe(true);
    expect(subscriptionWants({ scope: "areas", districts: ["มะนัง"] }, ["ละงู"])).toBe(false);
    expect(subscriptionWants({ scope: "areas", tambons: ["ละงู|กำแพง"] }, ["ละงู"])).toBe(true);
    expect(subscriptionWants({ scope: "areas", districts: ["มะนัง"] }, [])).toBe(true);
  });

  test("buildWarningPayload combines items", () => {
    const p = buildWarningPayload([{ message: "a อ.ละงู", districts: ["ละงู"] }, { message: "b", districts: [] }], Date.parse("2026-10-09T10:00:00+07:00"));
    expect(p.title).toContain("2 เรื่อง");
    expect(p.body).toContain("• a");
    expect(p.tag).toBe("warn-2026-10-09");
  });

  test("validateBroadcastInput restricts links to this site", () => {
    expect(validateBroadcastInput({ title: "ทดสอบ", body: "ข้อความทดสอบระบบ", url: "https://evil.com" }).error).toBeTruthy();
    expect(validateBroadcastInput({ title: "ทดสอบ", body: "ข้อความทดสอบระบบ", url: "/stn-eoc/public/shelters/", districts: ["ละงู", "x"] }).value).toMatchObject({ url: "/stn-eoc/public/shelters/", districts: ["ละงู"], level: "info" });
    expect(validateBroadcastInput({ title: "ท", body: "x" }).error).toBeTruthy();
  });
});

describe("ระดับการส่งอัตโนมัติ / น้ำลดแล้ว / ข้อความสำเร็จรูป", () => {
  const { resolvedCandidates, normalizePushSettings } = jest.requireActual("@/lib/publicPush");
  const { PUSH_TEMPLATES, fillTemplate, unfilledPlaceholders, AUTO_LEVELS } = jest.requireActual("@/lib/pushTemplates");
  const now = Date.parse("2026-10-20T10:00:00+07:00");
  const warnings = [
    { level: "watch", message: "[ทดสอบ] น้ำใกล้ตลิ่ง สถานีA อ.ละงู ต่ำกว่าตลิ่ง 0.30 ม." },
    { level: "high", message: "[ทดสอบ] น้ำล้นตลิ่ง สถานีB อ.ควนโดน สูงกว่าตลิ่ง 0.10 ม." }
  ];

  test("ค่าเริ่มต้นส่งเฉพาะเหตุรุนแรง, เลือก watch ได้รวมเฝ้าระวัง", () => {
    expect(warningCandidates(warnings, now)).toHaveLength(1);
    const both = warningCandidates(warnings, now, { level: "watch" });
    expect(both.map((w) => w.level)).toEqual(["watch", "high"]);
    expect(normalizePushSettings({ auto_enabled: true }).auto_level).toBe("high");
    expect(normalizePushSettings({ auto_level: "watch" }).auto_level).toBe("watch");
    expect(Object.keys(AUTO_LEVELS)).toEqual(["high", "watch"]);
  });

  test("เฝ้าระวังอย่างเดียว = แจ้งเตือนไม่เร่งด่วน, มีเหตุรุนแรงปน = เตือนภัย", () => {
    const watchOnly = buildWarningPayload(warningCandidates(warnings.slice(0, 1), now, { level: "watch" }), now);
    expect(watchOnly).toMatchObject({ level: "info", title: "เฝ้าระวัง จ.สตูล" });
    const mixed = buildWarningPayload(warningCandidates(warnings, now, { level: "watch" }), now);
    expect(mixed.level).toBe("high");
    expect(mixed.body.indexOf("ล้นตลิ่ง")).toBeLessThan(mixed.body.indexOf("ใกล้ตลิ่ง"));
  });

  test("น้ำลดแล้ว: เฉพาะสถานีที่พ้นล้นตลิ่ง ส่งถึงอำเภอนั้น วันละครั้งต่อสถานี", () => {
    const items = resolvedCandidates([
      { kind: "water", stationId: "T1", stationName: "[ทดสอบ] บ้านปันจอร์", amphoe: "ควนโดน", previousState: "overflow", state: "near", bankDiff: -0.2 },
      { kind: "water", stationId: "T2", stationName: "x", amphoe: "ละงู", previousState: "normal", state: "near" },
      { kind: "rain", stationId: "rain:1", previousState: "severe", state: "watch" }
    ], now);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ key: "r:2026-10-20:T1", districts: ["ควนโดน"], level: "info" });
    expect(items[0].message).toContain("ต่ำกว่าตลิ่ง 0.20 ม.");
  });

  test("ข้อความสำเร็จรูป: เติมอำเภอ ยาวไม่เกินกำหนด และบอกส่วนที่ต้องแก้", () => {
    for (const template of PUSH_TEMPLATES) {
      const filled = fillTemplate(template, ["ควนโดน"]);
      expect(filled.title.length).toBeLessThanOrEqual(100);
      expect(filled.body.length).toBeLessThanOrEqual(400);
      expect(filled.title).not.toContain("{อำเภอ}");
      expect(validateBroadcastInput({ ...filled, districts: ["ควนโดน"] }).error).toBeUndefined();
    }
    expect(fillTemplate(PUSH_TEMPLATES[0], []).title).toContain("จ.สตูล");
    expect(unfilledPlaceholders("[ทดสอบ] อพยพ [หมู่ที่] [ตำบล] [ตำบล]")).toEqual(["[หมู่ที่]", "[ตำบล]"]);
  });
});

test("ส่งข้อความถึงเจ้าหน้าที่เท่านั้น: ไม่แยกอำเภอ", () => {
  const officers = validateBroadcastInput({ title: "[ทดสอบ] ประชุมด่วน", body: "[ทดสอบ] เจ้าหน้าที่ทุกทีมเข้าห้อง EOC 14.00 น.", districts: ["ละงู"], audience: "officers" });
  expect(officers.value).toMatchObject({ audience: "officers", districts: [] });
  expect(validateBroadcastInput({ title: "ทดสอบ", body: "ข้อความทดสอบระบบ", audience: "x" }).value.audience).toBe("public");
});
