/** @jest-environment node */
const mockGenerate = jest.fn();
jest.mock("@google/generative-ai", () => ({ GoogleGenerativeAI: jest.fn(() => ({ getGenerativeModel: jest.fn(() => ({ generateContent: mockGenerate })) })) }));
jest.mock("@/lib/db", () => ({ query: jest.fn(async () => []) }));
jest.mock("@/lib/telegram", () => ({ notifySecurityEvent: jest.fn() }));
jest.mock("@/lib/auth", () => ({ requireAuth: jest.fn() }));
jest.mock("@/lib/rateLimit", () => ({ consumeRateLimit: jest.fn(async () => ({ allowed: true })), tooManyRequestsResponse: jest.fn() }));
jest.mock("@/lib/routeAdvice", () => ({ isRouteAdviceQuestion: () => false, getRouteAdvice: jest.fn() }));
jest.mock("@/lib/assistantData", () => ({
  loadAssistantData: jest.fn(async () => ({
    now: Date.now(), districts: [], warnings: [], shelters: [], sheltersOpen: false, facilities: [], openEvents: [],
    waterStations: [{ id: "9", name: "[ทดสอบ] ละงู", river: "คลองละงู", amphoe: "ละงู", bankDiff: 0.1 }], waterHistory: {}, waterObservedAt: null
  }))
}));

process.env.GEMINI_API_KEY = "test-key";
const { POST } = require("@/app/api/chatbot/query/route");
const ask = async (message, conversationHistory = []) => (await (await POST(new Request("http://x/api", { method: "POST", body: JSON.stringify({ message, conversationHistory }) }))).json()).data;

beforeEach(() => mockGenerate.mockReset());

test("คำถามต่อเนื่องตอบจากข้อมูลจริงโดยไม่เรียก AI", async () => {
  const data = await ask("แล้วละงูล่ะ", [{ role: "user", content: "ระดับน้ำในคลองตอนนี้" }]);
  expect(data.source).toBe("live_water");
  expect(data.answer).toContain("ละงู");
  expect(mockGenerate).not.toHaveBeenCalled();
});

test("คำถามขอคำแนะนำ: ส่งข้อเท็จจริงจากระบบให้ AI คิดต่อ", async () => {
  mockGenerate.mockResolvedValueOnce({ response: { text: () => "**ควร**ขนของขึ้นที่สูงครับ" } });
  const data = await ask("น้ำในคลองละงูตอนนี้ ควรอพยพไหม");
  expect(data.answer).toBe("ควรขนของขึ้นที่สูงครับ");
  expect(mockGenerate.mock.calls[0][0]).toContain("ข้อเท็จจริงที่เกี่ยวกับคำถามนี้");
  expect(mockGenerate.mock.calls[0][0]).toContain("[ทดสอบ] ละงู");
});

test("AI ขัดข้อง: ยังตอบด้วยข้อมูลจริงแทนการบอกว่าตอบไม่ได้", async () => {
  mockGenerate.mockRejectedValueOnce(new Error("quota"));
  const data = await ask("น้ำในคลองละงูตอนนี้ ควรอพยพไหม");
  expect(data.source).toBe("live_water");
  expect(data.source_label).toContain("AI ไม่พร้อม");
});

test("เรื่องเร่งด่วนถึงชีวิต (งูกัด) ตอบจากคลังความรู้ทันที ไม่รอ AI", async () => {
  const data = await ask("ถูกงูกัดที่ขาต้องทำยังไง");
  expect(data.source).toBe("knowledge_snakebite");
  expect(data.answer).toContain("ห้ามกรีดแผล");
  expect(mockGenerate).not.toHaveBeenCalled();
});

test("ถามโรค/การรักษา: AI ตอบโดยยึดความรู้มาตรฐานของศูนย์ฯ", async () => {
  mockGenerate.mockResolvedValueOnce({ response: { text: () => "มีไข้หลังลุยน้ำควรรีบพบแพทย์ครับ" } });
  const data = await ask("มีไข้ ปวดน่องหลังลุยน้ำ เป็นอะไร รักษายังไง");
  expect(data.answer).toContain("พบแพทย์");
  expect(mockGenerate.mock.calls[0][0]).toContain("ความรู้มาตรฐานของศูนย์ฯ");
  expect(mockGenerate.mock.calls[0][0]).toContain("โรคฉี่หนู");
});

test("AI ขัดข้อง: ตอบจากคลังความรู้แทน", async () => {
  mockGenerate.mockRejectedValueOnce(new Error("quota"));
  const data = await ask("น้ำกำลังขึ้น ต้องทำยังไงบ้าง");
  expect(data.source).toBe("knowledge_flood-rising");
  expect(data.answer).toContain("ตัดไฟที่เบรกเกอร์");
});
