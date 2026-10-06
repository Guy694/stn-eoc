// สรุปโรคและสุขภาพในเหตุการณ์ (ชุมชน + ศูนย์พักพิง) สำหรับ dashboard — ไม่แตะฐานข้อมูล ทดสอบได้
// แนวคิด: ดูแนวโน้มรายวัน, เทียบ 7 วันล่าสุดกับ 7 วันก่อนหน้า, แยกอำเภอ/โรค แล้วสรุปเป็น "ข้อควรพิจารณา"

const n = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export function dateKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDays(key, days) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function dateRange(start, end, maxDays = 120) {
  const days = [];
  if (!start || !end || start > end) return days;
  let current = start;
  while (current <= end && days.length < maxDays) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

/** เปอร์เซ็นต์การเปลี่ยนแปลง (null ถ้าเดิมเป็น 0 แต่มีของใหม่ = "ใหม่") */
export function changePercent(current, previous) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function windowSums(rows, keyOf, today) {
  const last7Start = addDays(today, -6);
  const prev7Start = addDays(today, -13);
  const map = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    if (!map.has(key)) map.set(key, { key, total: 0, last7: 0, prev7: 0 });
    const entry = map.get(key);
    const day = dateKey(row.report_date);
    const cases = n(row.cases);
    entry.total += cases;
    if (day >= last7Start && day <= today) entry.last7 += cases;
    else if (day >= prev7Start && day < last7Start) entry.prev7 += cases;
  }
  return [...map.values()].map((entry) => ({ ...entry, change: changePercent(entry.last7, entry.prev7) }));
}

const DISEASE_ADVICE = [
  { match: /ฉี่หนู|เลปโต|lepto/i, advice: "แจกรองเท้าบูท/ถุงมือยาง ประชาสัมพันธ์เลี่ยงการลุยน้ำ และให้ผู้มีไข้หลังลุยน้ำรีบพบแพทย์" },
  { match: /อุจจาระร่วง|ท้องร่วง|ท้องเสีย|diarr/i, advice: "ตรวจคุณภาพน้ำดื่ม เติมคลอรีน ดูแลสุขาภิบาลอาหารและห้องน้ำในศูนย์ แจกผงเกลือแร่" },
  { match: /ผิวหนัง|น้ำกัดเท้า|เชื้อรา/i, advice: "แจกยาทาน้ำกัดเท้าและรองเท้า ให้ความรู้การล้างและเช็ดเท้าให้แห้ง" },
  { match: /ตาแดง|conjunct/i, advice: "แยกผู้ป่วย งดใช้ของร่วมกัน รณรงค์ล้างมือ" },
  { match: /ไข้หวัด|ทางเดินหายใจ|influ|covid|โควิด/i, advice: "แยกผู้มีอาการในศูนย์ แจกหน้ากากอนามัย จัดพื้นที่ระบายอากาศ" },
  { match: /ไข้เลือดออก|dengue/i, advice: "กำจัดแหล่งน้ำขังหลังน้ำลด พ่นยุงในหมู่บ้านที่มีผู้ป่วย" }
];

export function adviceForDisease(name) {
  return DISEASE_ADVICE.find((item) => item.match.test(String(name || "")))?.advice || null;
}

/**
 * raw: {
 *   community: [{ report_date, district, tambon, village, disease, cases }],
 *   shelter:   [{ report_date, district, shelter, disease, cases, hospitalized, deaths, severity }],
 *   population: [{ district, population }]
 *   session: { opened_at, closed_at }
 * }
 */
