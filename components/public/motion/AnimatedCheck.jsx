// A5: เครื่องหมายถูกวาดตัวเอง (ส่งคำขอสำเร็จ) · ลดการเคลื่อนไหว = แสดงเสร็จทันที
import "@/components/public/motion/publicMotion.css";

export default function AnimatedCheck({ className = "h-12 w-12" }) {
  return (
    <svg viewBox="0 0 52 52" className={`pm-check ${className}`} aria-hidden="true">
      <circle className="pm-check__circle" cx="26" cy="26" r="23" fill="none" strokeWidth="4" />
      <path className="pm-check__tick" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" d="M15 27l7.5 7.5L38 19" />
    </svg>
  );
}
