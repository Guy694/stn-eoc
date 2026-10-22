/** @jest-environment node */
import net from "node:net";
import { buildMessage, encodeHeaderWord, isValidEmail, mailConfig, sendMail } from "@/lib/mailer";
import { buildApprovalEmail, buildRejectionEmail, notifyAccountDecision } from "@/lib/accountEmails";

jest.mock("@/lib/db", () => ({ query: jest.fn(), getPool: jest.fn() }));

/** เซิร์ฟเวอร์ SMTP จำลอง (ไม่มี TLS) บันทึกคำสั่งและข้อความที่ได้รับ */
function fakeSmtp({ auth = "AUTH PLAIN LOGIN" } = {}) {
  const received = { commands: [], data: "" };
  const server = net.createServer((socket) => {
    let inData = false;
    let buffer = "";
    socket.write("220 fake ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (inData) {
        const end = buffer.indexOf("\r\n.\r\n");
        if (end === -1) return;
        received.data = buffer.slice(0, end);
        buffer = buffer.slice(end + 5);
        inData = false;
        socket.write("250 queued\r\n");
      }
      let index;
      while (!inData && (index = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        received.commands.push(line);
        if (line.startsWith("EHLO")) socket.write(`250-fake\r\n250-${auth}\r\n250 SIZE 1000000\r\n`);
        else if (line.startsWith("AUTH PLAIN")) socket.write("235 ok\r\n");
        else if (line.startsWith("MAIL FROM") || line.startsWith("RCPT TO")) socket.write("250 ok\r\n");
        else if (line === "DATA") { inData = true; socket.write("354 go\r\n"); }
        else if (line === "QUIT") { socket.write("221 bye\r\n"); socket.end(); }
      }
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port, received })));
}

test("ตรวจรูปแบบอีเมลและค่าตั้งค่า", () => {
  expect(isValidEmail("a.b@moph.go.th")).toBe(true);
  expect(isValidEmail("ไม่ใช่อีเมล")).toBe(false);
  expect(isValidEmail("a@b.com\r\nBcc: x@y.com")).toBe(false);
  expect(mailConfig({}).configured).toBe(false);
  expect(mailConfig({ SMTP_HOST: "smtp.x", MAIL_FROM: "eoc@x.go.th", SMTP_PORT: "465" }).secure).toBe(true);
  expect(mailConfig({ SMTP_HOST: "smtp.x", SMTP_USER: "eoc@x.go.th" }).from).toBe("eoc@x.go.th");
});

test("หัวเรื่องภาษาไทยเข้ารหัส และตัดขึ้นบรรทัดใหม่ (กันแทรกหัวอีเมล)", () => {
  expect(encodeHeaderWord("Hello")).toBe("Hello");
  expect(encodeHeaderWord("อนุมัติ")).toMatch(/^=\?UTF-8\?B\?/);
  const message = buildMessage({ from: "eoc@x.go.th", to: "a@b.com\r\nBcc: evil@x.com", subject: "ทดสอบ", text: "สวัสดี" });
  expect(message).not.toMatch(/\r\nBcc:/);
});

test("ส่งอีเมลผ่าน SMTP จำลอง: เข้าสู่ระบบ ส่งผู้ส่ง/ผู้รับ และเนื้อหา UTF-8", async () => {
  const { server, port, received } = await fakeSmtp();
  try {
    const env = { SMTP_HOST: "127.0.0.1", SMTP_PORT: String(port), SMTP_SECURE: "false", SMTP_USER: "eoc@x.go.th", SMTP_PASS: "[ทดสอบ]", MAIL_FROM: "eoc@x.go.th" };
    const result = await sendMail({ to: "officer@x.go.th", subject: "[ทดสอบ] อนุมัติ", text: "ข้อความ [ทดสอบ]", html: "<p>[ทดสอบ]</p>" }, { env, timeoutMs: 3000 });
    expect(result.sent).toBe(true);
    expect(received.commands).toEqual(expect.arrayContaining(["MAIL FROM:<eoc@x.go.th>", "RCPT TO:<officer@x.go.th>", "DATA"]));
    expect(received.commands.some((line) => line.startsWith("AUTH PLAIN "))).toBe(true);
    expect(received.data).toContain("multipart/alternative");
    const textPart = received.data.split("Content-Transfer-Encoding: base64\r\n\r\n")[1].split("\r\n--")[0];
    expect(Buffer.from(textPart.replace(/\r\n/g, ""), "base64").toString("utf8")).toBe("ข้อความ [ทดสอบ]");
  } finally {
    server.close();
  }
});

test("ไม่ได้ตั้งค่า หรือไม่มีอีเมล = ไม่ส่ง และบอกเหตุผล (ไม่ throw)", async () => {
  const officer = { username: "test01", given_name: "[ทดสอบ]", email: "" };
  expect(await notifyAccountDecision(officer, "approved", { configured: true })).toEqual({ sent: false, reason: "ไม่มีอีเมลที่ใช้ได้ในบัญชีนี้" });
  expect((await notifyAccountDecision({ ...officer, email: "t@x.go.th" }, "approved", { configured: false })).reason).toMatch(/ยังไม่ได้ตั้งค่า/);
  const send = jest.fn().mockRejectedValue(new Error("down"));
  expect((await notifyAccountDecision({ ...officer, email: "t@x.go.th" }, "approved", { configured: true, send })).sent).toBe(false);
  const ok = jest.fn().mockResolvedValue({ sent: true });
  expect(await notifyAccountDecision({ ...officer, email: "t@x.go.th" }, "rejected", { configured: true, send: ok, reason: "ข้อมูลไม่ครบ" })).toEqual({ sent: true, to: "t@x.go.th" });
  expect(ok.mock.calls[0][0].text).toContain("ข้อมูลไม่ครบ");
});

test("เนื้อหาอีเมลอนุมัติมีชื่อผู้ใช้ สิทธิ์ และลิงก์เข้าสู่ระบบ · HTML ไม่รับโค้ดแทรก", () => {
  const approval = buildApprovalEmail({ username: "test01", given_name: "<b>[ทดสอบ]</b>", role: "SEhRT" }, { siteUrl: "https://eoc.example/stn-eoc" });
  expect(approval.text).toContain("test01");
  expect(approval.text).toContain("https://eoc.example/stn-eoc/login");
  expect(approval.html).not.toContain("<b>[ทดสอบ]</b>");
  expect(buildRejectionEmail({ username: "x" }, "ซ้ำ").text).toContain("เหตุผล: ซ้ำ");
});
