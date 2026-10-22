// โครงเมนูหลังบ้าน (ผู้ดูแลระบบ) จัดตาม "งานที่ต้องทำ" แทนโครงสร้างโปรแกรม
// 1) ภาพรวม  2) เหตุการณ์ที่เปิดอยู่ (แกนหลักของการกรอกข้อมูล)  3) งานรอดำเนินการ
// 4) ข้อมูลกลาง (ใช้ทุกเหตุการณ์)  5) บริหารระบบ  6) บัญชีของฉัน
// ไฟล์นี้ไม่ผูกกับ React/ไอคอน (ใช้ iconKey) เพื่อทดสอบได้ง่าย
import { moduleEditAccess, resolveOwners } from "../../../lib/eocModulePermissions.js";
import { createTeamWorkItems } from "./eoc-navigation.js";
import { TEAM_CODES, normalizeTeamCode } from "../../features/eoc/registries/team.registry.js";
import { applyMenuLayout, ownerLabel } from "../../../lib/menuLayout.js";

export const EVENT_MODULES = {
  flood: {
    label: "อุทกภัย",
    pathPrefixes: ["/eoc/flood"],
    items: (ctx) => [
      { key: "overview", group: "ประเมินสถานการณ์", name: "ภาพรวมสถานการณ์", path: "/eoc/flood/overview", iconKey: "overview" },
      { key: "water-report", group: "ประเมินสถานการณ์", name: "รายงานระดับน้ำ", path: "/eoc/flood/water-report", iconKey: "flood", description: "ระดับน้ำสถานีเฝ้าระวัง ปภ. เทียบย้อนหลัง บันทึกเป็น PDF/รูป A4" },
      { key: "risk-map", group: "ประเมินสถานการณ์", name: "แผนที่สถานการณ์และความเสี่ยง", path: "/eoc/flood/risk-map", iconKey: "map", description: "ชุดเดียวกับหน้าประชาชน: ระดับน้ำ ฝน น้ำขึ้น–ลง น้ำท่วมซ้ำซาก ความเสี่ยงรายอำเภอ และ Windy" },
      { key: "hydro-trends", group: "ประเมินสถานการณ์", name: "แนวโน้มน้ำและฝน", path: "/eoc/hydro-trends", iconKey: "daily", description: "ฝนรายวัน ระดับน้ำในคลอง น้ำทะเลหนุน ย้อนหลัง 7/30/90 วัน" },
      { key: "area-risk", group: "ประเมินสถานการณ์", name: "พยากรณ์พื้นที่เสี่ยง", path: "/eoc/flood/area-risk", iconKey: "map", description: "ตอนนี้ • พยากรณ์ 7 วัน • จำลองถ้าฝน/คลอง/น้ำทะเลหนุน — ตำบลและหมู่บ้านที่คาดว่าน้ำท่วม" },
      { key: "triggers", group: "สั่งการ", name: "ธงเตือนภัยและ Trigger", path: "/eoc/flood/triggers", iconKey: "flag", description: "ประกาศธงเขียว/เหลือง/แดง และ Trigger เคลื่อนย้ายกลุ่มเปราะบาง รายพื้นที่" },
      { key: "command", group: "สั่งการ", name: "ภารกิจและข้อสั่งการ", path: "/eoc/flood/management/directives", iconKey: "command", description: "สถานการณ์/ข้อสั่งการรายวัน ภารกิจ ประชุม บันทึกการตัดสินใจ" },
      { key: "brief", group: "สั่งการ", name: "สรุปสำหรับห้องประชุม", path: "/eoc/flood/meeting-brief", iconKey: "command", description: "เรื่องเร่งด่วนจากทุกงานในหน้าเดียว พิมพ์ได้" },
      { key: "records", group: "พื้นที่และประชาชน", name: "บันทึกพื้นที่น้ำท่วม", path: "/eoc/flood/records", iconKey: "flood" },
      { key: "shelters", group: "พื้นที่และประชาชน", name: "ศูนย์พักพิง", path: `/eoc/shelters?eoc=flood${ctx.sessionId ? `&session=${ctx.sessionId}` : ""}`, iconKey: "shelter", description: "เปิดใช้ศูนย์และอัปเดตยอดผู้พักพิง" },
      { key: "vulnerable", group: "พื้นที่และประชาชน", name: "กลุ่มเปราะบาง", path: "/eoc/flood/vulnerable-groups", iconKey: "vulnerable", description: "ยอดรายหมู่บ้าน และรายบุคคลบนแผนที่ (พิกัดบ้าน สถานะการช่วยเหลือ)", alsoActive: ["/eoc/flood/vulnerable-persons"] },
      { key: "affected", group: "พื้นที่และประชาชน", name: "ผู้ได้รับผลกระทบ", path: "/eoc/flood/affected", iconKey: "people" },
      { key: "health", group: "การแพทย์และทีม", name: "โรคและสุขภาพ", path: "/eoc/flood/health", iconKey: "health", description: "ผู้ป่วยในศูนย์พักพิงและในชุมชนช่วงน้ำท่วม" },
      { key: "team-reports", group: "การแพทย์และทีม", name: "รายงานประจำวันรายอำเภอ", path: "/eoc/flood/team-reports", iconKey: "daily", description: "MCATT หน่วยแพทย์ MERT จ่ายยา Doxy และการแจกจ่ายทรัพยากร" },
      { key: "team", group: "การแพทย์และทีม", name: "ทีมปฏิบัติการ", path: "/eoc/flood/operations-team", iconKey: "team" },
      { key: "supplies", group: "ทรัพยากร", name: "เวชภัณฑ์และคลังยา", path: "/eoc/flood/supplies", iconKey: "inventory", description: "ยอดตั้งต้น รายงานรับเข้า/ใช้ไปประจำวัน dashboard รายการใกล้หมด" },
      { key: "oxygen", group: "ทรัพยากร", name: "ออกซิเจนเหลว", path: "/eoc/flood/oxygen", iconKey: "inventory", description: "คงเหลือของแต่ละโรงพยาบาล ใช้ได้อีกกี่วัน" },
      { key: "it-support", group: "ทรัพยากร", name: "รายงาน IT support", path: "/eoc/flood/it-support", iconKey: "server", description: "ปัญหาระบบ อินเทอร์เน็ต อุปกรณ์ และการแก้ไข" }
    ]
  },
  disease: {
    label: "โรคระบาด",
    pathPrefixes: ["/eoc/disease", "/eoc/dengue"],
    items: () => [
      { key: "overview", name: "ภาพรวมสถานการณ์", path: "/eoc/disease/overview", iconKey: "overview" },
      { key: "command", name: "จัดการ EOC", path: "/eoc/disease/management", iconKey: "command" },
      { key: "records", name: "บันทึกรายงานผู้ป่วย", path: "/eoc/disease/records", iconKey: "records" },
      { key: "facility-reports", name: "รายงานจากหน่วยบริการ", path: "/eoc/disease/records?tab=facility", iconKey: "health" },
      { key: "daily", name: "สรุปรายวัน", path: "/eoc/disease/daily-risk", iconKey: "daily" },
      { key: "map", name: "แผนที่", path: "/eoc/disease/map", iconKey: "map" },
      { key: "vulnerable", name: "กลุ่มเปราะบาง", path: "/eoc/disease/vulnerable-groups", iconKey: "vulnerable", description: "ยอดรายหมู่บ้าน และรายบุคคลบนแผนที่", alsoActive: ["/eoc/disease/vulnerable-persons"] },
      { key: "it-support", name: "รายงาน IT support", path: "/eoc/disease/it-support", iconKey: "server", description: "ปัญหาระบบ อินเทอร์เน็ต อุปกรณ์ และการแก้ไข" }
    ]
  },
  "festival-accidents": {
    label: "อุบัติเหตุช่วงเทศกาล",
    pathPrefixes: ["/eoc/festival-accidents", "/eoc/accident"],
    items: () => [
      { key: "overview", name: "ภาพรวมเทศกาล", path: "/eoc/festival-accidents", iconKey: "overview" },
      { key: "records", name: "บันทึกอุบัติเหตุ", path: "/eoc/accident/records", iconKey: "accident" },
      { key: "service-points", name: "จุดบริการชั่วคราว", path: "/eoc/accident/service-points", iconKey: "checkpoint" },
      { key: "compare", name: "เปรียบเทียบเทศกาล", path: "/eoc/festival-accidents/compare", iconKey: "compare" }
    ]
  }
};

