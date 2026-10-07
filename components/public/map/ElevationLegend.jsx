"use client";

// คำอธิบายชั้นข้อมูลความสูงพื้นที่ — ใช้คู่กับ ElevationLayer
import { useState } from "react";
import { ELEVATION_BANDS } from "@/lib/elevation";

export default function ElevationLegend({ className = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-black">ความสูงพื้นที่ (จากระดับทะเล)</span>
        <button type="button" onClick={() => setOpen((value) => !value)} className="text-[11px] font-bold underline opacity-80 hover:opacity-100" aria-expanded={open}>
          {open ? "ย่อ" : "อ่านคำอธิบาย"}
        </button>
      </div>
      <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
        {ELEVATION_BANDS.map((band) => (
          <li key={band.label} className="flex items-center gap-1.5" title={band.meaning}>
            <span className="h-3 w-4 shrink-0 rounded-sm ring-1 ring-white/50" style={{ backgroundColor: `rgb(${band.rgb.join(",")})` }} aria-hidden="true" />
            <span className="font-semibold">{band.label}</span>
          </li>
        ))}
      </ul>
      {open ? (
        <div className="mt-2 space-y-1 text-[11px] leading-4 opacity-90">
          <p>สีบอกว่าพื้นดินสูงจากระดับทะเลเท่าไร <b>พื้นที่สีน้ำเงินเข้ม (ต่ำ)</b> น้ำจะไหลมารวมและท่วมขังก่อน โดยเฉพาะที่อยู่ติดคลองหรือชายฝั่งช่วงน้ำทะเลหนุน ส่วนพื้นที่สีน้ำตาล (ภูเขา) ไม่ท่วมขังแต่เสี่ยงน้ำป่าและดินถล่มเมื่อฝนหนัก</p>
          <p>ชี้เมาส์หรือแตะแผนที่เพื่อดูความสูง ณ จุดนั้น</p>
          <p><b>ข้อจำกัด:</b> ข้อมูลจากดาวเทียม (SRTM) ความละเอียดราว 30 ม. คลาดเคลื่อนได้หลายเมตร และรวมความสูงของต้นไม้/อาคาร ใช้ดูภาพรวมว่าที่ไหนต่ำกว่ากัน ไม่ใช้แทนการรังวัดหรือระดับน้ำจริง</p>
        </div>
      ) : null}
    </div>
  );
}
