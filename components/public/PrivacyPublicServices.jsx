"use client";

import { useEffect, useState } from "react";
import { Check, HandHelping, Smartphone, Trash2 } from "lucide-react";
import { PrivacySection } from "@/components/public/PrivacySection";

// ส่วนของนโยบายความเป็นส่วนตัวที่อธิบายบริการสำหรับประชาชน + ปุ่มล้างข้อมูลที่จำไว้ในเครื่อง
// รายการ key ต้องตรงกับที่หน้าเว็บใช้จริง (lib/myReports.js, lib/myRisk, AIChatbot, HomePopup)
const DEVICE_KEYS = [
  { key: "stn-eoc:tracking-identity", label: "ชื่อ นามสกุล และเบอร์โทร 4 ตัวท้าย สำหรับติดตามคำขอ" },
  { key: "stn-eoc:home-location", label: "ตำแหน่งบ้านที่ใช้เช็ก \"บ้านฉันเสี่ยงไหม\"" },
  { key: "stn-eoc:my-district", label: "อำเภอที่เลือกไว้" },
  { key: "chatbot_history", label: "ประวัติคำถามกับน้องสจ๊วต" },
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
    title: "รับแจ้งเตือนภัย",
    body: "ระบบเก็บเฉพาะปลายทางการแจ้งเตือนของเบราว์เซอร์ กุญแจเข้ารหัส และพื้นที่ที่เลือก ไม่เก็บชื่อหรือเบอร์โทร เมื่อแจ้งเตือนขึ้นบนเครื่องหรือมีการกดเปิด เครื่องจะส่งสัญญาณกลับเพื่อนับจำนวนผู้รับ (ไม่มี IP ชื่อ หรือตำแหน่ง) และลบเมื่อเกิน 1 ปี ยกเลิกได้ทุกเมื่อที่หน้า \"แจ้งเตือน\""
  },
  {
    title: "ประเมินความพึงพอใจ",
    body: "เก็บเฉพาะจำนวนดาว ข้อเสนอแนะที่ท่านพิมพ์ (ถ้ามี) ช่องทางที่ท่านรู้จักระบบ (ถ้าเลือก) หน้าที่ประเมิน และประเภทอุปกรณ์ ระบบจดจำจำนวนครั้งที่เข้าใช้ไว้ในเครื่องของท่านเท่านั้น เพื่อเลือกเวลาเชิญให้ประเมิน ไม่ส่งไปที่เซิร์ฟเวอร์ ไม่เก็บชื่อ เบอร์โทร หรือที่อยู่ไอพี กรุณาอย่าพิมพ์ข้อมูลส่วนตัวในช่องข้อเสนอแนะ ระบบลบอัตโนมัติเมื่อเกิน 2 ปี"
  },
  {
    title: "น้องสจ๊วต",
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

  const removable = stored !== null && DEVICE_KEYS.some((item) => !item.keep && stored.includes(item.key));
  return (
    <>
      <PrivacySection id="public-services" title="บริการสำหรับประชาชน ใช้ข้อมูลอย่างไร" icon={HandHelping}>
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {SERVICES.map((item) => (
            <div key={item.title} className="rounded-xl bg-[#f3f7f8] p-4 sm:rounded-2xl">
              <h3 className="mb-1 font-semibold leading-snug text-[#0c2f4a]">{item.title}</h3>
              <p className="text-[0.95rem] leading-7 text-slate-700">{item.body}</p>
            </div>
          ))}
        </div>
      </PrivacySection>

      <PrivacySection id="device-data" title="ข้อมูลที่จำไว้ในเครื่องนี้" icon={Smartphone}>
        <p>
          เว็บไซต์จำข้อมูลบางอย่างไว้ในเบราว์เซอร์ของท่าน (Local Storage) เพื่อไม่ต้องกรอกซ้ำ ข้อมูลส่วนนี้ไม่ได้ส่งไปเก็บที่ศูนย์
          ถ้าใช้โทรศัพท์หรือคอมพิวเตอร์ร่วมกับผู้อื่น ควรลบก่อนส่งต่อเครื่อง
        </p>
        <ul className="mt-3 divide-y divide-[#e3ecef] overflow-hidden rounded-xl ring-1 ring-[#d6e3ea]">
          {DEVICE_KEYS.map((item) => {
            const has = stored?.includes(item.key);
            return (
              <li key={item.key} className="flex items-start justify-between gap-3 bg-white px-3.5 py-2.5 text-[0.95rem] leading-snug">
                <span className="flex items-start gap-2.5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${has ? "bg-[#2a9db0]" : "bg-slate-300"}`} aria-hidden="true" />
                  {item.label}
                </span>
                {stored === null ? null : (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${has ? "bg-[#e3f2f5] text-[#11708a]" : "bg-slate-100 text-slate-500"}`}>
                    {has ? "มีในเครื่อง" : "ไม่มี"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={clearAll}
          disabled={stored !== null && !removable}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0b4c86] px-5 py-2.5 font-semibold text-white hover:bg-[#0c2f4a] disabled:bg-slate-300 sm:w-auto sm:rounded-full"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> ลบข้อมูลทั้งหมดที่จำไว้ในเครื่องนี้
        </button>
        {cleared ? <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700" role="status"><Check className="h-4 w-4" aria-hidden="true" />ลบแล้ว</p> : null}
      </PrivacySection>
    </>
  );
}
