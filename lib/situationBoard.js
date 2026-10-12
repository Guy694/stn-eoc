// แผงสรุปสถานการณ์ (หน้าภาพรวม) — แปลงข้อมูลสรุปของเหตุการณ์เป็น "ตัวชี้วัดหลัก" และ "ตารางรายอำเภอ"
// ไม่แตะฐานข้อมูล ทดสอบได้ — ข้อมูลมาจาก loadEventBrief()

const n = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/** ชื่ออำเภอจากแต่ละตารางเขียนต่างกัน ("อ.ละงู", "อำเภอละงู", "ละงู") — ใช้ชื่อเปล่าเป็นกุญแจ */
export function districtKey(name) {
  return String(name || "").trim().replace(/^(อำเภอ|อ\.)\s*/, "").trim();
}

export const TONES = {
  red: { label: "เร่งด่วน", rank: 0 },
  amber: { label: "เฝ้าระวัง", rank: 1 },
  green: { label: "ปกติ", rank: 2 },
  gray: { label: "ไม่มีข้อมูล", rank: 3 }
};

const worst = (...tones) => tones.filter(Boolean).sort((a, b) => TONES[a].rank - TONES[b].rank)[0] || "gray";

/**
 * ตัวชี้วัดหลัก 6 ด้าน แต่ละด้านมีสถานะ (tone) และข้อความบอกว่า "ทำไม" เพื่อให้ตัดสินใจได้จากแถวเดียว
 */
