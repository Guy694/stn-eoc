import { helpRequestSpeech, setVoiceEnabled, speak, speechText, waterAlertSpeech } from "@/lib/alertSpeech";

describe("ข้อความเสียงพูด", () => {
  it("ตัดอีโมจิ ขยายคำย่อ หน่วย และเวลา", () => {
    expect(speechText("🚨 [ทดสอบ] น้ำล้นตลิ่ง — สถานีตัวอย่าง อ.ละงู ต.กำแพง สูงกว่าตลิ่ง 0.25 ม."))
      .toBe("ทดสอบ น้ำล้นตลิ่ง สถานีตัวอย่าง อำเภอละงู ตำบลกำแพง สูงกว่าตลิ่ง 0.25 เมตร");
    expect(speechText("ฝน 24 ชม. 95.0 มม. เวลา 14.30 น. รพ.ละงู #12")).toBe("ฝน 24 ชั่วโมง 95.0 มิลลิเมตร เวลา 14 นาฬิกา 30 นาที โรงพยาบาลละงู หมายเลข 12");
  });

  it("แจ้งเตือนระดับน้ำ/ฝน: หัวข้อตามชนิด + เรื่อง + ตัวเลข", () => {
    expect(waterAlertSpeech([{ kind: "water", level: "critical", title: "🚨 น้ำล้นตลิ่ง — สถานีบ้านควน", message: "ต.ควนโพธิ์ อ.เมืองสตูล\nสูงกว่าตลิ่ง 0.30 ม." }]))
      .toBe("แจ้งเตือนระดับน้ำ น้ำล้นตลิ่ง สถานีบ้านควน ตำบลควนโพธิ์ อำเภอเมืองสตูล สูงกว่าตลิ่ง 0.30 เมตร");
    expect(waterAlertSpeech([{ kind: "rain", level: "critical", title: "⛈️ ฝนหนักมาก — สถานีมะนัง", message: "ต.ปาล์มพัฒนา อ.มะนัง\nฝน 24 ชม. 95.0 มม. (ฝนหนักมาก)" }, { kind: "water", level: "serious", title: "x" }]))
      .toBe("แจ้งเตือนปริมาณฝนตก ฝนหนักมาก สถานีมะนัง ตำบลปาล์มพัฒนา อำเภอมะนัง ฝน 24 ชั่วโมง 95.0 มิลลิเมตร และอีก 1 เรื่อง");
    expect(waterAlertSpeech([{ kind: "water", level: "info", title: "✅ น้ำลดลงต่ำกว่าตลิ่งแล้ว — สถานีบ้านควน", message: "" }])).toBe("แจ้งระดับน้ำ น้ำลดลงต่ำกว่าตลิ่งแล้ว สถานีบ้านควน");
  });

  it("คำขอความช่วยเหลือ", () => {
    expect(helpRequestSpeech([{ id: 5, kind: "new", place: "ต.กำแพง อ.ละงู" }])).toBe("แจ้งเตือนคำขอความช่วยเหลือใหม่ ที่ ตำบลกำแพง อำเภอละงู");
    expect(helpRequestSpeech([{ id: 7, kind: "overdue", waited_min: 31.6 }])).toBe("คำขอความช่วยเหลือ หมายเลข 7 ยังไม่มีผู้รับเรื่อง รอมาแล้ว 32 นาที");
  });
});

describe("speak", () => {
  let spoken;
  const install = (voices) => {
    spoken = [];
    window.speechSynthesis = { getVoices: () => voices, cancel: jest.fn(), speak: (utterance) => spoken.push(utterance), addEventListener: jest.fn(), removeEventListener: jest.fn() };
    window.SpeechSynthesisUtterance = function Utterance(text) { this.text = text; };
  };
  afterEach(() => { delete window.speechSynthesis; delete window.SpeechSynthesisUtterance; window.localStorage.clear(); });

  it("พูดด้วยเสียงภาษาไทย", async () => {
    install([{ name: "Samantha", lang: "en-US" }, { name: "Kanya", lang: "th-TH", localService: true }]);
    await expect(speak("แจ้งเตือนระดับน้ำ")).resolves.toBe(true);
    expect(spoken[0]).toMatchObject({ text: "แจ้งเตือนระดับน้ำ", lang: "th-TH", voice: { name: "Kanya" } });
  });
  it("ไม่มีเสียงไทย หรือปิดเสียงพูด → ไม่พูด", async () => {
    install([{ name: "Samantha", lang: "en-US" }]);
    await expect(speak("ทดสอบ")).resolves.toBe(false);
    install([{ name: "Kanya", lang: "th-TH" }]);
    setVoiceEnabled(false);
    await expect(speak("ทดสอบ")).resolves.toBe(false);
    await expect(speak("ทดสอบ", { force: true })).resolves.toBe(true);
  });
});
