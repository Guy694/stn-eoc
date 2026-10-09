// สร้างกุญแจ VAPID สำหรับแจ้งเตือนภัยผ่าน Web Push — คัดลอก 3 บรรทัดที่ได้ไปใส่ใน .env ของเซิร์ฟเวอร์
// ใช้กุญแจชุดเดิมตลอด: ถ้าเปลี่ยน ผู้ที่สมัครไว้แล้วจะไม่ได้รับแจ้งเตือนจนกว่าจะกดสมัครใหม่
import crypto from "node:crypto";

const ecdh = crypto.createECDH("prime256v1");
ecdh.generateKeys();
console.log(`VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString("base64url")}`);
console.log(`VAPID_PRIVATE_KEY=${ecdh.getPrivateKey().toString("base64url")}`);
console.log("VAPID_SUBJECT=mailto:ใส่อีเมลผู้ดูแลระบบ");