export function buildKpis(brief = {}) {
  const impact = brief.impact || {};
  const health = brief.health?.totals || {};
  const shelters = brief.shelters || {};
  const vulnerable = brief.vulnerable || {};
  const supplies = brief.supplies?.summary || null;
  const it = brief.it?.summary || {};
  const casualties = impact.casualties || {};

  const people = n(impact.latest?.people);
  const prevPeople = n(impact.previous?.people);
  const peopleDelta = impact.previous ? people - prevPeople : null;
  const loss = n(casualties.deaths) + n(casualties.missing);

  const kpis = [
    {
      key: "impact",
      label: "ประชาชนได้รับผลกระทบ",
      value: people,
      unit: "คน",
      delta: peopleDelta,
      deltaLabel: impact.previous ? `เทียบรายงาน ${impact.previous.date}` : null,
      detail: impact.latest
        ? `${n(impact.latest.villages)} หมู่บ้าน · ระดับรุนแรง ${n(impact.latest.severe)} หมู่บ้าน · ข้อมูลวันที่ ${impact.latest.date}`
        : "ยังไม่มีบันทึกพื้นที่น้ำท่วม",
      tone: !impact.latest ? "gray" : n(impact.latest.severe) > 0 || (peopleDelta !== null && peopleDelta > 0) ? "red" : people > 0 ? "amber" : "green",
      href: "/eoc/flood/records"
    },
    {
      key: "casualties",
      label: "เสียชีวิต / สูญหาย / บาดเจ็บ",
      value: `${n(casualties.deaths)} / ${n(casualties.missing)} / ${n(casualties.injured)}`,
      unit: "คน",
      detail: loss > 0 ? "มีผู้เสียชีวิตหรือสูญหาย ต้องรายงานผู้บังคับบัญชา" : n(casualties.injured) > 0 ? "มีผู้บาดเจ็บ ติดตามการส่งต่อ" : "ยังไม่มีรายงานผู้เสียชีวิตหรือสูญหาย",
      tone: loss > 0 ? "red" : n(casualties.injured) > 0 ? "amber" : "green",
      href: "/eoc/flood/affected"
    },
    {
      key: "shelters",
      label: "ผู้พักพิงในศูนย์",
      value: n(shelters.occupancy),
      unit: "คน",
      detail: n(shelters.activeCount)
        ? `${n(shelters.activeCount)} ศูนย์ · ใช้ ${n(shelters.usePercent)}% ของความจุ · ว่าง ${n(shelters.free)} ที่${n(shelters.full) ? ` · เต็ม ${n(shelters.full)} แห่ง` : ""}`
        : "ยังไม่เปิดศูนย์พักพิงในเหตุการณ์นี้",
      tone: !n(shelters.activeCount) ? "gray" : n(shelters.full) > 0 ? "red" : n(shelters.nearFull) > 0 || n(shelters.usePercent) >= 80 ? "amber" : "green",
      href: "/eoc/shelters?eoc=flood"
    },
    {
      key: "health",
      label: "ผู้ป่วย 7 วันล่าสุด",
      value: n(health.last7),
      unit: "ราย",
      delta: health.change === undefined ? null : health.change,
      deltaUnit: "%",
      deltaLabel: health.change === null && n(health.last7) > 0 ? "พบใหม่ (7 วันก่อนไม่มี)" : "เทียบ 7 วันก่อน",
      detail: `สะสม ${n(health.cases)} ราย · ส่งต่อ รพ. ${n(health.hospitalized)} · เสียชีวิต ${n(health.deaths)}${n(health.severeReports) ? ` · รายงานอาการรุนแรง ${n(health.severeReports)} ครั้ง` : ""}`,
      tone: n(health.deaths) > 0 || n(health.severeReports) > 0 ? "red" : n(health.last7) > 0 && (health.change === null || health.change > 0) ? "amber" : n(health.cases) > 0 ? "green" : "gray",
      href: "/eoc/flood/health"
    },
    {
      key: "vulnerable",
      label: "กลุ่มเปราะบางที่ยังไม่ได้ดูแล",
      value: n(vulnerable.pending),
      unit: "คน",
      detail: n(vulnerable.affected)
        ? `จาก ${n(vulnerable.affected)} คนในพื้นที่ประสบภัย · ดูแลแล้ว ${n(vulnerable.caredPercent)}%`
        : "ยังไม่ได้เพิ่มหมู่บ้านที่ประสบภัย",
      tone: !n(vulnerable.affected) ? "gray" : n(vulnerable.caredPercent) < 50 ? "red" : n(vulnerable.pending) > 0 ? "amber" : "green",
      href: "/eoc/flood/vulnerable-groups"
    },
    {
      key: "supplies",
      label: "เวชภัณฑ์หมด / ใกล้หมด",
      value: supplies ? `${n(supplies.out)} / ${n(supplies.low)}` : "-",
      unit: "รายการ",
      detail: supplies ? `ติดตาม ${n(supplies.items)} ชนิด ใน ${n(supplies.agencies)} หน่วยบริการ` : "ยังไม่เปิดบัญชีคลังของเหตุการณ์",
      tone: !supplies ? "gray" : n(supplies.out) > 0 ? "red" : n(supplies.low) > 0 ? "amber" : "green",
      href: "/eoc/flood/supplies"
    },
    {
      key: "it",
      label: "ปัญหา IT ที่ยังไม่แก้",
      value: n(it.open),
      unit: "เรื่อง",
      detail: n(it.open) ? `วิกฤต/สูง ${n(it.critical)} เรื่อง · อุปกรณ์ออฟไลน์ ${n(it.resources?.offline)}` : `อุปกรณ์ออฟไลน์ ${n(it.resources?.offline)}`,
      tone: n(it.critical) > 0 ? "red" : n(it.open) > 0 ? "amber" : "green",
      href: "/eoc/flood/it-support"
    }
  ];
  // ออกซิเจนเหลว: แสดงเมื่อมีโรงพยาบาลรายงานแล้ว
  const oxygen = brief.oxygen;
  if (oxygen?.facilities) {
    kpis.push({
      key: "oxygen",
      label: "ออกซิเจนเหลว ใช้ได้น้อยที่สุด",
      value: oxygen.minDays === null ? "-" : oxygen.minDays,
      unit: "วัน",
      detail: `วิกฤต ${n(oxygen.critical)} · ต้องจัดหา ${n(oxygen.low)} จาก ${n(oxygen.facilities)} โรงพยาบาล${n(oxygen.problems) ? ` · มีปัญหาจัดหา ${n(oxygen.problems)} แห่ง` : ""}`,
      tone: n(oxygen.critical) > 0 ? "red" : n(oxygen.low) > 0 || n(oxygen.problems) > 0 ? "amber" : oxygen.minDays === null ? "gray" : "green",
      href: "/eoc/flood/oxygen"
    });
  }
  // ทีมปฏิบัติการ (MCATT / หน่วยแพทย์ / MERT): แสดงเมื่อมีรายงานแล้ว
  const teams = brief.teamReports;
  if (teams && Object.values(teams).some((team) => team.reports)) {
    const servedToday = n(teams.mcatt?.servedToday) + n(teams.medical?.servedToday) + n(teams.mert?.servedToday);
    const stressHigh = n(teams.mcatt?.cumulative?.stress_high);
    const reportedToday = Object.values(teams).some((team) => team.districtsToday?.length);
    kpis.push({
      key: "teams",
      label: "ทีมลงพื้นที่วันนี้ ให้บริการ",
      value: servedToday,
      unit: "ราย/หลัง",
      detail: [
        `MCATT เยี่ยมบ้าน ${n(teams.mcatt?.today?.home_visits)}`,
        `หน่วยแพทย์ ${n(teams.medical?.today?.treated)}`,
        `MERT ${n(teams.mert?.today?.served)}`,
        stressHigh ? `เครียดสูงสะสม ${stressHigh} ราย` : null
      ].filter(Boolean).join(" · "),
      tone: stressHigh > 0 ? "amber" : reportedToday ? "green" : "gray",
      href: "/eoc/flood/team-reports"
    });
  }
  return kpis;
}