function eventTitle(type, status) {
  const definition = EVENT_MODULES[type];
  const name = type === "disease" && status?.disease_name ? status.disease_name : definition.label;
  return status?.session_number ? `${name} ครั้งที่ ${status.session_number}` : name;
}

/**
 * ส่วน "เหตุการณ์ที่เปิดอยู่": แสดงทุก EOC ที่เปิดอยู่ (ขยายไว้)
 * และแสดง EOC ที่ปิดแล้วเฉพาะเมื่อกำลังเปิดหน้าของ EOC นั้นอยู่ (ป้าย "ปิดแล้ว")
 */
/** เมนูของเหตุการณ์หนึ่ง: จัดกลุ่ม/ลำดับตามที่แอดมินตั้ง + ป้ายทีมที่บันทึกได้ */
export function eventMenuItems(type, { sessionId = null, overrides = {}, layout = {} } = {}) {
  const definition = EVENT_MODULES[type];
  if (!definition) return [];
  return applyMenuLayout(type, definition.items({ sessionId }), layout)
    .map((item) => ({ ...item, ownerLabel: ownerLabel(type, item.key, overrides) }));
}

export function buildEventSections({ eocStatus = {}, pathname = "", overrides = {}, layout = {} }) {
  return Object.entries(EVENT_MODULES)
    .map(([type, definition]) => {
      const status = eocStatus[type];
      const isActive = Boolean(status?.is_active);
      const onPage = definition.pathPrefixes.some((prefix) => pathname.startsWith(prefix));
      if (!isActive && !onPage) return null;
      return {
        section: `event-${type}`,
        key: `event-${type}`,
        group: "events",
        title: eventTitle(type, status),
        eocType: type,
        eventState: isActive ? "open" : "closed",
        collapsible: true,
        defaultExpanded: isActive || onPage,
        items: eventMenuItems(type, { sessionId: status?.session_id || null, overrides, layout })
      };
    })
    .filter(Boolean);
}

