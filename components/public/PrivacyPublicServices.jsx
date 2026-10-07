"use client";

import { useEffect, useState } from "react";

// ส่วนของนโยบายความเป็นส่วนตัวที่อธิบายบริการสำหรับประชาชน + ปุ่มล้างข้อมูลที่จำไว้ในเครื่อง
// รายการ key ต้องตรงกับที่หน้าเว็บใช้จริง (lib/myReports.js, lib/myRisk, AIChatbot, HomePopup)
const DEVICE_KEYS = [
  { key: "stn-eoc:tracking-identity", label: "ชื่อ นามสกุล และเบอร์โทร 4 ตัวท้าย สำหรับติดตามคำขอ" },
  { key: "stn-eoc:home-location", label: "ตำแหน่งบ้านที่ใช้เช็ก \"บ้านฉันเสี่ยงไหม\"" },
  { key: "stn-eoc:my-district", label: "อำเภอที่เลือกไว้" },
  { key: "chatbot_history", label: "ประวัติคำถามกับผู้ช่วย EOC" },
  { key: "stn-eoc:seen-popups", label: "ประกาศที่ปิดไปแล้ว" },
  // รายงานที่ส่งไม่ออกตอนไม่มีสัญญาณ: ไม่ลบด้วยปุ่มนี้ เพราะอาจเป็นคำขอความช่วยเหลือที่ยังไม่ถึงศูนย์
  { key: "stn-eoc:offline-queue:v1", label: "รายงานที่รอส่งเมื่อมีสัญญาณ (ลบเองเมื่อส่งสำเร็จ)", keep: true }
];

const SERVICES = [
  {
    title: "ขอความช่วยเหลือ แจ้งจุดปัญหา และรายงานระดับน้ำ",
    body: "ชื่อ นามสกุล เบอร์โทร ตำแหน่ง และรูปที่แจ้ง ส่งถึงเจ้าหน้าที่ศูนย์ฯ ผ่านระบบและช่องแจ้งเตือนเจ้าหน้าที่ (Telegram) เพื่อประสานความช่วยเหลือ บนแผนที่สาธารณะแสดงเฉพาะเรื่องที่เจ้าหน้าที่ตรวจแล้ว ด้วยตำแหน่งโดยประมาณ ไม่แสดงชื่อและเบอร์โทร ระบบลบข้อมูลตำแหน่งที่ฝังในไฟล์รูปให้อัตโนมัติ"
  },
  {
    title: "ติดตามคำขอ",
    body: "ชื่อ นามสกุล และเบอร์โทร 4 ตัวท้ายที่กรอก ใช้ค้นหาเรื่องที่แจ้งภายใน 90 วันเท่านั้น ศูนย์ไม่ได้บันทึกการค้นหาไว้ ผลที่แสดงมีเฉพาะประเภทเรื่อง พื้นที่ระดับตำบล และสถานะ ไม่แสดงรายละเอียดที่ผู้แจ้งเขียน"
  },
  {
    title: "บ้านฉันเสี่ยงไหม",
    body: "พิกัดบ้านใช้คำนวณหาหมู่บ้านและความเสี่ยงแล้วทิ้งไป ศูนย์ไม่ได้บันทึกเก็บไว้ หากเลือกให้จำ จะจำไว้ในเครื่องของท่านเท่านั้น"
  },
  {
    title: "ผู้ช่วย EOC",
    body: "คำถามบางข้อส่งไปประมวลผลด้วยบริการ AI ของ Google (Gemini) เพื่อเรียบเรียงคำตอบ กรุณาอย่าพิมพ์ชื่อ เบอร์โทร เลขบัตรประชาชน หรือข้อมูลสุขภาพลงในช่องคำถาม"
  }
];

function readKeys() {
  try {
    return DEVICE_KEYS.filter((item) => window.localStorage.getItem(item.key) !== null).map((item) => item.key);
  } catch {
    return [];
  }
}

export default function PrivacyPublicServices() {
  const [stored, setStored] = useState(null);
  const [cleared, setCleared] = useState(false);

  useEffect(() => { setStored(readKeys()); }, []);

  const clearAll = () => {
    try {
      DEVICE_KEYS.filter((item) => !item.keep).forEach((item) => window.localStorage.removeItem(item.key));
      window.sessionStorage.clear();
    } catch {
      // ปิด storage อยู่ = ไม่มีอะไรให้ลบ
    }
    setStored(readKeys());
    setCleared(true);
  };

  return (
    <>
      <section id="public-services" className="scroll-mt-24 border-t border-[#d6e3ea] pt-8">
        <h2 className="font-[family-name:var(--font-kanit)] text-2xl font-semibold text-[#0c2f4a]">บริการสำหรับประชาชน ใช้ข้อมูลอย่างไร</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {SERVICES.map((item) => (
            <div key={item.title} className="rounded-2xl bg-[#f3f7f8] p-4">
              <h3 className="mb-1 font-semibold text-[#0c2f4a]">{item.title}</h3>
              <p className="text-[0.95rem] leading-7 text-slate-700">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="device-data" className="scroll-mt-24 border-t border-[#d6e3ea] pt-8">
        <h2 className="font-[family-name:var(--font-kanit)] text-2xl font-semibold text-[#0c2f4a]">ข้อมูลที่จำไว้ในเครื่องนี้</h2>
        <p className="mt-4 leading-8 text-slate-700">
          เว็บไซต์จำข้อมูลบางอย่างไว้ในเบราว์เซอร์ของท่าน (Local Storage) เพื่อไม่ต้องกรอกซ้ำ ข้อมูลส่วนนี้ไม่ได้ส่งไปเก็บที่ศูนย์
          ถ้าใช้โทรศัพท์หรือคอมพิวเตอร์ร่วมกับผู้อื่น ควรลบก่อนส่งต่อเครื่อง
        </p>
        <ul className="mt-3 space-y-1.5 text-slate-700">
          {DEVICE_KEYS.map((item) => {
            const has = stored?.includes(item.key);
            return (
              <li key={item.key} className="flex items-start gap-2">
                <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${has ? "bg-[#2a9db0]" : "bg-slate-300"}`} aria-hidden="true" />
                <span>{item.label} <span className="text-sm text-slate-500">{stored === null ? "" : has ? "(มีในเครื่องนี้)" : "(ไม่มี)"}</span></span>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={clearAll}
          disabled={stored !== null && !DEVICE_KEYS.some((item) => !item.keep && stored.includes(item.key))}
          className="mt-4 rounded-full bg-[#0b4c86] px-5 py-2.5 font-semibold text-white hover:bg-[#0c2f4a] disabled:bg-slate-300"
        >
          ลบข้อมูลทั้งหมดที่จำไว้ในเครื่องนี้
        </button>
        {cleared ? <p className="mt-2 text-sm font-semibold text-emerald-700" role="status">ลบแล้ว</p> : null}
      </section>
    </>
  );
}
