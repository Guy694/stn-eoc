// ขนาดตัวอักษรที่ผู้ใช้เลือก (ใช้ร่วมกันระหว่าง layout ฝั่งเซิร์ฟเวอร์ และปุ่มฝั่งหน้าเว็บ)
export const TEXT_SCALE_KEY = "stn-text-scale";
export const TEXT_SCALES = [
  { value: 1, label: "ปกติ" },
  { value: 1.125, label: "ใหญ่" },
  { value: 1.25, label: "ใหญ่มาก" }
];
export const TEXT_SCALE_SCRIPT = `try{var s=parseFloat(localStorage.getItem("${TEXT_SCALE_KEY}"));if(s>1&&s<=1.25)document.documentElement.style.fontSize=(s*100)+"%"}catch(e){}`;