/**
 * เมนูเหตุการณ์สำหรับเจ้าหน้าที่ (ไม่ใช่แอดมิน): เหมือนของแอดมิน แต่
 * - แสดงเฉพาะเหตุการณ์ที่เปิดอยู่ซึ่งผู้ใช้ได้รับมอบหมาย
 * - เมนูของกลุ่มภารกิจอื่นติดป้าย readOnly (เปิดดูได้ บันทึกไม่ได้)
 */
export function buildOfficerEventSections({ eocStatus = {}, assignments = [], role = "staff", overrides = {}, layout = {} } = {}) {
  return Object.entries(EVENT_MODULES)
    .map(([type, definition]) => {
      const status = eocStatus[type];
      if (!status?.is_active) return null;
      const mine = assignments.filter((item) => item?.eoc_type === type && (!status.session_id || Number(item.session_id ?? item.eoc_session_id) === Number(status.session_id)));
      if (!mine.length && role !== "commander") return null;
      // เมนูเหมือนแอดมินทุกข้อ (ลำดับ/ชื่อเดียวกัน) — เมนูที่กำหนดทีมเจ้าของแล้วติดป้ายดูอย่างเดียวสำหรับทีมอื่น
      const items = eventMenuItems(type, { sessionId: status.session_id || null, overrides, layout })
        .map((item) => ({ ...item, readOnly: !moduleEditAccess({ role, memberships: mine, moduleKey: item.key, owners: resolveOwners(type, item.key, overrides) }).canEdit }));
      // งานของกลุ่มภารกิจที่ผู้ใช้สังกัด (รายงานประจำวัน + งานเฉพาะที่ยังไม่อยู่ในเมนูเหตุการณ์)
      const myTeams = new Set(mine.map((item) => normalizeTeamCode(item.team_code)).filter(Boolean));
      const shownPaths = new Set(items.map((item) => item.path));
      const teamItems = TEAM_CODES
        .filter((code) => myTeams.has(code))
        .flatMap((code) => createTeamWorkItems(type, code))
        .filter((item) => !shownPaths.has(item.path));
      items.push(...teamItems);
      if (!items.length) return null;
      return {
        section: `event-${type}`,
        key: `event-${type}`,
        group: "events",
        title: eventTitle(type, status),
        eocType: type,
        eventState: "open",
        collapsible: true,
        defaultExpanded: true,
        items
      };
    })
    .filter(Boolean);
}

