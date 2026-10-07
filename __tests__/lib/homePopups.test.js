import { announcementPopupId, choosePopup, urgentAlerts } from "@/lib/homePopups";

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
});
