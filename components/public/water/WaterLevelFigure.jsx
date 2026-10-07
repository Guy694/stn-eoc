// ภาพคนยืนในน้ำ เทียบระดับน้ำให้เข้าใจทันทีโดยไม่ต้องรู้ตัวเลข
// fill = สัดส่วนความสูงของน้ำเทียบกับความสูงคน (0–1); 1 = มิดหัว
const PERSON = "M26.5 14h7a4 4 0 0 1 4 4v15a2 2 0 0 1-4 0V21h-.8v34a2.6 2.6 0 0 1-5.2 0V37h-1v18a2.6 2.6 0 0 1-5.2 0V21H21.5v12a2 2 0 0 1-4 0V18a4 4 0 0 1 4-4z";

export default function WaterLevelFigure({ fill, color, id, className = "" }) {
  // คนยืนตั้งแต่ y=2 (หัว) ถึง y=58 (เท้า) — น้ำวัดจากพื้น y=60
  const ground = 60;
  const personHeight = 56;
  const level = Math.min(1, Math.max(0, fill));
  const waterTop = level >= 1 ? 0 : ground - level * personHeight - 2;
  const clipId = `water-${id}`;
  const wave = `M8 ${waterTop + 1.5} q5.5 -3 11 0 t11 0 t11 0 t11 0`;
  return (
    <svg viewBox="0 0 60 62" className={className} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipId}><rect x="8" y={waterTop} width="44" height={62 - waterTop} /></clipPath>
      </defs>
      <g fill="#334155">
        <circle cx="30" cy="7" r="5" />
        <path d={PERSON} transform="translate(0 -1)" />
      </g>
      <rect x="8" y={waterTop} width="44" height={62 - waterTop} fill={color} opacity="0.88" rx="1" />
      {/* ส่วนของคนที่จมน้ำ: เงาเข้มให้ยังเห็นว่าน้ำสูงถึงตรงไหนของร่างกาย */}
      <g clipPath={`url(#${clipId})`} fill="#0f172a" opacity="0.28">
        <circle cx="30" cy="7" r="5" />
        <path d={PERSON} transform="translate(0 -1)" />
      </g>
      <path d={wave} fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
