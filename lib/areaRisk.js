// วิเคราะห์พื้นที่เสี่ยงน้ำท่วมรายตำบล — รวมข้อมูลหลายแหล่งเป็นคะแนนที่อธิบายได้ (ไม่มีการเรียกเครือข่ายในไฟล์นี้)
//
// 1) ความเปราะบางของพื้นที่ (คงที่, 0–40): เคยท่วมซ้ำจากดาวเทียม GISTDA, บันทึกน้ำท่วมของ EOC ในอดีต, สัดส่วนที่ลุ่มต่ำ (DEM)
// 2) คนและกลุ่มเปราะบาง (0–20): จำนวนครัวเรือน, ผู้ติดเตียง/พิการ/ตั้งครรภ์ (ทะเบียนกลาง)
// 3) ภัยตอนนี้ (0–40): ความเสี่ยงอำเภอ (ฝนวัด/พยากรณ์ ECMWF/GloFAS), ฝนที่สถานีในตำบล, น้ำในคลองที่สถานีในตำบล,
//    น้ำทะเลหนุน (ตำบลติดทะเล), รายงานน้ำจากประชาชนที่เจ้าหน้าที่ยืนยัน, บันทึกน้ำท่วมในเหตุการณ์ที่เปิดอยู่
// ความเสี่ยงตอนนี้ = ภัยตอนนี้ × (1 + พื้นฐาน/60) → พื้นที่ที่เปราะบางกว่าขึ้นอันดับก่อนเมื่อเจอภัยเท่ากัน
// ถ้าไม่มีภัยตอนนี้ ความเสี่ยงตอนนี้ = ปกติ (แต่ยังเห็น "ความเปราะบางพื้นฐาน" สำหรับวางแผนล่วงหน้า)

import { RISK_LEVELS, RISK_META } from "@/lib/weatherRiskConfig";

export const BASELINE_LEVELS = {
  high: { key: "high", label: "เปราะบางสูง", color: "#7c2d12" },
  medium: { key: "medium", label: "เปราะบางปานกลาง", color: "#c2410c" },
  low: { key: "low", label: "เปราะบางต่ำ", color: "#a8a29e" }
};

const FLOOD_LEVEL_RANK = { "ไม่มี": 0, "ต่ำ": 1, "ปานกลาง": 2, "สูง": 3, "สูงมาก": 4 };
export const floodLevelRank = (value) => FLOOD_LEVEL_RANK[value] ?? 0;

/** ชื่อตำบล/อำเภอจากหลายแหล่งให้ตรงกัน: ตัด "ต." "ตำบล" "อ." "อำเภอ" และช่องว่าง */
export function normalizeAreaName(value) {
  return String(value || "")
    .replace(/^(ต\.|ตำบล|อ\.|อำเภอ|จ\.|จังหวัด)\s*/, "")
    .replace(/\s+/g, "")
    .trim();
}

export const areaKey = (district, tambon) => `${normalizeAreaName(district)}|${normalizeAreaName(tambon)}`;

const add = (bucket, points, label) => {
  if (points > 0) bucket.push({ points, label });
};
const total = (factors, cap) => Math.min(cap, factors.reduce((sum, item) => sum + item.points, 0));
const fmt = (value) => Number(value || 0).toLocaleString("th-TH");

export function susceptibilityOf(area) {
  const factors = [];
  const g = area.gistda;
  if (g) {
    const freqPoints = g.max_freq >= 4 ? 15 : g.max_freq >= 2 ? 10 : g.max_freq >= 1 ? 5 : 0;
    add(factors, freqPoints, `ดาวเทียมพบน้ำท่วมสูงสุด ${g.max_freq} ใน 14 ปี (GISTDA)`);
    const repeatedPoints = g.repeated_rai >= 2000 ? 10 : g.repeated_rai >= 500 ? 5 : g.repeated_rai >= 100 ? 2 : 0;
    add(factors, repeatedPoints, `พื้นที่ท่วมซ้ำ ${fmt(g.repeated_rai)} ไร่`);
  }
  const h = area.eoc_history;
  if (h?.years) add(factors, h.years >= 3 ? 10 : h.years === 2 ? 7 : 4, `EOC บันทึกน้ำท่วม ${h.years} ปี${h.max_level ? ` (สูงสุดระดับ${h.max_level})` : ""}`);
  const t = area.terrain;
  // SRTM เป็นความสูงผิวบน (รวมเรือนยอดไม้/ป่าชายเลน) ที่ราบลุ่มจึงออกมาสูงกว่าจริงหลายเมตร → ใช้เกณฑ์ < 10 ม.
  if (t && Number.isFinite(t.low10_pct)) {
    add(factors, t.low10_pct >= 40 ? 10 : t.low10_pct >= 20 ? 6 : t.low10_pct >= 10 ? 3 : 0, `ที่ลุ่มต่ำ (< 10 ม.) ${t.low10_pct}% ของตำบล${t.coastal ? " ติดทะเล" : ""}`);
  }
  return { score: total(factors, 40), max: 40, factors };
}

