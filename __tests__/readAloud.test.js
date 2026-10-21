import { riskSpeechText } from "@/lib/myRisk";
import { speechChunks } from "@/lib/readAloud";

describe("อ่านผลประเมินออกเสียง", () => {
  test("เรียงเป็น ระดับ → ตำแหน่ง → เหตุผล → สิ่งที่ควรทำ และตัดให้ไม่ยาวเกิน", () => {
    const text = riskSpeechText({
      label: "เฝ้าระวัง",
      place: "บ้าน[ทดสอบ] ต.พิมาน อ.เมืองสตูล",
      reasons: ["คลองใกล้บ้านต่ำกว่าตลิ่ง 0.30 ม.", "ฝน 24 ชม. 45 มม.", "เหตุผลที่สาม", "เหตุผลที่สี่ไม่ควรถูกอ่าน"],
      advice: ["ยกของขึ้นที่สูง", "เตรียมกระเป๋าฉุกเฉิน"]
    });
    expect(text.startsWith("ความเสี่ยงน้ำท่วมที่บ้านคุณตอนนี้ ระดับเฝ้าระวัง.")).toBe(true);
    expect(text).toContain("สิ่งที่ควรทำ. ยกของขึ้นที่สูง.");
    expect(text).not.toContain("เหตุผลที่สี่");
  });

  test("แบ่งเป็นช่วงสั้น ขยายคำย่อและหน่วยให้อ่านเป็นธรรมชาติ", () => {
    const chunks = speechChunks(riskSpeechText({ label: "ปกติ", place: "ต.พิมาน อ.เมืองสตูล", reasons: ["ฝน 24 ชม. 45 มม."], advice: ["ก".repeat(400)] }));
    expect(chunks.every((chunk) => chunk.length <= 180)).toBe(true);
    const joined = chunks.join(" ");
    expect(joined).toContain("อำเภอเมืองสตูล");
    expect(joined).toContain("45 มิลลิเมตร");
    expect(joined).toContain("ชั่วโมง");
  });
});
