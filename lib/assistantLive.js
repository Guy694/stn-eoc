// ผู้ช่วย EOC: ตอบคำถามสถานการณ์ "ตอนนี้" จากข้อมูลจริงในระบบ (ไม่มีการเรียกเครือข่าย/ฐานข้อมูลในไฟล์นี้)
// ข้อมูลเข้า (data): { now, districts, warnings, waterStations, waterObservedAt, shelters, sheltersOpen, facilities, openEvents, riverOutlook }
import { RISK_META } from "@/lib/weatherRiskConfig";
import { canalState, canalSummary, sortCanals, shelterSummary } from "@/lib/homeSignals";
import { facilityTypeInfo, serviceStatusMeta } from "@/lib/healthFacilityStatus";
import { DISCHARGE_LEVELS } from "@/lib/forecastSignals";

export const SATUN_DISTRICTS = ["เมืองสตูล", "ควนโดน", "ควนกาหลง", "ท่าแพ", "ละงู", "ทุ่งหว้า", "มะนัง"];

const normalize = (value) => String(value || "").replace(/^อ(\.|ำเภอ)\s*/, "").replace(/\s+/g, "");

/** หาอำเภอจากข้อความ (รองรับ "อำเภอเมือง", "อ.เมือง") */
export function detectDistrict(message, fallback = null) {
  const text = String(message || "").replace(/\s+/g, "");
  const found = SATUN_DISTRICTS.find((name) => text.includes(name));
  if (found) return found;
  if (/(อำเภอ|อ\.)เมือง|ตัวเมือง|ในเมือง/.test(text)) return "เมืองสตูล";
  return SATUN_DISTRICTS.includes(normalize(fallback)) ? normalize(fallback) : null;
}

const INTENTS = [
  ["track", /ติดตาม(คำขอ|เรื่อง|สถานะ)|เรื่องที่แจ้ง|แจ้งไปแล้ว|สถานะคำขอ|ถึงไหนแล้ว/],
  ["help", /ขอความช่วยเหลือ|ช่วยด้วย|ติดอยู่ใน|ออกจากบ้านไม่ได้|ต้องการความช่วยเหลือ|แจ้งเหตุ/],
  ["shelter", /ศูนย์พักพิง|ที่พักพิง|อพยพไป(ที่)?ไหน|ที่หลบภัย|ศูนย์อพยพ/],
  ["health", /โรงพยาบาล|รพ\.|รพสต|สถานพยาบาล|อนามัย|หาหมอ/],
  ["warning", /ประกาศเตือน|เตือนภัย|แจ้งเตือน|มีเตือน/],
  ["water", /ระดับน้ำ|น้ำในคลอง|ตลิ่ง|น้ำล้น|คลอง.*(เป็น|ตอนนี้|ยังไง|สูง)|แม่น้ำ.*(ตอนนี้|สูง)/],
  ["forecast", /พรุ่งนี้|มะรืน|พยากรณ์|สัปดาห์นี้|7\s*วัน|วันข้างหน้า|ฝนจะตก/],
  ["rain", /ฝน.*(ตอนนี้|วันนี้|ตกไหม|ตกอยู่|เท่าไ|กี่|มม|ที่ไหน)|ฝนตกที่ไหน|ปริมาณฝน/],
  ["risk", /เสี่ยง|ปลอดภัยไหม|น่ากังวล|อันตรายไหม|สถานการณ์(วันนี้|ตอนนี้)|ตอนนี้เป็นยังไง/]
];

/** ประเภทคำถามที่ตอบจากข้อมูลจริงได้ทันที */
export function detectLiveIntent(message) {
  const text = String(message || "").replace(/\s+/g, "");
  const hit = INTENTS.find(([, pattern]) => pattern.test(text));
  return hit ? hit[0] : null;
}

function clock(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) || date.getTime() <= 0
    ? null
    : date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
}

function dayLabel(dateText, index) {
  if (index === 0) return "วันนี้";
  if (index === 1) return "พรุ่งนี้";
  const date = new Date(`${String(dateText).slice(0, 10)}T00:00:00+07:00`);
  return date.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
}

const riskLabel = (level) => (RISK_META[level] || RISK_META.normal).label;
const findDistrict = (data, name) => (data.districts || []).find((item) => normalize(item.district_name) === normalize(name)) || null;

