// ส่งอีเมลผ่าน SMTP ด้วยโมดูลในตัวของ Node (net/tls) — ไม่ต้องติดตั้งแพ็กเกจเพิ่ม
// รองรับ: พอร์ต 465 (TLS ตั้งแต่ต้น) และ 587/25 (STARTTLS) · AUTH PLAIN/LOGIN · ข้อความ UTF-8 ทั้งหัวเรื่องและเนื้อหา
// ตั้งค่าใน .env: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM (ไม่ตั้ง = ระบบไม่ส่งอีเมล ไม่ error)
import net from "node:net";
import tls from "node:tls";
import crypto from "node:crypto";

const EMAIL_PATTERN = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || "").trim());
}

/** อ่านค่าตั้งค่า SMTP (ค่าว่าง = ยังไม่ตั้ง) */
export function mailConfig(env = process.env) {
  const host = String(env.SMTP_HOST || "").trim();
  const port = Number.parseInt(env.SMTP_PORT || "", 10) || 587;
  const secureRaw = String(env.SMTP_SECURE || "").trim().toLowerCase();
  const secure = secureRaw ? ["1", "true", "yes", "on"].includes(secureRaw) : port === 465;
  const user = String(env.SMTP_USER || "").trim();
  const pass = String(env.SMTP_PASS || "");
  const from = String(env.MAIL_FROM || user || "").trim();
  const fromName = String(env.MAIL_FROM_NAME || "ศูนย์ข้อมูลสถานการณ์ฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล").trim();
  return { host, port, secure, user, pass, from, fromName, configured: Boolean(host && isValidEmail(from)) };
}

export function isMailConfigured(env = process.env) {
  return mailConfig(env).configured;
}

const clean = (value) => String(value ?? "").replace(/[\r\n]+/g, " ").trim();