function districtRow(name) {
  return {
    district: name,
    people: 0, households: 0, villages: 0, severe: 0, maxDepth: 0,
    deaths: 0, missing: 0, injured: 0,
    shelters: 0, occupancy: 0, capacity: 0, fullShelters: 0, nearShelters: 0,
    cases7: 0, casesPrev7: 0, casesChange: 0,
    vulnerablePending: 0, vulnerableAffected: 0,
    reported: null, tambons: null,
    recovery: null
  };
}

/** ตารางรายอำเภอ: รวมทุกด้านไว้แถวเดียว + จัดลำดับความเร่งด่วน พร้อมเหตุผล */
export function buildDistrictMatrix(brief = {}) {
  const rows = new Map();
  const row = (name) => {
    const key = districtKey(name);
    if (!key || key === "ไม่ระบุอำเภอ") return null;
    if (!rows.has(key)) rows.set(key, districtRow(key));
    return rows.get(key);
  };

  for (const entry of brief.completeness?.districts || []) {
    const target = row(entry.district);
    if (target) { target.reported = n(entry.reported); target.tambons = n(entry.total); }
  }
  for (const entry of brief.impact?.districts || []) {
    const target = row(entry.district);
    if (!target) continue;
    Object.assign(target, {
      people: n(entry.people), households: n(entry.households), villages: n(entry.villages),
      severe: n(entry.severe), maxDepth: n(entry.maxDepth)
    });
  }
  for (const entry of brief.impact?.casualties?.districts || []) {
    const target = row(entry.district);
    if (target) Object.assign(target, { deaths: n(entry.deaths), missing: n(entry.missing), injured: n(entry.injured) });
  }
  for (const entry of brief.shelters?.districts || []) {
    const target = row(entry.district);
    if (target) Object.assign(target, { shelters: n(entry.shelters), occupancy: n(entry.occupancy), capacity: n(entry.capacity), fullShelters: n(entry.full), nearShelters: n(entry.nearFull) });
  }
  for (const entry of brief.health?.districts || []) {
    const target = row(entry.district);
    if (target) Object.assign(target, { cases7: n(entry.last7), casesPrev7: n(entry.prev7), casesChange: entry.change });
  }
  for (const entry of brief.vulnerable?.districts || []) {
    const target = row(entry.district);
    if (target) Object.assign(target, { vulnerablePending: n(entry.pending), vulnerableAffected: n(entry.affected) });
  }

  for (const entry of brief.recovery?.districts || []) {
    const target = row(entry.district);
    if (target) target.recovery = { normal: entry.normal, easing: entry.easing, ongoing: entry.ongoing };
  }

  // ถ้ายังไม่มีอำเภอไหนส่งรายงานเลย ไม่ต้องเขียน "ยังไม่ส่งรายงานวันนี้" ซ้ำทุกแถว (การ์ดความครบรายงานด้านบนบอกอยู่แล้ว)
  const anyReported = [...rows.values()].some((entry) => entry.reported > 0);
  return [...rows.values()]
    .map((entry) => {
      const reasons = [];
      const tones = [];
      if (entry.deaths + entry.missing > 0) { reasons.push(`เสียชีวิต/สูญหาย ${entry.deaths + entry.missing} คน`); tones.push("red"); }
      if (entry.severe > 0) { reasons.push(`น้ำท่วมรุนแรง ${entry.severe} หมู่บ้าน`); tones.push("red"); }
      // ดูรายศูนย์ด้วย: ยอดรวมอำเภออาจยังว่าง แต่บางศูนย์เต็มแล้ว
      if (entry.fullShelters > 0 || (entry.capacity && entry.occupancy >= entry.capacity)) { reasons.push(`ศูนย์พักพิงเต็ม ${entry.fullShelters || 1} แห่ง`); tones.push("red"); }
      else if (entry.nearShelters > 0 || (entry.capacity && entry.occupancy / entry.capacity >= 0.8)) { reasons.push("ศูนย์พักพิงใกล้เต็ม"); tones.push("amber"); }
      if (entry.cases7 > 0 && (entry.casesChange === null || entry.casesChange > 0)) {
        reasons.push(entry.casesChange === null ? `ผู้ป่วยเริ่มพบใหม่ ${entry.cases7} ราย` : `ผู้ป่วยเพิ่ม ${entry.casesChange}%`);
        tones.push(entry.cases7 >= 10 ? "red" : "amber");
      }
      if (entry.vulnerablePending > 0) { reasons.push(`เปราะบางรอดูแล ${entry.vulnerablePending.toLocaleString("th-TH")} คน`); tones.push(entry.vulnerableAffected && entry.vulnerablePending / entry.vulnerableAffected > 0.5 ? "red" : "amber"); }
      if (entry.people > 0 && !entry.severe) { tones.push("amber"); }
      if (anyReported && entry.tambons && entry.reported === 0) reasons.push("ยังไม่ส่งรายงานวันนี้");
      const hasData = entry.people || entry.shelters || entry.cases7 || entry.vulnerableAffected || entry.deaths || entry.injured;
      const tone = tones.length ? worst(...tones) : hasData ? "green" : "gray";
      // คะแนนเรียงลำดับ: สถานะก่อน แล้วตามขนาดผลกระทบ
      const score = (3 - TONES[tone].rank) * 1e6 + (entry.deaths + entry.missing) * 1e4 + entry.severe * 1e3 + entry.people + entry.cases7 * 10 + entry.vulnerablePending;
      return { ...entry, tone, reasons, score };
    })
    .sort((a, b) => b.score - a.score || a.district.localeCompare(b.district, "th"));
}