const ACTIONS = {
  map: { label: "แผนที่สถานการณ์", href: "/public/disaster-map" },
  forecast: { label: "พยากรณ์ 7 วัน", href: "/public/weather-watch" },
  myRisk: { label: "บ้านฉันเสี่ยงไหม", href: "/public/my-risk" },
  shelters: { label: "ศูนย์พักพิงใกล้ฉัน", href: "/public/shelters?near=1" },
  track: { label: "ติดตามคำขอ", href: "/public/track" },
  help: { label: "ขอความช่วยเหลือ", href: "/public/report-incident", tone: "danger" },
  water: { label: "รายงานระดับน้ำ", href: "/public/report-water" },
  call1669: { label: "โทร 1669", href: "tel:1669", tone: "danger" },
  call1784: { label: "โทร 1784", href: "tel:1784", tone: "danger" }
};

function waterAnswer(data, district) {
  const all = data.waterStations || [];
  if (all.length === 0) return { answer: "ตอนนี้ยังอ่านค่าจากสถานีวัดระดับน้ำไม่ได้ครับ ลองดูที่แผนที่สถานการณ์อีกครั้งภายหลัง", actions: [ACTIONS.map] };
  const inDistrict = district ? all.filter((item) => normalize(item.amphoe) === district) : [];
  const list = sortCanals(inDistrict.length ? inDistrict : all).slice(0, inDistrict.length ? 6 : 5);
  const lines = list.map((station) => {
    const state = canalState(station);
    const diff = state.diff === null ? "" : ` ${state.diff >= 0 ? "สูงกว่า" : "ต่ำกว่า"}ตลิ่ง ${Math.abs(state.diff).toFixed(2)} ม.`;
    const trend = station.trend?.label ? ` (${station.trend.label})` : "";
    return `• ${station.name}${station.river ? ` ${station.river}` : ""}: ${state.label}${state.key === "normal" ? diff.replace(" ต่ำกว่าตลิ่ง", "") : diff}${trend}`;
  });
  const time = clock(data.waterObservedAt);
  const head = district && !inDistrict.length
    ? `อ.${district} ไม่มีสถานีวัดระดับน้ำครับ ภาพรวมทั้งจังหวัด: ${canalSummary(all)}`
    : `${district && inDistrict.length ? `อ.${district}: ` : ""}${canalSummary(inDistrict.length ? inDistrict : all)}`;
  return {
    answer: [head, ...lines, time ? `ข้อมูล ThaiWater (สสน.) เวลา ${time} น.` : null].filter(Boolean).join("\n"),
    actions: [ACTIONS.map, ACTIONS.myRisk]
  };
}

function rainAnswer(data, district) {
  const districts = data.districts || [];
  if (districts.length === 0) return null;
  if (district) {
    const item = findDistrict(data, district);
    if (!item) return null;
    const lines = [
      `อ.${item.district_name} ตอนนี้: ${item.weather_condition}${item.rain_now_text ? ` (${item.rain_now_text})` : ""}`,
      `ฝน 24 ชม.${item.rain_source === "gauge" ? "ที่วัดได้" : " (ประมาณ)"} ${item.rainfall_24h} มม.${item.rain_gauge?.max_station ? ` สูงสุดที่${item.rain_gauge.max_station}` : ""}`,
      item.heavy_rain_today ? `โอกาสฝนหนักวันนี้ ${item.heavy_rain_today.prob_heavy}% พรุ่งนี้ ${item.heavy_rain_tomorrow?.prob_heavy ?? "-"}%` : null
    ];
    return { answer: lines.filter(Boolean).join("\n"), actions: [ACTIONS.forecast, ACTIONS.map] };
  }
  const raining = districts.filter((item) => item.rain_now?.raining > 0);
  const top = [...districts].sort((a, b) => b.rainfall_24h - a.rainfall_24h).slice(0, 3);
  return {
    answer: [
      raining.length ? `ตอนนี้ฝนตกใน ${raining.length} อำเภอ: ${raining.map((item) => `อ.${item.district_name}`).join(" ")}` : "ตอนนี้สถานีวัดฝนยังไม่พบฝนตกครับ",
      "ฝนสะสม 24 ชม. มากที่สุด:",
      ...top.map((item) => `• อ.${item.district_name} ${item.rainfall_24h} มม.`),
      "ข้อมูลจากสถานีวัดฝน ThaiWater (สสน.)"
    ].join("\n"),
    actions: [ACTIONS.map, ACTIONS.forecast]
  };
}

