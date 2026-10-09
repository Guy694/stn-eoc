import { decodePerson, decryptNote, encodePerson, encryptNote } from "@/lib/vulnerablePersonsCrypto";
import { validatePerson } from "@/lib/vulnerablePersons";

describe("vulnerablePersonsCrypto", () => {
  const original = process.env.SECRET_KEY;
  beforeAll(() => { process.env.SECRET_KEY = "test-secret-key-at-least-32-characters!!"; });
  afterAll(() => { process.env.SECRET_KEY = original; });

  it("แถวที่บันทึกไม่มีชื่อ เบอร์ หรือพิกัดเป็นข้อความธรรมดา และถอดกลับได้ครบ", () => {
    const { value } = validatePerson({
      name: "นายทดสอบ ระบบ", vulnerable_type: "bedridden", district: "ละงู", tambon: "กำแพง", village: "บ้านทดสอบ",
      phone: "0812345678", address: "99 ม.1", needs: "ใช้ออกซิเจน", caregiver_name: "ลูกสาว", caregiver_phone: "0898765432", lat: "6.85", lng: "99.79"
    });
    const row = encodePerson(value);
    const stored = JSON.stringify(row);
    for (const secret of ["นายทดสอบ", "0812345678", "99 ม.1", "ออกซิเจน", "ลูกสาว", "6.85", "99.79"]) expect(stored).not.toContain(secret);
    expect(row).toMatchObject({ district: "ละงู", tambon: "กำแพง", village: "บ้านทดสอบ", vulnerable_type: "bedridden" });

    const person = decodePerson({ id: 7, ...row });
    expect(person).toMatchObject({
      id: 7, name: "นายทดสอบ ระบบ", phone: "0812345678", address: "99 ม.1", needs: "ใช้ออกซิเจน",
      caregiver_name: "ลูกสาว", caregiver_phone: "0898765432", location: { lat: 6.85, lng: 99.79 }
    });
  });

  it("ถอดรหัสไม่ได้ → ไม่ล้มทั้งรายการ", () => {
    const person = decodePerson({ id: 1, vulnerable_type: "elderly", district: "ก", tambon: "ข", name_enc: "v1:bad:bad:bad" });
    expect(person.decrypt_error).toBe(true);
    expect(person.location).toBeNull();
  });

  it("บันทึกหน้างานเข้ารหัส", () => {
    const payload = encryptNote("ส่งยาแล้ว");
    expect(payload).not.toContain("ส่งยา");
    expect(decryptNote(payload)).toBe("ส่งยาแล้ว");
    expect(decryptNote("garbage")).toBeNull();
  });
});
