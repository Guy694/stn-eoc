import { occupancyStatus, toPublicShelter } from "@/lib/publicShelters";

describe("publicShelters", () => {
  test("ไม่ส่งข้อมูลบุคคลและตัวเลขกลุ่มเปราะบาง", () => {
    const row = {
      id: 1, sheltername: "โรงเรียนบ้านควน", lat: 6.6, lon: 100, shelter_capacity: 100, current_occupancy: 85,
      contact_phone: "074000000", coordinator_name: "นาย ก", coordinator_phone: "0811111111",
      health_service_name: "รพ.สต.", health_contact_phone: "0822222222", occupancy_bedridden: 2, import_source: "sheet"
    };
    const shelter = toPublicShelter(row);
    expect(shelter).not.toHaveProperty("coordinator_name");
    expect(shelter).not.toHaveProperty("coordinator_phone");
    expect(shelter).not.toHaveProperty("health_contact_phone");
    expect(shelter).not.toHaveProperty("occupancy_bedridden");
    expect(shelter).toMatchObject({ contact_phone: "074000000", vacancy: 15, occupancy_status: "near_full" });
  });

  test("สถานะความจุ", () => {
    expect(occupancyStatus(0, 0)).toBe("unknown");
    expect(occupancyStatus(100, 100)).toBe("full");
    expect(occupancyStatus(100, 10)).toBe("available");
  });
});