export function exposureOf(area) {
  const factors = [];
  const hh = Number(area.households || 0);
  add(factors, hh >= 3000 ? 8 : hh >= 1500 ? 5 : hh >= 500 ? 3 : 0, `${fmt(hh)} ครัวเรือน`);
  const v = area.vulnerable;
  if (v) {
    const priority = Number(v.priority || 0);
    add(factors, priority >= 50 ? 8 : priority >= 20 ? 5 : priority >= 5 ? 3 : priority > 0 ? 1 : 0, `ผู้ติดเตียง/พิการ/ตั้งครรภ์ ${fmt(priority)} คน`);
    add(factors, Number(v.total || 0) >= 500 ? 4 : Number(v.total || 0) >= 200 ? 2 : 0, `กลุ่มเปราะบางรวม ${fmt(v.total)} คน`);
  }
  return { score: total(factors, 20), max: 20, factors };
}

const DISTRICT_POINTS = { critical: 20, high: 14, watch: 7, normal: 0 };
const SEA_AREA_POINTS = { record: 8, high: 5, elevated: 2, normal: 0 };

export function hazardOf(area) {
  const factors = [];
  const d = area.district_weather;
  if (d) add(factors, DISTRICT_POINTS[d.risk_level] || 0, `อ.${area.district}: ${RISK_META[d.risk_level]?.label || d.risk_level}${d.top_reason ? ` — ${d.top_reason}` : ""}`);
  const rain = area.rain_gauge;
  if (rain) add(factors, rain.rain24h >= 90 ? 10 : rain.rain24h >= 60 ? 6 : rain.rain24h >= 35 ? 3 : 0, `ฝน 24 ชม. ${rain.rain24h} มม. ที่สถานี${rain.station}`);
  const water = area.water_station;
  if (water) {
    if (water.source === "ddpm") add(factors, water.state === "overflow" ? 12 : 6, `ระดับน้ำตามเกณฑ์ ปภ. ${water.status_label || "เฝ้าระวัง"} ที่สถานี${water.station}`);
    else if (water.state === "overflow") add(factors, 12, `น้ำล้นตลิ่งที่สถานี${water.station} (+${water.bank_diff} ม.)`);
    else if (water.state === "near") add(factors, 6, `น้ำใกล้ตลิ่งที่สถานี${water.station}`);
  }
  if (area.sea && area.terrain?.coastal !== false) {
    add(factors, SEA_AREA_POINTS[area.sea.key] || 0, `น้ำทะเล${area.sea.label}${area.sea.forecast ? "ในรอบน้ำขึ้นถัดไป" : ""}`);
  }
  const reports = area.citizen_reports;
  if (reports?.count) add(factors, reports.max_rank >= 2 ? 6 : 3, `ประชาชนรายงานน้ำท่วม ${reports.count} จุด (สูงสุด${reports.max_label || "-"}) เจ้าหน้าที่ยืนยันแล้ว`);
  const active = area.active_flood;
  if (active?.records) add(factors, 15, `มีบันทึกน้ำท่วมในเหตุการณ์ที่เปิดอยู่ ${active.records} หมู่บ้าน${active.max_level ? ` (ระดับ${active.max_level})` : ""}`);
  return { score: total(factors, 40), max: 40, factors };
}

export function nowLevelFromScore(score) {
  if (score >= 45) return "critical";
  if (score >= 28) return "high";
  if (score >= 12) return "watch";
  return "normal";
}

export function baselineLevel(index) {
  return index >= 40 ? "high" : index >= 25 ? "medium" : "low";
}

