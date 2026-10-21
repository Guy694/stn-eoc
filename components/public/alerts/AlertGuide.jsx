// คู่มือสั้น: รับแจ้งเตือนภัยบนมือถือ (Android / iPhone) และทำให้มีเสียง
import { Share, SquarePlus } from "lucide-react";

const STEPS = {
  android: {
    title: "Android (Chrome)",
    items: [
      <>กด <b>รับแจ้งเตือนภัย</b> แล้วกด <b>อนุญาต</b></>,
      <>ให้มีเสียง: การตั้งค่า › แอป › Chrome › การแจ้งเตือน › เลือกหัวข้อของเว็บนี้ › <b>ส่งเสียงเตือน</b></>,
      <>ถ้าแจ้งเตือนมาช้า ปิดโหมดประหยัดแบตเตอรี่ของ Chrome</>
    ]
  },
  ios: {
    title: "iPhone / iPad (iOS 16.4 ขึ้นไป)",
    items: [
      <>เปิดเว็บนี้ใน <b>Safari</b> กดปุ่มแชร์ <Share className="inline h-4 w-4 align-[-2px]" aria-label="แชร์" /> › <b>เพิ่มไปยังหน้าจอโฮม</b> <SquarePlus className="inline h-4 w-4 align-[-2px]" aria-hidden="true" /></>,
      <>เปิดเว็บจากไอคอน <b>สตูล EOC</b> บนหน้าจอโฮม แล้วกด <b>รับแจ้งเตือนภัย</b> › <b>อนุญาต</b></>,
      <>ให้มีเสียง: การตั้งค่า › การแจ้งเตือน › สตูล EOC › เปิด <b>เสียง</b></>
    ]
  }
};

export const ALERT_TIPS = [
  "ไม่ต้องเปิดเว็บค้างไว้ แจ้งเตือนเด้งเองแม้ปิดจอ",
  "เปิดจาก LINE หรือ Facebook จะรับไม่ได้ ให้กด ⋯ › เปิดในเบราว์เซอร์ ก่อน",
  "ปิดโหมดห้ามรบกวน และอย่าล้างข้อมูลเว็บ ไม่อย่างนั้นต้องกดรับใหม่",
  "กดที่แจ้งเตือนเพื่ออ่านข้อความเต็ม หรือดูย้อนหลังที่หน้า \"แจ้งเตือนที่ได้รับ\""
];

export default function AlertGuide({ only = null, compact = false, className = "" }) {
  const keys = only ? [only] : ["android", "ios"];
  return (
    <div className={className}>
      <div className={`grid gap-3 ${keys.length > 1 && !compact ? "sm:grid-cols-2" : ""}`}>
        {keys.map((key) => (
          <section key={key} className="rounded-2xl bg-[#f3f8fa] p-4" aria-label={STEPS[key].title}>
            <h3 className="font-semibold text-[#0c2f4a]">{STEPS[key].title}</h3>
            <ol className="mt-2 space-y-1.5 text-[15px] leading-6 text-slate-700">
              {STEPS[key].items.map((item, index) => (
                <li key={index} className="flex gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0b4c86] text-xs font-bold text-white">{index + 1}</span><span>{item}</span></li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      {compact ? null : (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[15px] leading-6 text-slate-600">
          {ALERT_TIPS.map((tip) => <li key={tip}>{tip}</li>)}
        </ul>
      )}
    </div>
  );
}
