// สรุปว่า "วันนี้" ตำบลไหนส่งรายงานแล้ว / ยังไม่ส่ง แยกตามอำเภอ (ไม่แตะฐานข้อมูล ทดสอบได้)

export const COMPLETENESS_SOURCES = {
  flood: {
    label: "อุทกภัยน้ำท่วม",
    sql: `SELECT DISTINCT district, tambon FROM flood_records WHERE session_id = ? AND DATE(flood_start_date) = ?`,
    recordsPath: "/eoc/flood/records"
  },
  disease: {
    label: "โรคระบาด",
    sql: `SELECT DISTINCT district_name AS district, tambon_name AS tambon FROM disease_reports WHERE session_id = ? AND report_date = ?`,
    recordsPath: "/eoc/disease/records"
  }
};

const key = (district, tambon) => `${String(district || "").trim()}|${String(tambon || "").trim()}`;

/** areas: [{district, tambon}] ทั้งจังหวัด, reported: [{district, tambon}] ที่ส่งแล้วในวันนั้น */
export function buildCompleteness(areas, reported) {
  const done = new Set(reported.map((row) => key(row.district, row.tambon)));
  const districts = new Map();
  for (const area of areas) {
    if (!area.district || !area.tambon) continue;
    if (!districts.has(area.district)) districts.set(area.district, { district: area.district, tambons: [] });
    const entry = districts.get(area.district);
    if (entry.tambons.some((item) => item.name === area.tambon)) continue;
    entry.tambons.push({ name: area.tambon, reported: done.has(key(area.district, area.tambon)) });
  }
  const list = [...districts.values()]
    .map((entry) => {
      const reportedCount = entry.tambons.filter((item) => item.reported).length;
      return {
        ...entry,
        tambons: entry.tambons.sort((a, b) => a.name.localeCompare(b.name, "th")),
        total: entry.tambons.length,
        reported: reportedCount,
        missing: entry.tambons.filter((item) => !item.reported).map((item) => item.name)
      };
    })
    .sort((a, b) => a.district.localeCompare(b.district, "th"));
  const total = list.reduce((sum, item) => sum + item.total, 0);
  const reportedTotal = list.reduce((sum, item) => sum + item.reported, 0);
  return { districts: list, total, reported: reportedTotal, percent: total ? Math.round((reportedTotal / total) * 100) : 0 };
}

/** ข้อความแจ้งเตือนสำหรับ Telegram (HTML) */
export function buildReminderText({ label, sessionNumber, dateLabel, summary, escape = (value) => value }) {
  const lines = [
    `<b>แจ้งเตือนส่งรายงาน${escape(label)}${sessionNumber ? ` ครั้งที่ ${sessionNumber}` : ""}</b>`,
    `วันที่ ${escape(dateLabel)} ส่งแล้ว ${summary.reported}/${summary.total} ตำบล (${summary.percent}%)`,
    ""
  ];
  for (const district of summary.districts) {
    if (!district.missing.length) continue;
    lines.push(`• อ.${escape(district.district)} ยังไม่ส่ง: ${district.missing.map(escape).join(", ")}`);
  }
  if (summary.reported === summary.total) lines.push("ทุกตำบลส่งรายงานครบแล้ว ขอบคุณครับ");
  return lines.join("\n");
}