export function buildAdminMenu({ eocStatus = {}, pathname = "", overrides = {}, layout = {} } = {}) {
  const events = buildEventSections({ eocStatus, pathname, overrides, layout });
  const anyOpen = events.some((section) => section.eventState === "open");

  return [
    {
      section: "overview",
      title: "ภาพรวม",
      audience: "ทุกบทบาท",
      items: [
        { name: "หน้าหลัก", path: "/dashboard", iconKey: "home" },
        { name: "สถานะความพร้อมเจ้าหน้าที่", path: "/admin/officer-readiness", iconKey: "readiness", description: "ใครพร้อม/มาไม่ได้/ต้องการความช่วยเหลือ สรุปรายทีม ปรับสถานะแทนได้" },
        { name: "วิเคราะห์ข้อมูล", path: "/analytics", iconKey: "analytics" },
        { name: "แนวโน้มน้ำและฝน", path: "/eoc/hydro-trends", iconKey: "flood", description: "กราฟฝนรายวัน ระดับน้ำในคลอง และน้ำทะเลหนุน 7/30/90 วัน" }
      ]
    },
    {
      section: "events-heading",
      title: "เหตุการณ์ที่เปิดอยู่",
      group: "events-heading",
      emptyMessage: anyOpen ? null : "ยังไม่มีเหตุการณ์ที่เปิดอยู่",
      items: anyOpen ? [] : [{ name: "เปิด EOC", path: "/admin/eoc-management", iconKey: "power" }]
    },
    ...events,
    {
      section: "pending",
      title: "งานรอดำเนินการ",
      audience: "แอดมิน",
      items: [
        { name: "คำขอจากประชาชน", path: "/admin/incident-reports", iconKey: "inbox", badge: "pendingReports", description: "คำขอความช่วยเหลือ จุดปัญหา และรายงานเส้นทาง — ตรวจก่อนเผยแพร่" },
        { name: "คำขอสมัครเจ้าหน้าที่", path: "/admin/officers?tab=requests", iconKey: "userCheck", badge: "pendingRegistrations", description: "อนุมัติหรือปฏิเสธบัญชีที่สมัครใหม่" }
      ]
    },
    {
      section: "registry",
      title: "ข้อมูลกลาง",
      audience: "แอดมิน",
      collapsible: true,
      defaultExpanded: false,
      description: "ข้อมูลที่ใช้ร่วมกันทุกเหตุการณ์",
      items: [
        { name: "ทะเบียนศูนย์พักพิง", path: "/eoc/shelters?tab=registry", iconKey: "shelter" },
        { name: "ทะเบียนกลุ่มเปราะบาง", path: "/eoc/vulnerable-groups", iconKey: "vulnerable" },
        { name: "หน่วยบริการสุขภาพ", path: "/admin/health-facilities", iconKey: "health" },
        { name: "หมู่บ้านและพื้นที่", path: "/admin/village-polygons", iconKey: "map" },
        { name: "ทรัพยากร IT", path: "/admin/it-resources", iconKey: "server" },
        { name: "ข้อมูลอ้างอิงอื่น", path: "/admin/master-data/agencies", iconKey: "database", description: "หน่วยงาน โรค ภัย ความเสี่ยง เส้นทาง" }
      ]
    },
    {
      section: "communication",
      title: "สื่อสาร",
      audience: "แอดมิน · ผบ.",
      // ช่วงมีเหตุการณ์เปิดอยู่ พับเมนูทั่วไปไว้ ให้เมนูเหตุการณ์อยู่ใกล้มือ
      collapsible: anyOpen,
      defaultExpanded: !anyOpen,
      items: [
        { name: "ประกาศ", path: "/announcements", iconKey: "megaphone" },
        { name: "คลังอินโฟกราฟิก", path: "/admin/upload-infographics", iconKey: "image", description: "อัปโหลดภาพอินโฟกราฟิก แสดงในหน้าประกาศและความรู้ของประชาชน" },
        { name: "แจ้งเตือนประชาชน", path: "/admin/public-alerts", iconKey: "announcements", description: "ส่งเตือนภัยเข้ามือถือประชาชน ข้อความสำเร็จรูป การส่งอัตโนมัติ" }
      ]
    },
    {
      section: "system",
      title: "บริหารระบบ",
      audience: "แอดมิน",
      collapsible: true,
      defaultExpanded: false,
      items: [
        { name: "ตั้งค่าระบบ", path: "/admin/settings", iconKey: "settings", description: "สถานะระบบ แจ้งเตือน การเชื่อมต่อ ความปลอดภัย สำรองข้อมูล" },
        { name: "เปิด/ปิด EOC", path: "/admin/eoc-management", iconKey: "power" },
        { name: "ประวัติเหตุการณ์", path: "/admin/eoc-sessions", iconKey: "history" },
        { name: "เจ้าหน้าที่และสิทธิ์", path: "/admin/officers", iconKey: "users" },
        { name: "ผู้ใช้ประชาชน", path: "/admin/citizens", iconKey: "people" },
        { name: "ตรวจคุณภาพข้อมูล", path: "/admin/data-management", iconKey: "database" },
        { name: "ประวัติการใช้งาน", path: "/admin/activity-logs", iconKey: "log" },
        { name: "ผู้เข้าชม", path: "/admin/visitors", iconKey: "visitors", description: "ใครเข้าชมระบบ จาก IP และตำแหน่งโดยประมาณใด (ประวัติความปลอดภัย)" },
        { name: "ถังขยะ", path: "/admin/trash", iconKey: "trash", description: "ข้อมูลที่ถูกลบ กู้คืนได้" }
      ]
    },
    {
      section: "account",
      title: "บัญชีของฉัน",
      items: [
        { name: "สถานะของฉัน", path: "/eoc/readiness", iconKey: "myStatus", description: "รายงานว่าพร้อมปฏิบัติงานหรือไม่" },
        { name: "โปรไฟล์", path: "/profile", iconKey: "profile" },
        { name: "คู่มือการใช้งาน", path: "/eoc/guide", iconKey: "guide", description: "คู่มือเจ้าหน้าที่ และคู่มือผู้ดูแลระบบ (แท็บด้านบน)", alsoActive: ["/eoc/guide/admin"] }
      ]
    }
  ];
}

