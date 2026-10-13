// สเปกการนำเข้า Excel ของแต่ละหน้า (คอลัมน์ วิธีกรอก ตัวอย่าง และกติกาเมื่อนำเข้าซ้ำ)
// ใช้ทั้งสร้างไฟล์ตัวอย่าง ตรวจไฟล์ และแสดงคำอธิบายในหน้าต่างนำเข้า
import { VULNERABLE_TYPES } from "@/lib/vulnerableEvent";
import { CARE_GROUPS } from "@/lib/careGroups";
import { FLOOD_LEVELS } from "@/lib/floodRecords";

const vulnerable = {
  kind: "vulnerable",
  title: "นำเข้าทะเบียนกลุ่มเปราะบางรายบุคคล",
  summary: "เพิ่มรายชื่อกลุ่มเปราะบางทีละหลายคนจากไฟล์ Excel ข้อมูลชื่อ เบอร์ ที่อยู่ และพิกัดจะถูกเข้ารหัสเมื่อบันทึก",
  unit: "1 แถวต่อ 1 คน",
  filename: "แบบนำเข้า-กลุ่มเปราะบาง.xlsx",
  notes: [
    "คนที่มีชื่อ-นามสกุล อำเภอ และตำบลตรงกับทะเบียนเดิม ระบบจะข้าม ไม่เพิ่มซ้ำและไม่แก้ข้อมูลเดิม (แก้รายคนในหน้าทะเบียน)",
    "ชื่อซ้ำกันภายในไฟล์เดียวกัน ระบบจะแจ้งเป็นปัญหาให้ตรวจก่อน",
    "ไฟล์นี้มีข้อมูลส่วนบุคคล เมื่อนำเข้าเสร็จแล้วให้ลบไฟล์ออกจากเครื่องและกลุ่มแชต"
  ],
  columns: [
    { key: "vulnerable_type", header: "ประเภท", required: true, type: "enum", width: 26,
      options: VULNERABLE_TYPES.map((type) => ({ value: type.key, label: type.label, aliases: [type.short, type.tag, type.key] })),
      help: "เลือกจากรายการ เช่น ผู้ป่วยติดบ้าน/ติดเตียง ผู้พิการ หญิงตั้งครรภ์ (พิมพ์ชื่อย่อ เช่น ติดเตียง ก็ได้)", example: "ผู้ป่วยติดบ้าน/ติดเตียง" },
    { key: "name", header: "ชื่อ-นามสกุล", required: true, type: "text", max: 150, width: 24, aliases: ["ชื่อ", "ชื่อสกุล"], help: "ชื่อและนามสกุลในช่องเดียว", example: "นางสมใจ ใจดี" },
    { key: "district", header: "อำเภอ", required: true, type: "enum", ref: "districts", width: 14, help: "ชื่ออำเภอไม่ต้องใส่ อ. นำหน้า", example: "ละงู" },
    { key: "tambon", header: "ตำบล", required: true, type: "enum", ref: "tambons", width: 16, help: "ชื่อตำบลไม่ต้องใส่ ต. นำหน้า ต้องเป็นตำบลในอำเภอที่กรอก", example: "กำแพง" },
    { key: "village", header: "หมู่บ้าน", type: "text", max: 100, width: 18, aliases: ["หมู่ที่", "หมู่"], help: "หมู่ที่และ/หรือชื่อหมู่บ้าน", example: "หมู่ 3 บ้านทุ่ง" },
    { key: "phone", header: "เบอร์โทร", type: "phone", width: 14, help: "เบอร์ 9–10 หลัก มีขีดหรือไม่มีก็ได้", example: "0812345678" },
    { key: "address", header: "ที่อยู่", type: "text", max: 300, width: 28, help: "บ้านเลขที่ ซอย จุดสังเกต", example: "45/2 ซอยมัสยิด" },
    { key: "lat", header: "ละติจูด", type: "number", min: 0, maxValue: 90, width: 12, help: "พิกัดบ้าน (ทศนิยม) เช่น 6.9123 — ต้องกรอกคู่กับลองจิจูด", example: 6.9123 },
    { key: "lng", header: "ลองจิจูด", type: "number", min: 0, maxValue: 180, width: 12, help: "พิกัดบ้าน (ทศนิยม) เช่น 99.7801", example: 99.7801 },
    { key: "care_group", header: "กลุ่มสี", type: "enum", width: 12,
      options: CARE_GROUPS.map((group) => ({ value: group.key, label: group.label, aliases: [group.key, group.label.replace("สี", "")] })),
      help: "สีแดง / สีเหลือง / สีเขียว — เว้นว่างให้ระบบเสนอตามประเภท", example: "สีแดง" },
    { key: "power_dependent", header: "ใช้อุปกรณ์ไฟฟ้า", type: "bool", width: 14, aliases: ["พึ่งไฟฟ้า", "ใช้เครื่องช่วยหายใจ"], help: "ใช่ = ใช้เครื่องช่วยหายใจ/ออกซิเจน/อุปกรณ์ที่ต้องใช้ไฟฟ้า (ระบบจัดเป็นสีแดง)", example: "ใช่" },
    { key: "needs", header: "ความต้องการพิเศษ", type: "text", max: 500, width: 28, help: "ยา อุปกรณ์ การเคลื่อนย้าย", example: "ต้องใช้รถเข็น ยาความดัน" },
    { key: "caregiver_name", header: "ชื่อผู้ดูแล", type: "text", max: 150, width: 20, example: "นายสมชาย ใจดี" },
    { key: "caregiver_phone", header: "เบอร์ผู้ดูแล", type: "phone", width: 14, example: "0898765432" },
    { key: "due_date", header: "กำหนดคลอด", type: "date", width: 14, help: "เฉพาะหญิงตั้งครรภ์ เช่น 15/12/2569", example: "15/12/2569" },
    { key: "preterm_history", header: "เคยคลอดก่อนกำหนด", type: "bool", width: 16, help: "เฉพาะหญิงตั้งครรภ์ ใส่ ใช่ หรือเว้นว่าง", example: "" }
  ]
};