export function buildHealthDashboard(raw, today) {
  const community = raw.community || [];
  const shelter = raw.shelter || [];
  const all = [...community.map((row) => ({ ...row, source: "community" })), ...shelter.map((row) => ({ ...row, source: "shelter" }))];
  const endKey = raw.session?.closed_at ? dateKey(raw.session.closed_at) : today;
  const firstReport = all.map((row) => dateKey(row.report_date)).filter(Boolean).sort()[0];
  const startKey = [dateKey(raw.session?.opened_at), firstReport].filter(Boolean).sort()[0] || addDays(endKey, -13);
  const days = dateRange(startKey < addDays(endKey, -89) ? addDays(endKey, -89) : startKey, endKey);

  // แนวโน้มรายวัน
  const byDay = new Map(days.map((day) => [day, { day, community: 0, shelter: 0 }]));
  for (const row of all) {
    const entry = byDay.get(dateKey(row.report_date));
    if (entry) entry[row.source] += n(row.cases);
  }
  const trend = [...byDay.values()].map((entry, index, list) => {
    const window = list.slice(Math.max(0, index - 6), index + 1);
    const avg = window.reduce((sum, item) => sum + item.community + item.shelter, 0) / window.length;
    return { ...entry, total: entry.community + entry.shelter, avg7: Math.round(avg * 10) / 10 };
  });

  const sumWhere = (rows, from, to) => rows.reduce((sum, row) => {
    const day = dateKey(row.report_date);
    return day >= from && day <= to ? sum + n(row.cases) : sum;
  }, 0);
  const last7 = sumWhere(all, addDays(endKey, -6), endKey);
  const prev7 = sumWhere(all, addDays(endKey, -13), addDays(endKey, -7));
  const todayCases = sumWhere(all, endKey, endKey);
  const lastReport = all.map((row) => dateKey(row.report_date)).filter(Boolean).sort().pop() || null;

  const population = new Map((raw.population || []).map((row) => [row.district, n(row.population)]));
  const districts = windowSums(all, (row) => row.district || "ไม่ระบุอำเภอ", endKey)
    .map((entry) => {
      const pop = population.get(entry.key) || 0;
      return {
        ...entry,
        district: entry.key,
        community: community.filter((row) => (row.district || "ไม่ระบุอำเภอ") === entry.key).reduce((sum, row) => sum + n(row.cases), 0),
        shelter: shelter.filter((row) => (row.district || "ไม่ระบุอำเภอ") === entry.key).reduce((sum, row) => sum + n(row.cases), 0),
        ratePer100k: pop ? Math.round((entry.total / pop) * 100000 * 10) / 10 : null
      };
    })
    .sort((a, b) => b.last7 - a.last7 || b.total - a.total);

  const diseases = windowSums(all, (row) => String(row.disease || "ไม่ระบุโรค").trim(), endKey)
    .map((entry) => ({ ...entry, disease: entry.key, advice: adviceForDisease(entry.key) }))
    .sort((a, b) => b.total - a.total);

  const villages = windowSums(community, (row) => [row.district, row.tambon, row.village].filter(Boolean).join("|"), endKey)
    .filter((entry) => entry.last7 > 0)
    .map((entry) => { const [district, tambon, village] = entry.key.split("|"); return { ...entry, district, tambon, village }; })
    .sort((a, b) => b.last7 - a.last7)
    .slice(0, 8);

  // heatmap อำเภอ × วัน (14 วันล่าสุด)
  const heatDays = days.slice(-14);
  const heatDistricts = districts.slice(0, 10).map((entry) => entry.district);
  const heat = heatDistricts.map((district) => ({
    district,
    values: heatDays.map((day) => all.filter((row) => (row.district || "ไม่ระบุอำเภอ") === district && dateKey(row.report_date) === day).reduce((sum, row) => sum + n(row.cases), 0))
  }));
  const heatMax = Math.max(1, ...heat.flatMap((row) => row.values));

  const shelterTotals = shelter.reduce((acc, row) => ({
    cases: acc.cases + n(row.cases), hospitalized: acc.hospitalized + n(row.hospitalized), deaths: acc.deaths + n(row.deaths),
    severe: acc.severe + (row.severity === "high" || row.severity === "critical" ? 1 : 0)
  }), { cases: 0, hospitalized: 0, deaths: 0, severe: 0 });

  // ข้อควรพิจารณา (เรียงตามความสำคัญ)
  const actions = [];
  if (shelterTotals.deaths) actions.push({ level: "critical", title: `มีผู้เสียชีวิต ${shelterTotals.deaths} ราย`, detail: "พิจารณาสอบสวนโรคและทบทวนการส่งต่อผู้ป่วยจากศูนย์พักพิง" });
  const recent3 = trend.slice(-3).reduce((sum, item) => sum + item.total, 0);
  const before3 = trend.slice(-6, -3).reduce((sum, item) => sum + item.total, 0);
  if (recent3 >= 5 && recent3 > before3 * 1.5) actions.push({ level: "serious", title: "ผู้ป่วยเพิ่มเร็วใน 3 วันล่าสุด", detail: `${recent3} ราย เทียบกับ ${before3} ราย ใน 3 วันก่อนหน้า ควรเพิ่มการคัดกรองเชิงรุกในพื้นที่ประสบภัย` });
  for (const district of districts) {
    if (district.last7 >= 5 && (district.change === null || district.change >= 50)) {
      actions.push({ level: "serious", title: `อ.${district.district} ผู้ป่วยเพิ่มขึ้น${district.change === null ? " (เริ่มพบใหม่)" : ` ${district.change}%`}`, detail: `7 วันล่าสุด ${district.last7} ราย เทียบกับ ${district.prev7} ราย พิจารณาส่งทีม SRRT/MCATT ลงพื้นที่` });
    }
  }
  for (const disease of diseases.slice(0, 5)) {
    if (disease.last7 > 0 && disease.advice && (disease.change === null || disease.change > 0 || disease.last7 >= 10)) {
      actions.push({ level: "warning", title: `${disease.disease} ${disease.last7} รายใน 7 วัน${disease.change > 0 ? ` (เพิ่ม ${disease.change}%)` : ""}`, detail: disease.advice });
    }
  }
  if (shelterTotals.cases && shelterTotals.hospitalized / shelterTotals.cases >= 0.2) {
    actions.push({ level: "warning", title: "ผู้ป่วยในศูนย์ต้องส่งต่อสูง", detail: `ส่งต่อ ${shelterTotals.hospitalized} จาก ${shelterTotals.cases} ราย ควรเพิ่มบุคลากร/ยาในศูนย์และเตรียมรถส่งต่อ` });
  }
  if (lastReport && lastReport < addDays(endKey, -1) && !raw.session?.closed_at) {
    actions.push({ level: "info", title: "ไม่มีรายงานใหม่เกิน 1 วัน", detail: `รายงานล่าสุดวันที่ ${lastReport} ตรวจสอบว่าหน่วยบริการ/ศูนย์ส่งข้อมูลครบหรือไม่` });
  }
  if (!all.length) actions.push({ level: "info", title: "ยังไม่มีรายงานผู้ป่วยในเหตุการณ์นี้", detail: "เริ่มบันทึกได้ที่แท็บ \"ในศูนย์พักพิง\" หรือ \"ในชุมชน / พื้นที่\"" });

  return {
    range: { start: days[0] || null, end: endKey },
    totals: {
      cases: all.reduce((sum, row) => sum + n(row.cases), 0),
      community: community.reduce((sum, row) => sum + n(row.cases), 0),
      shelter: shelterTotals.cases,
      today: todayCases, last7, prev7, change: changePercent(last7, prev7),
      hospitalized: shelterTotals.hospitalized, deaths: shelterTotals.deaths, severeReports: shelterTotals.severe,
      districtsWithCases: districts.filter((entry) => entry.total > 0).length,
      lastReport
    },
    trend,
    districts,
    diseases: diseases.slice(0, 10),
    villages,
    heat: { days: heatDays, rows: heat, max: heatMax },
    actions
  };
}