/** ตรงกับเมนูไหน: เทียบ path และ query ที่ระบุในเมนู (เช่น ?tab=registry) */
/** จัดเมนูของเหตุการณ์เป็นกลุ่มตาม item.group (เมนูที่ไม่มีกลุ่มรวมไว้กลุ่มเดียวไม่มีหัวข้อ) */
export function groupMenuItems(items = []) {
  const groups = [];
  for (const item of items) {
    const title = item.group || "";
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.items.push(item);
    else groups.push({ title, items: [item] });
  }
  return groups;
}

export function isMenuItemActive(item, pathname, search = "") {
  // หน้าที่เป็นส่วนหนึ่งของเมนูนี้ (เช่น แผนที่รายบุคคลอยู่ใต้ "กลุ่มเปราะบาง")
  if ((item.alsoActive || []).some((path) => pathname === path || pathname === `${path}/`)) return true;
  const [itemPath, itemQuery = ""] = item.path.split("?");
  if (pathname !== itemPath && !(itemPath !== "/" && pathname === `${itemPath}/`)) return false;
  // เทียบเฉพาะ "แท็บ" — เมนูที่ไม่ระบุแท็บคือแท็บเริ่มต้นของหน้า จึงไม่ active เมื่อกำลังดูแท็บอื่น
  const currentTab = new URLSearchParams(search).get("tab") || "";
  const wantedTab = new URLSearchParams(itemQuery).get("tab") || "";
  return currentTab === wantedTab;
}