const flood = {
  kind: "flood-records",
  title: "นำเข้าพื้นที่น้ำท่วมรายหมู่บ้าน",
  summary: "บันทึกสถานการณ์น้ำท่วมของหลายหมู่บ้านในครั้งเดียว ข้อมูลจะเข้าเหตุการณ์อุทกภัยที่เลือกอยู่",
  unit: "1 แถวต่อ 1 หมู่บ้านต่อ 1 วัน",
  filename: "แบบนำเข้า-พื้นที่น้ำท่วม.xlsx",
  notes: [
    "หมู่บ้านที่มีข้อมูลของวันเดียวกันอยู่แล้ว ระบบจะแทนที่ด้วยค่าในไฟล์ (เหมือนแก้ไขในหน้าบันทึก)",
    "วันที่ต้องอยู่ในช่วงของเหตุการณ์ และไม่เป็นวันในอนาคต",
    "ระบุหมู่บ้านด้วยหมู่ที่หรือชื่อหมู่บ้านอย่างน้อยหนึ่งอย่าง ต้องตรงกับชั้นข้อมูลหมู่บ้านของ จ.สตูล"
  ],
  columns: [
    { key: "date", header: "วันที่", required: true, type: "date", width: 13, help: "วันที่ของข้อมูล เช่น 13/10/2569 หรือ 2026-10-13", example: "13/10/2569" },
    { key: "district", header: "อำเภอ", required: true, type: "enum", ref: "districts", width: 14, example: "ละงู" },
    { key: "tambon", header: "ตำบล", required: true, type: "enum", ref: "tambons", width: 16, example: "กำแพง" },
    { key: "moo", header: "หมู่ที่", type: "int", min: 1, maxValue: 99, width: 9, aliases: ["หมู่"], help: "ตัวเลขหมู่ที่ (ใช้หาหมู่บ้าน)", example: 3 },
    { key: "village", header: "ชื่อหมู่บ้าน", type: "text", max: 100, width: 20, aliases: ["หมู่บ้าน"], help: "ใช้เมื่อไม่ทราบหมู่ที่ หรือเพื่อตรวจซ้ำ", example: "บ้านทุ่ง" },
    { key: "flood_level", header: "ระดับน้ำท่วม", required: true, type: "enum", width: 14,
      options: FLOOD_LEVELS.map((level) => ({ value: level.value, label: level.value })),
      help: FLOOD_LEVELS.map((level) => `${level.value} = ${level.hint}`).join(" · "), example: "ปานกลาง" },
    { key: "water_depth_cm", header: "ความลึกน้ำ (ซม.)", type: "number", maxValue: 1000, width: 14, aliases: ["ความลึกน้ำ"], help: "0–1000 เซนติเมตร", example: 40 },
    { key: "affected_households", header: "ครัวเรือนที่ได้รับผลกระทบ", type: "int", maxValue: 100000, width: 16, aliases: ["ครัวเรือน"], help: "จำนวนเต็ม ไม่มากกว่าจำนวนคน", example: 25 },
    { key: "affected_people", header: "ผู้ได้รับผลกระทบ (คน)", type: "int", maxValue: 1000000, width: 16, aliases: ["ผู้ได้รับผลกระทบ", "จำนวนคน"], example: 80 },
    { key: "description", header: "หมายเหตุ", type: "text", max: 1000, width: 30, help: "สถานการณ์ เส้นทาง ความช่วยเหลือที่ต้องการ", example: "ถนนเข้าหมู่บ้านน้ำท่วมสูง รถเล็กผ่านไม่ได้" }
  ]
};