/** หัวเรื่อง/ชื่อภาษาไทย: เข้ารหัสแบบ RFC 2047 (UTF-8 base64) */
export function encodeHeaderWord(value) {
  const text = clean(value);
  if (/^[\x20-\x7e]*$/.test(text)) return text;
  return `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function base64Lines(text) {
  return Buffer.from(String(text ?? ""), "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

/** สร้างข้อความอีเมล (multipart/alternative: ข้อความล้วน + HTML) */
export function buildMessage({ from, fromName, to, subject, text, html, date = new Date(), messageId }) {
  const boundary = `stn-${crypto.randomBytes(12).toString("hex")}`;
  const domain = String(from).split("@")[1] || "localhost";
  const headers = [
    `From: ${fromName ? `${encodeHeaderWord(fromName)} ` : ""}<${clean(from)}>`,
    `To: <${clean(to)}>`,
    `Subject: ${encodeHeaderWord(subject)}`,
    `Date: ${date.toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: ${messageId || `<${crypto.randomUUID()}@${domain}>`}`,
    "MIME-Version: 1.0",
    "Auto-Submitted: auto-generated"
  ];
  if (!html) {
    return [...headers, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", base64Lines(text), ""].join("\r\n");
  }
  return [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(html),
    `--${boundary}--`,
    ""
  ].join("\r\n");
}

class SmtpError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "SmtpError";
    this.code = code;
  }
}

/** อ่านคำตอบ SMTP ทีละชุด (รองรับคำตอบหลายบรรทัด "250-...") */
function createReader(getSocket) {
  let buffer = "";
  let lines = [];
  let waiting = null;
  let failure = null;

  const flush = () => {
    if (!waiting) return;
    if (failure) {
      const { reject } = waiting;
      waiting = null;
      reject(failure);
      return;
    }
    const endIndex = lines.findIndex((line) => /^\d{3}(?: |$)/.test(line));
    if (endIndex === -1) return;
    const response = lines.slice(0, endIndex + 1);
    lines = lines.slice(endIndex + 1);
    const { resolve } = waiting;
    waiting = null;
    resolve({ code: Number(response[endIndex].slice(0, 3)), lines: response });
  };

  const onData = (chunk) => {
    buffer += chunk.toString("utf8");
    const parts = buffer.split(/\r?\n/);
    buffer = parts.pop();
    lines.push(...parts.filter(Boolean));
    flush();
  };
  const onError = (error) => {
    failure = error;
    flush();
  };

  return {
    attach() {
      const socket = getSocket();
      socket.on("data", onData);
      socket.on("error", onError);
      socket.on("close", () => onError(new SmtpError("เซิร์ฟเวอร์อีเมลปิดการเชื่อมต่อ")));
    },
    detach() {
      const socket = getSocket();
      socket.removeAllListeners("data");
      socket.removeAllListeners("error");
      socket.removeAllListeners("close");
      socket.on("error", () => {}); // กัน error หลังเลิกฟัง (เช่น ปิดการเชื่อมต่อ) ทำให้โปรเซสล้ม
    },
    next() {
      return new Promise((resolve, reject) => {
        waiting = { resolve, reject };
        flush();
      });
    }
  };
}

function connect({ host, port, secure, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const options = { host, port, servername: host };
    const socket = secure ? tls.connect(options) : net.connect(options);
    const ready = secure ? "secureConnect" : "connect";
    socket.setTimeout(timeoutMs, () => socket.destroy(new SmtpError("เชื่อมต่อเซิร์ฟเวอร์อีเมลไม่ทันเวลา")));
    socket.once(ready, () => resolve(socket));
    socket.once("error", reject);
  });
}

/**
 * ส่งอีเมลหนึ่งฉบับ
 * @returns {Promise<{ sent: true, messageId: string }>}
 */
export async function sendMail({ to, subject, text, html }, { env = process.env, timeoutMs = 15000, hostname = "stn-eoc.local" } = {}) {
  const config = mailConfig(env);
  if (!config.configured) throw new SmtpError("ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์อีเมล (SMTP_HOST, MAIL_FROM)", "NOT_CONFIGURED");
  if (!isValidEmail(to)) throw new SmtpError("อีเมลผู้รับไม่ถูกต้อง", "BAD_RECIPIENT");

  const domain = config.from.split("@")[1];
  const messageId = `<${crypto.randomUUID()}@${domain}>`;
  const message = buildMessage({ from: config.from, fromName: config.fromName, to, subject, text, html, messageId });

  let socket = await connect({ ...config, timeoutMs });
  const reader = createReader(() => socket);
  reader.attach();

  const expect = async (codes, step) => {
    const response = await reader.next();
    if (!codes.includes(response.code)) {
      throw new SmtpError(`เซิร์ฟเวอร์อีเมลปฏิเสธขั้น ${step} (${response.lines.join(" ").slice(0, 200)})`, response.code);
    }
    return response;
  };
  const command = async (line, codes, step) => {
    socket.write(`${line}\r\n`);
    return expect(codes, step);
  };

  try {
    await expect([220], "เชื่อมต่อ");
    let ehlo = await command(`EHLO ${hostname}`, [250], "EHLO");

    if (!config.secure && ehlo.lines.some((line) => /STARTTLS/i.test(line))) {
      await command("STARTTLS", [220], "STARTTLS");
      reader.detach();
      socket = await new Promise((resolve, reject) => {
        const upgraded = tls.connect({ socket, servername: config.host }, () => resolve(upgraded));
        upgraded.once("error", reject);
      });
      socket.setTimeout(timeoutMs, () => socket.destroy(new SmtpError("เซิร์ฟเวอร์อีเมลไม่ตอบสนอง")));
      reader.attach();
      ehlo = await command(`EHLO ${hostname}`, [250], "EHLO");
    }

    if (config.user) {
      const authLine = ehlo.lines.find((line) => /AUTH/i.test(line)) || "";
      if (/PLAIN/i.test(authLine) || !/LOGIN/i.test(authLine)) {
        const token = Buffer.from(`\u0000${config.user}\u0000${config.pass}`, "utf8").toString("base64");
        await command(`AUTH PLAIN ${token}`, [235], "เข้าสู่ระบบอีเมล");
      } else {
        await command("AUTH LOGIN", [334], "เข้าสู่ระบบอีเมล");
        await command(Buffer.from(config.user, "utf8").toString("base64"), [334], "เข้าสู่ระบบอีเมล");
        await command(Buffer.from(config.pass, "utf8").toString("base64"), [235], "เข้าสู่ระบบอีเมล");
      }
    }

    await command(`MAIL FROM:<${config.from}>`, [250], "ผู้ส่ง");
    await command(`RCPT TO:<${clean(to)}>`, [250, 251], "ผู้รับ");
    await command("DATA", [354], "เนื้อหา");
    // dot-stuffing: บรรทัดที่ขึ้นต้นด้วย "." ต้องเติมจุดอีกตัว
    socket.write(`${message.replace(/\r\n\./g, "\r\n..")}\r\n.\r\n`);
    await expect([250], "ส่งข้อความ");
    socket.write("QUIT\r\n");
    return { sent: true, messageId };
  } finally {
    reader.detach();
    socket.end();
  }
}

export { SmtpError };