function actionsFor(area, nowLevel) {
  const actions = [];
  const priority = Number(area.vulnerable?.priority || 0);
  const shelters = area.shelters || [];
  if (nowLevel === "critical" || nowLevel === "high") {
    actions.push(`แจ้งผู้นำชุมชน/อสม. ต.${area.tambon} ให้เตรียมพร้อมและติดตามระดับน้ำทุก 1–3 ชม.`);
    if (priority > 0) actions.push(`ตรวจรายชื่อผู้ติดเตียง/พิการ/ตั้งครรภ์ ${fmt(priority)} คน เตรียมรถและทีมเคลื่อนย้าย (ดูแผนที่กลุ่มเปราะบาง)`);
    if (shelters.length) {
      const best = [...shelters].sort((a, b) => b.vacancy - a.vacancy)[0];
      actions.push(`ศูนย์พักพิงในตำบล ${shelters.length} แห่ง — ${best.name} รับได้อีกราว ${fmt(best.vacancy)} คน`);
    } else {
      actions.push("ไม่มีศูนย์พักพิงที่ลงทะเบียนในตำบลนี้ — ประสานศูนย์ในตำบลใกล้เคียง");
    }
  } else if (nowLevel === "watch") {
    actions.push("เฝ้าระวังฝนและระดับน้ำในคลอง ติดตามข้อมูลทุก 3 ชม.");
    if (priority >= 5) actions.push(`ทบทวนรายชื่อกลุ่มเปราะบางที่ต้องเคลื่อนย้ายก่อน (${fmt(priority)} คน)`);
  }
  if (area.sea && ["high", "record"].includes(area.sea.key)) {
    actions.push(`ระวังช่วงน้ำทะเลขึ้นสูงสุด${area.sea.at ? ` ~${new Date(area.sea.at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })} น.` : ""} ชุมชนริมคลอง/ปากน้ำ`);
  }
  return actions;
}

function missingOf(area) {
  const missing = [];
  if (!area.terrain) missing.push("ความสูงพื้นที่");
  if (!area.gistda) missing.push("สถิติน้ำท่วมจากดาวเทียม");
  if (!area.households) missing.push("จำนวนครัวเรือน");
  if (!area.vulnerable) missing.push("ทะเบียนกลุ่มเปราะบาง");
  if (!area.district_weather) missing.push("ความเสี่ยงรายอำเภอ");
  return missing;
}

/** ประเมินหนึ่งตำบล */
export function assessArea(area) {
  const susceptibility = susceptibilityOf(area);
  const exposure = exposureOf(area);
  const hazard = hazardOf(area);
  const baselineIndex = susceptibility.score + exposure.score;
  const nowScore = hazard.score > 0 ? Math.round(hazard.score * (1 + baselineIndex / 60)) : 0;
  const nowLevel = nowLevelFromScore(nowScore);
  const base = baselineLevel(baselineIndex);
  return {
    key: area.key,
    district: area.district,
    tambon: area.tambon,
    centroid: area.centroid || null,
    households: area.households || 0,
    coastal: Boolean(area.terrain?.coastal),
    terrain: area.terrain || null,
    flood_history: { max_freq: Number(area.gistda?.max_freq || 0), eoc_years: Number(area.eoc_history?.years || 0) },
    susceptibility,
    exposure,
    hazard,
    baseline_index: baselineIndex,
    baseline_level: base,
    now_score: nowScore,
    now_level: nowLevel,
    reasons: [...hazard.factors, ...susceptibility.factors, ...exposure.factors].sort((a, b) => b.points - a.points).slice(0, 5).map((item) => item.label),
    actions: actionsFor(area, nowLevel),
    missing: missingOf(area),
    shelters: area.shelters || [],
    vulnerable: area.vulnerable || null
  };
}

/** ประเมินทุกตำบลและเรียงอันดับ: ความเสี่ยงตอนนี้ก่อน แล้วความเปราะบางพื้นฐาน */
export function rankAreas(areas = []) {
  const assessed = areas.map(assessArea);
  assessed.sort((a, b) => (
    RISK_LEVELS.indexOf(b.now_level) - RISK_LEVELS.indexOf(a.now_level)
    || b.now_score - a.now_score
    || b.baseline_index - a.baseline_index
  ));
  const counts = Object.fromEntries(RISK_LEVELS.map((level) => [level, assessed.filter((item) => item.now_level === level).length]));
  const baselineCounts = Object.fromEntries(Object.keys(BASELINE_LEVELS).map((level) => [level, assessed.filter((item) => item.baseline_level === level).length]));
  return { areas: assessed, counts, baseline_counts: baselineCounts };
}
