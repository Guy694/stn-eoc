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
