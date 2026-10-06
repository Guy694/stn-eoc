// รายการตรวจหลังเปิด EOC: สิ่งที่ต้องตั้งค่าก่อนเจ้าหน้าที่จะบันทึกและสรุปข้อมูลได้ครบ
// (บทเรียนจากการทดสอบ: เหตุการณ์ที่ยังไม่มีทีม SAT บันทึกพื้นที่น้ำท่วมไม่ได้เลย แต่ไม่มีหน้าไหนเตือน)
// ไม่แตะฐานข้อมูล ทดสอบได้

/**
 * @param {object} brief ผลจาก loadEventBrief()
 * @param {object} extras { teams: [{ code, name, members, hasLead }], telegram: { ready, enabled }, eocType }
 * @returns {{ items, required, requiredDone, done, total, complete }}
 */
export function buildSetupChecklist(brief = {}, extras = {}) {
  const eocType = extras.eocType || "flood";
  const base = `/eoc/${eocType}`;
  const teams = extras.teams || [];
  const sat = teams.find((team) => String(team.code).toUpperCase() === "SAT");
  const emptyTeams = teams.filter((team) => !team.members && !team.hasLead);
  const telegram = extras.telegram || {};
  const items = [];
  const add = (item) => items.push({ required: false, ...item });

  if (eocType === "flood") {
    add({
      key: "sat-team",
      required: true,
      title: "เพิ่มทีม SAT เข้าเหตุการณ์",
      done: Boolean(sat),
      detail: sat
        ? `ทีม SAT มีสมาชิก ${sat.members} คน${sat.hasLead ? "" : " (ยังไม่กำหนดหัวหน้าทีม)"}`
        : "ถ้ายังไม่มีทีม SAT จะบันทึกพื้นที่น้ำท่วมและผู้ได้รับผลกระทบไม่ได้",
      href: `${base}/operations-team`,
      action: "ไปที่ทีมปฏิบัติการ"
    });
  }
  add({
    key: "team-members",
    title: "ทุกทีมมีหัวหน้าหรือสมาชิก",
    done: teams.length > 0 && emptyTeams.length === 0,
    detail: !teams.length
      ? "ยังไม่มีทีมในเหตุการณ์"
      : emptyTeams.length
        ? `ยังไม่มีคนในทีม: ${emptyTeams.map((team) => team.code).join(", ")}`
        : `${teams.length} ทีมพร้อมทำงาน`,
    href: `${base}/operations-team`,
    action: "จัดคนเข้าทีม"
  });
  add({
    key: "alerts",
    required: true,
    title: "แจ้งเตือนอัตโนมัติพร้อมส่ง",
    done: Boolean(telegram.ready) && telegram.enabled !== false,
    detail: !telegram.ready
      ? "ยังไม่ได้ตั้งค่า Telegram — เรื่องเร่งด่วนจะไม่ถูกส่งถึงผู้บัญชาการ"
      : telegram.enabled === false
        ? "ปิดการส่งอยู่ (EOC_ALERTS_TELEGRAM=off) — เปิดก่อนใช้งานจริง"
        : "ส่งเข้ากลุ่ม Telegram ของศูนย์",
    href: `${base}/meeting-brief`,
    action: "ดูการแจ้งเตือน"
  });
  if (eocType === "flood") {
    add({
      key: "shelters",
      title: "เปิดใช้ศูนย์พักพิงที่พร้อมรับผู้อพยพ",
      done: Number(brief.shelters?.activeCount) > 0,
      detail: Number(brief.shelters?.activeCount) > 0
        ? `เปิดแล้ว ${brief.shelters.activeCount} ศูนย์`
        : "ยอดผู้พักพิงในห้องประชุมจะเป็น 0 จนกว่าจะเปิดใช้ศูนย์",
      href: `/eoc/shelters?eoc=${eocType}`,
      action: "เลือกศูนย์พักพิง"
    });
    add({
      key: "supplies",
      title: "เปิดบัญชีคลังเวชภัณฑ์ของเหตุการณ์",
      done: Boolean(brief.supplies?.opened),
      detail: brief.supplies?.opened ? "เปิดแล้ว ติดตามยอดคงเหลือได้" : "ยกยอดคงเหลือจากเหตุการณ์ก่อนได้ในคลิกเดียว",
      href: `${base}/supplies`,
      action: "เปิดบัญชีคลัง"
    });
  }
  add({
    key: "vulnerable",
    title: "เพิ่มหมู่บ้านที่ประสบภัยในกลุ่มเปราะบาง",
    done: Number(brief.vulnerable?.villages) > 0,
    detail: Number(brief.vulnerable?.villages) > 0
      ? `เพิ่มแล้ว ${brief.vulnerable.villages} พื้นที่`
      : "จำนวนผู้เปราะบางจะดึงจากทะเบียนกลางเมื่อเพิ่มหมู่บ้าน",
    href: `${base}/vulnerable-groups`,
    action: "เพิ่มหมู่บ้าน"
  });
  if (eocType === "flood") {
    add({
      key: "first-report",
      title: "บันทึกพื้นที่น้ำท่วมรายงานแรก",
      done: Boolean(brief.impact?.latest),
      detail: brief.impact?.latest ? `รายงานล่าสุดวันที่ ${brief.impact.latest.date}` : "ตัวเลขผู้ได้รับผลกระทบมาจากบันทึกนี้",
      href: `${base}/records`,
      action: "บันทึกพื้นที่"
    });
  }
  add({
    key: "directives",
    title: "บันทึกสถานการณ์/ข้อสั่งการวันนี้",
    done: Boolean(brief.directives?.date) && brief.directives.date === brief.today,
    detail: brief.directives?.date
      ? brief.directives.date === brief.today ? "บันทึกของวันนี้แล้ว" : `ฉบับล่าสุดวันที่ ${brief.directives.date}`
      : "ยังไม่มีบันทึกข้อสั่งการ",
    href: `${base}/management/directives`,
    action: "บันทึกข้อสั่งการ"
  });

  // ข้อที่ยังไม่ทำและจำเป็นขึ้นก่อน
  items.sort((a, b) => Number(a.done) - Number(b.done) || Number(b.required) - Number(a.required));
  const required = items.filter((item) => item.required);
  const done = items.filter((item) => item.done).length;
  return {
    items,
    required: required.length,
    requiredDone: required.filter((item) => item.done).length,
    done,
    total: items.length,
    complete: done === items.length
  };
}