function riskAnswer(data, district) {
  const districts = data.districts || [];
  if (districts.length === 0) return null;
  if (district) {
    const item = findDistrict(data, district);
    if (!item) return null;
    return {
      answer: [
        `อ.${item.district_name} วันนี้ระดับ "${riskLabel(item.risk_level)}"`,
        ...(item.risk_reasons || []).slice(0, 4).map((reason) => `• ${reason}`),
        "ต้องการดูเฉพาะบ้านคุณ กด \"บ้านฉันเสี่ยงไหม\" ได้เลยครับ"
      ].join("\n"),
      actions: [ACTIONS.myRisk, ACTIONS.forecast]
    };
  }
  const atRisk = districts.filter((item) => item.risk_level !== "normal");
  return {
    answer: atRisk.length
      ? [`วันนี้มี ${atRisk.length} จาก ${districts.length} อำเภอที่ต้องเฝ้าระวัง`, ...atRisk.map((item) => `• อ.${item.district_name}: ${riskLabel(item.risk_level)} — ${(item.risk_reasons || [])[0] || ""}`)].join("\n")
      : `วันนี้ทั้ง ${districts.length} อำเภอยังอยู่ในระดับปกติครับ ฝนที่วัดได้ ระดับน้ำในคลอง และพยากรณ์ฝนหนักยังไม่น่ากังวล`,
    actions: [ACTIONS.myRisk, ACTIONS.map]
  };
}

function forecastAnswer(data, district) {
  const districts = data.districts || [];
  if (districts.length === 0) return null;
  const item = district ? findDistrict(data, district) : [...districts].sort((a, b) => {
    const pa = Math.max(...(a.forecast_daily || []).slice(0, 3).map((day) => day.prob_heavy || 0));
    const pb = Math.max(...(b.forecast_daily || []).slice(0, 3).map((day) => day.prob_heavy || 0));
    return pb - pa;
  })[0];
  if (!item) return null;
  const days = (item.forecast_daily || []).slice(0, 4).map((day, index) => (
    `• ${dayLabel(day.forecast_datetime, index)}: ${day.weather_condition} ฝนราว ${day.rainfall_median ?? day.rainfall_forecast} มม.${day.prob_heavy !== null && day.prob_heavy !== undefined ? ` โอกาสฝนหนัก ${day.prob_heavy}%` : ""} (${riskLabel(day.risk_level)})`
  ));
  const rivers = (data.riverOutlook || []).filter((river) => normalize(river.amphoe) === normalize(item.district_name) && river.level !== "normal");
  return {
    answer: [
      `${district ? "" : "อำเภอที่มีโอกาสฝนหนักสูงสุด: "}อ.${item.district_name} ช่วงข้างหน้า`,
      ...days,
      ...rivers.map((river) => `• น้ำในคลองที่${river.station}คาดว่า${DISCHARGE_LEVELS[river.level]?.label}ช่วง 7 วันข้างหน้า`),
      "พยากรณ์จาก ECMWF (51 ชุด) ใช้ประกอบการตัดสินใจ ไม่ใช่ประกาศทางราชการ"
    ].join("\n"),
    actions: [ACTIONS.forecast, ACTIONS.myRisk]
  };
}

function warningAnswer(data) {
  const warnings = data.warnings || [];
  if (warnings.length === 0) {
    return { answer: "ตอนนี้ยังไม่มีประกาศเตือนในจังหวัดสตูลครับ ทั้งจากสถานีวัดน้ำ/ฝน และประกาศของ สสน.", actions: [ACTIONS.map, ACTIONS.forecast] };
  }
  return {
    answer: [`มีประกาศเตือน ${warnings.length} รายการ:`, ...warnings.slice(0, 5).map((item) => `• ${item.message}`)].join("\n"),
    actions: [ACTIONS.myRisk, ACTIONS.map]
  };
}

function shelterAnswer(data, district) {
  if (!data.sheltersOpen || (data.shelters || []).length === 0) {
    return {
      answer: "ตอนนี้ยังไม่มีศูนย์พักพิงที่เปิดรับผู้อพยพครับ ศูนย์จะเปิดเมื่อจังหวัดเปิดศูนย์ปฏิบัติการ (EOC) หากต้องการอพยพเร่งด่วน โทร 1784 หรือ 1669",
      actions: [ACTIONS.call1784, ACTIONS.myRisk]
    };
  }
  const list = district ? data.shelters.filter((item) => normalize(item.district_name) === district) : data.shelters;
  const summary = shelterSummary(data.shelters);
  const shown = (list.length ? list : data.shelters).slice().sort((a, b) => (b.vacancy || 0) - (a.vacancy || 0)).slice(0, 5);
  return {
    answer: [
      `เปิดอยู่ ${summary.open} แห่ง รับได้อีกรวม ${summary.vacancy.toLocaleString("th-TH")} คน${district && !list.length ? ` (อ.${district} ยังไม่มีศูนย์ที่เปิด)` : ""}`,
      ...shown.map((item) => `• ${item.sheltername} อ.${item.district_name || "-"}: ${item.occupancy_status === "full" ? "เต็มแล้ว" : `ว่าง ${item.vacancy} คน`}${item.contact_phone ? ` โทร ${item.contact_phone}` : ""}`)
    ].join("\n"),
    actions: [ACTIONS.shelters, ACTIONS.myRisk]
  };
}