/** สรุปภาพรวมระดับจังหวัดเป็นประโยคเดียว (ใช้เป็นหัวเรื่องของแผง) */
export function headline(kpis, matrix) {
  const red = matrix.filter((row) => row.tone === "red").map((row) => `อ.${row.district}`);
  const amber = matrix.filter((row) => row.tone === "amber").map((row) => `อ.${row.district}`);
  const urgentKpis = kpis.filter((kpi) => kpi.tone === "red").length;
  if (red.length) return { tone: "red", text: `พื้นที่เร่งด่วน ${red.length} อำเภอ: ${red.slice(0, 4).join(", ")}${red.length > 4 ? ` และอีก ${red.length - 4}` : ""}` };
  if (amber.length || urgentKpis) return { tone: "amber", text: amber.length ? `เฝ้าระวัง ${amber.length} อำเภอ: ${amber.slice(0, 4).join(", ")}` : "มีประเด็นที่ต้องติดตาม" };
  if (matrix.some((row) => row.tone === "green")) return { tone: "green", text: "สถานการณ์ทุกอำเภออยู่ในระดับควบคุมได้" };
  return { tone: "gray", text: "ยังไม่มีข้อมูลจากพื้นที่ — เริ่มจากบันทึกพื้นที่น้ำท่วมและยอดศูนย์พักพิง" };
}
