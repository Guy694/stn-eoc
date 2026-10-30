import { alertDetail, alertHazard, alertHeadline, announcementPopupId, choosePopup, popupHazard, urgentAlerts } from "@/lib/homePopups";

describe("homePopups", () => {
  const warnings = [
    { level: "watch", message: "น้ำใกล้ตลิ่ง สถานีละงู" },
    { level: "high", message: "น้ำล้นตลิ่ง สถานีบ้านปันจอร์ อ.ควนโดน" }
  ];

  test("เตือนด่วนเฉพาะระดับรุนแรง และ id คงที่ตามข้อความ", () => {
    const urgent = urgentAlerts(warnings);
    expect(urgent).toHaveLength(1);
    expect(urgent[0].id).toBe(urgentAlerts(warnings)[0].id);
  });

  test("เตือนด่วนมาก่อนประกาศ และไม่เด้งซ้ำเรื่องที่เห็นแล้ว", () => {
    const urgent = urgentAlerts(warnings);
    const announcement = { id: 4, title: "ประกาศ", start_date: "2026-10-07" };
    expect(choosePopup({ urgent, announcement }).kind).toBe("urgent");
    const seen = urgent.map((item) => item.id);
    expect(choosePopup({ urgent, announcement, seen }).kind).toBe("announcement");
    expect(choosePopup({ urgent, announcement, seen: [...seen, announcementPopupId(announcement)] })).toBeNull();
    expect(choosePopup({})).toBeNull();
  });

  test("จัดหัวข้อและชนิดภัย: น้ำใช้ภาพ flood ฝนใช้ภาพ rainny", () => {
    const rain = { message: "ฝนตกหนักมาก สถานีบ้านนาข่า ฝน 24 ชม. 95 มม." };
    const flood = { message: "ระดับน้ำอันตราย สถานีสะพานข้ามคลองท่าแพ" };
    expect(alertHeadline(rain)).toBe("ฝนตกหนักมาก");
    expect(alertHeadline(flood)).toBe("ระดับน้ำอันตราย");
    expect(alertHeadline({ message: "น้ำล้นตลิ่ง สถานีบ้านปันจอร์" })).toBe("น้ำล้นตลิ่ง");
    expect(alertHeadline({ message: "น้ำใกล้ตลิ่ง สถานีละงู" })).toBe("น้ำใกล้ล้นตลิ่ง");
    expect(alertHeadline({ message: "ประกาศ สสน. น้ำป่าไหลหลาก" })).toBe("เสี่ยงน้ำท่วมฉับพลัน");
    expect(alertDetail(flood)).toBe("สถานีสะพานข้ามคลองท่าแพ");
    expect(alertDetail({ message: "สถานีบ้านเอ ฝน 24 ชม. 40 มม." })).toBe("สถานีบ้านเอ ฝน 24 ชม. 40 มม.");
    const bank = { message: "น้ำล้นตลิ่ง สถานีบ้านปันจอร์" };
    const near = { message: "น้ำใกล้ตลิ่ง สถานีละงู" };
    expect(alertHazard(rain)).toBe("rain");
    expect(alertHazard(flood)).toBe("water"); // ระดับน้ำอันตราย แต่ยังไม่ถึงตลิ่ง → ไม่ใช้คำว่าน้ำท่วม
    expect(alertHazard(bank)).toBe("flood");
    expect(alertHazard(near)).toBe("flood");
    expect(popupHazard([rain])).toBe("rain");
    expect(popupHazard([rain, flood])).toBe("water");
    expect(popupHazard([flood])).toBe("water");
    expect(popupHazard([rain, flood, bank])).toBe("flood");
  });
});