function healthAnswer(data, district) {
  const facilities = (data.facilities || []).filter((item) => facilityTypeInfo(item.typecode).level !== "office");
  if (facilities.length === 0) return null;
  const affected = facilities.filter((item) => ["closed", "limited"].includes(item.service_status) || ["flooded", "access_cut"].includes(item.flood_status));
  const inDistrict = district ? facilities.filter((item) => normalize(item.district_name) === district) : [];
  const hospitals = (inDistrict.length ? inDistrict : facilities).filter((item) => facilityTypeInfo(item.typecode).level === "hospital");
  const lines = [];
  if (district) lines.push(`สถานพยาบาลใน อ.${district} ${inDistrict.length} แห่ง`);
  hospitals.slice(0, 3).forEach((item) => lines.push(`• ${item.name}: ${serviceStatusMeta(item.service_status).label}${item.phone ? ` โทร ${item.phone}` : ""}`));
  lines.push(affected.length
    ? `ที่ปิดหรือจำกัดบริการตอนนี้: ${affected.map((item) => item.name).slice(0, 6).join(", ")}`
    : "ยังไม่มีรายงานสถานพยาบาลปิดหรือน้ำท่วมครับ");
  lines.push("เจ็บป่วยฉุกเฉินโทร 1669 ได้ตลอด 24 ชม.");
  return { answer: lines.join("\n"), actions: [ACTIONS.map, ACTIONS.call1669] };
}

function trackAnswer() {
  return {
    answer: "ติดตามเรื่องที่แจ้งได้ที่เมนู \"ติดตามคำขอ\" ครับ กรอกชื่อ นามสกุล และเบอร์โทร 4 ตัวท้ายให้ตรงกับตอนแจ้ง จะเห็นสถานะ ลำดับเหตุการณ์ และข้อความจากเจ้าหน้าที่",
    actions: [ACTIONS.track]
  };
}

function helpAnswer(data) {
  const open = (data.openEvents || []).length > 0;
  return {
    answer: open
      ? "ถ้ามีผู้บาดเจ็บหรืออันตรายถึงชีวิต โทร 1669 ทันทีครับ\nถ้าต้องการให้เจ้าหน้าที่ช่วย เช่น ขนย้าย อพยพ ขาดอาหารหรือยา กด \"ขอความช่วยเหลือ\" แล้วปักหมุดตำแหน่ง เจ้าหน้าที่จะติดต่อกลับตามเบอร์ที่ให้ไว้"
      : "ถ้ามีผู้บาดเจ็บหรืออันตรายถึงชีวิต โทร 1669 ทันทีครับ\nเหตุสาธารณภัย เช่น น้ำท่วมติดบ้าน โทร 1784 (ปภ.) ตอนนี้ยังไม่ได้เปิดศูนย์ปฏิบัติการ จึงยังไม่รับคำขอผ่านเว็บไซต์",
    actions: open ? [ACTIONS.help, ACTIONS.call1669] : [ACTIONS.call1669, ACTIONS.call1784]
  };
}

const BUILDERS = {
  water: waterAnswer,
  rain: rainAnswer,
  risk: riskAnswer,
  forecast: forecastAnswer,
  warning: warningAnswer,
  shelter: shelterAnswer,
  health: healthAnswer,
  track: trackAnswer,
  help: helpAnswer
};

export const INTENT_SOURCES = {
  water: "สถานีวัดระดับน้ำ ThaiWater (สสน.)",
  rain: "สถานีวัดฝน ThaiWater (สสน.)",
  risk: "การประเมินความเสี่ยงของระบบ (ข้อมูลวัดจริง + ECMWF)",
  forecast: "พยากรณ์ ECMWF และ GloFAS",
  warning: "ประกาศ สสน. และสถานีวัดในจังหวัด",
  shelter: "ศูนย์ปฏิบัติการภาวะฉุกเฉิน จ.สตูล",
  health: "ข้อมูลสถานพยาบาลที่เจ้าหน้าที่รายงาน",
  track: "ระบบติดตามคำขอ",
  help: "ช่องทางขอความช่วยเหลือ"
};

