// เสียงแจ้งเตือนบนหน้าเว็บเจ้าหน้าที่ (ใช้ร่วมกัน: เตือนระดับน้ำ/ฝน และคำขอความช่วยเหลือ)
// เสียงสังเคราะห์ (ไม่ต้องโหลดไฟล์เสียง): วิกฤต = ไซเรนสองเสียง 3 รอบ, เฝ้าระวัง = บี๊บ 2 ครั้ง, คลี่คลาย = เสียงกริ๊งเบา ๆ
export function playPattern(ctx, level) {
  const now = ctx.currentTime + 0.02;
  const tone = (freq, start, duration, gain = 0.22, type = "square") => {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + start);
    amp.gain.setValueAtTime(0.0001, now + start);
    amp.gain.exponentialRampToValueAtTime(gain, now + start + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + duration + 0.05);
  };
  if (level === "critical") {
    for (let i = 0; i < 3; i += 1) {
      tone(960, i * 0.9, 0.4);
      tone(720, i * 0.9 + 0.42, 0.4);
    }
  } else if (level === "serious") {
    tone(880, 0, 0.22, 0.2, "triangle");
    tone(880, 0.32, 0.22, 0.2, "triangle");
  } else {
    tone(660, 0, 0.18, 0.12, "sine");
    tone(990, 0.16, 0.3, 0.12, "sine");
  }
}

