// A5: วงเรดาร์ระหว่าง "กำลังหาตำแหน่ง GPS" (วางทับกลางแผนที่)
import { LocateFixed } from "lucide-react";
import "@/components/public/motion/publicMotion.css";

export default function GpsRadar({ label = "กำลังหาตำแหน่ง…" }) {
  return (
    <div className="pm-radar" role="status" aria-live="polite">
      <span className="pm-radar__rings" aria-hidden="true"><span /><span /><span /></span>
      <span className="pm-radar__dot" aria-hidden="true"><LocateFixed className="h-5 w-5" /></span>
      <span className="pm-radar__label">{label}</span>
    </div>
  );
}