const supplies = {
  kind: "supplies",
  title: "นำเข้ายอดคงคลังเวชภัณฑ์",
  summary: "ใส่ยอดคงเหลือจากการนับคลังของแต่ละหน่วยบริการในครั้งเดียว ใช้กับเหตุการณ์ที่เปิดบัญชีคลังแล้ว",
  unit: "1 แถวต่อ 1 รายการของ 1 หน่วยบริการ",
  filename: "แบบนำเข้า-คลังเวชภัณฑ์.xlsx",
  notes: [
    "รายการที่ยังไม่มีในหน่วยบริการนั้น ระบบจะเพิ่มใหม่โดยใช้ยอดในไฟล์เป็นยอดตั้งต้น",
    "รายการที่มีอยู่แล้ว (รหัส หรือชื่อรายการตรงกัน) ระบบจะปรับยอดคงเหลือให้เท่ากับไฟล์ และบันทึกเป็นประวัติ \"ปรับยอด\" พร้อมชื่อไฟล์",
    "ยอดเท่าเดิมจะข้าม ไม่สร้างประวัติ · การรับเข้า/เบิกจ่ายรายครั้งให้ทำในหน้าคลังตามปกติ"
  ],
  columns: [
    { key: "facility", header: "หน่วยบริการ/คลัง", required: true, type: "enum", ref: "facilities", width: 28, aliases: ["หน่วยบริการ", "คลัง"], help: "ชื่อให้ตรงกับรายการในแผ่นงาน รายการให้เลือก", example: "รพ.ละงู" },
    { key: "item_code", header: "รหัสรายการ", type: "text", max: 80, width: 14, aliases: ["รหัส"], help: "ไม่บังคับ ถ้าว่างระบบใช้ชื่อรายการแทนรหัส", example: "" },
    { key: "item_name", header: "ชื่อรายการ", required: true, type: "text", max: 255, width: 30, aliases: ["รายการ", "เวชภัณฑ์"], example: "ผงเกลือแร่ ORS" },
    { key: "unit", header: "หน่วยนับ", required: true, type: "text", max: 50, width: 10, aliases: ["หน่วย"], example: "ซอง" },
    { key: "balance_qty", header: "ยอดคงเหลือ", required: true, type: "number", maxValue: 100000000, width: 12, aliases: ["คงเหลือ", "จำนวน"], help: "ยอดที่นับได้จริง ณ ตอนนี้", example: 1200 },
    { key: "note", header: "หมายเหตุ", type: "text", max: 500, width: 26, example: "นับคลังเช้า 13 ต.ค." }
  ]
};

export const IMPORT_SPECS = { vulnerable, "flood-records": flood, supplies };

export function importSpec(kind) {
  return IMPORT_SPECS[kind] || null;
}
