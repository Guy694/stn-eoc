"use client";

import { useEffect, useRef } from "react";

// พื้นหลังของหน้าแรกที่เคลื่อนไหวตามสภาพอากาศตอนนี้: เม็ดฝน ลม เมฆ ฟ้าแลบ ดาว/แสงแดด
// - วาดบน canvas เดียว ไม่รับการคลิก อยู่หลังเนื้อหา
// - หยุดเมื่อแท็บถูกซ่อน และแสดงภาพนิ่งเมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว
// - ฟ้าแลบนาน ๆ ครั้ง (ทุก 7–14 วินาที) และสว่างไม่มาก เพื่อไม่ให้รบกวน/กระตุ้นอาการแพ้แสงกระพริบ
const RAIN_DROPS = [0, 70, 160, 300];

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export default function HeroWeatherFx({ scene }) {
  const canvasRef = useRef(null);
  const flashRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scene) return undefined;
    const context = canvas.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let running = true;
    let lastFlash = performance.now();
    let nextFlash = rand(7000, 14000);

    // ลมพัดเม็ดฝนเอียง: 0–45 กม./ชม. → เอียง 0–0.55
    const slant = Math.min(0.55, (scene.wind || 0) / 80);
    const drops = [];
    const streaks = [];
    const stars = [];

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const area = (width * height) / (1280 * 640);
      drops.length = 0;
      const dropCount = Math.round(RAIN_DROPS[scene.rain || 0] * Math.max(0.35, area));
      for (let index = 0; index < dropCount; index += 1) {
        drops.push({ x: rand(-height * slant, width), y: rand(-height, height), length: rand(10, 22) + scene.rain * 4, speed: rand(7, 11) + scene.rain * 2.5, alpha: rand(0.18, 0.45) });
      }
      streaks.length = 0;
      const streakCount = scene.wind >= 15 ? Math.round((scene.wind >= 30 ? 16 : 8) * Math.max(0.5, area)) : 0;
      for (let index = 0; index < streakCount; index += 1) {
        streaks.push({ x: rand(-width, width), y: rand(0, height), length: rand(60, 180), speed: rand(2, 4) + scene.wind / 12, alpha: rand(0.05, 0.14), wave: rand(0, Math.PI * 2) });
      }
      stars.length = 0;
      if (scene.night && scene.cloud < 2 && !scene.rain) {
        for (let index = 0; index < Math.round(70 * Math.max(0.5, area)); index += 1) {
          stars.push({ x: rand(0, width), y: rand(0, height * 0.7), r: rand(0.5, 1.4), phase: rand(0, Math.PI * 2) });
        }
      }
    };

    const draw = (time) => {
      context.clearRect(0, 0, width, height);

      // ดาวระยิบ (คืนฟ้าโปร่ง)
      for (const star of stars) {
        const twinkle = reduced ? 0.6 : 0.35 + 0.35 * Math.sin(time / 900 + star.phase);
        context.fillStyle = `rgba(255,255,255,${twinkle})`;
        context.beginPath();
        context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        context.fill();
      }

      // เส้นลม
      context.lineCap = "round";
      for (const streak of streaks) {
        const y = streak.y + Math.sin(time / 1200 + streak.wave) * 10;
        const gradient = context.createLinearGradient(streak.x, y, streak.x + streak.length, y);
        gradient.addColorStop(0, "rgba(213,231,236,0)");
        gradient.addColorStop(0.5, `rgba(213,231,236,${streak.alpha})`);
        gradient.addColorStop(1, "rgba(213,231,236,0)");
        context.strokeStyle = gradient;
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(streak.x, y);
        context.quadraticCurveTo(streak.x + streak.length / 2, y - 6, streak.x + streak.length, y);
        context.stroke();
        if (!reduced) {
          streak.x += streak.speed;
          if (streak.x > width) { streak.x = -streak.length - rand(0, width * 0.5); streak.y = rand(0, height); }
        }
      }

      // เม็ดฝน
      context.lineWidth = scene.rain >= 3 ? 1.6 : 1.2;
      for (const drop of drops) {
        context.strokeStyle = `rgba(190,226,240,${drop.alpha})`;
        context.beginPath();
        context.moveTo(drop.x, drop.y);
        context.lineTo(drop.x + drop.length * slant, drop.y + drop.length);
        context.stroke();
        if (!reduced) {
          drop.y += drop.speed;
          drop.x += drop.speed * slant;
          if (drop.y > height) { drop.y = rand(-40, -10); drop.x = rand(-height * slant, width); }
        }
      }

      // ฟ้าแลบ: แสงวาบจาง ๆ ทั้งพื้นหลัง
      if (scene.thunder && !reduced && flashRef.current) {
        if (time - lastFlash > nextFlash) {
          lastFlash = time;
          nextFlash = rand(7000, 14000);
          flashRef.current.animate(
            [{ opacity: 0 }, { opacity: 0.22, offset: 0.08 }, { opacity: 0.05, offset: 0.2 }, { opacity: 0.16, offset: 0.3 }, { opacity: 0 }],
            { duration: 900, easing: "ease-out" }
          );
        }
      }

      if (running && !reduced) frame = window.requestAnimationFrame(draw);
    };

    const start = () => {
      window.cancelAnimationFrame(frame);
      running = true;
      frame = window.requestAnimationFrame(draw);
    };
    const onVisibility = () => {
      if (document.hidden) { running = false; window.cancelAnimationFrame(frame); }
      else start();
    };

    resize();
    start();
    const observer = new ResizeObserver(() => { resize(); if (reduced) draw(performance.now()); });
    observer.observe(canvas);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [scene]);

  if (!scene) return null;
  const sunny = !scene.night && scene.cloud === 0 && !scene.rain;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* แสงแดด / แสงจันทร์ */}
      {sunny ? <div className="hero-fx__sun absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(255,214,120,.35),rgba(255,214,120,0)_65%)]" /> : null}
      {scene.night && !scene.rain ? <div className="absolute right-[12%] top-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(220,235,255,.18),rgba(220,235,255,0)_70%)]" /> : null}
      {/* เมฆ */}
      {scene.cloud > 0 ? (
        <>
          <div className={`hero-fx__cloud absolute -left-40 top-6 h-56 w-[38rem] rounded-full bg-white/[.06] blur-3xl ${scene.cloud > 1 ? "" : "opacity-60"}`} />
          <div className="hero-fx__cloud hero-fx__cloud--slow absolute left-1/3 top-24 h-48 w-[30rem] rounded-full bg-white/[.05] blur-3xl" />
          {scene.cloud > 1 ? <div className="hero-fx__cloud absolute -right-32 bottom-10 h-64 w-[36rem] rounded-full bg-[#9fc9d6]/[.07] blur-3xl" /> : null}
        </>
      ) : null}
      {/* ฝนหนักทำให้ฟ้ามืดลงเล็กน้อย */}
      {scene.rain >= 2 ? <div className="absolute inset-0 bg-[#06192a]/25" /> : null}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div ref={flashRef} className="absolute inset-0 bg-[#e8f1ff] opacity-0" />
      <style>{`
        .hero-fx__cloud { animation: hero-fx-drift ${Math.max(28, 90 - (scene.wind || 0))}s ease-in-out infinite alternate; }
        .hero-fx__cloud--slow { animation-duration: ${Math.max(40, 120 - (scene.wind || 0))}s; animation-direction: alternate-reverse; }
        .hero-fx__sun { animation: hero-fx-glow 8s ease-in-out infinite alternate; }
        @keyframes hero-fx-drift { from { transform: translateX(-4%); } to { transform: translateX(10%); } }
        @keyframes hero-fx-glow { from { opacity: .7; transform: scale(.96); } to { opacity: 1; transform: scale(1.04); } }
        @media (prefers-reduced-motion: reduce) { .hero-fx__cloud, .hero-fx__sun { animation: none; } }
      `}</style>
    </div>
  );
}
