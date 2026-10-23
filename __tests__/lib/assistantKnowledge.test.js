import { KNOWLEDGE_TOPICS, knowledgeAnswer, matchKnowledge } from "@/lib/assistantKnowledge";

const ids = (text) => matchKnowledge(text).map((topic) => topic.id);

test("จับหัวข้อจากคำถามที่คนพิมพ์จริง", () => {
  expect(ids("น้ำกำลังขึ้น ทำยังไงดี")[0]).toBe("flood-rising");
  expect(ids("ท้องเสียช่วงน้ำท่วมทำยังไง")[0]).toBe("diarrhea");
  expect(ids("น้ำกัดเท้า คันมาก")[0]).toBe("athletes-foot");
  expect(ids("ลูกเป็นไข้เลือดออกกินยาอะไรได้")[0]).toBe("dengue");
  expect(ids("คนจมน้ำ ช่วยยังไง")[0]).toBe("drowning-cpr");
  expect(ids("ยาเบาหวานหมด ทำยังไง")[0]).toBe("chronic-meds");
  expect(ids("หลังน้ำลดทำความสะอาดบ้านยังไง")[0]).toBe("after-flood");
});

test("ไม่จับคำที่แค่คล้าย (ไอพี ท้อง ยาก)", () => {
  expect(ids("ไอพีของเว็บคืออะไร")).toEqual([]);
  expect(ids("ปวดท้องน้อย")).not.toContain("mental");
  expect(ids("ระดับน้ำในคลองตอนนี้")).toEqual([]);
  expect(ids("แล้วละงูล่ะ")).toEqual([]); // ชื่ออำเภอ ไม่ใช่งู
});

test("เรื่องเร่งด่วนขึ้นก่อน และคำตอบด้านสุขภาพมีคำเตือนว่าไม่ใช่การวินิจฉัย", () => {
  expect(ids("ตอนลุยน้ำโดนงูกัดแล้วมีแผล")[0]).toBe("snakebite");
  const answer = knowledgeAnswer(matchKnowledge("ตาแดงช่วงน้ำท่วม"));
  expect(answer.answer).toContain("ไม่ใช่การวินิจฉัย");
  expect(knowledgeAnswer([])).toBeNull();
});

test("ทุกหัวข้อมีเนื้อหา ทางลัด และไม่มีเบอร์โทรนอกรายการที่อนุญาต", () => {
  const allowed = new Set(["1669", "1784", "1422", "1323", "1367"]);
  for (const topic of KNOWLEDGE_TOPICS) {
    expect(topic.lines.length).toBeGreaterThan(2);
    const numbers = topic.lines.join(" ").match(/\b1\d{3}\b/g) || [];
    numbers.forEach((number) => expect(allowed.has(number)).toBe(true));
  }
});