/** ตอบจากข้อมูลจริง ถ้าคำถามตรงกับประเภทที่รองรับ (คืน null ถ้าไม่ตรงหรือไม่มีข้อมูล) */
export function answerLive(message, data, { district: fallbackDistrict = null } = {}) {
  const intent = detectLiveIntent(message);
  if (!intent) return null;
  const district = detectDistrict(message, fallbackDistrict);
  const result = BUILDERS[intent](data, district);
  return result ? { ...result, intent, district, sourceLabel: INTENT_SOURCES[intent] } : null;
}

/** สรุปสถานการณ์เป็นข้อความสั้น ให้ AI ใช้เป็นข้อเท็จจริง (มีเวลาของข้อมูลกำกับ) */
export function buildSnapshot(data, { district = null } = {}) {
  const lines = [];
  const now = new Date(data.now || Date.now()).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
  lines.push(`เวลาปัจจุบัน: ${now}`);
  lines.push(`ศูนย์ปฏิบัติการ (EOC) ที่เปิด: ${(data.openEvents || []).map((item) => item.label).join(", ") || "ไม่มี"}`);
  if (district) lines.push(`ผู้ใช้สนใจพื้นที่: อ.${district}`);
  for (const item of data.districts || []) {
    lines.push(`อ.${item.district_name}: ความเสี่ยง${riskLabel(item.risk_level)}; ตอนนี้${item.weather_condition}; ฝน 24 ชม. ${item.rainfall_24h} มม.; โอกาสฝนหนักวันนี้ ${item.heavy_rain_today?.prob_heavy ?? "-"}% พรุ่งนี้ ${item.heavy_rain_tomorrow?.prob_heavy ?? "-"}%; อุณหภูมิ ${item.temperature}°C`);
  }
  const waterTime = clock(data.waterObservedAt);
  for (const station of sortCanals(data.waterStations || []).slice(0, 8)) {
    const state = canalState(station);
    lines.push(`สถานีน้ำ ${station.name} (${station.river || "-"}, อ.${station.amphoe}): ${state.label}${state.diff !== null ? ` ${state.diff.toFixed(2)} ม.จากตลิ่ง` : ""}; ${station.trend?.label || ""}${waterTime ? ` [${waterTime} น.]` : ""}`);
  }
  lines.push(`ประกาศเตือน: ${(data.warnings || []).map((item) => item.message).join(" | ") || "ไม่มี"}`);
  if (data.sheltersOpen && (data.shelters || []).length) {
    const summary = shelterSummary(data.shelters);
    lines.push(`ศูนย์พักพิงเปิด ${summary.open} แห่ง ว่างรวม ${summary.vacancy} คน: ${data.shelters.slice(0, 10).map((item) => `${item.sheltername} (อ.${item.district_name}, ว่าง ${item.vacancy})`).join("; ")}`);
  } else {
    lines.push("ศูนย์พักพิง: ยังไม่เปิด (เปิดเมื่อมี EOC)");
  }
  const affected = (data.facilities || []).filter((item) => ["closed", "limited"].includes(item.service_status) || ["flooded", "access_cut"].includes(item.flood_status));
  lines.push(`สถานพยาบาลที่ปิด/จำกัดบริการ/น้ำท่วม: ${affected.map((item) => `${item.name} (${serviceStatusMeta(item.service_status).label})`).join("; ") || "ไม่มีรายงาน"}`);
  return lines.join("\n");
}

/** ปุ่มลัดตามหัวข้อ (ใช้กับคำตอบจาก AI ด้วย เพื่อไม่ให้ AI แต่งลิงก์เอง) */
export function actionsForTopic(message) {
  const intent = detectLiveIntent(message);
  if (intent && BUILDERS[intent]) {
    const fallback = { water: [ACTIONS.map], rain: [ACTIONS.forecast], risk: [ACTIONS.myRisk], forecast: [ACTIONS.forecast], warning: [ACTIONS.map], shelter: [ACTIONS.shelters], health: [ACTIONS.call1669], track: [ACTIONS.track], help: [ACTIONS.help, ACTIONS.call1669] };
    return fallback[intent];
  }
  if (/น้ำท่วม|อุทกภัย|อพยพ/.test(message)) return [ACTIONS.myRisk, ACTIONS.map];
  if (/ฝน|พายุ|มรสุม|ลมแรง/.test(message)) return [ACTIONS.forecast, ACTIONS.myRisk];
  if (/ไข้|โรค|ป่วย/.test(message)) return [ACTIONS.call1669];
  return [];
}
